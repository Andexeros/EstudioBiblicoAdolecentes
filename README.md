# Huellas · Estudios Bíblicos

Versión 1.1.0 · Identidad e instalación · 19/10/2026. Mantiene las quince clases y sus 161 referencias, ilustraciones, animaciones y navegación original. Todos los archivos que necesitás subir están en una misma carpeta.

## Actualizar el repositorio que ya creaste

1. Descargá el ZIP y usá **Extraer todo** en Windows.
2. Abrí la carpeta extraída y seleccioná todos sus archivos descomprimidos.
3. En la página principal de tu repositorio de GitHub, elegí **Add file → Upload files** y arrastrá esos archivos.
4. Confirmá con **Commit changes**. Los archivos con el mismo nombre actualizan la versión anterior.
5. Revisá el nuevo despliegue de Vercel, que debe utilizar ese último commit.

Los archivos deben quedar en la raíz del repositorio, con sus nombres originales. Los duplicados con nombres como `app (1).js` no se utilizan para la web; podés eliminarlos después.

## Identidad e instalación

El encabezado, favicon e íconos utilizan una Biblia abierta vectorial, sin cruz. La marca Huellas y el nombre de instalación son independientes de la clase abierta y del año de la colección.

En **Las 15 clases**, el botón **Instalar app** abre el cuadro nativo cuando el navegador lo ofrece. En los demás casos presenta instrucciones según el dispositivo. El catálogo se cierra mientras se muestran las instrucciones y vuelve al cerrar, con el foco y la posición conservados. El botón se oculta en modo de aplicación instalada o al recibir la confirmación de instalación.

Probá la instalación en la dirección **HTTPS publicada en Vercel**. Abrir `index.html` desde el disco no permite comprobar el cuadro de instalación nativo. Esta entrega no incorpora un service worker ni funcionalidad offline.

- `CAMBIOS_PWA.md`: detalle de los archivos modificados, nuevos y conservados.
- `GUIA_PWA.md`: pruebas en Android, iPhone, escritorio y dispositivos con una instalación anterior.

## Configuración de Vercel

La configuración está en `vercel.json`: framework **Other**, comando de compilación **npm run build**, carpeta de salida **dist**. No requiere variables de entorno, servicios de IA ni dependencias de npm.

La carpeta `dist` se genera durante la compilación. No necesitás crearla ni subirla a GitHub.

## Editar y probar

`lessons.js` contiene las quince clases, sus colores y las 161 referencias bíblicas. `references-provenance.json` conserva el origen de cada referencia en los PDF. `styles.css` define el diseño; `app.js` controla la navegación y `art.js` las ilustraciones geométricas. Los tres archivos `atlas-*.webp` contienen las ilustraciones originales.

Con Node.js 20 o superior, ejecutá `npm run dev` y abrí `http://localhost:4173`. Para compilar: `npm run build`. Para ver el resultado compilado: `npm start`.

## Contenido y recursos

Se conservaron las historias, puntos clave, conclusiones y todas las referencias de las quince clases. Se eliminaron actividades de apertura, juegos, videos de apoyo y contenido ajeno al tema. Las citas que estaban dentro de imágenes se recuperaron visualmente. Las referencias se abren en BibleGateway, versión RVR1960.

Las ilustraciones se generaron para el proyecto. La licencia de la tipografía URW Gothic Demi está en `FONT-LICENSE.txt`. El diseño contempla celulares, navegación por teclado y preferencias de movimiento reducido.

La compilación y las pruebas funcionales de contenido, navegación y estados de instalación pasaron. La instalación real y la revisión visual en navegador requieren las pruebas de `GUIA_PWA.md`.
