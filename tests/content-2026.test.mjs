import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { lessons } from '../lessons.js';
import { lessonsIntermedioGrande2026 as added } from '../server/lessons-2026.js';
import { lessonEnvidia, lessonEstoicismoEvangelio } from '../server/lessons-noviembre-2026.js';
import { studyLessons, studyForGroup, studyAssignments, studyCollections } from '../server/studies.js';

const ids = ['santa-cena', 'defendiendo-mi-fe', 'amigo-de-jesus', 'naaman-logica-de-dios',
  'sala-de-espera-de-dios', 'evangelios-cuatro-miradas', 'fariseos-corazon', 'baal-vive',
  'oracion-perseverante', 'angeles-y-el-hombre', 'historia-iglesia-personajes', 'historia-asamblea-cristiana', 'santa-cena-octubre'];
const get = id => added.find(lesson => lesson.id === id);

test('the collections open with their assigned November studies and list all classes newest first', () => {
  assert.deepEqual(added.map(lesson => lesson.id), ids);
  const intermedio = studyForGroup('intermedio'), grande = studyForGroup('grande');
  const expected = [lessonEstoicismoEvangelio, ...added.toReversed()];
  for (const { lessons: selected } of [intermedio, grande]) {
    assert.equal(selected.length, expected.length);
    for (const [index, lesson] of expected.entries()) assert.equal(selected[index], lesson);
  }
  assert.equal(studyLessons.length, 30);
  assert.equal(new Set(studyLessons.map(lesson => lesson.id)).size, studyLessons.length);
  const adolescentes = studyForGroup('adolescentes').lessons;
  assert.deepEqual(adolescentes.slice(0, 3), [lessonEnvidia, get('santa-cena-octubre'), get('santa-cena')]);
  assert.deepEqual(adolescentes.slice(3), lessons.toReversed());
  assert.equal(adolescentes[1], intermedio.lessons[1]);
  assert.equal(adolescentes[2], intermedio.lessons.at(-1));
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
  assert.equal(sourceFiles.size, 15, 'the fourteen earlier sources and the new October presentation are represented');
});

test('the earlier Santa Cena and Defendiendo mi fe sources remain consolidated, with October as a separate study', () => {
  assert.equal(get('santa-cena').sourceFiles.length, 2);
  assert.equal(get('defendiendo-mi-fe').sourceFiles.length, 2);
  assert.deepEqual(added.filter(lesson => /santa-cena/.test(lesson.id)).map(lesson => lesson.id), ['santa-cena', 'santa-cena-octubre']);
  assert.equal(added.filter(lesson => /defendiendo/.test(lesson.id)).length, 1);
  assert(get('santa-cena').references.some(ref => ref.label === 'Colosenses 1:13–14'));
  assert(get('defendiendo-mi-fe').references.some(ref => ref.label === '2 Timoteo 2:24–25'));
  const original = lessons.find(lesson => lesson.id === 'defender-la-fe');
  assert(studyForGroup('adolescentes').lessons.includes(original));
  assert.deepEqual(get('defendiendo-mi-fe').art, original.art);
});

test('April keeps its route and October shares its artwork as a distinct study in all three groups', () => {
  const april = get('santa-cena'), october = get('santa-cena-octubre');
  assert.equal(april.name, 'La Santa Cena (abril)');
  assert.equal(october.name, 'La Santa Cena (octubre)');
  assert.notEqual(april.id, october.id);
  assert.deepEqual(october.art, april.art);
  assert.equal(october.color, april.color);
  assert.equal(october.symbol, april.symbol);
  for (const group of ['adolescentes', 'intermedio', 'grande']) {
    const collection = studyForGroup(group).lessons;
    assert.equal(collection.find(lesson => lesson.id === 'santa-cena'), april);
    assert.equal(collection[1], october);
    assert.equal(collection.filter(lesson => lesson.id === october.id).length, 1);
  }
});

