import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createLocalHandler } from '../serve.mjs';
import { lessons } from '../lessons.js';

const root = new URL('../', import.meta.url);
await import('../build.mjs');

test('the static build contains no class dataset, server source, database script or secrets', async () => {
  const files = await readdir(new URL('dist/', root));
  for (const name of ['lessons.js', 'server', 'api', 'migrations', 'neon-login.sql', '.env.local', '.env.example', 'package-lock.json', 'node_modules', 'CONFIGURAR_LOGIN.md']) assert(!files.includes(name), name);
  for (const name of ['index.html', 'app.js', 'auth.js', 'auth.css', 'admin.js', 'admin.css', 'name-rules.js', 'groups.js', 'groups-ui.js', 'groups.css', 'art.js', 'atlas-f.webp', 'install.js', 'manifest.webmanifest']) assert(files.includes(name));
  const html = await readFile(new URL('dist/index.html', root), 'utf8');
  const app = await readFile(new URL('dist/app.js', root), 'utf8');
  assert(!html.includes(lessons[0].description));
  assert(!/from\s*['"]\.\/lessons\.js/.test(app));
  for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)) {
    if (match[1].startsWith('/') || /^[a-z]+:/i.test(match[1])) continue;
    await stat(new URL('dist/' + match[1], root));
  }
});

test('the local server also denies direct source and class-file access', async () => {
  const handler = createLocalHandler();
  async function invoke(url) {
    let body; const headers = {};
    const res = { writeHead(status, values = {}) { this.statusCode = status; Object.assign(headers, values); }, end(value) { body = value; } };
    await handler({ method: 'GET', url, headers: {} }, res);
    return { status: res.statusCode, headers, body };
  }
  const page = await invoke('/');
  assert.equal(page.status, 200); assert.match(page.headers['Content-Type'], /text\/html/);
  for (const path of ['/lessons.js', '/server/lessons-2026.js', '/server/auth.js', '/server/profile.js', '/server/admin-data.js', '/server/memberships.js', '/migrations/20261021-approval-admin.sql', '/migrations/20261021-google-profile.sql', '/.env.local', '/neon-login.sql', '/package.json']) assert.equal((await invoke(path)).status, 404, path);
  assert.equal((await invoke('/%2e%2e%2fpackage.json')).status, 403);
});

test('the original dataset keeps its 15 classes, all 161 references and the unchanged PWA identity', async () => {
  assert.equal(lessons.length, 15);
  assert.equal(lessons.reduce((sum, lesson) => sum + lesson.references.length, 0), 161);
  const manifest = JSON.parse(await readFile(new URL('dist/manifest.webmanifest', root), 'utf8'));
  assert.equal(manifest.name, 'Huellas · Estudios Bíblicos');
  assert.equal(manifest.short_name, 'Huellas');
  for (const icon of manifest.icons) await stat(new URL('dist/' + icon.src, root));
});

test('legal pages are public HTML without authentication, application scripts or provider requests', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Public documents must not contact an authentication or database service'); });
  const handler = createLocalHandler();
  async function invoke(url, method = 'GET') {
    let body; const headers = {};
    const res = { writeHead(status, values = {}) { this.statusCode = status; Object.assign(headers, values); }, end(value) { body = value; } };
    await handler({ method, url, headers: {} }, res);
    return { status: res.statusCode, headers, body };
  }
  for (const [path, title] of [['/privacidad', 'Política de Privacidad'], ['/terminos', 'Términos y Condiciones de Uso']]) {
    for (const suffix of ['', '/', '/index.html']) {
      const page = await invoke(path + suffix);
      assert.equal(page.status, 200, path + suffix);
      assert.match(page.headers['Content-Type'], /text\/html/);
      assert(!Object.keys(page.headers).some(name => name.toLowerCase() === 'set-cookie'));
      const html = page.body.toString();
      assert(html.includes(`<h1>${title}</h1>`));
      assert(!/<script\b|\/api\/|id="huellas-app"/.test(html));
      for (const match of html.matchAll(/(?:src|href)="(\/[^"#?]*)(?:\?[^"#]*)?"/g)) {
        assert.equal((await invoke(match[1])).status, 200, `${path}: ${match[1]}`);
      }
      for (const match of html.matchAll(/href="#([^"]+)"/g)) assert(html.includes(`id="${match[1]}"`), match[1]);
    }
    const head = await invoke(path, 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, undefined);
  }
  assert.equal(fetch.mock.callCount(), 0);
});
