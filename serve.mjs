import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeHandler } from './server/http.js';
import { authProxy, authReturn } from './server/auth.js';
import { sessionEndpoint, lessonsEndpoint, usersEndpoint, preferencesEndpoint, adminEndpoint } from './server/api.js';

const publicRoot = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff':'font/woff', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.m4a':'audio/mp4' };
const handlers = new Map([
  ['/api/auth-return', nodeHandler(authReturn)], ['/api/session', nodeHandler(sessionEndpoint)],
  ['/api/lessons', nodeHandler(lessonsEndpoint)], ['/api/users', nodeHandler(usersEndpoint)],
  ['/api/preferences', nodeHandler(preferencesEndpoint)], ['/api/admin', nodeHandler(adminEndpoint)],
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
      if (['.mp3', '.m4a'].includes(extname(file))) {
        const { size } = await stat(file);
        const headers = { 'Content-Type': types[extname(file)], 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
        let start = 0, end = size - 1, status = 200;
        if (req.headers.range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
          if (match && (match[1] || match[2])) {
            start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
            end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
          }
          if (!match || (!match[1] && !match[2]) || start > end || start >= size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
            res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }); res.end(); return;
          }
          status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
        }
        headers['Content-Length'] = end - start + 1;
        res.writeHead(status, headers);
        if (req.method === 'HEAD') { res.end(); return; }
        const stream = createReadStream(file, { start, end });
        stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
        return;
      }
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
