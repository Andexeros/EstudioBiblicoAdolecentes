import test from 'node:test';
import assert from 'node:assert/strict';
import { ShuffleQueue, MusicEngine, readMusicSettings, writeMusicSettings, MUSIC_STORAGE_KEY,
  playerBounds, restorePosition, rememberPosition, clampPosition, panelPosition } from '../music-core.js';

function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const delay = () => new Promise(resolve => setImmediate(resolve));
const songs = Array.from({ length: 4 }, (_, i) => ({ id: 'song-' + i, title: 'Canción ' + i, src: 'audio/song-' + i + '.mp3', duration: 120 }));
class FakeAudio extends EventTarget {
  constructor() { super(); this.paused = true; this.currentTime = 0; this.duration = NaN; this.currentSrc = ''; this.sources = []; this.starts = 0; this.loads = 0; this._volume = 1; }
  set src(value) { this.currentSrc = value; this.sources.push(value); this.currentTime = 0; this.duration = NaN; }
  get src() { return this.currentSrc; }
  set volume(value) { this._volume = value; }
  get volume() { return this._volume; }
  play() { this.starts++; if (this.behavior) return this.behavior(this); return this.succeed(); }
  succeed() { this.paused = false; this.duration = 120; this.dispatchEvent(new Event('loadedmetadata')); this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
  pause() { const changed = !this.paused; this.paused = true; if (changed) this.dispatchEvent(new Event('pause')); }
  removeAttribute(name) { if (name === 'src') this.currentSrc = ''; }
  load() { this.loads++; this.duration = NaN; this.currentTime = 0; }
}
function setup(t, tracks = songs, options = {}) {
  const audio = new FakeAudio(), saved = [];
  const engine = new MusicEngine(tracks, audio, { random: seeded(17), remember: patch => saved.push(patch), ...options });
  t.after(() => engine.destroy()); return { engine, audio, saved };
}

for (const count of [1, 2, 16]) test(`shuffle plays each of ${count} tracks once per cycle and avoids boundary repetitions`, () => {
  const ids = Array.from({ length: count }, (_, i) => String(i));
  for (let seed = 0; seed < 50; seed++) {
    const queue = new ShuffleQueue(ids, { random: seeded(seed), lastTrack: ids[0] });
    let last = ids[0];
    for (let cycle = 0; cycle < 6; cycle++) {
      const round = Array.from({ length: count }, () => queue.next());
      assert.equal(new Set(round).size, count);
      assert.deepEqual([...round].sort(), [...ids].sort());
      if (count > 1) assert.notEqual(round[0], last);
      last = round.at(-1);
    }
  }
});
test('manual selection removes the chosen track from the remaining shuffle cycle', () => {
  const queue = new ShuffleQueue(['a', 'b', 'c', 'd'], { random: seeded(10) });
  const first = queue.next();
  const selected = queue.remaining.at(-1); queue.select(selected);
  const rest = Array.from({ length: 2 }, () => queue.next());
  assert.equal(new Set([first, selected, ...rest]).size, 4);
  assert.notEqual(queue.next(), rest.at(-1));
});
test('previous follows listening history and next returns through the same history', () => {
  const queue = new ShuffleQueue(['a', 'b', 'c'], { random: seeded(2) });
  const a = queue.next(), b = queue.next(), c = queue.next();
  assert.equal(queue.previous(), b); assert.equal(queue.previous(), a);
  assert.equal(queue.next(), b); assert.equal(queue.next(), c);
});
test('missing or excluded tracks and an empty playlist terminate cleanly', () => {
  const queue = new ShuffleQueue(['a', 'b']); queue.next();
  assert.equal(queue.next(new Set(['a', 'b'])), null);
  assert.equal(new ShuffleQueue([]).next(), null);
  assert.equal(queue.select('unknown'), queue.current);
});
test('corrupted or inaccessible local storage does not prevent music controls', () => {
  assert.equal(readMusicSettings({ getItem() { throw new Error('denied'); } }).volume, .35);
  assert.equal(readMusicSettings({ getItem: () => 'invalid JSON' }).lastTrack, '');
  assert.equal(writeMusicSettings({ setItem() { throw new Error('full'); } }, {}), false);
  const entries = new Map(); const storage = { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
  const settings = { muted: true, volume: .2, lastTrack: 'song-2', position: { x: .3, y: .8 } };
  assert(writeMusicSettings(storage, settings)); assert(entries.has(MUSIC_STORAGE_KEY));
  assert.deepEqual(readMusicSettings(storage), { ...settings, version: 1 });
});
for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }, { width: 260, height: 300, offsetLeft: 30, offsetTop: 80 }]) test(`button and panel respect the visible ${viewport.width}×${viewport.height} viewport and safe areas`, () => {
  const bounds = playerBounds(viewport, { top: 24, bottom: 34, right: 8, left: 8 });
  const position = clampPosition({ x: -999, y: 9999 }, bounds);
  assert.equal(position.x, bounds.minX); assert.equal(position.y, bounds.maxY);
  const normalized = rememberPosition(position, bounds);
  assert.deepEqual(restorePosition(normalized, bounds), position);
  const width = Math.min(340, bounds.maxX + bounds.size - bounds.minX), height = Math.min(410, bounds.maxY + bounds.size - bounds.minY);
  const panel = panelPosition(position, bounds, width, height);
  assert(panel.x >= bounds.minX && panel.y >= bounds.minY);
  assert(panel.x + width <= bounds.maxX + bounds.size + .001);
  assert(panel.y + height <= bounds.maxY + bounds.size + .001);
});
test('restoring a saved mobile position adapts to a desktop or rotated viewport', () => {
  const small = playerBounds({ width: 390, height: 844 });
  const saved = rememberPosition({ x: small.maxX, y: small.minY }, small);
  const large = playerBounds({ width: 1440, height: 900 });
  assert.deepEqual(restorePosition(saved, large), { x: large.maxX, y: large.minY });
});
test('initialization selects a random song without requesting any audio', t => {
  const { engine, audio, saved } = setup(t, songs, { settings: { lastTrack: songs[0].id } });
  assert.notEqual(engine.track.id, songs[0].id); assert.equal(audio.sources.length, 0);
  assert.equal(audio.preload, 'none'); assert.equal(audio.autoplay, false); assert.equal(audio.starts, 0);
  assert.equal(saved.length, 0);
});
test('the same audio instance continues across tracks and records only played songs', async t => {
  const { engine, audio, saved } = setup(t);
  const first = engine.track.id;
  const promise = engine.play(); assert.equal(audio.starts, 1, 'play is invoked inside the original interaction');
  await promise; audio.currentTime = 35;
  assert.equal(engine.state.time, 35); assert.equal(engine.state.playing, true);
  engine.next(); await delay();
  assert.equal(engine.audio, audio); assert.notEqual(engine.track.id, first); assert.equal(audio.sources.length, 2);
  assert(saved.some(value => value.lastTrack === first));
});
test('changing a selected song while paused cues it without downloading it', t => {
  const { engine, audio } = setup(t); const first = engine.track.id;
  engine.next(); assert.notEqual(engine.track.id, first); assert.equal(audio.sources.length, 0);
  engine.select(first); assert.equal(engine.track.id, first); assert.equal(audio.starts, 0);
});
test('mute pauses streaming, restores the preference and resumes only after an explicit unmute', async t => {
  const { engine, audio, saved } = setup(t); await engine.play();
  engine.mute(); assert.equal(engine.state.muted, true); assert.equal(audio.paused, true);
  engine.mute(); await delay(); assert.equal(engine.state.playing, true); assert.equal(engine.state.muted, false);
  assert(saved.some(value => value.muted === true));
});
test('mute and unmute while already paused never start audio unexpectedly', t => {
  const { engine, audio } = setup(t); engine.mute(); engine.mute(); assert.equal(audio.starts, 0);
});
test('volume zero pauses sound and play restores an audible volume', async t => {
  const { engine, audio } = setup(t); await engine.play(); engine.setVolume(0);
  assert.equal(engine.state.muted, true); assert.equal(audio.paused, true);
  await engine.play(); assert(engine.state.volume > 0); assert.equal(engine.state.playing, true);
});
test('a browser autoplay rejection is displayed without skipping the playlist', async t => {
  const { engine, audio } = setup(t); const first = engine.track.id;
  audio.behavior = () => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
  assert.equal(await engine.play(), false); assert.equal(engine.track.id, first);
  assert.equal(engine.state.blocked, true); assert.equal(engine.state.playing, false);
  assert.match(engine.state.message, /Reproducir/); assert.equal(audio.sources.length, 1);
});
test('late play promises cannot restart a paused player or override the new song', async t => {
  const { engine, audio } = setup(t); let resolve;
  audio.behavior = () => new Promise(done => { resolve = done; });
  const pending = engine.play(); engine.pause(); resolve(); await pending;
  assert.equal(engine.state.playing, false); assert.equal(engine.state.intent, false);
  audio.behavior = null; await engine.play(); assert.equal(engine.state.playing, true);
});
test('a late ended event after pause does not start another song', async t => {
  const { engine, audio } = setup(t); await engine.play(); const id = engine.track.id;
  engine.pause(); audio.dispatchEvent(new Event('ended'));
  assert.equal(engine.track.id, id); assert.equal(audio.starts, 1);
});
test('the end of a song advances automatically through the shuffle queue', async t => {
  const { engine, audio } = setup(t); await engine.play(); const first = engine.track.id;
  audio.dispatchEvent(new Event('ended')); await delay();
  assert.notEqual(engine.track.id, first); assert.equal(engine.state.playing, true);
});
test('a broken audio file is skipped once and another track can play', async t => {
  const { engine, audio } = setup(t); const bad = engine.track.id;
  audio.behavior = element => element.currentSrc.includes(bad) ? Promise.reject(new Error('unsupported')) : element.succeed();
  await engine.play(); await delay();
  assert.notEqual(engine.track.id, bad); assert.equal(engine.state.playing, true); assert.equal(engine.failed.size, 1);
});
test('if every audio file fails the player stops without an infinite retry loop', async t => {
  const { engine, audio } = setup(t); audio.behavior = () => Promise.reject(new Error('missing file'));
  await engine.play(); for (let i = 0; i < songs.length + 1; i++) await delay();
  assert.equal(audio.starts, songs.length); assert.equal(engine.state.playing, false); assert.equal(engine.state.intent, false);
  assert.match(engine.state.message, /No pudimos cargar/);
});
test('offline startup does not request or iterate over the audio library', async t => {
  const { engine, audio } = setup(t, songs, { online: () => false });
  await engine.play(); assert.equal(audio.sources.length, 0); assert.match(engine.state.message, /Sin conexión/);
});
test('malformed source URLs are omitted without breaking the playable collection', async t => {
  const { engine, audio } = setup(t, [{ id: 'bad', src: 'http://[' }, { id: 'invalid', src: 'javascript:void(0)' }, ...songs]);
  assert.equal(engine.tracks.length, songs.length); await engine.play(); assert.equal(audio.starts, 1);
  assert.equal(readMusicSettings({ getItem: () => '{"volume":null}' }).volume, .35);
});
test('an empty playlist remains usable and a single track can repeat safely', async t => {
  const empty = setup(t, []); assert.equal(await empty.engine.play(), false); assert.equal(empty.audio.starts, 0);
  const one = setup(t, songs.slice(0, 1)); await one.engine.play(); one.audio.dispatchEvent(new Event('ended')); await delay();
  assert.equal(one.engine.track.id, songs[0].id); assert.equal(one.audio.starts, 2);
});
test('seeking is disabled before metadata and clamps to the real duration afterwards', async t => {
  const { engine, audio } = setup(t); assert.equal(engine.seek(20), false);
  await engine.play(); assert.equal(engine.seek(1000), true); assert.equal(audio.currentTime, 120);
  engine.seek(-10); assert.equal(audio.currentTime, 0);
});
