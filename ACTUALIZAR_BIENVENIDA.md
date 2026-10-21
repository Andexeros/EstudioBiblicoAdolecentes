# Huellas — Bienvenida para cuentas ya aprobadas

Este parche se aplica sobre la versión que ya envía los correos de aprobación
(revisión `816d8e7`). Reutiliza su plantilla y SMTP sin cambiar sus variables.

## 1. Ejecutar el SQL en Neon

En **SQL Editor**, seleccioná la misma rama, base y rol propietario que utiliza
`DATABASE_URL` en Vercel. Ejecutá completo:

`migrations/20261021-welcome-existing-users.sql`

Copiá desde `BEGIN;` hasta `COMMIT;`. Necesita la migración de correo anterior,
que ya tenés instalada. No hace falta volver a ejecutar las migraciones viejas.
Si aparece un error, no publiques el parche; ejecutá `ROLLBACK;` si quedó una
transacción abierta y revisá el error antes de reintentar.

La migración puede repetirse. Solo actualiza una función propia de Huellas:
no envía correos, no cambia estados, grupos ni roles y no modifica Neon Auth.

## 2. Subir el parche

Descomprimí el ZIP en la raíz del repositorio conservando las carpetas y
reemplazando los archivos. En GitHub Desktop, hacé **Commit** y **Push origin**.
Esperá el despliegue de Vercel y recargá Huellas o cerrá y reabrí la PWA.

No hay nuevas variables de entorno, dependencias ni cambios de SMTP.

## 3. Enviar las bienvenidas

En **Administración → Todos los usuarios**, filtrá por **Aprobados**.

- Las cuentas sin notificación muestran **Enviar correo de bienvenida**.
- Confirmá el envío de cada cuenta. No se envía un lote automáticamente.
- Al aceptarlo el SMTP, se registra **Bienvenida enviada** con su fecha y se
  retira el botón. El servidor impide repetir ese envío desde un listado viejo.
- Si falla, queda **Reenviar correo**, con la espera y los límites actuales.
- Si figura **sin confirmar**, consultá primero si llegó antes de reenviarlo.
  Una interrupción de SMTP puede impedir saber si el proveedor lo aceptó.

Se conservan los permisos actuales: un administrador gestiona usuarios
ordinarios; el propietario también puede gestionar administradores. La cuenta
propietaria continúa protegida. Se exige correo verificado y, para Google,
nombre confirmado. La aprobación del destinatario nunca se modifica.

## Comprobaciones

1. Enviá a una cuenta antigua aprobada sin notificación. Debe recibir la misma
   bienvenida con su nombre y grupo, y seguir aprobada.
2. Actualizá el panel: debe mostrar la fecha y no ofrecer otro envío exitoso.
3. Un segundo clic simultáneo o una petición antigua no debe enviar otro correo.
4. Un envío fallido debe permitir **Reenviar correo** después del plazo actual.
5. Las cuentas pendientes, bloqueadas o sin correo verificado no pueden recibir
   esta bienvenida mediante el botón. Los permisos administrativos se conservan.
6. La aprobación de una cuenta nueva debe seguir enviando su correo normalmente.

Las pruebas locales usan correo simulado: el envío real se comprueba después
del despliegue, usando el SMTP que ya funciona en producción.

Validación: 154 pruebas del proyecto, 21 comprobaciones en PostgreSQL local y
11 pruebas de los controles del panel; todas correctas. Compilación correcta.
