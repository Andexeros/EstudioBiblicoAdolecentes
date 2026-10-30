# Huellas · Aviso de solicitudes pendientes

Este parche se preparó sobre la versión del repositorio `282da7a69c3eddbd11a2a8bd7b29a3b5d64f6302`.

## Aplicar el parche

1. Abrí el **SQL Editor de Neon**, en la misma rama, base y rol propietario que utiliza `DATABASE_URL` en Vercel.
2. Copiá **todo** el contenido de `migrations/20261030-pending-request-email.sql` y ejecutalo. Aplicá solamente esta migración nueva; las migraciones anteriores ya deben estar instaladas. Es idempotente: repetirla conserva los registros de envío. No modifica tablas internas de Neon Auth, usuarios, grupos, roles ni aprobaciones.
3. Extraé el ZIP dentro de la **raíz del repositorio local**, reemplazando los archivos y conservando `server/`, `migrations/` y `tests/`. No lo subas como una carpeta adicional dentro del proyecto.
4. En GitHub Desktop, revisá los cambios, hacé **Commit** y **Push origin**. Esperá el despliegue de Vercel.

No hay variables nuevas ni cambios en Neon Auth, Google Cloud o la configuración de Gmail. Se reutilizan `DATABASE_URL` y las variables `HUELLAS_SMTP_*` que ya funcionan. Si hoy usás Gmail con puerto **465**, conservá esa configuración: el transporte sigue utilizando TLS desde el inicio.

## Qué hace

- Envía al propietario, `abelpravata@gmail.com`, un correo con nombre completo, correo verificado y grupo del solicitante. El destinatario se fija en el servidor; el navegador no puede reemplazarlo.
- Reutiliza el transporte SMTP de las bienvenidas, su límite de tiempo, el logo de Biblia adjunto y el diseño oscuro, celeste y turquesa. El envío a la misma dirección utilizada como remitente está permitido por el código.
- Solo lo intenta cuando la cuenta está pendiente, el correo está verificado, hay un nombre completo válido y se eligió un grupo. Si es una cuenta de Google, primero debe confirmar su nombre real.
- Se activa después de guardar el grupo y se comprueba también al registrar una sesión. Así puede completar el aviso si el usuario vuelve a ingresar después de haber guardado su grupo. No se hace ningún envío masivo al ejecutar el SQL; una cuenta pendiente existente que ya cumpla los requisitos puede generar su primer aviso cuando vuelva a ingresar. Las cuentas aprobadas no generan este aviso.
- La restricción única por usuario en `huellas_pending_request_emails` reserva el envío antes de contactar SMTP. Otra pestaña, otro dispositivo, cambiar el grupo o repetir una petición no genera otro correo.
- Espera la aceptación real de SMTP y guarda el resultado. Si falla el correo o el registro de su resultado, conserva el grupo y la cuenta pendiente. No cambia aprobaciones ni permisos.
- Un resultado fallido o incierto no se reintenta automáticamente. Esto evita duplicar un mensaje que Gmail pudo haber aceptado antes de una desconexión. No se agrega un botón de reenvío de estos avisos; los botones existentes de bienvenida conservan su comportamiento.
- El botón **Revisar solicitud** apunta a `https://estudiosbiblicossr.vercel.app/#solicitudes-pendientes`. Conserva el inicio de sesión existente y abre el listado pendiente al entrar con una cuenta administradora. El enlace no aprueba cuentas ni otorga permisos.
- Reutiliza el contador real de pendientes del panel. Muestra **0** cuando no hay cuentas en ese estado, anuncia sus cambios de forma accesible y se actualiza con la comprobación de sesión existente, aproximadamente cada 30 segundos mientras el panel está abierto y visible. También se puede usar **Actualizar**. El conteo mantiene su criterio actual: todas las cuentas con estado `pending`; el correo exige además que el registro esté completo y verificado.

## Comprobar en producción

