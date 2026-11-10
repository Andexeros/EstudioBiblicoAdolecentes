# Huellas · Clases de noviembre de 2026

El parche incorpora dos estudios a la colección 2026. Huellas abre con el más reciente de cada grupo.

| Grupo | Clase nueva | Total |
| --- | --- | --- |
| Adolescentes | La envidia | 18 |
| Grupo Intermedio | Estoicismo y Evangelio | 14 |
| Grupo Grande | Estoicismo y Evangelio | 14 |

La envidia conserva el relato de Saúl y David, las cuatro reacciones ante un logro ajeno y la práctica del contentamiento. Estoicismo y Evangelio incorpora la autoayuda, la ley de atracción, el estoicismo y el ejemplo de Juan el Bautista. Cada clase reúne doce referencias; el relato de Juan se enlaza a Juan 3:26–30. Intermedio y Grande comparten un mismo estudio.

Las ilustraciones se generaron con el generador integrado de imágenes. Están en `atlas-g.webp` y sus prompts completos, en `artwork-prompts.json`. Se conserva el motor de animación existente.

## Aplicar

1. Extraé el ZIP en la **raíz del repositorio local de Huellas**, conservando las carpetas `server/` y `tests/`. Reemplazá los archivos que coincidan.
2. En GitHub Desktop, revisá los cambios y hacé **Commit → Push**. Esperá el despliegue de Vercel.
3. Entrá con una cuenta aprobada y revisá **Mis estudios**. La envidia aparece primero en Adolescentes. Estoicismo y Evangelio aparece primero en Intermedio y en Grande.

No hay que ejecutar SQL ni agregar variables. Las clases siguen llegando por la API autenticada. Las presentaciones originales no se publican.

## Verificación

- `npm test`: 184 pruebas aprobadas. Se comprobó el orden, las referencias, el acceso protegido y los grupos asignados.
- `npm run build`: compilación correcta con el nuevo atlas.
- Seis pruebas con el canvas real: ambas ilustraciones en tamaños de escritorio y móvil, y con movimiento reducido. La prueba del despliegue con una sesión real se realiza después de aplicar el parche.
