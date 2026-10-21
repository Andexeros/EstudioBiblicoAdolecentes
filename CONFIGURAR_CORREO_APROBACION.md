# Huellas: correo de aprobación

Este parche agrega la bienvenida por correo al aprobar una solicitud pendiente. Se preparó sobre el repositorio actual, revisión `6581f0a` (incluye el arreglo de reproducción musical). No publica cambios ni envía correos por sí solo: hay que ejecutar el SQL, configurar el SMTP y desplegar los archivos.

## 1. Reutilizar el proveedor de correo

En Neon, revisá la configuración de correo de Auth:

- Si ya usás **Custom SMTP**, podés utilizar ese mismo proveedor para la bienvenida, siempre que permita correos transaccionales enviados desde Huellas. No hace falta cambiar Neon Auth, los correos de verificación ni Google.
- Vercel no hereda el usuario y la contraseña SMTP guardados en Neon. Obtené los valores originales desde tu proveedor de correo. Una contraseña enmascarada con asteriscos no sirve.
- Si usás el proveedor compartido de Neon, sus credenciales no están disponibles para el servidor de Huellas. Necesitarás un SMTP propio con un remitente autorizado. El código es compatible con SMTP autenticado: no requiere contratar un servicio específico ni configurar una API de correo diferente.

No intentamos reutilizar las rutas de verificación, recuperación de contraseña ni el botón de correo de prueba de Neon para enviar la bienvenida. Tampoco necesitamos una nueva clave de administración de Neon.

Referencias oficiales:

