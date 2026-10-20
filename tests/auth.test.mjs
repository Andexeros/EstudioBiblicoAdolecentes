import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import {
  NEON_AUTH_SESSION_COOKIE_NAME as TOKEN, NEON_AUTH_SESSION_DATA_COOKIE_NAME as CACHE,
  NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME as CHALLENGE,
} from '@neondatabase/auth/server';
import { configuration, fromNode, toNode, nodeHandler, HttpError, bodyJSON } from '../server/http.js';
import { authProxy, authReturn, getSession, safeHash, isAdmin } from '../server/auth.js';
import { sessionEndpoint, lessonsEndpoint, usersEndpoint } from '../server/api.js';
import { recordAccess, registeredUsers } from '../server/access.js';
import { lessons } from '../lessons.js';

const origin = 'https://huellas.example';
const baseUrl = 'https://auth.example/neondb/auth';
const config = { baseUrl, origin, cookieSecret: 'test-only-random-secret-0123456789-abcdef', sessionDataTtl: 60, sameSite: 'lax' };
const now = new Date().toISOString();
const user = { id: 'u-123', email: 'alguien@example.com', name: 'Alguien', emailVerified: true, createdAt: now, updatedAt: now };
const envelope = (person = user, expiresAt = new Date(Date.now() + 86400000).toISOString()) => ({
  user: person, session: { id: 's-123', token: 'opaque-session', userId: person.id, createdAt: now, updatedAt: now, expiresAt },
});
const cookie = `${TOKEN}=opaque-session`;
function req(path, { method = 'GET', body, cookies, headers = {} } = {}) {
  return new Request(origin + path, { method, headers: { Origin: origin, ...headers,
    ...(cookies ? { Cookie: cookies } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function upstream(t, responder) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const item = { url: String(url), method: init.method || 'GET', headers: new Headers(init.headers), body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(item);
    return responder(item);
  });
  return calls;
}
const rejectCode = (promise, code) => assert.rejects(promise, error => error instanceof HttpError && error.code === code);
function responseCookies(response) { return response.headers.getSetCookie().map(value => value.split(';')[0]).join('; '); }
function fakeSQL(rows) {
  const names = Object.keys(rows[0] || { id: '' });
  return Response.json({ fields: names.map(name => ({ name, dataTypeID: 25 })), rows: rows.map(row => names.map(name => row[name])), rowCount: rows.length, command: 'SELECT' });
}

beforeEach(() => {
  process.env.NEON_AUTH_BASE_URL = baseUrl;
  process.env.NEON_AUTH_COOKIE_SECRET = config.cookieSecret;
  process.env.HUELLAS_SITE_URL = origin;
  process.env.HUELLAS_ADMIN_EMAILS = '';
  process.env.HUELLAS_GOOGLE_ENABLED = 'false';
  delete process.env.DATABASE_URL;
});

test('anonymous visitors cannot retrieve classes or the user directory', async t => {
  const calls = upstream(t, () => { throw new Error('No network request expected'); });
  await rejectCode(lessonsEndpoint(req('/api/lessons'), config), 'UNAUTHENTICATED');
  await rejectCode(usersEndpoint(req('/api/users'), config), 'UNAUTHENTICATED');
  assert.equal((await (await sessionEndpoint(req('/api/session'), config)).json()).user, null);
  assert.equal(calls.length, 0);
});

test('a verified session returns all original classes without session tokens', async t => {
  process.env.DATABASE_URL = 'postgresql://owner:fake-password@ep-test.us-east-2.aws.neon.tech/neondb?sslmode=require';
  upstream(t, item => item.url.startsWith(baseUrl) ? Response.json(envelope()) : fakeSQL([{ study_group: 'adolescentes' }]));
  const response = await lessonsEndpoint(req('/api/lessons', { cookies: cookie }), config);
  assert.deepEqual((await response.json()).lessons, lessons);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  const session = await (await sessionEndpoint(req('/api/session', { cookies: cookie }), config)).json();
  assert.equal(session.user.id, user.id);
  assert.equal(session.user.token, undefined);
  assert.equal(session.session, undefined);
  assert.equal(session.isAdmin, false);
});

test('unverified, expired, mismatched or revoked sessions cannot read classes', async t => {
  let data = envelope({ ...user, emailVerified: false });
  upstream(t, () => Response.json(data));
  await rejectCode(lessonsEndpoint(req('/api/lessons', { cookies: cookie }), config), 'EMAIL_NOT_VERIFIED');
  data = envelope(user, new Date(Date.now() - 60000).toISOString());
  await rejectCode(lessonsEndpoint(req('/api/lessons', { cookies: cookie }), config), 'UNAUTHENTICATED');
  data = envelope(); data.session.userId = 'other-user';
  await rejectCode(lessonsEndpoint(req('/api/lessons', { cookies: cookie }), config), 'UNAUTHENTICATED');
  data = null;
  await rejectCode(lessonsEndpoint(req('/api/lessons', { cookies: cookie }), config), 'UNAUTHENTICATED');
});

test('the real SDK signs its cache; forged cache falls back to upstream validation', async t => {
  let revoked = false;
  t.mock.method(console, 'warn', () => {});
  const calls = upstream(t, () => Response.json(revoked ? null : envelope()));
  const first = await getSession(req('/api/session', { cookies: cookie }), config);
  const jar = cookie + '; ' + first.cookies.map(value => value.split(';')[0]).join('; ');
  assert(jar.includes(CACHE + '='));
  const count = calls.length;
  assert.equal((await getSession(req('/api/session', { cookies: jar }), config)).user.id, user.id);
  assert.equal(calls.length, count, 'a valid SDK cache avoids repeated upstream requests');
  revoked = true;
  const forged = cookie + '; ' + CACHE + '=eyJhbGciOiJIUzI1NiJ9.forged.signature';
  assert.equal((await getSession(req('/api/session', { cookies: forged }), config)).user, null);
  assert(calls.length > count);
  assert.equal((await getSession(req('/api/session', { cookies: jar.split(';').filter(item => !item.trim().startsWith(TOKEN + '=')).join(';') }), config)).user, null);
});

test('fresh administrator validation bypasses the signed session cache', async t => {
  let revoked = false;
  upstream(t, () => Response.json(revoked ? null : envelope()));
  const first = await getSession(req('/api/session', { cookies: cookie }), config);
  const jar = cookie + '; ' + first.cookies.map(value => value.split(';')[0]).join('; ');
  revoked = true;
  assert.equal((await getSession(req('/api/session', { cookies: jar }), config, true)).user, null);
  process.env.HUELLAS_ADMIN_EMAILS = ' ALGUIEN@example.com,otra@example.com ';
  assert.equal(isAdmin(user), true);
  assert.equal(isAdmin({ ...user, emailVerified: false }), false);
  assert.equal(isAdmin({ ...user, email: 'ajeno@example.com' }), false);
});

test('foreign origins, missing POST origin and unsupported proxy endpoints are rejected', async () => {
  const body = { email: user.email, password: 'a-valid-password' };
  await rejectCode(authProxy(req('/api/auth/sign-in/email', { method: 'POST', body, headers: { Origin: 'https://ajeno.example' } }), config), 'INVALID_ORIGIN');
  const missing = req('/api/auth/sign-in/email', { method: 'POST', body }); missing.headers.delete('Origin');
  await rejectCode(authProxy(missing, config), 'INVALID_ORIGIN');
  await rejectCode(lessonsEndpoint(req('/api/lessons', { headers: { 'Sec-Fetch-Site': 'cross-site' } }), config), 'INVALID_ORIGIN');
  await rejectCode(authProxy(req('/api/auth/admin/list-users', { method: 'POST', body: {} }), config), 'NOT_FOUND');
  await rejectCode(authProxy(req('/api/auth/sign-in/email'), config), 'METHOD_NOT_ALLOWED');
});

test('sign-in keeps tokens HttpOnly, preserves multiple cookies and forces a local callback', async t => {
  const calls = upstream(t, item => {
    if (item.url.endsWith('/get-session')) return Response.json(envelope());
    const headers = new Headers();
    headers.append('Set-Cookie', `${TOKEN}=opaque-session; Path=/; HttpOnly; SameSite=None; Secure; Partitioned`);
    headers.append('Set-Cookie', `${CHALLENGE}=challenge; Path=/; HttpOnly; Secure`);
    headers.set('set-auth-token', 'do-not-expose');
    return Response.json({ token: 'opaque-session', user, redirect: false }, { headers });
  });
  const response = await authProxy(req('/api/auth/sign-in/email', { method: 'POST', body: {
    email: user.email, password: 'a-valid-password', rememberMe: false, returnHash: '#rut/referencias',
    callbackURL: 'https://attacker.example/', role: 'admin', token: 'attacker',
  } }), config);
  assert.deepEqual(await response.json(), { user: { id: user.id, name: user.name, email: user.email, emailVerified: true, createdAt: user.createdAt } });
  assert.equal(response.headers.has('set-auth-token'), false);
  const cookies = response.headers.getSetCookie();
  assert(cookies.length >= 3);
  for (const value of cookies) { assert.match(value, /HttpOnly/i); assert.match(value, /Secure/i); assert.match(value, /SameSite=Lax/i); assert.doesNotMatch(value, /Partitioned/i); }
  const sent = calls.find(item => item.url.endsWith('/sign-in/email'));
  assert.equal(sent.body.callbackURL, origin + '/api/auth-return?next=%23rut%2Freferencias');
  assert.equal(sent.body.rememberMe, false);
  assert.equal(sent.body.role, undefined);
  assert.equal(sent.headers.get('origin'), origin);
  assert.equal(sent.headers.get('x-neon-auth-middleware'), 'true');
});

test('registration, OTP and password recovery use only the expected payloads', async t => {
  const calls = upstream(t, () => Response.json({ status: true }));
  await authProxy(req('/api/auth/sign-up/email', { method: 'POST', body: { name: '  Ana   Pérez ', email: ' ana@example.com ', password: '12345678', returnHash: 'https://evil.example' } }), config);
  assert.equal(calls[0].body.name, 'Ana Pérez');
  assert.equal(calls[0].body.email, 'ana@example.com');
  assert.equal(calls[0].body.callbackURL, origin + '/api/auth-return?next=');
  await authProxy(req('/api/auth/email-otp/verify-email', { method: 'POST', body: { email: user.email, otp: '123456' } }), config);
  assert.deepEqual(calls[1].body, { email: user.email, otp: '123456' });
  await authProxy(req('/api/auth/request-password-reset', { method: 'POST', body: { email: user.email, redirectTo: 'https://evil.example' } }), config);
  assert.deepEqual(calls[2].body, { email: user.email, redirectTo: origin + '/?auth=reset' });
  await authProxy(req('/api/auth/reset-password', { method: 'POST', body: { token: 'reset-token', newPassword: 'new-password', userId: 'other-user' } }), config);
  assert.deepEqual(calls[3].body, { token: 'reset-token', newPassword: 'new-password' });
  await rejectCode(authProxy(req('/api/auth/email-otp/verify-email', { method: 'POST', body: { email: user.email, otp: 'wrong' } }), config), 'INVALID_OTP');
  await rejectCode(authProxy(req('/api/auth/sign-up/email', { method: 'POST', body: { name: 'Ana', email: user.email, password: 'short' } }), config), 'INVALID_PASSWORD');
});

test('Google is opt-in and cannot accept arbitrary provider tokens or callback URLs', async t => {
  const calls = upstream(t, () => Response.json({ url: 'https://accounts.google.com/o/oauth2/auth', redirect: true }));
  const social = () => req('/api/auth/sign-in/social', { method: 'POST', body: { provider: 'other', idToken: { token: 'injected' }, callbackURL: 'https://evil.example', returnHash: '#jonas' } });
  await rejectCode(authProxy(social(), config), 'GOOGLE_NOT_ENABLED');
  assert.equal(calls.length, 0);
  process.env.HUELLAS_GOOGLE_ENABLED = 'true';
  await authProxy(social(), config);
  assert.equal(calls[0].body.provider, 'google');
  assert.equal(calls[0].body.idToken, undefined);
  assert.equal(new URL(calls[0].body.callbackURL).origin, origin);
});

test('OAuth callback exchanges challenge and verifier, then returns to a valid class URL', async t => {
  const calls = upstream(t, item => Response.json(envelope(), { headers: item.url.includes('neon_auth_session_verifier=') ? { 'Set-Cookie': `${TOKEN}=opaque-session; Path=/; HttpOnly; Secure` } : {} }));
  const callback = '/api/auth-return?next=%23rut%2Fclaves&neon_auth_session_verifier=valid-verifier';
  const first = await authReturn(req(callback, { cookies: `${CHALLENGE}=challenge`, headers: { 'Sec-Fetch-Site': 'cross-site' } }), config);
  assert.equal(first.status, 302);
  const url = new URL(first.headers.get('Location'));
  assert.equal(url.searchParams.has('neon_auth_session_verifier'), false);
  assert(calls.some(item => item.url.includes('/get-session?') && item.url.includes('valid-verifier')));
  const second = await authReturn(req(url.pathname + url.search, { cookies: responseCookies(first) }), config);
  assert.equal(second.headers.get('Location'), origin + '/#rut/claves');
  const invalid = await authReturn(req('/api/auth-return?next=https://attacker.example'), config);
  assert.equal(new URL(invalid.headers.get('Location')).origin, origin);
  assert.equal(safeHash('#rut/referencias'), '#rut/referencias');
  assert.equal(safeHash('#rut/../../evil'), '');
});

test('logout clears token, cache and OAuth challenge cookies even after upstream rejection', async t => {
  upstream(t, () => Response.json({ code: 'INVALID_SESSION' }, { status: 401 }));
  const response = await authProxy(req('/api/auth/sign-out', { method: 'POST', body: {}, cookies: cookie }), config);
  assert.equal(response.status, 200);
  for (const name of [TOKEN, CACHE, CHALLENGE]) assert(response.headers.getSetCookie().some(value => value.startsWith(name + '=') && /Max-Age=0/i.test(value)));
});

test('only a verified allowlisted administrator may query registered users', async t => {
  upstream(t, () => Response.json(envelope()));
  await rejectCode(usersEndpoint(req('/api/users', { cookies: cookie }), config), 'FORBIDDEN');
  process.env.HUELLAS_ADMIN_EMAILS = user.email;
  await rejectCode(usersEndpoint(req('/api/users?offset=0%20OR%201=1', { cookies: cookie }), config), 'INVALID_PAGE');
  await rejectCode(usersEndpoint(req('/api/users', { cookies: cookie }), config), 'DATABASE_NOT_CONFIGURED');
});

test('access tracking and admin pagination parameterize SQL rather than interpolating user input', async t => {
  process.env.DATABASE_URL = 'postgresql://owner:fake-password@ep-test.us-east-2.aws.neon.tech/neondb?sslmode=require';
  const calls = upstream(t, item => fakeSQL(item.body.query.includes('SELECT')
    ? Array.from({ length: 51 }, (_, i) => ({ id: String(i), name: 'Ana', email: 'ana@example.com', total: '101' })) : []));
  const userId = "u'); DROP TABLE example; --";
  await recordAccess(userId);
  assert.equal(calls[0].body.params[0], userId);
  assert(!calls[0].body.query.includes(userId));
  assert.match(calls[0].body.query, /ON CONFLICT/);
  const page = await registeredUsers(50);
  assert.equal(page.users.length, 50); assert.equal(page.hasMore, true); assert.equal(page.total, 101);
  assert.equal(calls[1].body.params.at(-1), '50');
  assert.match(calls[1].body.query, /neon_auth\."user"/);
});

test('Node/Vercel bridge preserves cookie headers and rejects oversized or injected requests', async () => {
  const input = Object.assign(Readable.from([]), { method: 'POST', url: '/api/auth/sign-out', body: {}, headers: { origin, 'content-type': 'application/json', host: 'attacker.example', authorization: 'Bearer injected', 'x-neon-auth-middleware': 'injected' } });
  const request = await fromNode(input, config);
  assert.equal(new URL(request.url).origin, origin);
  assert.equal(request.headers.has('authorization'), false);
  assert.equal(request.headers.has('x-neon-auth-middleware'), false);
  assert.deepEqual(await request.json(), {});
  await rejectCode(fromNode({ ...input, url: 'https://attacker.example/' }, config), 'INVALID_URL');
  await rejectCode(fromNode({ ...input, body: 'x'.repeat(16385) }, config), 'BODY_TOO_LARGE');
  await rejectCode(bodyJSON(new Request(origin, { method: 'POST', body: '{}' })), 'JSON_REQUIRED');
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', 'a=1; Path=/; HttpOnly'); response.headers.append('Set-Cookie', 'b=2; Path=/; HttpOnly');
  const headers = {}; let output;
  const res = { setHeader: (k, v) => { headers[k.toLowerCase()] = v; }, end: b => { output = b; } };
  await toNode(res, response);
  assert.equal(headers['set-cookie'].length, 2); assert.equal(JSON.parse(output).ok, true);
});

test('configuration errors fail closed without disclosing secrets', async () => {
  delete process.env.NEON_AUTH_COOKIE_SECRET;
  assert.throws(configuration, error => error.code === 'AUTH_NOT_CONFIGURED');
  let output; const headers = {};
  const res = { setHeader: (k, v) => { headers[k] = v; }, end: b => { output = JSON.parse(b); } };
  await nodeHandler(lessonsEndpoint)({ method: 'GET', url: '/api/lessons', headers: {} }, res);
  assert.equal(res.statusCode, 503); assert.equal(output.code, 'AUTH_NOT_CONFIGURED');
  assert(!JSON.stringify(output).includes(baseUrl));
});
