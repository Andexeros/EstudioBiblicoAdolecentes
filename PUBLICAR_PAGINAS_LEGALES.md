# Huellas — Páginas públicas de privacidad y términos

Esta actualización agrega dos documentos informativos. No cambia autenticación, aprobación, permisos, grupos, clases, animaciones, música ni PWA. No agrega un registro de aceptación de términos ni un sistema de consentimiento parental.

## Antes de publicar: revisar los datos de contacto

Se utilizó **abelpravata@gmail.com**, el correo del propietario ya identificado en el proyecto, como contacto público para consultas y solicitudes de eliminación. Confirmá que querés recibir allí esas solicitudes. Si preferís un correo institucional, reemplazalo en `privacidad/index.html` y `terminos/index.html`, incluidos sus enlaces `mailto:`.

La información disponible identifica al equipo de Huellas y su localidad, pero no una persona o entidad responsable legalmente identificada ni su domicilio completo. **Completá esa identidad y domicilio en la sección 1 de la política antes de usarla como documento definitivo.** No se inventaron razón social, dirección, inscripción de base de datos ni certificaciones.

Revisá también con quien sea responsable de la comunidad el tratamiento de datos que pueden revelar intereses religiosos, la intervención de responsables de menores cuando corresponda, las transferencias internacionales y los plazos de conservación. El código actual no comprueba edad ni consentimiento parental y conserva auditorías sin vencimiento automático; los documentos lo explican y no afirman que esos mecanismos estén implementados. Una política publicada no reemplaza esos procedimientos ni certifica cumplimiento legal.

Referencias para esa revisión:

- Ley 25.326, especialmente información al titular, datos sensibles y derechos: <https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790/actualizacion>.
- Criterios de la AAIP sobre consentimiento y menores, Resolución 4/2019 y su anexo: <https://www.argentina.gob.ar/normativa/nacional/resolucion-4-2019-318874/texto>.

## Incorporar con GitHub Desktop

1. Hacé una copia de seguridad o asegurate de tener tus cambios actuales guardados en GitHub.
2. Abrí la carpeta local del repositorio desde GitHub Desktop: **Repository → Show in Explorer/Finder**.
3. Extraé el ZIP y copiá su contenido **dentro de la raíz del repositorio**, donde están `package.json`, `index.html` y `vercel.json`. Conservá las carpetas `privacidad/`, `terminos/` y `tests/`. No subas el ZIP ni crees una carpeta contenedora adicional.
4. En GitHub Desktop revisá los ocho archivos indicados más abajo, creá el commit y ejecutá **Push origin**.
5. Esperá a que termine correctamente el despliegue de Vercel.

No copies `dist/` ni `node_modules/`: Vercel genera la salida pública con el comando de build existente.

## URL públicas y Google OAuth

Después del despliegue, las direcciones serán:

- Política de Privacidad: **https://estudiosbiblicossr.vercel.app/privacidad**
- Términos y Condiciones: **https://estudiosbiblicossr.vercel.app/terminos**

En Google Cloud / Google Auth Platform, dentro de **Branding / Información de la aplicación**, usá esas direcciones en los campos de política de privacidad y términos del servicio. La página principal sigue siendo `https://estudiosbiblicossr.vercel.app/`.

Estas páginas **no son callbacks OAuth**: no reemplaces la URL de redirección que indica Neon ni cambies los orígenes o proveedores existentes. Publicar los documentos no habilita Google por sí solo ni garantiza su verificación: Google conserva sus requisitos de dominio y marca. Referencia: <https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance>.

**No hay SQL que ejecutar, variables nuevas en Vercel ni ajustes nuevos en Neon.** Mantené la configuración de autenticación actual. Si tenés activada una protección global de despliegues de Vercel, comprobá que no impida al público y a Google consultar estas páginas en producción; esa protección se configura fuera del código de Huellas.

## Qué se cambió

