import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NEON_AUTH_SESSION_COOKIE_NAME as TOKEN } from '@neondatabase/auth/server';
import { HttpError } from '../server/http.js';
import { preferencesEndpoint, lessonsEndpoint, usersEndpoint } from '../server/api.js';
import { studyForGroup, studyAssignments } from '../server/studies.js';
import { groupLabel } from '../groups.js';
import { lessons } from '../lessons.js';

const origin = 'https://huellas.example', baseUrl = 'https://auth.example/neondb/auth';
const config = { baseUrl, origin, cookieSecret: 'test-only-secret-01234567890123456789', sessionDataTtl: 60, sameSite: 'lax' };
const timestamp = new Date().toISOString();
const person = { id: 'user-a', name: 'Ana', email: 'ana@example.com', emailVerified: true, createdAt: timestamp, updatedAt: timestamp };
const request = (path = '/api/preferences', body, cookie = `${TOKEN}=test-token`, customOrigin = origin) => new Request(origin + path, {
  method: body === undefined ? 'GET' : 'POST', headers: { Cookie: cookie, Origin: customOrigin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const reject = (promise, code) => assert.rejects(promise, error => error instanceof HttpError && error.code === code);
const sqlResult = rows => {
  const names = Object.keys(rows[0] || { study_group: null });
  return Response.json({ fields: names.map(name => ({ name, dataTypeID: typeof rows[0]?.[name] === 'boolean' ? 16 : 25 })), rows: rows.map(row => names.map(name => typeof row[name] === 'boolean' ? (row[name] ? 't' : 'f') : row[name] ?? null)), rowCount: rows.length, command: 'SELECT' });
};
function backend(t) {
  const saved = new Map(), queries = [], state = { user: { ...person }, member: { status: 'approved', role: 'user', version: 1 } };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).startsWith(baseUrl)) return Response.json(state.user ? {
      user: state.user, session: { id: 'session', token: 'test-token', userId: state.user.id, createdAt: timestamp, updatedAt: timestamp, expiresAt: new Date(Date.now() + 3600000).toISOString() },
    } : null);
    const { query, params } = JSON.parse(init.body); queries.push({ query, params });
    if (query.includes('huellas:membership')) return sqlResult([{ ...state.member, user_id: state.user.id, study_group: saved.get(state.user.id) ?? null }]);
    if (query.includes('huellas:limit')) return sqlResult([{ allowed: true }]);
    if (query.includes('huellas_set_own_group')) { saved.set(params[0], params[1]); state.member.version++; return sqlResult([{ group_id: params[1] }]); }
    if (query.startsWith('INSERT INTO public.huellas_user_preferences')) { saved.set(params[0], params[1]); return sqlResult([]); }
    if (query.startsWith('SELECT study_group')) return sqlResult(saved.has(params[0]) ? [{ study_group: saved.get(params[0]) }] : []);
    if (query.includes('FROM neon_auth')) return sqlResult([{ id: person.id, name: person.name, email: person.email, study_group: saved.get(person.id), total: '1' }]);
    throw new Error('Unexpected query');
  });
  return { saved, queries, state };
}
beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://owner:test-password@ep-test.us-east-2.aws.neon.tech/neondb?sslmode=require';
  process.env.HUELLAS_ADMIN_EMAILS = '';
});

