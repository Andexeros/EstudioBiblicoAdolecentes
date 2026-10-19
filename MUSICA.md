# Música instrumental en Huellas

El reproductor flotante de Huellas utiliza las 16 canciones ya incorporadas al proyecto, convertidas a MP3 estéreo de 128 kbps / 44,1 kHz. Se corrigieron los encabezados defectuosos de los M4A antes de convertirlos y se verificaron la decodificación completa y las duraciones de los MP3. El ZIP pequeño de inicio automático solo actualiza tres archivos; no vuelve a incluir los audios.

## Incorporar el parche

1. Extraé todo el ZIP en Windows.
2. En GitHub Desktop, seleccioná el repositorio actual y pulsá **Fetch origin / Pull origin** si hay cambios pendientes por descargar.
3. Elegí **Repository → Show in Explorer**. Copiá allí todo el contenido del ZIP, junto a `index.html` y `package.json`. Combiná las carpetas y reemplazá los archivos que coincidan.
4. Revisá la lista de cambios. Escribí `Agregar reproductor instrumental`, pulsá **Commit to main** y luego **Push origin**.
5. Esperá el nuevo despliegue de Vercel en estado **Ready** y recargá Huellas.

No requiere nuevas variables de Vercel ni cambios en Neon. La compilación sigue siendo `npm run build`, con salida `dist`. El parche se preparó sobre el commit `060c695` del repositorio actual.

## Usar el reproductor

El círculo aparece después de ingresar, mientras recorrés las clases. La música intenta comenzar con el primer clic, toque o al terminar un deslizamiento del dedo; también con Enter o Espacio. No hace falta abrir el reproductor. Si habías elegido silenciarla o dejar el volumen en cero, se respeta esa preferencia y podés iniciarla desde Reproducir. Cerrar el panel permite seguir escuchando. Los cambios de clase, el catálogo y el desplazamiento de la página conservan la misma instancia de audio y la posición de reproducción.

La mezcla está siempre activa. Cada carga de la página prepara un orden nuevo; la primera canción evita la última que realmente se escuchó, si hay más de una. Se recorre la lista completa antes de mezclar otra vez y se evita repetir una canción al unir dos rondas. Elegir una canción manualmente la retira de las pendientes de esa ronda. «Anterior» recorre el historial de esta sesión y «Siguiente» vuelve a avanzar por él antes de continuar la mezcla.

Una canción seleccionada con la música pausada queda preparada, sin descargarse. Si hay reproducción en curso, se reproduce la elegida. Al silenciar, se pausa el audio para evitar que avance en silencio; activar el sonido retoma lo que se estaba escuchando. Reproducir desde el estado silenciado activa el sonido expresamente. El volumen, el silencio, la última canción y la posición del círculo se recuerdan localmente.

En cada recarga se espera una interacción real, sin descargar audio antes de ella. Después de arrancar, pausar o silenciar desde los controles, la navegación no vuelve a activar la música. Algunos navegadores no habilitan audio con un deslizamiento: en ese caso se intenta con el próximo toque y sigue disponible Reproducir. Los rechazos de `play()` se gestionan sin bucles ni intentos por temporizador. La reproducción en segundo plano puede depender de las restricciones del navegador y del sistema operativo.

Podés arrastrar el círculo con el dedo o el mouse. Los gestos cortos abren el panel; un arrastre lo mueve. Su posición se ajusta al área visible, la orientación, el teclado de pantalla y los márgenes seguros. Con teclado: Tab para llegar al círculo, Enter para abrirlo y **Alt + flechas** para moverlo. Escape cierra el panel y devuelve el foco al círculo. Tab permite salir del panel sin bloquear la navegación de la página.

En iPhone / iPad, el volumen se ajusta con los botones del dispositivo; el control de silencio sigue disponible. Los controles del sistema operativo se agregan mediante Media Session cuando el navegador los admite.

## Agregar, quitar o reemplazar canciones

Los archivos se guardan en **`audio/`**, en la raíz del proyecto. La configuración está en **`music-playlist.js`**. No hace falta editar la lógica del reproductor.

Para agregar una canción, copiá su MP3 a `audio/` y agregá un objeto a la lista:

```js
{
  "id": "mi-nueva-cancion",
  "title": "Título que se muestra al usuario",
  "src": "audio/mi-nueva-cancion.mp3",
  "duration": 180,
  "artist": "Intérprete"
}
```

