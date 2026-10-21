# Huellas · Aprobación de cuentas y administración

Actualización del 21 de octubre de 2026. Preparada sobre el repositorio `Andexeros/EstudioBiblicoAdolecentes`, revisión `28414a3` (CORRECCION RAICES).

El ZIP es una actualización parcial: contiene solamente archivos nuevos y modificados. Conservá el resto de tu proyecto. No contiene credenciales ni reemplaza los contenidos, ilustraciones, audios o íconos.

## 1. Primero: ejecutar el SQL en Neon

1. Entrá a tu proyecto actual de Neon → **SQL Editor**.
2. Seleccioná **la misma rama y base de datos que utiliza `DATABASE_URL` en Vercel**. No crees otra base. Usá el mismo rol propietario de esa conexión: las tablas privadas se consultan desde el servidor.
3. Deben existir las tablas actuales `public.huellas_access` y `public.huellas_user_preferences`, y la cuenta **abelpravata@gmail.com** debe estar registrada y tener el correo verificado. No hace falta volver a registrarla.
4. Abrí `migrations/20261021-approval-admin.sql` del ZIP, copiá **todo** su contenido y ejecutalo. Incluye `BEGIN` y `COMMIT`: se ejecuta como una única transacción.
5. Si aparece el mensaje de que falta la cuenta propietaria verificada, la migración se cancela. Completá su verificación en el acceso actual y volvé a ejecutar el archivo. No avances con el despliegue hasta que termine correctamente.

Podés comprobar el resultado con estas consultas de lectura:

```sql
SELECT u.id, u.email, u."emailVerified", m.role, m.status
FROM public.huellas_memberships m
JOIN neon_auth."user" u ON u.id::text = m.user_id
WHERE m.role = 'owner';

SELECT status, role, count(*) AS cuentas
FROM public.huellas_memberships
GROUP BY status, role
ORDER BY role, status;
```

La primera consulta debe devolver una única cuenta propietaria, verificada y `approved`. Las demás cuentas existentes quedan `pending` en esta primera ejecución. Sus grupos y sus identificadores permanecen intactos; no se cambian contraseñas ni tablas internas de Neon Auth.

La migración se puede volver a ejecutar: conserva aprobaciones, rechazos, bloqueos y roles ya revisados. El correo identifica al propietario solamente al instalar por primera vez; después los permisos quedan asociados a su **ID de usuario**, incluso si cambia su correo. La migración y un trigger protegen esa cuenta frente a degradación, bloqueo y eliminación. Este panel mantiene un único propietario; no ofrece transferir la propiedad.

## 2. Actualizar el repositorio con GitHub Desktop

1. Descargá el ZIP y extraelo.
2. Copiá su contenido **a la raíz de tu repositorio actual**, donde están `index.html`, `server/` y `api/`. Combiná las carpetas y reemplazá únicamente los archivos con el mismo nombre. No borres las carpetas existentes.
3. En GitHub Desktop revisá los cambios. No incluyas `.env.local` ni claves reales. `.env.example` es solamente una plantilla con campos privados vacíos; no reemplaza las variables ya cargadas en Vercel.
4. Hacé **Commit** y **Push origin**. Vercel desplegará la actualización si ya está conectado al repositorio.
5. Abrí la web o cerrá y volvé a abrir la PWA. El módulo de acceso tiene una nueva versión para cargar esta actualización. No hace falta borrar cuentas ni reinstalar Neon Auth.

Ejecutá el SQL antes de publicar el código: los nuevos endpoints lo necesitan. Hasta que se publique este código, el despliegue anterior conserva sus reglas anteriores.

No cambian las dependencias ni los comandos de Vercel: `npm ci --omit=peer`, `npm run build`, salida `dist`, Node 24. La aplicación usa 11 funciones API en total. No se añade caché offline ni se copian los estudios privados a `dist/`.

## 3. Variables de Vercel y configuración de Neon

Para **aprobación, roles, grupos, métricas y auditoría** se utilizan las variables actuales:

- `DATABASE_URL`
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET`
- `HUELLAS_SITE_URL` = `https://estudiosbiblicossr.vercel.app`
- `HUELLAS_GOOGLE_ENABLED`, si ya la utilizás.

