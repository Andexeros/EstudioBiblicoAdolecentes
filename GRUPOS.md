# Huellas — grupos de estudio

Este parche se preparó sobre el commit `0facf12` del repositorio actual. Conserva las 15 clases y sus 161 referencias, ilustraciones, animaciones, reproductor musical, cuentas y sesiones. Los grupos oficiales son **Adolescentes**, **Grupo Intermedio** y **Grupo Grande**.

## 1. Ejecutar la migración en Neon

Hacelo **antes de subir el parche a GitHub**. La versión anterior puede seguir funcionando con la tabla nueva; la nueva versión necesita esa tabla para leer las preferencias.

1. Entrá al proyecto de Neon que Huellas ya utiliza.
2. Abrí **SQL Editor** y seleccioná la **rama y base de datos que corresponden a `DATABASE_URL` en Vercel**. No crees otra base ni otra rama para producción.
3. Seleccioná el **mismo rol propietario utilizado por `DATABASE_URL`**, igual que al configurar `huellas_access`. No hace falta compartir ni modificar esa contraseña.
4. Abrí el archivo **`migrations/20261020-user-groups.sql`** incluido en este ZIP. Copiá **todo** su contenido y ejecutalo.
5. Verificá la creación con esta consulta de lectura:

```sql
SELECT current_user AS rol_actual, schemaname, tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'huellas_user_preferences';
```

Debe aparecer una fila y el propietario debe ser el rol usado por el servidor. El script crea una tabla con `user_id`, `study_group`, `created_at` y `updated_at`, un índice por grupo y las restricciones de acceso. Puede repetirse sin borrar preferencias existentes. No inserta grupos por defecto ni modifica tablas internas de Neon Auth.

La seguridad por filas queda habilitada, sin políticas de acceso directo desde el navegador, igual que en la tabla existente `huellas_access`. El backend usa el rol propietario y valida la sesión antes de leer o guardar el `user_id` autenticado. Si usás un rol de conexión distinto al propietario, debe revisarse esa configuración antes de desplegar; no desactives la protección para resolver un error de permisos.

Después de elegir un grupo desde Huellas, podés comprobar el guardado en el SQL Editor con:

```sql
SELECT user_id, study_group, updated_at
FROM public.huellas_user_preferences
ORDER BY updated_at DESC
LIMIT 20;
```

Los valores internos válidos son `adolescentes`, `intermedio` y `grande`. Los nombres visibles se mantienen separados y siempre muestran las denominaciones oficiales.

## 2. Incorporar los archivos con GitHub Desktop

1. Extraé el ZIP. Contiene solamente archivos nuevos y modificados, sin carpeta contenedora adicional.
2. En GitHub Desktop, abrí el repositorio de Huellas y descargá los cambios pendientes de origen, si los hay.
3. Abrí la carpeta local del repositorio y copiá allí **el contenido** del ZIP, al lado de `package.json`. Combiná las carpetas `api`, `server`, `tests` y `migrations`; reemplazá los archivos coincidentes.
4. Revisá los cambios, hacé Commit y luego Push origin.
5. Esperá que Vercel termine el despliegue en estado **Ready** y recargá la web/PWA.

No hace falta volver a subir audios, ilustraciones, clases ni íconos: esos archivos siguen siendo los del repositorio. No se ejecutó ninguna migración en tu Neon ni se modificó producción durante la preparación de este parche.

## 3. Vercel y configuración

- **No hay variables de entorno nuevas.** Se utiliza el `DATABASE_URL` existente.
- Conservá `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `HUELLAS_ADMIN_EMAILS` y el resto de la configuración que ya funciona.
- La variable existente `HUELLAS_SITE_URL` debe seguir coincidiendo con el dominio real del proyecto, actualmente `https://estudiosbiblicossr.vercel.app`. Si el acceso ya funciona allí, no la cambies por este parche.
- El comando de compilación continúa siendo `npm run build`, con salida `dist`. La instalación de Vercel sigue usando `npm ci --omit=peer`.
- El endpoint nuevo es `/api/preferences`. La migración y los contenidos protegidos no se copian al directorio público `dist`.
- Se actualizó la versión del módulo de acceso en `index.html` para solicitar el código nuevo al recargar. No se agregó caché offline ni se modificaron íconos, identificador, nombre o modo de instalación de la PWA.

## 4. Comportamiento

Una cuenta nueva completa registro y verificación con el flujo existente. Después, si no tiene grupo, ve la bienvenida con tres opciones y **Continuar a mis estudios**. Esto también ocurre en el próximo acceso de las cuentas existentes sin preferencia. No se pide edad ni información adicional.

Una cuenta con grupo guardado entra directamente a sus estudios. Neon es la fuente principal: iniciar sesión desde otro dispositivo recupera la misma preferencia, sin depender de localStorage.

Desde **Mi perfil → Mi grupo de estudio**, se elige una opción y se pulsa **Guardar grupo**. La respuesta del servidor incluye la colección correspondiente, sin recargar la página, cerrar la sesión o recrear el reproductor musical.

Adolescentes mantiene las 15 clases originales. Grupo Intermedio y Grupo Grande muestran **Próximamente** y permiten volver al perfil. El catálogo sigue disponible para instalar la app incluso cuando todavía no hay clases.

El administrador conserva sus permisos por la configuración existente, independientemente de su grupo. Puede filtrar usuarios por cada grupo o **Sin grupo**. En su perfil, **Consultar otros grupos** abre una vista de administración sin guardar un cambio de preferencia; un aviso permite volver a sus propios estudios.

## 5. Agregar clases y colecciones posteriormente

