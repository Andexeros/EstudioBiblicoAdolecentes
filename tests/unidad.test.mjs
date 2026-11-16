import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lessonUnidad } from '../server/lessons-unidad-2026.js';
import { studyForGroup, studyLessons } from '../server/studies.js';

test('La unidad opens all three groups from one shared study without duplicating content', () => {
  assert.equal(studyLessons.filter(lesson => lesson.id === lessonUnidad.id).length, 1);
  for (const [group, total] of [['adolescentes', 19], ['intermedio', 15], ['grande', 15]]) {
    const study = studyForGroup(group);
    assert.equal(study.lessons[0], lessonUnidad);
    assert.equal(study.lessons.length, total);
    assert.equal(study.lessons.filter(lesson => lesson.id === lessonUnidad.id).length, 1);
    assert.equal(study.collection.id, '2026');
  }
});

test('La unidad preserves every cited Bible passage and links all its reading sections', () => {
  const passages = [
    'Hechos 9:26', 'Hechos 9:27–28', 'Juan 17:20–21', 'Romanos 15:7', 'Mateo 18:4',
    'Romanos 12:9–10', '1 Corintios 12:12–13', '1 Corintios 12:25–27', 'Efesios 4:1–6',
    'Gálatas 5:22–23', 'Lucas 11:13', 'Hechos 2:42, 46–47', '1 Pedro 3:8', 'Mateo 18:15', 'Efesios 2:14',
  ];
  assert.deepEqual(lessonUnidad.references.map(ref => ref.label), passages);
  for (const ref of lessonUnidad.references) {
    assert(ref.topic.trim());
    assert.deepEqual(ref.sources, lessonUnidad.sourceFiles);
  }
  for (const label of [
    lessonUnidad.anchor.reference, ...lessonUnidad.timeline.map(step => step.ref),
    ...lessonUnidad.points.map(point => point.ref),
    ...lessonUnidad.extra.flatMap(section => section.items.map(item => item.ref)),
  ].filter(Boolean)) assert(passages.includes(label), `Missing reference: ${label}`);
});

test('La unidad uses a separate transparent atlas that fits the existing geometric animation', async () => {
  assert.deepEqual(lessonUnidad.art, ['h-v2', 0]);
  const bytes = await readFile(new URL('../atlas-h-v2.webp', import.meta.url));
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
  assert.equal(bytes.subarray(8, 16).toString(), 'WEBPVP8X');
  assert(bytes[20] & 0x10, 'transparent alpha channel');
  assert.equal(bytes.readUIntLE(24, 3) + 1, 1536);
  assert.equal(bytes.readUIntLE(27, 3) + 1, 1024);
});
