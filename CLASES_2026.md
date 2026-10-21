# Huellas · Clases 2026 para Intermedio y Grande

Esta corrección se aplica sobre el proyecto que ya incorpora las clases de los grupos, correspondiente al commit `f0ac468` («CLASES GRUPOS»). Quita la atribución de autor de la cita y del relato de «Raíces». El ZIP contiene solamente tres archivos modificados: `server/lessons-2026.js`, `tests/content-2026.test.mjs` y esta guía. No es un proyecto completo.

## Actualización con GitHub Desktop

1. En GitHub Desktop, abrí tu repositorio de Huellas y usá **Fetch origin / Pull origin** para tener los últimos cambios. Podés guardar un commit de respaldo si tenés modificaciones propias pendientes.
2. Descomprimí el ZIP fuera del repositorio. Copiá **su contenido** a la raíz del proyecto, al mismo nivel que `package.json`, `app.js` y `build.mjs`. Reemplazá los archivos existentes cuando lo solicite el sistema.
3. Conservá las carpetas `server/` y `tests/`: combiná sus contenidos con las carpetas existentes. No reemplaces ni borres las carpetas completas. No crees una carpeta adicional con el nombre del ZIP dentro del proyecto.
4. En GitHub Desktop deben aparecer los tres archivos indicados al comienzo de esta guía. Revisá los cambios, hacé **Commit to main** y después **Push origin**.
5. Esperá que Vercel termine el despliegue automático y comprobá la colección desde Mi perfil. Si una pestaña estaba abierta, recargala para solicitar el catálogo actualizado.

No necesitás ejecutar SQL, crear tablas, agregar variables de entorno ni modificar la configuración de Vercel o Neon. La preferencia de grupo continúa guardándose con el sistema existente. Este parche no cambia la migración de grupos ya instalada.

## Archivos de la incorporación original de clases (referencia)

| Ruta | Cambio |
| --- | --- |
| `server/lessons-2026.js` | Nuevo contenido de las 12 clases, sus 279 referencias y materiales desplegables. Permanece fuera de la carpeta pública. |
| `server/studies.js` | Asocia la nueva colección a `intermedio` y `grande`, compartiendo los mismos objetos de contenido. |
| `atlas-d.webp` | Seis ilustraciones nuevas en el formato de atlas existente. |
| `atlas-e.webp` | Cuatro ilustraciones nuevas y dos celdas transparentes sin utilizar. |
| `build.mjs` | Incluye únicamente los dos atlas nuevos entre los recursos públicos adicionales. |
| `app.js` | Permite atribuir las citas históricas a su fuente y explicar las clases que no incluyen pasajes bíblicos. La salida de las 15 clases anteriores conserva el formato existente. |
| `groups-ui.js` | Actualiza la versión del módulo de lectura para cargar ese ajuste. |
| `tests/content-2026.test.mjs` | Pruebas de contenido, asociaciones, referencias, recursos y ampliación futura. |
| `tests/groups.test.mjs` | Actualiza las expectativas: los dos grupos ahora tienen 12 clases. |
| `tests/public-build.test.mjs` | Comprueba también que el nuevo contenido no pueda descargarse como archivo público. |
| `CLASES_2026.md` | Esta guía. |

No se incluyen credenciales reales, archivos de entorno, dependencias, música, PDFs/PPTXs originales ni el directorio generado `dist/`.

## Colección incorporada

Los dos grupos reciben la misma colección 2026 y el mismo orden. Los temas con fecha identificable siguen su secuencia; los dos recorridos históricos quedan al final.

| Nº | Clase | Referencias | Ilustración |
| --- | --- | --- | --- |
| 01 | La Santa Cena | 20 | Copa y pan nuevos · `d`, celda 0 |
| 02 | Defendiendo mi fe | 7 | Escudo existente · `a`, celda 0 |
| 03 | Soy amigo de Jesús | 122 | Manos unidas nuevas · `d`, celda 1 |
| 04 | La lógica de Dios: Naamán | 13 | Vasija y agua nuevas · `d`, celda 2 |
| 05 | La sala de espera de Dios | 7 | Reloj de arena existente · `a`, celda 3 |
| 06 | Los cuatro evangelios | 5 | Cuatro pergaminos nuevos · `d`, celda 3 |
| 07 | Más allá de la apariencia | 10 | Máscara de cristal nueva · `d`, celda 4 |
| 08 | Baal vive | 3 | Altar y llama nuevos · `d`, celda 5 |
| 09 | La oración perseverante | 24 | Manos en oración nuevas · `e`, celda 0 |
| 10 | Ángeles y el hombre | 62 | Alas simbólicas nuevas · `e`, celda 1 |
| 11 | Personajes de la historia de la Iglesia | 0 | Pergamino y pluma nuevos · `e`, celda 2 |
| 12 | Historia de la Asamblea Cristiana | 6 | Lámpara de aceite nueva · `e`, celda 3 |

