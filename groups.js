// Public labels only. Study contents and assignments stay on the server.
export const studyGroups = Object.freeze([
  { id: 'adolescentes', name: 'Adolescentes', description: 'Historias y enseñanzas para acompañar tu camino de fe.' },
  { id: 'intermedio', name: 'Grupo Intermedio', description: 'Un espacio para seguir creciendo juntos en la Palabra.' },
  { id: 'grande', name: 'Grupo Grande', description: 'Estudios para profundizar y compartir nuestra fe.' },
]);
export const groupById = id => studyGroups.find(group => group.id === id) || null;
export const groupLabel = id => groupById(id)?.name || 'Sin grupo';