1. Registrá una cuenta de prueba con nombre y apellido reales. **Antes de verificar el correo**, no debe llegar un aviso al propietario.
2. Verificá el código y elegí uno de los tres grupos. La cuenta debe continuar pendiente y debe llegar **un** aviso a `abelpravata@gmail.com`. Comprobá nombre, correo y grupo. Si no lo ves en Recibidos, revisá Todos, Spam y el hilo de Enviados, porque remitente y destinatario coinciden.
3. Recargá e iniciá sesión otra vez con esa misma cuenta. No debe llegar otro aviso. La reserva también evita duplicados si ingresás desde otro dispositivo.
4. Abrí **Revisar solicitud** con tu cuenta propietaria: debe abrir el panel en solicitudes pendientes. Probalo también después de cerrar sesión y volver a entrar con Google o contraseña. Una cuenta común o pendiente no debe poder consultar `/api/admin`, aunque tenga el enlace.
5. Repetí un registro con Google: antes de confirmar el nombre y seleccionar grupo, no debe avisar. Después, debe generar un único aviso. Repetí con otros grupos si querés comprobar sus etiquetas.
6. Con el panel abierto, registrá otra cuenta: el contador debe cambiar tras la siguiente comprobación o al pulsar **Actualizar**. Después de aprobar o rechazar solicitudes, debe actualizarse; si se resuelven todas las cuentas pendientes, debe mostrar 0.
7. Aprobá la cuenta de prueba. El correo de bienvenida al usuario y el acceso a sus clases deben seguir funcionando como antes.

No se realizaron envíos reales ni cambios en tu base de producción durante la preparación del parche. El envío real debe comprobarse después de ejecutar el SQL y desplegar.

## Diagnóstico sin secretos

En **Vercel → proyecto → Logs**, filtrá por `Huellas pending request email`. Los fallos se registran con códigos controlados, por ejemplo `SMTP_NOT_CONFIGURED`, `SMTP_AUTH_FAILED`, `SMTP_REJECTED`, `SMTP_UNCERTAIN` o `OUTCOME_NOT_RECORDED`. No se imprimen contraseñas, tokens, respuestas completas de Gmail ni datos del solicitante.

En el SQL Editor de Neon podés consultar el resultado, sin cambiarlo:

```sql
SELECT user_id, status, study_group, attempted_at, sent_at, error_code
FROM public.huellas_pending_request_emails
ORDER BY created_at DESC
LIMIT 20;
```

`sent` significa que el servidor SMTP aceptó el mensaje; no garantiza su ubicación en la bandeja de entrada. `sending` puede significar un envío en curso o una función interrumpida. No borres filas para forzar reenvíos sin comprobar primero si llegó el mensaje.

## Validación realizada

- 182 pruebas de Node, incluyendo las 165 anteriores: registro, OAuth, aprobación, autorización, correo de bienvenida, clases, música, identidad PWA y construcción pública.
- 43 comprobaciones SQL en PostgreSQL aislado mediante PGlite: migración repetida, los tres grupos, correo sin verificar, nombre de Google, estados restringidos, reserva única, errores, permisos públicos revocados y conservación de la cuenta propietaria.
- Pruebas del correo HTML y MIME con texto alternativo y PNG adjunto, sin contactar Gmail.
- Pruebas de la interfaz del panel con DOM simulado: enlace protegido, contador, estado 0 y revocación de permisos.

Las pruebas SQL no agregan dependencias al proyecto ni utilizan tu base de Neon. Las pruebas automatizadas incluidas se ejecutan con `npm test`; la compilación sigue siendo `npm run build`.

## Archivos incluidos

Modificados:

- `server/approval-email.js`: transporte SMTP compartido, con la misma configuración.
- `server/api.js`: activación del aviso después del registro completo.
- `admin.js`: enlace a solicitudes y actualización del contador.
- `auth.js`: apertura del destino administrativo y actualización de la versión del módulo.
- `index.html`: contador accesible inicializado en 0 y versión del script.

Nuevos:

- `server/pending-request-email.js`.
- `server/pending-request-email-template.js`.
- `migrations/20261030-pending-request-email.sql`.
- `tests/pending-request-email.test.mjs`.
- `tests/admin-notifications-ui.test.mjs`.
- `NOTIFICACIONES_ADMIN.md`.

El ZIP no incluye archivos sin cambios, credenciales, variables de entorno, dependencias ni archivos compilados.