### Decisiones de integración

- **Santa Cena:** las dos presentaciones se complementan y forman una sola clase. Se conservaron las referencias adicionales del borrador, incluida Colosenses 1:13–14.
- **Defendiendo mi fe:** se unificaron las dos presentaciones. Su enfoque sobre los tipos de fe y el Credo amplía el de «Cómo defender la fe» de Adolescentes, por lo que tiene contenido e identificador propios. Comparte el escudo, sin modificarlo.
- **La sala de espera:** la presentación nueva también desarrolla a Jacob y Génesis 25–27. Se creó una adaptación ampliada para los dos grupos, con el identificador `sala-de-espera-de-dios`. La clase anterior `sala-de-espera` y su reloj de arena permanecen intactos.
- **Soy amigo de Jesús:** el resumen principal conserva el formato de Huellas. El plan de once semanas queda en seis desplegables que reúnen las semanas tal como estaban agrupadas en el original, con sus 108 entradas y pasajes. Es material opcional, separado de la lectura principal.
- **Dos citas del material:** «Santiago 3:23» se aclara como Santiago 2:23, el pasaje sobre Abraham amigo de Dios. Marcos 15:14–17 se conserva identificado como la cita del original; se añade Juan 15:14–17 para la enseñanza sobre la amistad. Las aclaraciones son visibles en un desplegable. Comprobación textual: [Santiago 2:23](https://www.biblegateway.com/passage/?search=Santiago+2%3A23&version=RVR1960) y [Juan 15:14–17](https://www.biblegateway.com/passage/?search=Juan+15%3A14-17&version=RVR1960).
- **La oración:** mantiene tanto la parábola de la viuda y el juez como el desarrollo del Padre Nuestro.
- **Ángeles y el hombre:** conserva la distinción entre los textos bíblicos y las conclusiones o límites señalados por la propia presentación. Las alas son una representación simbólica.
- **Historia de la Iglesia:** se mantiene como clase distinta de la historia de la Asamblea Cristiana. No se inventan pasajes para una presentación que no los cita. El cierre explica esa ausencia.
- **Historia de la Asamblea Cristiana:** conserva el contexto pentecostal, la llegada a la Argentina, Villa Devoto, Mendoza y las generaciones posteriores. El relato y la cita destacada se muestran sin atribución de autor. Los relatos de experiencias se presentan como testimonios históricos; sus distintas corrientes no se confunden con una única organización.

Las actividades iniciales, diapositivas repetidas y elementos decorativos se omitieron del resumen. Las menciones bíblicas de los ejemplos iniciales sí se conservaron. Los metadatos `sourceFiles` y `references[].sources` permiten identificar las fuentes dentro del archivo protegido.

## Animaciones y recursos

`art.js` conserva exactamente el motor anterior. Los atlas nuevos tienen 1536 × 1024 píxeles, distribuidos en tres columnas y dos filas de celdas de 512 × 512. El catálogo y el canvas usan las mismas coordenadas. El armado, la dispersión de triángulos, la interacción del cursor y el movimiento reducido siguen funcionando con la implementación existente.

Las diez ilustraciones se generaron individualmente con la herramienta integrada de generación de imágenes y se empaquetaron como WebP con transparencia. Los dos atlas añaden aproximadamente 530 KiB de imágenes al proyecto. No se añaden librerías de animación ni nuevas descargas de audio.

Para reproducir el estilo, los prompts utilizados combinaron este encargo común con cada tema: una única escultura de cristal de estilo low-poly, facetas triangulares nítidas, volumen, bordes luminosos discretos y silueta reconocible; composición cuadrada centrada con margen generoso; fondo realmente transparente; sin paisaje, suelo, textos, marcas de agua ni símbolos de cruz. Los temas y paletas fueron:

| Recurso | Tema del prompt |
| --- | --- |
| `atlas-d.webp`, 0 | Copa sencilla de comunión junto a un pequeño pan partido, cristal ámbar y dorado con reflejos celestes. |
| `atlas-d.webp`, 1 | Dos manos estrechadas en amistad, composición compacta, cristal verde jade y turquesa. |
| `atlas-d.webp`, 2 | Ánfora antigua con una cinta de agua del río alrededor de su base, cristal cobre y turquesa. |
| `atlas-d.webp`, 3 | Exactamente cuatro pergaminos antiguos en abanico, sin escritura, cristal marfil y ámbar. |
| `atlas-d.webp`, 4 | Máscara antigua partida verticalmente, con luz cálida entre las mitades, cristal lavanda e índigo. |
| `atlas-d.webp`, 5 | Altar de bloques de piedra con una llama, sin estatua, cristal azul pizarra, rubí y ámbar. |
| `atlas-e.webp`, 0 | Dos manos juntas en oración, dedos hacia arriba, cristal celeste y turquesa. |
| `atlas-e.webp`, 1 | Dos alas unidas en la base y abiertas hacia arriba, sin cuerpo ni halo, cristal blanco perla y azul hielo. |
| `atlas-e.webp`, 2 | Pergamino parcialmente abierto con una pluma en diagonal, sin escritura, cristal marfil y bronce. |
| `atlas-e.webp`, 3 | Lámpara antigua de aceite con asa y una sola llama, cristal ámbar y dorado con reflejos turquesa. |

## Pruebas realizadas

- **72 pruebas del proyecto:** contenido, autenticación, sesiones, verificación, grupos, permisos, filtros administrativos, reproductor y build público. Todas aprobadas.
- **14 escenarios de integración con DOM y audio simulados:** acceso inicial, cambios de grupo, recuperación de errores, vista previa administrativa, las doce rutas de cada grupo, referencias, catálogo, flechas, teclado y continuidad de la instancia musical. Todos aprobados.
- **36 escenarios con canvas nativo y el `GeometryArt` original:** doce clases en escritorio, doce en tamaño móvil y doce con movimiento reducido. Se comprobó carga de imágenes, fragmentos, avance de cuadros, reloj de inicio y ausencia de reinicios por interacción del cursor.
- Comparación contra el repositorio base: `lessons.js`, `art.js`, estilos, atlas originales, logo, login, endpoints de autenticación, reproductor, audio, manifiesto, instalación PWA, migraciones y configuración de Vercel permanecen sin cambios.
- El build continúa excluyendo los datos de clases y el código del servidor del directorio público. Las clases se entregan mediante los endpoints autenticados existentes.

Estas comprobaciones se realizaron localmente. No se desplegó el parche, no se modificó Neon y no se realizó una prueba visual en navegadores o dispositivos físicos desde este entorno.

### Comprobación después del despliegue

1. **Adolescentes:** ingresar y recorrer las 15 clases; comprobar sus ilustraciones y un enlace anterior, por ejemplo `#rut/claves`.
2. **Intermedio:** seleccionarlo desde Mi perfil y comprobar 12 clases, numeración 01–12 y catálogo completo.
3. **Grande:** seleccionarlo y comprobar las mismas 12 clases. Recargar y entrar desde otro dispositivo para confirmar que Neon recupera el grupo guardado.
4. **Navegación:** recorrer cada clase con flechas, catálogo y teclado; ir de la última a la primera. En móvil, probar también el gesto sobre la ilustración.
5. **Armado:** comprobar los triángulos de las diez imágenes nuevas y los dos recursos compartidos en escritorio y móvil. Con movimiento reducido activado deben mostrarse sin el armado animado.
6. **Música:** reproducir una canción, cambiar de clase y de grupo, abrir el catálogo y cerrar paneles. La canción debe continuar en su posición.
7. **Lectura:** abrir los desplegables del plan de once semanas, los del Padre Nuestro y algunas referencias bíblicas. En la clase histórica sin citas debe verse la explicación, sin enlaces vacíos.
8. **Administración:** previsualizar ambas colecciones desde el panel y comprobar que la preferencia personal no cambia.
9. **PWA:** abrir la aplicación instalada en Android e iPhone, recargar y probar los grupos. Nombre e ícono deben seguir siendo Huellas.

## Incorporar clases diferentes más adelante

La colección compartida actual vive una sola vez en `server/lessons-2026.js`. Sus asociaciones actuales están en `server/studies.js`.

Para una clase nueva exclusiva de un grupo, incorporá su objeto al conjunto `studyLessons` y añadí una asociación específica fuera del bloque de clases compartidas:

```js
{ lessonId: 'id-unico-de-la-clase', groupIds: ['intermedio'], collectionId: '2026', order: 13, published: true }
```

Para Grande se usa `groupIds: ['grande']`; para compartir, `['intermedio', 'grande']`. Una misma clase no necesita duplicar su contenido. No agregues una clase exclusiva a `lessonsIntermedioGrande2026`, porque ese conjunto se asigna intencionalmente a los dos grupos.

Para otra colección, agregá su definición a `studyCollections`, incorporá los datos al conjunto de contenido y usá su `collectionId` en las asociaciones. La navegación, los contadores, la elección de grupo, los perfiles y Neon no necesitan cambios. Los recursos visuales nuevos se incorporan en atlas adicionales y se agregan al listado público de `build.mjs`.

Para deshacer esta actualización, revertí su commit desde GitHub Desktop. No hay cambios de base de datos que revertir.