test('October preserves all five passages, the last-supper story and the discernment-to-hope structure of its source', () => {
  const october = get('santa-cena-octubre');
  assert.deepEqual(october.references.map(ref => ref.label), [
    '1 Tesalonicenses 5:21–22', 'Efesios 5:11', 'Lucas 22:19–20', '1 Corintios 11:26', 'Juan 11:25–26',
  ]);
  assert.deepEqual(october.sourceFiles, ['POWER POINT LA SANTA CENA 22-10-2026.pptx_20261026_140723_0000.pdf']);
  for (const ref of october.references) assert.deepEqual(ref.sources, october.sourceFiles);
  assert.match(october.story, /Jesús/); assert.match(october.story, /pan/); assert.match(october.story, /copa/);
  assert.match(october.story, /Halloween/); assert.match(october.conclusion, /resurrección/); assert.match(october.conclusion, /regreso/);
  assert.equal(october.points.length, 6); assert.equal(october.timeline.length, 3);
  assert.equal(october.extra.length, 1); assert.equal(october.extra[0].items.length, 3);
  assert.match(october.application, /examinarme antes de participar/);
  const passages = new Set(october.references.map(ref => ref.label));
  for (const event of october.timeline) for (const ref of event.ref.split(';').map(text => text.trim())) assert(passages.has(ref), ref);
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
  assert.equal(get('historia-asamblea-cristiana').anchor.attribution, undefined);
});

test('new artwork uses the original atlas format and only the ten new illustration cells', async () => {
  const cells = new Set();
  for (const lesson of added) {
    const [atlas, cell] = lesson.art;
    assert(['a','d','e','f'].includes(atlas)); assert(Number.isInteger(cell) && cell >= 0 && cell < 6);
    const path = new URL(`../atlas-${atlas}.webp`, import.meta.url);
    assert((await stat(path)).size > 1000);
    if (atlas !== 'a') cells.add(`${atlas}${cell}`);
  }
  assert.equal(cells.size, 10);
  assert.deepEqual(get('amigo-de-jesus').art, ['f', 0]);
  assert.deepEqual(get('historia-asamblea-cristiana').art, ['f', 1]);
  for (const atlas of ['d','e','f']) {
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

test('November preserves the Bible passages and original presentations for both new studies', () => {
  const expected = [
    [lessonEnvidia, 'Clase La Envidia_20261106_212248_0000.pdf', [
      'Éxodo 20:17', 'Marcos 7:21–23', '1 Samuel 18:6–12', 'Proverbios 14:30', 'Santiago 3:14–16', 'Gálatas 5:19–21',
      '1 Corintios 13:4', '1 Corintios 12:26', '1 Timoteo 6:6–8', 'Romanos 12:15', 'Gálatas 5:22–23', 'Lucas 15:25–32',
    ]],
    [lessonEstoicismoEvangelio, 'Clase Estoi co-n Cristo_20261109_131627_0000.pdf', [
      'Gálatas 6:9', 'Romanos 12:2', 'Santiago 1:22', 'Filipenses 4:8', '1 Tesalonicenses 5:18', '1 Juan 5:14',
      'Santiago 1:19–20', '1 Pedro 5:7', 'Santiago 1:2–4', 'Mateo 16:24', 'Juan 3:26–30', 'Gálatas 2:20',
    ]],
  ];
  for (const [lesson, source, passages] of expected) {
    assert.deepEqual(lesson.sourceFiles, [source]);
    assert.deepEqual(lesson.references.map(ref => ref.label), passages);
    for (const ref of lesson.references) assert.deepEqual(ref.sources, [source]);
    for (const label of [
      lesson.anchor.reference, ...lesson.timeline.map(step => step.ref), ...lesson.points.map(point => point.ref),
      ...lesson.extra.flatMap(section => section.items.map(item => item.ref)),
    ].filter(Boolean)) assert(passages.includes(label), `${lesson.id}: missing ${label}`);
  }
});

test('the two November illustrations share a transparent 3 by 2 atlas with distinct cells', async () => {
  assert.deepEqual(lessonEnvidia.art, ['g', 0]);
  assert.deepEqual(lessonEstoicismoEvangelio.art, ['g', 1]);
  const bytes = await readFile(new URL('../atlas-g.webp', import.meta.url));
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
  assert.equal(bytes.subarray(8, 16).toString(), 'WEBPVP8X');
  assert(bytes[20] & 0x10, 'alpha flag');
  assert.equal(bytes.readUIntLE(24, 3) + 1, 1536);
  assert.equal(bytes.readUIntLE(27, 3) + 1, 1024);
});
