import { cp, mkdir, rm } from 'node:fs/promises';
await rm(new URL('./dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
// lessons.js is server-only: Vercel functions import it outside the public dist/ directory.
for (const name of ['index.html', 'styles.css', 'identity.css', 'auth.css', 'groups.css', 'groups.js', 'groups-ui.js', 'app.js', 'auth.js', 'install.js', 'art.js', 'atlas-a.webp', 'atlas-b.webp', 'atlas-c.webp', 'huellas-display.woff', 'manifest.webmanifest', 'huellas-biblia.svg', 'favicon.svg', 'huellas-favicon-16-v2.png', 'huellas-favicon-32-v2.png', 'huellas-apple-touch-180-v2.png', 'huellas-icon-192-v2.png', 'huellas-icon-512-v2.png', 'huellas-maskable-192-v2.png', 'huellas-maskable-512-v2.png', 'music.css', 'music.js', 'music-core.js', 'music-playlist.js', 'audio', 'FONT-LICENSE.txt']) {
  await cp(new URL(`./${name}`, import.meta.url), new URL(`./dist/${name}`, import.meta.url), { recursive: true });
}
console.log('Huellas: interfaz generada en dist/. Las clases se sirven mediante /api/lessons con sesión verificada.');
