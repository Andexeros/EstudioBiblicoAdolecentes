# Cambios de identidad e instalación

Versión 1.1.0 · 19/10/2026. Base: última entrega «Huellas-Vercel-sin-carpetas.zip» de esta conversación.

## Revisión inicial

La versión de base no tenía manifiesto de aplicación, íconos PWA, código de instalación ni service worker. `app.js` cambiaba el título del documento con cada clase. Los recursos ya se encontraban en una sola carpeta para facilitar su carga a GitHub.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `index.html` | Biblia en el encabezado; descripción de adolescentes en escritorio; título y metadatos estables; manifiesto e íconos; botón dentro del catálogo; diálogo de instrucciones y estado accesible. |
| `app.js` | Título fijo «Huellas · Estudios Bíblicos». Las flechas de navegación quedan suspendidas mientras cualquiera de los diálogos esté abierto. |
| `favicon.svg` | Nueva Biblia sobre fondo oscuro. El enlace incluye una versión para actualizar la caché. |
| `build.mjs` | Copia los recursos nuevos a `dist`, incluidos manifiesto e íconos. |
| `serve.mjs` | Tipo MIME correcto para `.webmanifest` en pruebas locales. |
| `vercel.json` | Revalidación de recursos y tipo MIME explícito del manifiesto. Conserva la configuración de compilación y las cabeceras de seguridad. |
| `package.json` | Versión 1.1.0 y descripción institucional. Conserva los comandos y la ausencia de dependencias. |
| `README.md` | Instrucciones actualizadas de carga, publicación y pruebas. |

## Archivos nuevos

| Archivo | Función |
| --- | --- |
| `manifest.webmanifest` | Identidad estable: `id`, `start_url` y `scope` en `/`, nombre completo, nombre corto Huellas, descripción, modo standalone y cuatro íconos. El año no forma parte de la identidad. |
| `huellas-biblia.svg` | Marca vectorial reutilizable, transparente, celeste y sin cruz. |
| `identity.css` | Estilos limitados a la marca, botón y diálogo de instalación; adaptación móvil y foco visible. |
| `install.js` | `beforeinstallprompt`, eventos de un solo uso y `appinstalled`; instrucciones según dispositivo; detección de standalone, cierre y restauración del catálogo. |
| `huellas-icon-192-v2.png`, `huellas-icon-512-v2.png` | Íconos generales con fondo oscuro opaco. |
| `huellas-maskable-192-v2.png`, `huellas-maskable-512-v2.png` | Íconos con margen seguro para máscaras del sistema. |
| `huellas-apple-touch-180-v2.png` | Ícono de pantalla de inicio para Apple. |
| `huellas-favicon-16-v2.png`, `huellas-favicon-32-v2.png` | Alternativas PNG del favicon para tamaños pequeños. |
| `GUIA_PWA.md`, `CAMBIOS_PWA.md` | Pruebas de publicación e instalación y registro de cambios. |

## Archivos conservados sin modificar

Se compararon byte a byte con el ZIP original: `lessons.js`, `styles.css`, `art.js`, los tres `atlas-*.webp`, `huellas-display.woff`, `references-provenance.json`, `artwork-prompts.json` y `FONT-LICENSE.txt`.

Las quince clases, sus 161 referencias, la animación de fragmentos, los gestos, las URL y los colores de cada estudio se conservan. No se agregó almacenamiento local, seguimiento de usuarios, librerías ni caché offline.

## Comprobaciones de esta entrega

- Compilación con `npm run build` y sintaxis de JavaScript.
- Navegación de las quince clases, referencias, índice, rutas directas, teclado y fragmentos incorrectos.
- Dieciséis escenarios PWA con APIs de navegador simuladas: instalación nativa, aceptación, cancelación, error, instrucciones por dispositivo, modo standalone, cambio de modo, foco, cierre y convivencia de diálogos.
- Dimensiones y opacidad de íconos; área segura maskable; resolución de recursos y manifiesto en la salida compilada.

Las pruebas de DOM no equivalen a una instalación en un teléfono. La revisión visual del sitio en navegador y los cuadros nativos de Android/iOS quedan para las pruebas de `GUIA_PWA.md`.