test('a verified existing account without a preference receives onboarding and no class data', async t => {
  const { queries } = backend(t);
  const response = await preferencesEndpoint(request(), config);
  const data = await response.json();
  assert.equal(data.groupId, null); assert.equal(data.study, null); assert.equal(data.access.status, 'approved');
  assert.equal(queries.length, 1);
  await reject(lessonsEndpoint(request('/api/lessons'), config), 'GROUP_REQUIRED');
});
test('saving and retrieving a group survives a different device session cookie', async t => {
  const { saved, queries } = backend(t);
  let result = await (await preferencesEndpoint(request('/api/preferences', { groupId: 'adolescentes' }), config)).json();
  assert.equal(saved.get(person.id), 'adolescentes'); assert.deepEqual(result.study.lessons, lessons);
  assert.equal(queries.filter(item => item.query.includes('huellas_set_own_group')).length, 1, 'one transactional preference write');
  result = await (await preferencesEndpoint(request('/api/preferences', undefined, `${TOKEN}=another-device-session`), config)).json();
  assert.equal(result.groupId, 'adolescentes');
  await preferencesEndpoint(request('/api/preferences', { groupId: 'grande' }), config);
  result = await (await preferencesEndpoint(request(), config)).json();
  assert.equal(result.groupId, 'grande'); assert.deepEqual(result.study.lessons, studyForGroup('grande').lessons);
});
test('preference reads and writes use only the verified session user and remain isolated', async t => {
  const { saved, queries, state } = backend(t);
  saved.set('user-b', 'grande');
  await preferencesEndpoint(request('/api/preferences?userId=user-b', { groupId: 'intermedio' }), config);
  assert.equal(saved.get('user-a'), 'intermedio'); assert.equal(saved.get('user-b'), 'grande');
  assert.equal(queries[0].params[0], person.id);
  await reject(preferencesEndpoint(request('/api/preferences', { groupId: 'grande', userId: 'user-b' }), config), 'INVALID_PREFERENCE');
  state.user = { ...person, id: 'user-b' };
  assert.equal((await (await preferencesEndpoint(request(), config)).json()).groupId, 'grande');
});
test('anonymous, unverified and foreign-origin requests cannot save preferences', async t => {
  const { state, queries } = backend(t);
  state.user = null;
  await reject(preferencesEndpoint(request('/api/preferences', { groupId: 'grande' }, ''), config), 'UNAUTHENTICATED');
  state.user = { ...person, emailVerified: false };
  await reject(preferencesEndpoint(request('/api/preferences', { groupId: 'grande' }), config), 'EMAIL_NOT_VERIFIED');
  state.user = person;
  await reject(preferencesEndpoint(request('/api/preferences', { groupId: 'grande' }, undefined, 'https://foreign.example'), config), 'INVALID_ORIGIN');
  const noOrigin = request('/api/preferences', { groupId: 'grande' }); noOrigin.headers.delete('origin');
  await reject(preferencesEndpoint(noOrigin, config), 'INVALID_ORIGIN'); assert.equal(queries.length, 0);
});
test('unknown groups, injected SQL, missing values and privilege fields cannot reach a mutation', async t => {
  const { queries } = backend(t);
  for (const groupId of ['', null, 123, 'adultos', 'admin', "grande'); DROP TABLE neon_auth.user; --"]) {
    await reject(preferencesEndpoint(request('/api/preferences', { groupId }), config), 'INVALID_GROUP');
  }
  await reject(preferencesEndpoint(request('/api/preferences', { groupId: 'grande', role: 'admin' }), config), 'INVALID_PREFERENCE');
  assert(queries.every(item => item.query.includes('huellas:membership')), 'only authorization reads are allowed');
});
test('preference queries are parameterized and never mutate Neon Auth', async t => {
  const { state, queries } = backend(t);
  state.user = { ...person, id: "user'); DROP TABLE any_table; --" };
  await preferencesEndpoint(request('/api/preferences', { groupId: 'grande' }), config);
  await preferencesEndpoint(request(), config);
  for (const entry of queries) {
    assert(!entry.query.includes(state.user.id));
    assert(!/(?:INSERT INTO|UPDATE|DELETE FROM)\s+neon_auth/i.test(entry.query));
    if (!entry.query.includes('huellas:limit')) assert(entry.params.includes(state.user.id));
  }
});
test('the classes API uses the stored group and ignores a requested user or ordinary group override', async t => {
  const { saved } = backend(t); saved.set(person.id, 'intermedio');
  const data = await (await lessonsEndpoint(request('/api/lessons?group=adolescentes&userId=someone'), config)).json();
  assert.equal(data.groupId, 'intermedio'); assert.deepEqual(data.lessons, studyForGroup('intermedio').lessons);
});
test('group selection never grants administrative access or previews', async t => {
  backend(t);
  for (const groupId of ['adolescentes', 'intermedio', 'grande']) {
    await preferencesEndpoint(request('/api/preferences', { groupId }), config);
    await reject(usersEndpoint(request('/api/users'), config), 'FORBIDDEN');
    await reject(lessonsEndpoint(request('/api/lessons?previewGroup=adolescentes'), config), 'FORBIDDEN');
  }
});
test('administrators can preview any group without changing their preference', async t => {
  const { saved, queries, state } = backend(t); state.member.role = 'owner'; saved.set(person.id, 'grande');
  const result = await (await lessonsEndpoint(request('/api/lessons?previewGroup=adolescentes'), config)).json();
  assert.deepEqual(result.lessons, lessons); assert.equal(saved.get(person.id), 'grande'); assert(queries.every(item => item.query.includes('huellas:membership')));
  await reject(lessonsEndpoint(request('/api/lessons?previewGroup=adultos'), config), 'INVALID_GROUP');
});
test('administrative group filters are validated and parameterized; unassigned users remain visible', async t => {
  const { queries, state } = backend(t); state.member.role = 'owner';
  for (const filter of ['', 'adolescentes', 'intermedio', 'grande', 'unassigned']) {
    await usersEndpoint(request('/api/users?group=' + filter), config);
    const entry = queries.at(-1); assert.equal(entry.params[0], filter); assert.match(entry.query, /LEFT JOIN public\.huellas_user_preferences/);
    assert.match(entry.query, /p\.study_group IS NULL/);
  }
  const count = queries.length;
  await reject(usersEndpoint(request('/api/users?group=admin'), config), 'INVALID_GROUP'); assert.equal(queries.length, count + 1, 'fresh authorization still runs before rejecting a filter');
});
test('Adolescentes preserves the 15 exact lesson objects, order and 161 references', () => {
  const study = studyForGroup('adolescentes'); assert.deepEqual(study.lessons, lessons);
  for (let index = 0; index < lessons.length; index++) assert.equal(study.lessons[index], lessons[index]);
  assert.equal(study.lessons.reduce((total, lesson) => total + lesson.references.length, 0), 161);
  assert.equal(studyAssignments.filter(item => item.groupIds.includes('adolescentes')).length, 15);
});
test('Intermedio and Grande share twelve classes with valid collection metadata and their official names', () => {
  for (const id of ['intermedio', 'grande']) {
    const study = studyForGroup(id); assert.equal(study.groupName, groupLabel(id));
    assert.equal(study.lessons.length, 12); assert.equal(study.collection.id, '2026'); assert.equal(study.collections.length, 1);
  }
  assert.equal(groupLabel('grande'), 'Grupo Grande');
});
test('future years, shared assignments, ordering and unpublished studies need only content configuration', () => {
  const source = [{ id: 'one' }, { id: 'two' }, { id: 'draft' }];
  const assignments = [
    { lessonId: 'one', groupIds: ['adolescentes', 'grande'], collectionId: '2027', order: 2, published: true },
    { lessonId: 'two', groupIds: ['adolescentes'], collectionId: '2027', order: 1, published: true },
    { lessonId: 'draft', groupIds: ['adolescentes'], collectionId: '2027', order: 0, published: false },
    { lessonId: 'one', groupIds: ['adolescentes'], collectionId: '2026', order: 1, published: true },
  ];
  const collections = [{ id: '2026', year: 2026 }, { id: '2027', year: 2027 }];
  assert.deepEqual(studyForGroup('adolescentes', '', source, assignments, collections).lessons, [source[1], source[0]]);
  assert.equal(studyForGroup('adolescentes', '', source, assignments, collections).collection.id, '2027');
  assert.deepEqual(studyForGroup('grande', '2027', source, assignments, collections).lessons, [source[0]]);
  assert.deepEqual(studyForGroup('adolescentes', '2026', source, assignments, collections).lessons, [source[0]]);
  assert.throws(() => studyForGroup('grande', '2026', source, assignments, collections), error => error.code === 'INVALID_COLLECTION');
});
test('public modules contain no protected lessons or SQL migrations', async () => {
  for (const name of ['groups.js', 'groups-ui.js', 'groups.css']) {
    const text = await readFile(new URL('../' + name, import.meta.url), 'utf8');
    assert(!text.includes(lessons[0].story)); assert(!/DATABASE_URL|NEON_AUTH_COOKIE_SECRET/.test(text));
  }
});