- `id`: único y estable, preferentemente sin espacios.
- `title`: nombre visible; puede tener espacios, tildes y signos.
- `src`: ruta real y exacta del archivo. Vercel distingue mayúsculas y minúsculas.
- `duration`: opcional, en segundos, para mostrar una duración antes de cargar el audio. Al reproducir se usa la duración real.
- `artist`: opcional, para los controles del sistema operativo.

Para quitar una canción, eliminá su objeto de la lista y, si ya no se usa, su archivo. Para reemplazarla, cambiá `src` o sustituí el MP3. Si usás el mismo nombre, conviene cambiar también la ruta con una versión, por ejemplo `audio/mi-cancion-v2.mp3`, para distinguir el recurso actualizado.

Se admite una sola canción y también una lista vacía. Los errores de carga pasan a otra canción; si fallan todas, se detienen los intentos y se muestra un mensaje. La biblioteca no se descarga al abrir la página: se solicita solo la canción que el usuario decide reproducir. No se agregó caché offline ni se modificó el manifiesto PWA.

## Archivos del parche

Modificados: `index.html` (enlaces al módulo y su CSS), `build.mjs` (copia los nuevos recursos), `serve.mjs` (tipo de audio y solicitudes de fragmentos para pruebas locales).

Nuevos: `music.js`, `music.css`, `music-core.js`, `music-playlist.js`, esta guía, las pruebas `tests/music-core.test.mjs` y `tests/music-assets.test.mjs`, y los 16 MP3 de `audio/`.

Se conservan las clases, sus referencias, `art.js`, los atlas de ilustraciones, `app.js`, `auth.js`, las API de Neon, el panel administrativo, los estilos originales, `install.js`, el manifiesto y todos los íconos.

## Pruebas

```sh
npm ci --omit=peer
npm test
npm run build
```

Las pruebas automatizadas cubren mezcla, historial, errores, bloqueo de autoplay, silencio, volumen, progreso, geometría en distintas pantallas y publicación de los recursos. La integración del panel y la continuidad entre clases también se comprueban con DOM y medios simulados. Estas comprobaciones no sustituyen la reproducción y la revisión visual en dispositivos reales.

Después de desplegar:

1. En Android / Chrome y en la PWA instalada, probá entrar sin el sonido silenciado y tocar cualquier parte de la clase o deslizar el dedo. La música debe intentar comenzar sin abrir el reproductor. Si el navegador exige un toque, probalo después del deslizamiento. Cambiá entre las 15 clases, abrí el catálogo, cerrá el reproductor y desplazá el estudio. El tiempo de reproducción debe continuar.
2. Arrastrá el círculo hasta los cuatro bordes y girá el celular. Comprobá que se conserve visible, que un arrastre no abra el panel y que los controles del panel entren en la pantalla.
3. Probá pausa, silencio, volumen, anterior, siguiente, progreso y selección manual. Después de pausar o silenciar, tocar o deslizar por las clases no debe reactivar el sonido. Al recargar, debe preparar otra primera canción cuando existan varias y esperar una interacción; si quedó silenciado, debe conservar el silencio.
4. En iPhone / Safari y en la app agregada a pantalla de inicio, repetí las pruebas. Revisá los botones físicos de volumen y los controles de pantalla bloqueada cuando se ofrezcan.
5. En Chrome, Edge, Firefox y Safari de escritorio, probá Tab, Enter, Escape y Alt + flechas. Verificá que manejar la música no cambie de clase y que la preferencia de movimiento reducido desactive las animaciones del reproductor.
6. Cerrá sesión: la música debe detenerse y el reproductor debe desaparecer con las clases. El registro, la verificación y el panel de usuarios mantienen su funcionamiento anterior.

Para probar localmente, `npm run dev` usa la configuración de Neon ya existente. El servidor local admite el tipo `audio/mpeg` y solicitudes HTTP Range para buscar posiciones dentro del audio. En producción, los MP3 se sirven como archivos estáticos de Vercel.

## Actualización: inicio con la primera interacción

El ZIP pequeño de esta actualización reemplaza únicamente `music.js`, `index.html` y esta guía. Se preparó sobre el commit `17f72ec`, que ya incluye el reproductor y las 16 canciones. Copiá su contenido en la raíz del repositorio actual y hacé Commit y Push desde GitHub Desktop; no hace falta volver a subir los audios ni cambiar la configuración de Neon o Vercel.