| Archivo | Cambio |
| --- | --- |
| `privacidad/index.html` | Política pública; datos reales, proveedores, menores, conservación, derechos y solicitud manual de eliminación. |
| `terminos/index.html` | Condiciones públicas sobre cuentas, aprobación, grupos, uso de materiales y contacto. |
| `legal.css` | Estilos exclusivos de los documentos y sus enlaces, con adaptación móvil, foco de teclado e impresión. |
| `index.html` | Enlaces en acceso/registro, confirmación de nombre de Google y pie público, fuera de la aplicación protegida. |
| `build.mjs` | Copia los documentos y su CSS a la salida pública. Los contenidos de las clases siguen excluidos. |
| `vercel.json` | Dos reglas exactas para resolver `/privacidad` y `/terminos` a sus documentos; conserva funciones y cabeceras existentes. |
| `tests/public-build.test.mjs` | Verificación de páginas y recursos públicos, GET/HEAD, rutas con y sin barra, sin llamadas a autenticación ni base de datos. |
| `PUBLICAR_PAGINAS_LEGALES.md` | Esta guía. |

Los enlaces desde el acceso y el pie abren otra pestaña para conservar el formulario o el estudio que estabas viendo. Los documentos públicos no cargan JavaScript, autenticación, reproductor ni clases. Sus enlaces internos funcionan sin JavaScript.

## Pruebas de integración

Con Node.js 24, desde la raíz del proyecto:

```bash
npm ci --omit=peer
npm test
npm run build
```

Después del despliegue:

1. Abrí ambas URL en incógnito, sin iniciar sesión: deben mostrar el documento completo, no el login ni una pantalla pendiente. Probá también `/privacidad/` y `/terminos/`.
2. Desactivá JavaScript en esa ventana y recargá: los documentos, estilos, índice y enlaces deben seguir funcionando.
3. En la página de acceso, entrá a «Crear cuenta» y abrí cada enlace legal. Debe abrirse otra pestaña y conservarse el formulario. Comprobá el pie también estando pendiente de aprobación y con una cuenta aprobada.
4. En un teléfono verificá la lectura, el índice, el correo de contacto y «Volver a Huellas» sin desplazamiento horizontal. Con teclado, usá Tab y el enlace «Ir a…» para saltar al documento; el foco debe ser visible.
5. Verificá registro por correo, ingreso con Google cuando esté configurado, selección de grupo, aprobación y acceso a clases como antes. Un visitante sin sesión o una cuenta pendiente/bloqueada debe seguir sin acceso a `/api/lessons`; las páginas legales sí son públicas.
6. Desde una cuenta aprobada, revisá una clase, sus flechas y catálogo, música y el panel administrativo según el rol. Ninguno de esos archivos ni sus datos fue modificado por esta actualización.
7. Comprobá que los dos enlaces `mailto:` usen el contacto que decidiste publicar. No envían mensajes automáticamente ni crean tickets: abren el cliente de correo para una solicitud manual.

La publicación y la configuración de Google las realizás después de incorporar estos archivos. Las pruebas locales no confirman por sí solas la accesibilidad del despliegue de producción.

## Validación realizada en esta entrega

- **113 pruebas automatizadas aprobadas** con `npm test`, incluidas las comprobaciones existentes de autenticación, aprobación, roles, grupos y reproducción musical.
- `npm run build` completado y `git diff --check` sin errores.
- Los documentos responden a GET y HEAD sin cookies ni llamadas a Neon; se probaron las rutas con y sin barra final y sus recursos locales. Sus índices no tienen destinos faltantes ni identificadores duplicados.
- Se conservan las 12 funciones API de Vercel y sus cabeceras; únicamente se agregaron dos rutas públicas exactas. Los archivos de autenticación, clases, animaciones, grupos, administración, música y PWA permanecen sin cambios.
- La revisión visual con el navegador de pruebas no pudo completarse porque el entorno bloqueó el acceso a la vista local. Quedan pendientes la comprobación visual en móvil/escritorio y la prueba de las URL publicadas indicadas arriba.