- [Proveedor de correo de Neon](https://api-docs.neon.tech/reference/updateneonauthemailprovider)
- [Prueba del SMTP guardado: la contraseña permanece en Neon](https://api-docs.neon.tech/reference/sendneonauthemailprovidertest)
- [Configuración SMTP y TLS de Nodemailer](https://nodemailer.com/smtp)

## 2. Variables privadas en Vercel

Abrí el proyecto de Huellas → **Settings → Environment Variables**. Agregá estas variables al entorno **Production**, usando los datos reales de tu proveedor:

| Variable | Qué colocar |
| --- | --- |
| `HUELLAS_SMTP_HOST` | Host SMTP, sin `https://`, puerto ni rutas. |
| `HUELLAS_SMTP_PORT` | Puerto del proveedor. Generalmente `465` o `587`; `2525` también se admite si ofrece STARTTLS. |
| `HUELLAS_SMTP_USER` | Usuario SMTP. Puede ser una dirección de correo o un usuario definido por el proveedor. |
| `HUELLAS_SMTP_PASSWORD` | Contraseña SMTP, contraseña de aplicación o clave que el proveedor indique para SMTP. |
| `HUELLAS_SMTP_FROM` | Dirección remitente autorizada, por ejemplo la misma que usás en Neon. Solo el correo, sin nombre ni `< >`. |

El nombre del remitente será **Huellas — Estudios Bíblicos**. El servidor exige TLS: usa conexión segura directa en `465` y STARTTLS obligatorio en los demás puertos. No desactiva la validación de certificados.

Conservá las variables actuales, especialmente `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `HUELLAS_SITE_URL` y `HUELLAS_GOOGLE_ENABLED`. Las nuevas variables no llevan prefijos públicos. No pegues valores reales en `.env.example` ni los subas al repositorio.

Guardá las variables ahora; el despliegue del paso 4 las incorporará. No las agregues a Preview salvo que quieras probar envíos en ese entorno y sepas a qué base apunta.

## 3. Ejecutar la migración en Neon

1. Abrí **SQL Editor** en Neon.
2. Elegí la **misma rama y base** que usa `DATABASE_URL` en producción, con su rol propietario.
3. Abrí `migrations/20261021-approval-email.sql` del ZIP, copiá **todo** su contenido y ejecutalo completo, desde `BEGIN;` hasta `COMMIT;`.
4. Debe finalizar sin errores. Si hay un error, no despliegues hasta corregirlo; si el editor conserva una transacción abierta, ejecutá `ROLLBACK;` antes de reintentar.

El SQL necesita que ya estén aplicadas las migraciones de grupos, aprobación y perfil de Google del proyecto. **No hace falta volver a ejecutar esas migraciones anteriores** si ya funcionan.

La nueva migración es idempotente. Crea una tabla propia, un trigger y funciones de Huellas. No modifica tablas internas de Neon Auth, cuentas, contraseñas, roles existentes ni grupos. Las cuentas aprobadas anteriormente no generan correos.

Podés comprobar la instalación con esta consulta de solo lectura:

```sql
SELECT to_regclass('public.huellas_approval_emails') AS tabla,
       EXISTS (
         SELECT 1 FROM pg_trigger
         WHERE tgname = 'huellas_queue_approval_email'
           AND tgrelid = 'public.huellas_memberships'::regclass
           AND NOT tgisinternal
       ) AS trigger_instalado;
```

Debe mostrar la tabla y `trigger_instalado = true`. Es normal que al principio no haya registros de envío.

## 4. Subir los archivos con GitHub Desktop

1. Descomprimí el ZIP en la raíz del repositorio, conservando sus carpetas y reemplazando los archivos existentes.
2. Revisá los cambios en GitHub Desktop, hacé **Commit** y **Push origin**.
3. Esperá el despliegue de Vercel. Incluí juntos `package.json` y `package-lock.json`: agregan únicamente Nodemailer; las versiones existentes de Neon no se cambian.
4. Recargá Huellas o cerrá y reabrí la PWA para obtener las nuevas versiones de los scripts.

El archivo `vercel.json` conserva las rutas y los tiempos existentes; agrega explícitamente el PNG actual de la Biblia al paquete del servidor para incorporarlo al correo. No hay que cambiar dominios, callbacks de Google ni configuración de autenticación.

## 5. Funcionamiento y reenvío

- Al pasar **de pendiente a aprobado**, el trigger registra una notificación en la misma transacción que la aprobación y su auditoría.
- Después de confirmar esa transacción, el servidor reclama la notificación, comprueba de nuevo los permisos y lee el correo verificado, el nombre y el grupo desde Neon. El navegador no puede elegir destinatarios ni remitentes.
- El envío se espera dentro de la petición del servidor. No depende de tareas que continúen después de devolver la respuesta. Si falla, la aprobación permanece guardada y el usuario puede entrar.
- El correo lleva el asunto solicitado, el nombre confirmado, el grupo y el botón a `https://estudiosbiblicossr.vercel.app`. Incluye HTML, texto simple y la Biblia actual como PNG embebido, sin rastreadores, fuentes externas ni JavaScript.
- Rechazar, bloquear, reactivar una cuenta ya revisada o cambiar grupos/roles no dispara esta bienvenida.

Desde **Administración → Todos los usuarios**, filtrá por **Aprobados**. Junto al estado de cada cuenta aparecerá el resultado del correo: pendiente de envío, en envío, enviado, fallido o sin confirmar. Cuando existe una notificación, un administrador con permisos sobre esa cuenta puede usar **Reenviar correo** y confirmar la acción. Las cuentas aprobadas antes de instalar el parche no muestran este botón porque nunca tuvieron una notificación de aprobación.

Entre intentos se espera **5 minutos**. Después de corregir una configuración que faltaba (`SMTP_NOT_CONFIGURED`), se permite reintentar sin esa espera. También hay límites por administrador y destinatario. Si un botón sigue deshabilitado después del plazo, pulsá **Actualizar**.

“Enviado” significa que el proveedor SMTP aceptó el mensaje; no confirma lectura ni entrega en la bandeja principal. Si una conexión se corta después de que el proveedor pudiera haber aceptado el correo, se registra **sin confirmar** y no se reintenta automáticamente. Consultá si llegó antes de confirmar un reenvío. SMTP no ofrece una garantía absoluta de entrega exactamente una vez en ese caso.

Si el proceso se interrumpe después de aprobar, el registro queda disponible para revisión y reenvío manual. No se agrega un cron ni un envío masivo de notificaciones pendientes. Un intento interrumpido se muestra como “sin confirmar” tras 2 minutos y admite reenvío manual al cumplirse los 5 minutos.

## 6. Pruebas después del despliegue

1. Registrá una cuenta de prueba con un correo al que tengas acceso, verificalo y seleccioná un grupo. Debe aparecer la aclaración de que se avisará por correo, sin acceso a clases todavía.
2. Aprobala como propietario. La cuenta debe conservar la aprobación en Neon y recibir una única bienvenida con nombre, grupo y enlace correctos. Revisá también Spam.
3. Entrá con esa cuenta desde otro dispositivo: debe conservar su grupo y acceso. Probá clases, música y PWA como de costumbre.
4. Repetí con un administrador delegado y un usuario ordinario pendiente. Debe funcionar sin otorgarle al administrador permisos nuevos sobre propietarios u otros administradores.
5. Actualizá varias veces el panel y repetí una petición de aprobación desactualizada: no debe producir otra bienvenida.
6. Verificá **Reenviar correo** después del plazo y su confirmación. Los permisos deben seguir verificándose en el servidor.
7. En un entorno de prueba, quitá temporalmente la contraseña SMTP y aprobá otra cuenta de prueba. Debe quedar aprobada, mostrar el error de configuración y permitir el reenvío después de restaurar la variable y desplegarla. No hace falta alterar el SMTP de Neon para probarlo.
8. Confirmá que rechazar, bloquear, reactivar y cambiar grupos no envían una bienvenida nueva; que los usuarios antiguos no reciben correos retroactivos; y que las cuentas sin correo verificado siguen sin poder aprobarse.

Para comprobar el registro de notificaciones desde Neon, sin mostrar nombres ni correos:

```sql
SELECT id, user_id, status, attempts, attempted_by, attempted_at, sent_at, error_code
FROM public.huellas_approval_emails
ORDER BY created_at DESC
LIMIT 20;
```

La contraseña SMTP, los tokens y el contenido de las respuestas del proveedor no se guardan en esta tabla ni se devuelven al navegador. Al eliminar una cuenta con el mecanismo actual, sus notificaciones se limpian por integridad referencial.

## 7. Validación del parche

Se verifican plantillas y MIME, cifrado SMTP, fallos y tiempos de espera, aprobación antes del envío, ausencia de duplicados simultáneos, permisos, reenvío, límites y datos públicos. La migración y las funciones también se comprobaron en PostgreSQL local, incluyendo aprobación y notificación a través del endpoint real de la aplicación con transporte de correo simulado.

Para ejecutar las pruebas incluidas y compilar:

```bash
npm ci --omit=peer
npm test
npm run build
```

No se realizaron envíos reales ni se modificó tu Neon o Vercel desde esta preparación. La entrega en Gmail y otros buzones debe verificarse después de cargar las credenciales válidas en producción.

## Archivos del parche

- `.env.example`
- `admin.css`
- `admin.js`
- `auth.js`
- `index.html`
- `package.json`
- `package-lock.json`
- `vercel.json`
- `server/access.js`
- `server/api.js`
- `server/approval-email.js` (nuevo)
- `server/approval-email-template.js` (nuevo)
- `migrations/20261021-approval-email.sql` (nuevo)
- `tests/approval-email.test.mjs` (nuevo)
- `CONFIGURAR_CORREO_APROBACION.md` (esta guía, nueva)

No se incluyen dependencias instaladas, credenciales, audios, clases, ilustraciones ni archivos que no cambiaron.