No regeneres el secreto de cookies ni cambies la conexión existente. `HUELLAS_ADMIN_EMAILS` puede permanecer configurada por compatibilidad con el despliegue anterior, pero **el nuevo código no la usa para conceder permisos**. Agregar un correo a esa variable ya no designa un administrador.

Para habilitar además **Eliminar cuenta permanentemente**, agregá estas tres variables privadas en Vercel → Project → Settings → Environment Variables:

| Variable | Qué colocar |
| --- | --- |
| `NEON_API_KEY` | Una clave de la API administrativa de Neon que permita gestionar ese proyecto. Creala desde la configuración de API keys de tu cuenta u organización Neon; elegí el alcance más limitado disponible que permita la eliminación. |
| `NEON_PROJECT_ID` | El ID del proyecto de Neon ya conectado a Huellas. |
| `NEON_BRANCH_ID` | El ID de la rama exacta que usa la conexión y Neon Auth, habitualmente con formato `br-...`. No es el nombre visible de la rama. |

Usá los IDs del panel o los ajustes del proyecto y de su rama. No uses el ID de Vercel, el del endpoint PostgreSQL (`ep-...`) ni la URL de autenticación como sustitutos. Guardá la clave como variable sensible en el servidor, sin prefijos públicos. Después, realizá un redeploy para que Vercel aplique las variables.

El servidor verifica la rama, el nombre de la base y la URL de Neon Auth antes de solicitar una eliminación. Si apuntan a otro servicio, rechaza la operación. Sin estas tres variables, el botón de eliminación queda deshabilitado; **todas las demás funciones están disponibles**.

