import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.argv[2] || '.');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff':'font/woff', '.woff2':'font/woff2' };
const port = Number(process.env.PORT || 4173);
createServer(async (req,res) => {
  try {
    let file = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (file !== root && !file.startsWith(root + sep)) {res.writeHead(403);res.end();return;}
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    res.writeHead(200, {'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache'});
    res.end(await readFile(file));
  } catch {res.writeHead(404);res.end('No encontrado');}
}).listen(port, '0.0.0.0', () => console.log(`Huellas en puerto ${port}`));
