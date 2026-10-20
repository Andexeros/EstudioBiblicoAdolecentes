import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { lessons } from '../lessons.js';
import { lessonsIntermedioGrande2026 as added } from '../server/lessons-2026.js';
import { studyLessons, studyForGroup, studyAssignments, studyCollections } from '../server/studies.js';

const ids = ['santa-cena', 'defendiendo-mi-fe', 'amigo-de-jesus', 'naaman-logica-de-dios',
  'sala-de-espera-de-dios', 'evangelios-cuatro-miradas', 'fariseos-corazon', 'baal-vive',
  'oracion-perseverante', 'angeles-y-el-hombre', 'historia-iglesia-personajes', 'historia-asamblea-cristiana'];
const get = id => added.find(lesson => lesson.id === id);

test('both new collections share the same objects in the approved order without duplicating content', () => {
  assert.deepEqual(added.map(lesson => lesson.id), ids);
  const intermedio = studyForGroup('intermedio'), grande = studyForGroup('grande');
  assert.deepEqual(intermedio.lessons.map(lesson => lesson.id), ids);
  assert.deepEqual(grande.lessons.map(lesson => lesson.id), ids);
  for (let i = 0; i < ids.length; i++) {
    assert.equal(intermedio.lessons[i], grande.lessons[i]);
    assert.equal(grande.lessons[i], added[i]);
  }
  assert.equal(new Set(studyLessons.map(lesson => lesson.id)).size, 27);
  assert.deepEqual(studyForGroup('adolescentes').lessons, lessons);
  assert(lessons.every(lesson => !ids.includes(lesson.id)));
});

test('every added study fits the existing renderer, has source provenance and complete reference links', () => {
  const sourceFiles = new Set();
  for (const lesson of added) {
    for (const key of ['id','name','category','description','summary','storyTitle','story','conclusionTitle','conclusion','application','symbol','artWord','artCaption']) {
      assert.equal(typeof lesson[key], 'string', `${lesson.id}.${key}`); assert(lesson[key].trim(), `${lesson.id}.${key}`);
    }
    assert.match(lesson.color, /^#[0-9a-f]{6}$/i);
    assert.equal(lesson.headline.length, 2); assert(lesson.headline.every(text => typeof text === 'string' && text.trim()));
    assert(lesson.timeline.length >= 3); assert(lesson.points.length >= 4);
    assert(Number.isInteger(lesson.minutes) && lesson.minutes > 0);
    lesson.sourceFiles.forEach(name => sourceFiles.add(name));
    const referenceSet = new Set(lesson.references.map(ref => ref.label));
    assert.equal(referenceSet.size, lesson.references.length, `${lesson.id}: duplicate passages`);
    for (const ref of lesson.references) { assert(ref.label.trim()); assert(ref.topic.trim()); assert(ref.sources.length); }
    for (const ref of [lesson.anchor.reference, ...lesson.points.map(point => point.ref), ...(lesson.extra || []).flatMap(section => section.items.map(item => item.ref))].filter(Boolean)) {
      for (const part of ref.split(';').map(text => text.trim())) assert(referenceSet.has(part), `${lesson.id}: missing ${part}`);
    }
  }
  assert.equal(sourceFiles.size, 14, 'all supplied presentations are represented');
});

test('the two Santa Cena and two Defendiendo mi fe sources are consolidated without changing the earlier studies', () => {
  assert.equal(get('santa-cena').sourceFiles.length, 2);
  assert.equal(get('defendiendo-mi-fe').sourceFiles.length, 2);
  assert.equal(added.filter(lesson => /santa-cena/.test(lesson.id)).length, 1);
  assert.equal(added.filter(lesson => /defendiendo/.test(lesson.id)).length, 1);
  assert(get('santa-cena').references.some(ref => ref.label === 'Colosenses 1:13–14'));
  assert(get('defendiendo-mi-fe').references.some(ref => ref.label === '2 Timoteo 2:24–25'));
  const original = lessons.find(lesson => lesson.id === 'defender-la-fe');
  assert(studyForGroup('adolescentes').lessons.includes(original));
  assert.deepEqual(get('defendiendo-mi-fe').art, original.art);
});

test('the expanded waiting-room class includes Jacob and reuses the original illustration without replacing the adolescent lesson', () => {
  const original = lessons.find(lesson => lesson.id === 'sala-de-espera'), expanded = get('sala-de-espera-de-dios');
  assert.notEqual(original, expanded); assert.notEqual(original.id, expanded.id);
  assert.match(expanded.story, /Jacob/);
  assert(expanded.references.some(ref => ref.label === 'Génesis 25–27'));
  assert.deepEqual(expanded.art, original.art);
});

test('the eleven-week reading plan is optional, complete and documents the mistaken source citations', () => {
  const friend = get('amigo-de-jesus');
  const plan = friend.extra.filter(section => /^Semana/.test(section.title));
  assert.equal(plan.length, 6, 'the original groups of weeks 1, 2–3, 4–5, 6–7, 8–9 and 10–11');
  assert(plan.reduce((count, section) => count + section.items.length, 0) > 90);
  assert(friend.references.some(ref => ref.label === 'Santiago 2:23' && ref.sourceLabel.includes('3:23')));
  assert(!friend.references.some(ref => ref.label === 'Santiago 3:23'));
  for (const label of ['Marcos 15:14–17','Juan 15:14–17','Mateo 24:23–26','Lucas 17:10']) assert(friend.references.some(ref => ref.label === label), label);
});

test('the prayer study includes the Padre Nuestro and the historical study does not invent Bible citations', () => {
  assert(get('oracion-perseverante').extra[0].items.length >= 8);
  assert.deepEqual(get('historia-iglesia-personajes').references, []);
  assert.equal(get('historia-iglesia-personajes').anchor.reference, null);
  assert(get('historia-iglesia-personajes').anchor.attribution);
  assert.match(get('historia-asamblea-cristiana').story, /Alfredo Borgia/);
});

test('new artwork uses the original atlas format and only the ten new illustration cells', async () => {
  const cells = new Set();
  for (const lesson of added) {
    const [atlas, cell] = lesson.art;
    assert(['a','d','e'].includes(atlas)); assert(Number.isInteger(cell) && cell >= 0 && cell < 6);
    const path = new URL(`../atlas-${atlas}.webp`, import.meta.url);
    assert((await stat(path)).size > 1000);
    if (atlas !== 'a') cells.add(`${atlas}${cell}`);
  }
  assert.equal(cells.size, 10);
  for (const atlas of ['d','e']) {
    const bytes = await readFile(new URL(`../atlas-${atlas}.webp`, import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(), 'RIFF'); assert.equal(bytes.subarray(8,12).toString(), 'WEBP');
  }
});

test('future separate assignments, years, drafts and empty collections keep working with the same navigation source', () => {
  const future = { id: '2027', label: 'Colección 2027', year: 2027 };
  const assignments = [...studyAssignments, { lessonId: ids[0], groupIds: ['intermedio'], collectionId: '2027', order: 1, published: true }];
  assert.deepEqual(studyForGroup('intermedio', '2027', studyLessons, assignments, [...studyCollections, future]).lessons, [added[0]]);
  assert.equal(studyForGroup('grande', '', studyLessons, assignments, [...studyCollections, future]).collection.id, '2026');
  assert.deepEqual(studyForGroup('intermedio', '2026', studyLessons, [], studyCollections).lessons, []);
});
