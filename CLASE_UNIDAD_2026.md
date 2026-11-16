# La unidad · Colección 2026

Clase compartida por Adolescentes, Grupo Intermedio y Grupo Grande. Se guarda un único contenido en `server/lessons-unidad-2026.js` y se asocia a los tres grupos desde `server/studies.js`.

## Estructura de la clase

- **Portada:** La unidad. «Derribemos el muro. Acerquémonos en Cristo».
- **Historia:** Saulo y Bernabé. Del temor inicial a un hermano que encuentra su lugar (Hechos 9:26–28).
- **Puntos clave:** la oración de Jesús por la unidad; recibir e integrar; humildad; un solo cuerpo con dones diferentes; cuidado mutuo; guardar la unidad del Espíritu; un carácter transformado por el Espíritu Santo; conversar ante los conflictos; compartir y sostener la hermandad.
- **Para profundizar:** del muro al encuentro. Reconocer barreras, responder con acciones y cuidar los vínculos después de cada encuentro.
- **Conclusión:** Cristo es nuestra paz. Preparar el corazón, dar el primer paso y cultivar relaciones sinceras.
- **Aplicación:** identificar una actitud propia que genera distancia y acercarse a alguien con un gesto concreto de escucha, invitación o acompañamiento.
- **Referencias:** los 15 pasajes citados en el PDF, disponibles con sus enlaces bíblicos.

La actividad inicial se adapta como una reflexión sobre barreras y respuestas. No se copian mensajes del muro, nombres de participantes, bromas ni datos de la actividad externa. Se conserva el contexto de Efesios 2:14 sobre judíos y gentiles antes de su aplicación a nuestras relaciones.

## Ilustración y navegación

`atlas-h-v2.webp` muestra un muro de ladrillos rectangulares con juntas visibles, roto en el centro por dos manos que se estrechan. Los ladrillos desprendidos representan las barreras que caen al recibirnos como hermanos. Usa el mismo sistema de armado, partículas, interacción con el cursor y movimiento reducido de las ilustraciones existentes. La nueva ruta del recurso permite cargar la ilustración actualizada al reabrir la clase. La instrucción de creación se conserva en la entrada `H` de `artwork-prompts.json`.

La clase aparece primera en la colección 2026 de los tres grupos. Los totales son 19 clases en Adolescentes y 15 en cada uno de los otros grupos. Los enlaces anteriores siguen funcionando; el enlace de esta clase es `/#la-unidad`.

No se requieren migraciones SQL, variables nuevas ni cambios en Neon, Vercel, la autenticación o la PWA.

## Comprobación

1. Ejecutar `npm ci --omit=peer`, `npm test` y `npm run build`.
2. Ingresar con una cuenta aprobada de cada grupo: La unidad debe aparecer primero, tanto en la portada como en el catálogo.
3. Revisar historia, puntos clave, las tres secciones desplegables, conclusión y los 15 enlaces bíblicos.
4. Cambiar de clase por flechas y catálogo; verificar el armado del muro en escritorio y celular y el modo de movimiento reducido.
5. Confirmar que las clases anteriores mantienen su contenido, música y navegación y que una cuenta sin aprobación no obtiene el estudio.
