import { cp, mkdir, rm } from 'node:fs/promises';
await rm(new URL('./dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
for (const name of ['index.html', 'styles.css', 'app.js', 'art.js', 'lessons.js', 'atlas-a.webp', 'atlas-b.webp', 'atlas-c.webp', 'huellas-display.woff', 'favicon.svg', 'FONT-LICENSE.txt']) {
  await cp(new URL(`./${name}`, import.meta.url), new URL(`./dist/${name}`, import.meta.url), { recursive: true });
}
console.log('Huellas: sitio estático generado en dist/.');
