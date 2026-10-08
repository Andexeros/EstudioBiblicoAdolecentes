# Huellas · Proyecto para Vercel

Esta versión conserva la web y las quince clases. Todos los archivos que necesitás subir están en una misma carpeta. La compilación utiliza `build.mjs` directamente y las imágenes y la tipografía se cargan desde la raíz.

## Actualizar el repositorio que ya creaste

1. Descargá el ZIP y usá **Extraer todo** en Windows.
2. Abrí la carpeta extraída. Seleccioná sus dieciocho archivos.
3. En la página principal de tu repositorio de GitHub, elegí **Add file → Upload files** y arrastrá esos archivos.
4. Confirmá con **Commit changes**. Los archivos con el mismo nombre actualizan la versión anterior.
5. Revisá el nuevo despliegue de Vercel, que debe utilizar ese último commit.

Los archivos deben quedar en la raíz del repositorio, con sus nombres originales. Los duplicados con nombres como `app (1).js` no se utilizan para la web; podés eliminarlos después.

## Configuración de Vercel

La configuración está en `vercel.json`: framework **Other**, comando de compilación **npm run build**, carpeta de salida **dist**. No requiere variables de entorno, servicios de IA ni dependencias de npm.

La carpeta `dist` se genera durante la compilación. No necesitás crearla ni subirla a GitHub.

## Editar y probar

`lessons.js` contiene las quince clases, sus colores y las 161 referencias bíblicas. `references-provenance.json` conserva el origen de cada referencia en los PDF. `styles.css` define el diseño; `app.js` controla la navegación y `art.js` las ilustraciones geométricas. Los tres archivos `atlas-*.webp` contienen las ilustraciones originales.

Con Node.js 20 o superior, ejecutá `npm run dev` y abrí `http://localhost:4173`. Para compilar: `npm run build`. Para ver el resultado compilado: `npm start`.

## Contenido y recursos

Se conservaron las historias, puntos clave, conclusiones y todas las referencias de las quince clases. Se eliminaron actividades de apertura, juegos, videos de apoyo y contenido ajeno al tema. Las citas que estaban dentro de imágenes se recuperaron visualmente. Las referencias se abren en BibleGateway, versión RVR1960.

Las ilustraciones se generaron para el proyecto. La licencia de la tipografía URW Gothic Demi está en `FONT-LICENSE.txt`. El diseño contempla celulares, navegación por teclado y preferencias de movimiento reducido.

La compilación y las pruebas funcionales de contenido y navegación pasaron. La revisión visual en un navegador no pudo completarse desde el entorno de creación.
