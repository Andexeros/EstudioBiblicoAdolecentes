# Huellas · Continuar con Google

Actualización del 21/10/2026 preparada sobre el repositorio actual, commit `9e320b1` (administracion mejorada). El ZIP contiene únicamente archivos nuevos y modificados, con sus rutas originales. Requiere que ya esté aplicada la actualización de aprobaciones.

## 1. Configurar Google y Neon

### Google Cloud

Entrá a [Google Cloud Console](https://console.cloud.google.com/) y seleccioná o creá un proyecto para Huellas. En **Google Auth Platform**:

- **Branding:** nombre Huellas, correo de soporte y correo de contacto del desarrollador.
- **Audience:** External para admitir cuentas personales de Gmail. Mientras uses Testing, agregá las cuentas de prueba. Para habilitarlo a toda la congregación, publicá la aplicación en Production y completá las verificaciones que Google solicite.
- **Data Access:** solo identidad básica: `openid`, `email` y `profile`. Huellas no necesita acceso a Gmail, Drive, contactos o calendarios.
- **Clients → Create client:** tipo **Web application**. Google generará el **Client ID** y el **Client Secret**. No hace falta crear clientes nativos de Android o iOS para esta web/PWA.

En **Authorized JavaScript origins** colocá:

```text
https://estudiosbiblicossr.vercel.app
```

Si Google solicita además el origen del servicio de autenticación, el correspondiente a la URL que figura actualmente en el proyecto es:

```text
https://ep-proud-poetry-b4jb0n37.neonauth.c-6.us-east-2.aws.neon.tech
```

En **Authorized redirect URIs**, para esa misma URL de Neon Auth:

```text
https://ep-proud-poetry-b4jb0n37.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth/callback/google
```

Esta dirección se obtiene de `NEON_AUTH_BASE_URL` del repositorio, agregando `/callback/google`. **Antes de guardarla, comparala con la URL exacta que muestra el diálogo del proveedor Google en Neon y con la variable actual de Vercel.** Si cambiaste la rama o la URL de Auth, copiá la que muestra Neon. No se inventaron IDs ni credenciales.

El callback que Google debe tener registrado es el de Neon. La ruta `https://estudiosbiblicossr.vercel.app/api/auth-return` es el regreso posterior a Huellas que el código configura automáticamente; no la uses como sustituto del callback del proveedor.

### Neon

En el proyecto y rama actuales, abrí **Settings → Auth**, o **Auth → Configuration**, según la vista del panel:

1. En OAuth providers, abrí Google → Configure, o agregá Google si aún no existe.
2. Copiá su callback al cliente de Google Cloud.
3. Guardá en Neon el **Client ID** y el **Client Secret** que generó Google.
4. En Domains/Trusted domains verificá que exista exactamente `https://estudiosbiblicossr.vercel.app`, con protocolo y sin barra final.

Neon ofrece credenciales compartidas para pruebas; para producción configurá las propias. No copies las credenciales en el repositorio ni las envíes por el chat. No cambies las opciones de verificación de correo ni habilites vinculaciones entre correos diferentes para resolver un error.

## 2. Aplicar el SQL nuevo

En Neon → SQL Editor, elegí **la misma base, rama y rol propietario que usa `DATABASE_URL` en Vercel** y ejecutá todo:

```text
migrations/20261021-google-profile.sql
```

Esta migración:

- Agrega `full_name` y `name_confirmed_at` a la tabla propia `public.huellas_memberships`.
- Crea una función privada para confirmar el nombre de la cuenta autenticada.
- Actualiza la función administrativa para impedir aprobaciones o concesiones de administrador a cuentas Google que todavía no confirmaron su nombre.
- Conserva los IDs, grupos, estados, roles y el historial existentes. No vuelve a poner en pendiente las cuentas que ya estaban aprobadas.
- No crea otra base ni modifica directamente las tablas internas de Neon Auth.

Puede ejecutarse nuevamente sin borrar nombres ni decisiones. No necesitás repetir las migraciones anteriores; esta debe aplicarse después de la de aprobaciones. Todavía no se ejecutó en tu Neon real desde esta sesión.

Para verificar las columnas y que tu propietario siga aprobado:

```sql
SELECT user_id, role, status, full_name, name_confirmed_at
FROM public.huellas_memberships
WHERE role = 'owner';
```

Debe conservar una sola fila `owner / approved`. Los campos del nombre pueden estar vacíos hasta la primera confirmación con Google. Las cuentas que usan únicamente correo y contraseña no reciben un paso de nombre nuevo.

## 3. Actualizar GitHub y Vercel

1. Extraé el ZIP y copiá su contenido a la raíz del repositorio existente. Combiná `api/`, `server/`, `migrations/` y `tests/`; reemplazá solo los archivos incluidos.
2. Con GitHub Desktop revisá los cambios, hacé Commit y Push. Conservá los demás archivos.
3. En Vercel → Environment Variables configurá `HUELLAS_GOOGLE_ENABLED=true` para Production. Verificá que `HUELLAS_SITE_URL` sea `https://estudiosbiblicossr.vercel.app`.
4. Desplegá o realizá un redeploy después de guardar las variables.

No se necesitan variables `GOOGLE_CLIENT_ID` ni `GOOGLE_CLIENT_SECRET` en Vercel: Neon administra esas credenciales. No regeneres `NEON_AUTH_COOKIE_SECRET` ni cambies `DATABASE_URL`, las variables de administración o los permisos actuales.

La plantilla `.env.example` continúa con `false` para no activar un proveedor que aún no esté configurado. Cambiar esa plantilla por sí solo no modifica las variables de Vercel.

La aplicación mantiene Node 24, las mismas dependencias y los mismos comandos de instalación/build. Se agrega `/api/profile`, con un total de 12 funciones API.

## 4. Flujo resultante

**Cuenta Google nueva:** Continuar con Google → autorización en Google → confirmar/completar nombre y apellido → seleccionar grupo → pendiente de aprobación → acceso cuando un administrador la apruebe.

**Cuenta existente:** Neon determina si la identidad Google se puede vincular de forma segura. Cuando conserva el mismo ID, Huellas recupera su grupo, aprobación y rol. La primera vez que la cuenta tenga Google vinculado se solicita confirmar el nombre una sola vez; no se vuelve a solicitar en otros dispositivos. Esto también aplica al propietario o a un administrador que empiece a usar Google, sin retirarles ni reasignarles su rol.

**Cuenta bloqueada o rechazada:** conserva esa restricción. Google y el formulario de nombre no la reactivan. Si un administrador reactiva una solicitud Google que nunca completó el nombre, regresa a pendiente para poder completar sus datos y volver a revisión. Las cuentas ya completas conservan la reactivación habitual.

El nombre se valida en el servidor y se actualiza mediante la API soportada `update-user` de Neon Auth. También queda confirmado en la tabla propia de Huellas: esta copia tiene prioridad para el perfil, listado e historial, aunque Google cambie después su alias. La confirmación no modifica correos, grupos, roles o aprobación. Un nombre ya confirmado no se puede reemplazar desde este formulario de alta; no se agregó una nueva función general de edición de perfiles.

El panel muestra “Nombre por confirmar” y deshabilita Aprobar/Designar administrador cuando falta ese paso. La función SQL verifica lo mismo, aun si se intenta enviar una petición manual.

## 5. Cuentas con el mismo correo

La vinculación pertenece a Neon Managed Better Auth. Huellas no busca un correo para reasignar IDs, no inserta cuentas OAuth por SQL ni confía en correos enviados desde el navegador. La identidad y los permisos se recuperan siempre por el ID devuelto por una sesión validada.

El proveedor debe demostrar el correo y Neon debe permitir la vinculación con la cuenta existente. No se relajan sus reglas para forzar el acceso. Si Neon devuelve `account_not_linked` o un error equivalente, se muestra que la persona puede ingresar con su correo y contraseña o recuperarla. No se crea una identidad alternativa desde el código de Huellas ni se fusionan registros manualmente.

Como no tenemos acceso a la configuración privada de tu proveedor, la vinculación real debe probarse con una cuenta existente verificada después de configurarlo. Confirmá que conserva exactamente el mismo ID, grupo y estado. Si el proveedor rechaza la vinculación, conservá el acceso tradicional y revisá sus opciones de vinculación compatibles; no cambies permisos ni filas internas para resolverlo.

## 6. Navegadores, móviles y PWA

Se conserva el SDK oficial de Neon, sus cookies HttpOnly, el par challenge/verifier y la ruta de regreso. La navegación a Google usa una redirección de página completa desde una interacción del usuario; no necesita ventanas emergentes, iframes ni un SDK de Google separado. El regreso conserva la URL de clase cuando existe, y después aplica los controles del servidor.

La implementación está preparada para Chrome/Edge/Firefox/Safari, Android, iPhone y la PWA. El consentimiento real y el retorno a la PWA requieren comprobarse en los dispositivos: iOS y los navegadores pueden abrir la autorización en otro contexto y separar las cookies de Safari de las de la aplicación instalada. No se desactivan validaciones para sortear esa separación. Si no se completa el regreso, se conserva el acceso por correo/contraseña; continuá la prueba en Safari y revisá la reapertura de la PWA. No se ha comprobado ni se garantiza desde una prueba simulada que todos esos contextos compartan sesión.

No se alteró el manifiesto, los íconos, el sistema de instalación ni se incorporó caché offline.

## 7. Pruebas

Verificaciones realizadas:

- **112 pruebas automatizadas del proyecto**, incluidas 17 nuevas: flag, payload OAuth, callback local, confirmación de nombre, bloqueo por servidor, aprobación, roles, origen, límites, errores y persistencia del nombre.
- **11 escenarios con PostgreSQL local/PGlite**, ejecutando los endpoints y las funciones SQL reales sobre identidades sintéticas: migración repetida, permisos, propietario, confirmación, aprobación, reactivación, búsqueda y auditoría.
- **12 recorridos de interfaz con JSDOM:** botón en ambas pantallas, errores, Google → nombre → grupo → espera → aprobación, propietario existente, bloqueo, verificación, panel y continuidad de música/geometría.
- `npm run build` correcto. Se mantiene fuera de la salida pública el contenido de clases y el código del servidor.

Para repetir las pruebas incluidas: `npm ci --omit=peer`, `npm test` y `npm run build`. Las herramientas PostgreSQL local y JSDOM se usaron externamente, sin nuevas dependencias de producción.

Las pruebas no iniciaron sesión en Google, no usaron credenciales privadas ni modificaron tu Neon. Antes de habilitarlo para todos:

1. Probá registro e ingreso por contraseña y la recuperación de contraseña.
2. Con una cuenta Google nueva, comprobá nombre precompletado, validación de nombre y apellido, persistencia, selección de grupo y espera. Pedir `/api/lessons` manualmente debe seguir devolviendo 403 mientras esté pendiente.
3. Intentá aprobarla antes de confirmar el nombre: el panel y el servidor deben impedirlo. Confirmalo, actualizá el listado y aprobala. No debe recibir permisos administrativos por usar Google.
4. Cerrá sesión e ingresá desde otro dispositivo: debe recuperar nombre, grupo y estado, sin otro formulario de confirmación.
5. Probá una cuenta existente verificada con el mismo correo en Google: comprobá que Neon mantiene su ID, grupo y aprobación. Probá también una cuenta existente sin correo verificado; no debe servir para saltar la verificación ni los controles de vinculación de Neon.
6. Con tu cuenta propietaria, verificá que conserve `owner/approved` y el panel. Con un delegado, probá que siga sin poder conceder roles, modificar al propietario o eliminar cuentas.
7. Cancelá Google y repetí el ingreso: debe volver a una pantalla utilizable con correo/contraseña. Probá errores de conexión al guardar el nombre y reintento sin doble confirmación.
8. Probá Android Chrome, iPhone Safari y ambas PWA instaladas, incluyendo vuelta desde Google, recarga y segundo plano. Completá la prueba tanto con una cuenta nueva como con una ya aprobada.
9. Recorré clases por URL, flechas y catálogo con la música reproduciéndose: sus contenidos, figuras y animaciones deben conservarse.

## Archivos incluidos

- Interfaz: `index.html`, `auth.js`, `admin.js`.
- Endpoints y perfil: `api/profile.js`, `server/profile.js`, `server/api.js`, `server/memberships.js`, `server/access.js`, `server/admin-data.js`, `serve.mjs`.
- Migración: `migrations/20261021-google-profile.sql`.
- Pruebas: `tests/google.test.mjs`, `tests/public-build.test.mjs`.
- Configuración/guía: `.env.example`, `CONFIGURAR_GOOGLE.md`.

Las clases, los grupos, las ilustraciones, las animaciones, los archivos del reproductor, los recursos PWA y las dependencias no se modificaron.

Referencias oficiales consultadas: [OAuth en Neon](https://neon.com/docs/auth/guides/setup-oauth), [dominios permitidos](https://neon.com/docs/auth/guides/configure-domains), [actualización de nombre](https://neon.com/docs/auth/guides/user-management), [vinculación en Better Auth](https://better-auth.com/docs/concepts/users-accounts), [consentimiento de Google](https://developers.google.com/workspace/guides/configure-oauth-consent).
