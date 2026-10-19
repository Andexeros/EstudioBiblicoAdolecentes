# Activar el registro de Huellas

Esta actualización agrega registro por correo y contraseña, verificación por código, recuperación de contraseña, sesión persistente y cierre de sesión. Las clases se entregan desde una API protegida. En «Mi cuenta», los administradores pueden consultar nombre, correo, fecha de registro y última apertura de Huellas.

Se conservan los contenidos, las 15 ilustraciones, sus animaciones, los enlaces por clase, el logo y la PWA. No se agrega un service worker ni acceso offline. Neon Auth administra las credenciales; Huellas no guarda contraseñas en su tabla de accesos ni en el almacenamiento del navegador.

## 1. Ejecutar el SQL en Neon

En tu proyecto **huellas**, abrí **SQL Editor**, elegí la rama **production** y la base **neondb**. Copiá el contenido de `neon-login.sql` y ejecutalo una vez. Solo crea `public.huellas_access`, destinada al primer y último acceso; no modifica las tablas de Neon Auth.

Usá después la conexión del propietario de esa base, que tiene acceso a esta tabla y a `neon_auth."user"`. Una conexión de un rol sin esos permisos impedirá registrar accesos o abrir la lista de usuarios.

## 2. Completar las variables de Vercel

Abrí el proyecto de Huellas en **Vercel → Settings → Environment Variables**. Agregá estas variables para **Production**. Son del servidor: no uses prefijos `VITE_`, `NEXT_PUBLIC_` ni las escribas dentro de JavaScript o HTML.

| Nombre | Valor |
| --- | --- |
| `NEON_AUTH_BASE_URL` | `https://ep-proud-poetry-b4jb0n37.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth` |
| `DATABASE_URL` | La conexión PostgreSQL con **Connection pooling** activado que copiás desde **Neon → Connect**, rama production, base neondb. Conservá sus parámetros SSL. |
| `NEON_AUTH_COOKIE_SECRET` | Un secreto aleatorio privado de al menos 32 caracteres. Generarlo como se indica abajo. |
| `HUELLAS_SITE_URL` | `https://estudiobiblicoadolecentes.vercel.app` |
| `HUELLAS_ADMIN_EMAILS` | El correo con el que vas a registrarte como administrador. Para varios, separalos con comas. No les da acceso hasta que verifiquen su correo. |
| `HUELLAS_GOOGLE_ENABLED` | `false`, hasta configurar credenciales propias de Google. El registro por correo funciona sin Google. |

La contraseña de aplicación de Gmail queda configurada en el SMTP de Neon. No hace falta copiarla a Vercel. La cuenta de Neon puede ser personal aunque el proyecto de Vercel esté en Andex.

Para generar el secreto, si tenés Node instalado, abrí una terminal y ejecutá:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

También podés generarlo en **PowerShell** de Windows, sin instalar Node:

```powershell
$huellasBytes = New-Object byte[] 32
$huellasRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$huellasRng.GetBytes($huellasBytes)
[Convert]::ToBase64String($huellasBytes)
$huellasRng.Dispose()
```

Copiá el resultado directamente a `NEON_AUTH_COOKIE_SECRET`. No lo publiques en GitHub ni en el chat. Mantené el mismo valor entre despliegues; cambiarlo invalida la caché firmada de sesión y obliga a volver a consultar Neon.

## 3. Revisar Neon Auth

- Trusted domain: `https://estudiobiblicoadolecentes.vercel.app`, sin barra al final.
- Email sign-up y Email sign-in: habilitados.
- Verify at Sign-up: habilitado, con **código de verificación**. La interfaz espera el código por correo.
- Nombre de aplicación: **Huellas · Estudios Bíblicos**.
- Custom SMTP: el correo emisor y la contraseña de aplicación que configuraste. Confirmá que el remitente esté autorizado por tu proveedor.
- Los demás plugins no son necesarios para esta actualización. No hace falta activar Data API ni crear tablas de contraseñas.

El código bloquea el contenido si `emailVerified` no es verdadero, aunque se desactive accidentalmente la verificación en Neon. Por eso debe estar disponible el envío de códigos para completar el registro.

## 4. Subir el parche y desplegar

1. Extraé el ZIP. Abrí la carpeta extraída y subí **su contenido** a la raíz del repositorio actual. Conservá las carpetas `api`, `server` y `tests`; no juntes sus archivos en la raíz.
2. Reemplazá los archivos existentes con el mismo nombre. Conservá todos los demás archivos del proyecto, incluidos `lessons.js`, `art.js`, `install.js`, imágenes e íconos.
3. Confirmá con **Commit changes**. No subas `node_modules`, `dist` ni archivos `.env` con valores reales.
4. En Vercel, verificá **Framework: Other**, **Node.js: 24.x**, **Root Directory: la carpeta que contiene package.json**, **Build: npm run build**, **Output: dist**. `vercel.json` configura la instalación `npm ci --omit=peer` y las funciones Node.
5. Revisá el nuevo despliegue. Si cargaste las variables después de que empezara la compilación, ejecutá **Redeploy** para que el nuevo servidor las reciba.
6. Probá desde la dirección de producción indicada arriba. Los dominios temporales de Preview no se autorizan automáticamente: para probarlos, se necesitan variables propias y ese dominio exacto autorizado en Neon.

No borres `lessons.js` del repositorio. La compilación deja de copiarlo a `dist`, pero las funciones lo necesitan en el servidor. Vercel incluye sus imports al empaquetar las funciones.

El ZIP contiene solo archivos nuevos o modificados. `ARCHIVOS_LOGIN.txt` enumera cuáles son. No es un proyecto completo independiente.

## 5. Comprobar el funcionamiento real

