import { cp, mkdir, rm } from 'node:fs/promises';
await rm(new URL('./dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
for (const name of ['index.html', 'styles.css', 'identity.css', 'app.js', 'install.js', 'art.js', 'lessons.js', 'atlas-a.webp', 'atlas-b.webp', 'atlas-c.webp', 'huellas-display.woff', 'manifest.webmanifest', 'huellas-biblia.svg', 'favicon.svg', 'huellas-favicon-16-v2.png', 'huellas-favicon-32-v2.png', 'huellas-apple-touch-180-v2.png', 'huellas-icon-192-v2.png', 'huellas-icon-512-v2.png', 'huellas-maskable-192-v2.png', 'huellas-maskable-512-v2.png', 'FONT-LICENSE.txt']) {
  await cp(new URL(`./${name}`, import.meta.url), new URL(`./dist/${name}`, import.meta.url), { recursive: true });
}
console.log('Huellas: sitio estático generado en dist/.');
