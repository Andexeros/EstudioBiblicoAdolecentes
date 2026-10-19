# Pruebas de instalación de Huellas

Probá sobre el despliegue HTTPS de Vercel del último commit. Las comprobaciones automatizadas de esta entrega simulan los eventos y estados del DOM; el sistema y el navegador controlan la instalación real.

## Android con Chrome

1. Abrí Huellas en Chrome, entrá en una clase distinta de Jonás y abrí **Las 15 clases**.
2. Pulsá **Instalar app**. Si Chrome ofrece el evento de instalación, debe aparecer su cuadro nativo con Huellas y la nueva Biblia.
3. Cancelá una vez. Comprobá que vuelve el catálogo, que el botón funciona de nuevo y que no se intenta reutilizar el mismo cuadro nativo.
4. Instalá desde el botón, si está disponible, o siguiendo las instrucciones manuales. Verificá que el nombre no sea el título de la clase.
5. Abrí Huellas desde su nuevo ícono. Debe abrir como aplicación y el catálogo debe ocultar **Instalar app**.
6. Cambiá de clase y abrí referencias. Comprobá que ilustraciones, animaciones y enlaces conservan su funcionamiento.

El navegador decide cuándo habilitar el cuadro nativo y puede dejar de ofrecerlo tras una cancelación. El botón presenta instrucciones cuando no dispone del evento.

## iPhone con Safari

1. Abrí el despliegue en Safari. Entrá en una clase, abrí el catálogo y tocá **Instalar app**.
2. Debe aparecer un solo diálogo con cuatro pasos y el catálogo debe quedar cerrado detrás.
3. Cerrá las instrucciones con la X y con **Entendido**. Debe volver el catálogo con su posición conservada.
4. Seguí la guía: Safari → Compartir → **Agregar a pantalla de inicio** o **Agregar a Inicio** → **Agregar**. Si aparece **Abrir como app**, dejalo activado. Compartir puede estar dentro del menú Más según la disposición de Safari.
5. Confirmá el nombre Huellas y el ícono de la Biblia. Abrí la app desde la pantalla de inicio.
6. Comprobá que el catálogo oculta el botón de instalación y que el encabezado, la lectura y los controles quedan accesibles en vertical y horizontal.

En iPad con navegación de escritorio también deben mostrarse las instrucciones para iOS.

## Escritorio y accesibilidad

- Chrome o Edge: probar el cuadro nativo cuando esté disponible y la guía manual cuando no lo esté.
- Safari para Mac: la guía indica **Archivo → Agregar al Dock**. La opción depende de la versión de macOS.
- Navegador sin instalación: verificar que las clases funcionan y se muestra la guía alternativa.
- Usar Tab y Shift+Tab dentro de ambos diálogos. El foco debe permanecer en el diálogo activo. Escape, la X y Entendido deben cerrar las instrucciones y devolver el foco a **Instalar app**.
- Con las instrucciones abiertas, las flechas izquierda y derecha no deben cambiar de estudio.
- Revisar a 320/390 píxeles de ancho y con zoom al 200%: debe poder desplazarse el contenido y seguir accediendo a los botones.

## Identidad anterior y caché

El manifiesto mantiene identidad y URL de inicio estables, sin año ni clase. Los íconos usan nombres `v2`, el favicon SVG incluye una versión en su URL y los recursos se revalidan al solicitarlos. No hay un service worker que mantenga una copia offline anterior.

Si ya existía un acceso directo con el nombre de una clase o el isotipo anterior, quitá ese acceso directo y agregá Huellas de nuevo desde el sitio actualizado. La actualización del ícono de una app instalada depende del sistema y no ocurre necesariamente al mismo tiempo que la publicación.

Para futuras colecciones, conservá `id`, `start_url`, `scope`, el nombre Huellas y la ubicación del manifiesto. Actualizá el año del contenido sin incorporarlo al nombre de la aplicación.

## Referencias técnicas

- [MDN: instalación de PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
- [MDN: instalación desde un botón](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt).
- [Apple: convertir un sitio en una app en iPhone](https://support.apple.com/es-mx/guide/iphone/iphea86e5236/ios).
- [Apple: apps web de Safari en Mac](https://support.apple.com/es-lamr/104996).
