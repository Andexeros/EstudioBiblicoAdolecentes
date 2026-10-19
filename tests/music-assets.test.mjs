import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { musicPlaylist } from '../music-playlist.js';

const root = new URL('../', import.meta.url);
test('all 16 playlist entries point to real, unique MP3 files with descriptive titles', async () => {
  assert.equal(musicPlaylist.length, 16);
  assert.equal(new Set(musicPlaylist.map(track => track.id)).size, 16);
  assert.equal(new Set(musicPlaylist.map(track => track.src)).size, 16);
  for (const track of musicPlaylist) {
    assert(track.title.length > 3); assert.match(track.src, /^audio\/[a-z0-9-]+\.mp3$/);
    assert(track.duration > 60 && track.duration < 600);
    const file = new URL(track.src, root); const info = await stat(file);
    assert(info.size > 100000 && info.size < 10000000);
    const bytes = await readFile(file); assert.equal(bytes.subarray(0, 3).toString(), 'ID3');
  }
  assert.equal((await readdir(new URL('audio/', root))).filter(name => name.endsWith('.mp3')).length, 16);
});
test('the player is loaded as a separate module and audio has no preload links', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.match(html, /type="module" src="music\.js\?v=/);
  assert.match(html, /rel="stylesheet" href="music\.css\?v=/);
  assert(!/rel="preload"[^>]*(?:audio|\.mp3)/.test(html));
  const build = await readFile(new URL('build.mjs', root), 'utf8');
  for (const file of ['music.css', 'music.js', 'music-core.js', 'music-playlist.js', 'audio']) assert(build.includes(`'${file}'`));
});
test('music styles stay scoped and reduced motion disables the player animations', async () => {
  const css = await readFile(new URL('music.css', root), 'utf8');
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /animation:none!important/);
  assert.match(css, /touch-action:none/);
  assert(!/serviceWorker|caches\.open/.test(await readFile(new URL('music.js', root), 'utf8')));
});