Los contenidos permanecen en **`lessons.js`**, con el formato que ya utiliza Huellas. Cada clase conserva su identificador único y sus campos existentes: nombre, descripción, temática, historia, puntos clave, conclusión, referencias, recursos visuales y configuración de ilustración.

Las asociaciones se administran en **`server/studies.js`**:

- `studyCollections`: identificador, etiqueta y año de cada colección.
- `studyAssignments`: `lessonId`, `groupIds`, `collectionId`, `order` y `published` de cada asociación.

Para una clase futura, agregá su contenido completo a `lessons.js` y una asociación como esta, usando el identificador real de la clase que incorporemos:

```js
{ lessonId: 'id-real-de-la-clase', groupIds: ['intermedio'], collectionId: '2026', order: 1, published: true }
```

Para compartir ese mismo contenido con Grupo Grande, usá `groupIds: ['intermedio', 'grande']`. No dupliques el objeto de la clase. `published: false` impide incluirla en las respuestas del catálogo.

Para una colección nueva, agregá por ejemplo `{ id: '2027', label: 'Colección 2027', year: 2027 }` a `studyCollections` y sus asociaciones. La colección más reciente disponible se abre inicialmente; cuando haya varias, el catálogo mostrará un selector de colección. Las cantidades, el orden y la navegación se calculan automáticamente.

No se crearon contenidos provisionales. Las futuras ilustraciones deberán seguir el formato de recursos visuales del sistema actual y agregarse a la copia de recursos del build cuando corresponda. No será necesario rehacer autenticación, perfiles, preferencias ni configuración de Neon.

## 6. Archivos del parche

**Nuevos:**

- `groups.js`: nombres y descripciones públicas de los tres grupos.
- `groups-ui.js`: bienvenida, perfil, cambio de colección y vista administrativa.
- `groups.css`: estilos de las nuevas pantallas y controles.
- `server/preferences.js`: validación y acceso a preferencias.
- `server/studies.js`: colecciones, asociaciones y filtrado de contenidos.
- `api/preferences.js`: adaptación del endpoint para Vercel.
- `migrations/20261020-user-groups.sql`: única migración necesaria.
- `tests/groups.test.mjs`: pruebas de preferencias, permisos y colecciones.
- `GRUPOS.md`: esta guía.

**Modificados:**

- `app.js`: actualización de colecciones sin remontar la aplicación, cantidades dinámicas y estado vacío.
- `auth.js`: incorporación de grupos después de la verificación y grupo/filtro en usuarios. Se conserva el flujo de credenciales y correo.
- `server/api.js`: endpoint de preferencias, selección de contenidos y consulta administrativa.
- `server/access.js`: reutilización de la conexión existente y grupo/filtro de usuarios.
- `index.html`: bienvenida, perfil, filtros y textos generales de la marca.
- `build.mjs`: copia los tres recursos públicos nuevos.
- `serve.mjs`: reconoce `/api/preferences` en desarrollo local.
- `install.js`: reemplaza una mención fija a “Las 15 clases” por “catálogo de clases”; el comportamiento de instalación se conserva.
- `manifest.webmanifest` y `package.json`: descripción general de la plataforma, sin cambios de dependencias o identidad de instalación.
- `tests/auth.test.mjs` y `tests/public-build.test.mjs`: adaptación de comprobaciones a las preferencias y recursos nuevos.

## 7. Pruebas realizadas y comprobaciones posteriores

Se verificaron las pruebas automatizadas del proyecto, incluida la autenticación existente y los casos nuevos de grupos. Se comprobó la migración en PostgreSQL embebido local: creación, repetición, restricciones, actualización única por usuario, acceso del propietario y rechazo de acceso directo mediante RLS. La base real de Neon no fue utilizada para estas pruebas.

Con DOM y medios simulados se comprobaron bienvenida, verificación previa, cambio de grupo, recuperación de errores, vista administrativa, filtros, colecciones futuras y continuidad de la misma instancia de audio e ilustraciones al recorrer grupos y las 15 clases.

No se hizo revisión visual en un navegador real ni pruebas en celulares físicos. Después de desplegar:

1. **Cuenta existente sin grupo:** iniciar sesión y elegir cada opción. Comprobar que la elección se guarda y que al recargar no se repite la bienvenida.
2. **Cuenta nueva:** registro, código de verificación y elección de grupo en ese orden. La recuperación de contraseña debe seguir funcionando.
3. **Otro dispositivo:** entrar con la misma cuenta y confirmar el grupo elegido. Cambiarlo desde el perfil y comprobarlo nuevamente tras iniciar sesión o recargar en el otro dispositivo.
4. **Adolescentes:** recorrer las 15 clases con flechas, teclado, gestos y catálogo; comprobar construcción geométrica, referencias y enlaces antiguos como `#rut/claves`.
5. **Grupos vacíos:** comprobar los nombres oficiales, la pantalla Próximamente, el acceso al perfil y la instalación desde el catálogo. No deben aparecer clases o contadores de Adolescentes.
6. **Música:** iniciar reproducción, cambiar de clase y de grupo, abrir/cerrar perfiles y catálogo. El tiempo debe continuar. Comprobar silencio y activación con la primera interacción.
7. **Administración:** comprobar grupos y Sin grupo en la tabla, filtros, paginación y vista de otros grupos sin modificar la preferencia propia. Una cuenta común no debe acceder a `/api/users` ni a vistas administrativas.
8. **Errores:** simular pérdida de conexión al guardar y confirmar que la selección anterior permanece visible y puede reintentarse.
9. **Responsive y accesibilidad:** Android/Chrome, iPhone/Safari y PWA instalada; Tab, radios con flechas, Enter, Escape para cerrar diálogos, foco visible y movimiento reducido.

Para repetir las pruebas del repositorio: `npm ci --omit=peer`, `npm test` y `npm run build`.