Estas pruebas se hacen después del despliegue; las pruebas locales con respuestas simuladas no pueden confirmar la entrega de correo ni las credenciales de tu cuenta.

1. Abrí la web en una ventana privada. Debe aparecer el ingreso. Abrí `/api/lessons` en otra pestaña privada: debe responder 401, sin devolver las clases. `/lessons.js` debe dar 404.
2. Creá una cuenta con nombre y un correo al que tengas acceso. Debe llegar el código. Antes de verificarlo, no se deben poder abrir las clases. Probá código incorrecto, reenvío y código correcto.
3. Si Neon no inicia sesión automáticamente al verificar, Huellas te pedirá ingresar con tu contraseña. Es un comportamiento previsto.
4. Comprobá las 15 clases: flechas, teclado, catálogo, enlaces directos como `/#rut/referencias`, ilustraciones e interacción con el cursor. Se conservan las preferencias de movimiento reducido.
5. Ingresá con «Recordarme en este dispositivo» marcado, cerrá y volvé a abrir el navegador. La sesión se conserva mientras siga vigente y el navegador no elimine las cookies. Huellas no guarda la contraseña; podés aceptar el gestor de contraseñas del navegador si querés.
6. Desde el botón de persona del encabezado, abrí «Mi cuenta» y cerrá sesión. Volvé a `/api/lessons`: debe responder 401. La web debe pedir ingreso nuevamente.
7. Probá «¿La olvidaste?»: recibí el enlace, abrilo, cambiá la contraseña e ingresá con la nueva. Un enlace vencido debe permitir solicitar otro. El token se retira de la URL al abrir la pantalla.
8. Registrá y verificá el correo configurado en `HUELLAS_ADMIN_EMAILS`. En «Mi cuenta» debe aparecer «Usuarios de Huellas», con registro y último acceso. Una cuenta común no debe ver ese botón y `/api/users` debe responder 403. Sin sesión debe responder 401.
9. En **Android / Chrome**, registrate o ingresá, instalá desde el catálogo y abrí la PWA. Comprobá las clases, persistencia y cierre de sesión. El nombre e ícono siguen siendo Huellas.
10. En **iPhone / Safari**, hacé la misma prueba y agregá a pantalla de inicio. Safari y la app instalada pueden usar sesiones separadas: si la app pide ingreso la primera vez, iniciá sesión allí y verificá que la recuerde al volver a abrirla. Revisá también el enlace de recuperación desde Mail.
11. Cerrá los modales con Escape y con sus botones; probá navegación por Tab y formularios en pantalla pequeña. La instalación, la cuenta y el catálogo deben abrirse sin superponer sus modales.

«Último acceso» indica la última apertura autenticada de Huellas, no cada cambio de clase ni una medición del tiempo de estudio. La tabla propia no recopila IP ni ubicación. Neon Auth puede conservar sus datos técnicos de sesión como parte de la autenticación administrada.

## Google, opcional

Podés completar toda la instalación usando solo correo y contraseña. El botón de Google está oculto mientras `HUELLAS_GOOGLE_ENABLED=false`.

Para habilitarlo en producción, configurá un cliente OAuth propio en Google y guardá su Client ID y Client Secret en **Neon Auth → Google**; las claves compartidas son para pruebas. En Google, autorizá exactamente esta redirección:

```text
https://ep-proud-poetry-b4jb0n37.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth/callback/google
```

Esa es la redirección de Google hacia Neon. `/api/auth-return` es el retorno posterior de Neon hacia Huellas y no la reemplaza. Configurá la pantalla de consentimiento, sus usuarios de prueba o publicación según corresponda. Después cambiá `HUELLAS_GOOGLE_ENABLED` a `true` en Vercel, redesplegá y probá el flujo completo, incluyendo el regreso a la clase abierta.

## Desarrollo y verificación técnica

Se usa el SDK oficial `@neondatabase/auth/server` para el proxy, las cookies y el intercambio de OAuth, y `@neondatabase/serverless` para consultas parametrizadas. Las versiones están fijadas en `package-lock.json`. El token queda en cookies `HttpOnly`, `Secure` y `SameSite=Lax`, con caché de sesión firmada de hasta 60 segundos. Las consultas de administradores validan una sesión nueva con Neon.

```sh
npm ci --omit=peer
npm test
npm run build
```

Las pruebas de `tests/` cubren bloqueo de acceso, verificación, cookies, cierre de sesión, CSRF, callbacks, filtros de administrador, SQL y recursos públicos. Usan el SDK real con respuestas simuladas de Neon; no crean usuarios ni envían correos.

Para desarrollo local, copiá `.env.example` como `.env.local`, completá sus valores y usá `HUELLAS_SITE_URL=http://localhost:4173`. Autorizá temporalmente ese origen en Neon mediante Allow Localhost. Ejecutá `npm run dev`. Las cookies se marcan Secure: la comprobación de compatibilidad entre navegadores y la instalación PWA deben hacerse en la URL HTTPS de producción. No habilites Localhost solo para desplegar en Vercel.

Si aparece «El acceso está en preparación», revisá las variables y el redeploy. Si funciona el ingreso pero falla «Abriendo tus clases», revisá `DATABASE_URL`, la rama/base elegida y la ejecución de `neon-login.sql`. Si no llega un correo, revisá el SMTP en Neon, spam y el remitente autorizado. Las claves privadas no se incluyen en las respuestas de error.

Referencias técnicas: [adaptadores del SDK oficial](https://github.com/neondatabase/neon-js/blob/main/packages/auth/BUILDING-AN-ADAPTER.md), [flujo de Neon Auth](https://neon.com/docs/auth/authentication-flow), [lista para producción](https://neon.com/docs/auth/production-checklist).
