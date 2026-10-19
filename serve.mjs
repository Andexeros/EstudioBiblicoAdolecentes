import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeHandler } from './server/http.js';
import { authProxy, authReturn } from './server/auth.js';
import { sessionEndpoint, lessonsEndpoint, usersEndpoint } from './server/api.js';

const publicRoot = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff':'font/woff', '.woff2':'font/woff2' };
const handlers = new Map([
  ['/api/auth-return', nodeHandler(authReturn)], ['/api/session', nodeHandler(sessionEndpoint)],
  ['/api/lessons', nodeHandler(lessonsEndpoint)], ['/api/users', nodeHandler(usersEndpoint)],
]);
const authHandler = nodeHandler(authProxy);

export function createLocalHandler() {
  return async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const api = handlers.get(pathname) || (pathname.startsWith('/api/auth/') ? authHandler : null);
      if (api) { await api(req, res); return; }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      // Never serve the source directory: it contains server code, lessons and local secrets.
      let file = resolve(publicRoot, '.' + decodeURIComponent(pathname));
      if (file !== publicRoot && !file.startsWith(publicRoot + sep)) { res.writeHead(403); res.end(); return; }
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch { res.writeHead(404); res.end('No encontrado'); }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) await import('./build.mjs');
  const port = Number(process.env.PORT || 4173);
  createServer(createLocalHandler()).listen(port, '127.0.0.1', () => console.log(`Huellas en http://localhost:${port}`));
}
