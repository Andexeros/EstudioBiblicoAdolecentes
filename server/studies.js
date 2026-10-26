import { lessons } from '../lessons.js';
import { lessonsIntermedioGrande2026 } from './lessons-2026.js';
import { groupById } from '../groups.js';
import { HttpError } from './http.js';

// Full content exists once; assignments can share it across groups and collections.
export const studyLessons = [...lessons, ...lessonsIntermedioGrande2026];
export const studyCollections = [{ id: '2026', label: 'Colección 2026', year: 2026 }];
export const studyAssignments = [
  ...[
  'jonas', 'rut', 'mi-error', 'derrota', 'sala-de-espera', 'voluntad-de-dios',
  'nuevo-nacimiento', 'tentacion', 'ruido', 'ayuno-y-oracion', 'alabanza',
  'congregarnos', 'verdad', 'defender-la-fe', 'apocalipsis',
  ].map((lessonId, index) => ({ lessonId, groupIds: ['adolescentes'], collectionId: '2026', order: index + 1, published: true })),
  ...lessonsIntermedioGrande2026.map((lesson, index) => ({ lessonId: lesson.id, groupIds: ['intermedio', 'grande'], collectionId: '2026', order: index + 1, published: true })),
  { lessonId: 'santa-cena', groupIds: ['adolescentes'], collectionId: '2026', order: lessons.length + 1, published: true },
  { lessonId: 'santa-cena-octubre', groupIds: ['adolescentes'], collectionId: '2026', order: lessons.length + 2, published: true },
  // Add future assignment objects here; groupIds may contain several groups.
];

export function studyForGroup(groupId, collectionId = '', source = studyLessons, assignments = studyAssignments, collections = studyCollections) {
  const group = groupById(groupId);
  if (!group) throw new HttpError(400, 'INVALID_GROUP', 'Elegí uno de los grupos disponibles.');
  const available = collections.filter(collection => assignments.some(item => item.published === true && item.collectionId === collection.id && item.groupIds.includes(groupId)))
    .sort((a, b) => b.year - a.year || b.id.localeCompare(a.id));
  // Empty groups still have a named collection, without invented lessons.
  if (!available.length && collections.length) available.push([...collections].sort((a, b) => b.year - a.year)[0]);
  const collection = collectionId ? available.find(item => item.id === collectionId) : available[0];
  if (!collection) throw new HttpError(400, 'INVALID_COLLECTION', 'La colección no está disponible para este grupo.');
  const byId = new Map(source.map(lesson => [lesson.id, lesson]));
  const seen = new Set();
  const selected = assignments.filter(item => item.published === true && item.groupIds.includes(groupId) && item.collectionId === collection.id)
    .sort((a, b) => a.order - b.order || a.lessonId.localeCompare(b.lessonId))
    .flatMap(item => { const lesson = byId.get(item.lessonId); if (!lesson || seen.has(item.lessonId)) return []; seen.add(item.lessonId); return [lesson]; });
  return { groupId, groupName: group.name, collection, collections: available, lessons: selected };
}