No hace falta habilitar un plugin administrativo de Better Auth, modificar roles internos de Neon Auth ni configurar otro proveedor de correo. Se conserva la verificación, recuperación de contraseña y autenticación actuales. La eliminación usa la [API administrativa oficial de Neon](https://api-docs.neon.tech/reference/deletebranchneonauthuser), nunca un `DELETE` directo en sus tablas internas.

## 4. Uso del sistema

### Usuarios

Registro → verificación de correo → selección de grupo → pantalla de espera. En el registro se solicita **Nombre y apellido**. Se admiten nombres compuestos, tildes, apóstrofes y guiones, con longitud de 3 a 100 caracteres; deben existir al menos dos partes significativas con letras. Esta validación comprueba el formato: la revisión administrativa permite confirmar que se conoce a la persona.

Las cuentas pendientes pueden seleccionar su grupo y consultar su estado, sin recibir los estudios. Pueden cerrar sesión y volver con la misma cuenta desde otro dispositivo. Las cuentas rechazadas o bloqueadas tienen su propia explicación y no pueden realizar operaciones protegidas.

La pantalla de espera ofrece **Consultar estado**. También se comprueba la autorización cada 30 segundos mientras la página está visible y al regresar a ella. Un bloqueo detectado cierra los diálogos, retira el estudio de la vista y pausa la música. El servidor revisa cada petición protegida de forma independiente. Lo que alguien ya leyó o descargó durante un acceso autorizado no puede retirarse de su dispositivo.

### Propietario

Ingresá con tu cuenta habitual → **Mi perfil → Usuarios de Huellas**.

- **Solicitudes pendientes** aparece destacada. Una cuenta sin correo verificado no puede aprobarse.
- **Todos los usuarios** permite buscar por nombre o correo, filtrar por estado, grupo y rol, y ordenar por registro o último acceso.
- **Gestionar administradores** muestra cuentas aprobadas: elegí **Designar administrador** y confirmá. **Revocar administrador** retira el permiso en la siguiente petición al servidor, sin exigir otro inicio de sesión.
- **Historial** muestra responsable, acción, cuenta afectada y fecha. Se conserva aunque se elimine la cuenta afectada.
- El cambio de grupo administrativo guarda la preferencia en Neon. La consulta de colecciones de otros grupos desde el perfil sigue siendo una vista previa que no cambia tu grupo.

Las acciones requieren confirmación. Para eliminar definitivamente hay que escribir el correo de la cuenta; la propia cuenta propietaria no tiene esa acción.

### Administradores delegados

Pueden ver métricas y usuarios, aprobar o rechazar solicitudes, cambiar el grupo, bloquear y reactivar **usuarios ordinarios**. No pueden cambiar al propietario ni a otro administrador, conceder o revocar roles, leer la auditoría reservada al propietario ni eliminar cuentas permanentemente. Elegir un grupo no concede ningún permiso.

## 5. Cómo se protegen los datos

- Las preferencias existentes siguen en `huellas_user_preferences`. Las nuevas tablas propias son `huellas_memberships` (estado y rol), `huellas_admin_audit` (historial) y `huellas_rate_limits` (límites de intentos).
- El navegador nunca elige el ID del administrador actuante. Se obtiene de una sesión verificada con Neon y el rol se vuelve a consultar en PostgreSQL.
- `/api/lessons` y `/api/preferences` solo entregan clases a cuentas `approved`, verificadas y del grupo guardado. Las vistas previas requieren permiso administrativo. `/api/users` y `/api/admin` tienen controles propios del servidor.
- Los estudios se mantienen fuera de los archivos estáticos públicos. No se publican los datasets, migraciones, código del servidor o variables de entorno.
- Las mutaciones usan funciones SQL privadas con validación de permisos y bloqueo de filas. La decisión y su auditoría se guardan juntas. Una versión por cuenta impide confirmar una acción sobre un registro que otro administrador o el usuario acaba de cambiar.
- Hay controles de origen para prevenir solicitudes desde otros sitios, consultas parametrizadas y límites persistentes de intentos de autenticación y modificaciones. Los límites se comparten entre instancias de Vercel. Los identificadores usados para limitar por correo/IP se guardan como HMAC, sin esos valores en texto plano. La aprobación sigue siendo la barrera para las cuentas que se registren directamente con el proveedor.
- La auditoría guarda IDs, acciones, fechas y cambios de grupo/estado/rol. No guarda contraseñas, cookies ni tokens.

La eliminación tiene dos etapas porque Neon Auth y la limpieza de la aplicación no forman una única transacción: primero bloquea la cuenta y registra la solicitud; después pide a Neon eliminar la identidad, comprueba que ya no exista y elimina preferencias, accesos y membresía en una transacción. Si hay un fallo, **permanece bloqueada**, con la operación registrada. El propietario puede actualizar el listado y elegir **Reintentar eliminación**, confirmando el correo otra vez. No se reactiva ni se reintenta automáticamente.

## 6. Pruebas antes de dar la actualización por terminada

### Comprobaciones realizadas localmente

- `npm test`: **95 pruebas aprobadas**, incluidas 23 nuevas de seguridad y regresión.
- Integración con PostgreSQL local mediante PGlite: **14 escenarios aprobados**, ejecutando las funciones SQL y los endpoints reales con identidades sintéticas. Incluyen migración repetida, métricas/filtros reales, aprobación, rechazo, bloqueo, revocación, permisos del rol de base, versiones, auditoría y recuperación de eliminación interrumpida.
- Integración de interfaz con JSDOM: **16 escenarios aprobados**: selección → espera → aprobación, verificación de correo, formulario de nombre, controles del panel, confirmaciones, filtros, escape de datos, retirada de permisos y conservación de una sola instancia de música y de la geometría al cambiar de grupo.
- Build estático y revisión de cambios: no se modificaron clases, referencias, ilustraciones, animaciones geométricas, música, manifiesto PWA ni sus íconos.

Estas pruebas usan datos y proveedores simulados; no se modificó tu Neon real ni se desplegó la web desde esta sesión. La instalación en dispositivos físicos y la eliminación con tu clave real requieren las siguientes comprobaciones después del despliegue.

### Lista para probar en tu despliegue

1. **Propietario:** comprobá con el SQL de arriba que tu ID es `owner/approved`. Entrá y abrí el panel. Verificá que conserve su grupo y pueda consultar las tres colecciones.
2. **Cuenta existente ordinaria:** al entrar debe conservar su grupo y mostrar espera. No debe aparecer el contenido de una clase ni al abrir una URL guardada.
3. **Cuenta nueva:** nombre inválido rechazado; nombre compuesto válido aceptado; código de correo habitual; selección de grupo; espera. Cerrar y volver a ingresar debe recuperar su estado sin registrarse otra vez.
4. **Aprobar:** desde el propietario, revisá una cuenta con correo verificado, confirmá su aprobación y usá Consultar estado en esa cuenta. Debe abrir sus clases. No debe poder aprobarse una cuenta sin verificar.
5. **Tres grupos:** una cuenta aprobada puede cambiar su propio grupo desde el perfil; el cambio debe aparecer en Neon y desde otro dispositivo, con 15 clases en Adolescentes y las 12 compartidas actuales en Intermedio/Grande.
6. **Rechazar y reactivar:** verificá que el rechazo bloquee las clases y que una revisión posterior permita reactivar una cuenta verificada.
7. **Delegar:** aprobá una cuenta de prueba, asignale Administrador y comprobá su panel. No debe tener herramientas para roles, auditoría del propietario o eliminación, ni acciones sobre propietario/administradores.
8. **Revocar:** dejá abierto ese panel en otra sesión y revocá su rol desde el propietario. En su siguiente petición al servidor debe obtener 403; al comprobar estado o dentro del siguiente ciclo visible, el panel debe cerrarse. Puede seguir como usuario aprobado.
9. **Bloquear:** con una clase y música abiertas en otra sesión, bloqueá esa cuenta. `/api/lessons` debe devolver 403 inmediatamente en una nueva petición; la siguiente comprobación visible debe retirar el estudio y pausar el sonido. Reactivá y comprobá el acceso nuevamente.
10. **Seguridad por API:** desde la consola del navegador de una cuenta pendiente/bloqueada, ejecutá `fetch('/api/lessons', {cache:'no-store'}).then(r=>r.status)` → 403. `/api/users` y `/api/admin?view=overview` también deben negar acceso. Con una cuenta ordinaria aprobada, estos dos últimos devuelven 403. Cambiar localStorage o el HTML no debe cambiar el resultado.
11. **Protección de propiedad:** no deben ofrecerse bloqueo/eliminación de tu cuenta ni concesión de propietario. La API debe rechazar intentos de un delegado de conceder permisos o modificar un administrador, aun enviando un POST manual. Dos decisiones sobre una versión antigua deben producir 409 y pedir actualizar.
12. **Eliminar:** usá exclusivamente una cuenta de prueba prescindible y las tres variables configuradas. Verificá la confirmación por correo, eliminación en Neon Auth, ausencia del usuario y sus preferencias, y conservación de la auditoría. No pruebes esto con una cuenta que necesites conservar.
13. **Escritorio y teléfono:** revisá la tabla y las tarjetas, búsqueda, filtros, orden, teclado, Escape/cierre de diálogos, errores de conexión y confirmaciones sin guardados duplicados.
14. **Android/iPhone/PWA:** probá ingreso persistente, recuperación de contraseña, retorno desde segundo plano, pantalla de espera y aprobación. Comprobá navegación por flechas/catálogo/URL, construcción de figuras y música continua entre clases. El comportamiento de instalación PWA permanece igual.

Para repetir las pruebas incluidas del proyecto, ejecutá `npm ci --omit=peer`, `npm test` y `npm run build` desde la raíz. Los ensayos con PostgreSQL local y JSDOM se ejecutaron como herramientas de verificación externas; no se agregaron dependencias de producción ni se incluyen datos de esas pruebas en la entrega.

## 7. Archivos de esta actualización

| Área | Archivos nuevos o modificados |
| --- | --- |
| Interfaz de acceso y panel | `index.html`, `auth.js`, `groups-ui.js`, `admin.js`, `admin.css`, `name-rules.js` |
| Servidor y permisos | `server/api.js`, `server/auth.js`, `server/http.js`, `server/access.js`, `server/preferences.js`, `server/memberships.js`, `server/admin-data.js`, `server/limits.js`, `server/neon-admin.js` |
| Ruta y build | `api/admin.js`, `serve.mjs`, `build.mjs` |
| SQL | `migrations/20261021-approval-admin.sql` |
| Pruebas | `tests/approval.test.mjs`, `tests/auth.test.mjs`, `tests/groups.test.mjs`, `tests/public-build.test.mjs` |
| Configuración e instrucciones | `.env.example`, `ACTUALIZAR_APROBACIONES.md` |

No hace falta ejecutar SQL de clases, reemplazar la carpeta de música ni cambiar el manifiesto de la aplicación.
