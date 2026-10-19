// Independent of class navigation, authentication and the PWA installation code.
const bounded = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export const MUSIC_STORAGE_KEY = 'huellas.music.v1';

export function readMusicSettings(storage) {
  let value;
  try { value = JSON.parse(storage?.getItem(MUSIC_STORAGE_KEY) || 'null'); } catch { /* Private browsing and full storage are supported. */ }
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const position = saved.position && Number.isFinite(saved.position.x) && Number.isFinite(saved.position.y)
    ? { x: bounded(saved.position.x, 0, 1), y: bounded(saved.position.y, 0, 1) } : null;
  return { version: 1, muted: saved.muted === true, volume: bounded(typeof saved.volume === 'number' ? finite(saved.volume, .35) : .35, 0, 1),
    lastTrack: typeof saved.lastTrack === 'string' ? saved.lastTrack : '', position };
}

export function writeMusicSettings(storage, settings) {
  try { storage?.setItem(MUSIC_STORAGE_KEY, JSON.stringify({ ...settings, version: 1 })); return true; }
  catch { return false; }
}

function mixed(ids, random, avoid) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(bounded(finite(random(), .5), 0, .999999999999) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result[0] === avoid) {
    const j = 1 + Math.floor(bounded(finite(random(), .5), 0, .999999999999) * (result.length - 1));
    [result[0], result[j]] = [result[j], result[0]];
  }
  return result;
}

export class ShuffleQueue {
  constructor(ids, { random = Math.random, lastTrack = '' } = {}) {
    this.ids = [...new Set(ids)]; this.random = random;
    this.remaining = mixed(this.ids, random, lastTrack);
    this.history = []; this.cursor = -1;
  }
  get current() { return this.history[this.cursor] ?? null; }
  get canPrevious() { return this.cursor > 0; }
  next(excluded = new Set()) {
    while (this.cursor < this.history.length - 1) {
      this.cursor++;
      if (!excluded.has(this.current)) return this.current;
    }
    this.remaining = this.remaining.filter(id => !excluded.has(id));
    if (!this.remaining.length) this.remaining = mixed(this.ids.filter(id => !excluded.has(id)), this.random, this.current);
    if (!this.remaining.length) return null;
    return this.record(this.remaining.shift());
  }
  previous(excluded = new Set()) {
    for (let i = this.cursor - 1; i >= 0; i--) {
      if (!excluded.has(this.history[i])) { this.cursor = i; return this.current; }
    }
    return this.current;
  }
  select(id) {
    if (!this.ids.includes(id)) return this.current;
    if (id === this.current) return id;
    this.remaining = this.remaining.filter(value => value !== id);
    return this.record(id);
  }
  record(id) {
    this.history.length = this.cursor + 1;
    this.history.push(id);
    if (this.history.length > 256) this.history.shift();
    this.cursor = this.history.length - 1;
    return id;
  }
}

export function playerBounds(viewport, safe = {}, size = 56, margin = 12) {
  const left = finite(viewport.offsetLeft, 0), top = finite(viewport.offsetTop, 0);
  const width = Math.max(size, finite(viewport.width, 320)), height = Math.max(size, finite(viewport.height, 480));
  const x = left + margin + Math.max(0, finite(safe.left, 0));
  const y = top + margin + Math.max(0, finite(safe.top, 0));
  return { minX: x, minY: y,
    maxX: Math.max(x, left + width - margin - Math.max(0, finite(safe.right, 0)) - size),
    maxY: Math.max(y, top + height - margin - Math.max(0, finite(safe.bottom, 0)) - size), size };
}
export function clampPosition(position, bounds) {
  return { x: bounded(finite(position.x, bounds.maxX), bounds.minX, bounds.maxX), y: bounded(finite(position.y, bounds.maxY), bounds.minY, bounds.maxY) };
}
export function restorePosition(saved, bounds) {
  return saved ? clampPosition({ x: bounds.minX + saved.x * (bounds.maxX - bounds.minX), y: bounds.minY + saved.y * (bounds.maxY - bounds.minY) }, bounds)
    : { x: bounds.maxX, y: bounds.maxY };
}
export function rememberPosition(position, bounds) {
  return { x: (position.x - bounds.minX) / (bounds.maxX - bounds.minX || 1), y: (position.y - bounds.minY) / (bounds.maxY - bounds.minY || 1) };
}
export function panelPosition(button, bounds, width, height, gap = 12) {
  const right = bounds.maxX + bounds.size, bottom = bounds.maxY + bounds.size;
  const x = bounded(button.x + bounds.size - width, bounds.minX, Math.max(bounds.minX, right - width));
  const above = button.y - height - gap;
  const below = button.y + bounds.size + gap;
  const target = above >= bounds.minY ? above : below + height <= bottom ? below : button.y - height / 2;
  return { x, y: bounded(target, bounds.minY, Math.max(bounds.minY, bottom - height)) };
}

export class MusicEngine extends EventTarget {
  constructor(tracks, audio, { settings = {}, remember = () => {}, random = Math.random, online = () => true, baseUrl = 'https://huellas.invalid/', loadTimeout = 20000 } = {}) {
    super();
    const seen = new Set();
    this.tracks = tracks.filter(track => {
      if (!track || typeof track.id !== 'string' || !track.id || seen.has(track.id) || typeof track.src !== 'string' || !track.src) return false;
      try { if (!['http:', 'https:'].includes(new URL(track.src, baseUrl).protocol)) return false; } catch { return false; }
      seen.add(track.id); return true;
    });
    this.audio = audio; this.remember = remember; this.online = online; this.baseUrl = baseUrl; this.loadTimeout = loadTimeout;
    this.queue = new ShuffleQueue(this.tracks.map(track => track.id), { random, lastTrack: settings.lastTrack });
    this.queue.next();
    this.muted = settings.muted === true;
    this.volume = bounded(finite(settings.volume, .35), 0, 1);
    this.lastVolume = this.volume > 0 ? this.volume : .35;
    this.playing = false; this.intent = false; this.loading = false; this.blocked = false;
    this.message = ''; this.failed = new Set(); this.ticket = 0; this.failedTicket = -1; this.loadedId = null;
    this.resumeOnUnmute = false; this.listeners = [];
    audio.preload = 'none'; audio.autoplay = false; audio.loop = false; audio.muted = this.muted;
    try { audio.volume = this.volume; } catch { /* Volume may be controlled only by the device. */ }
    this.listen('playing', () => {
      if (!this.intent) { audio.pause(); return; }
      this.playing = true; this.loading = false; this.blocked = false; this.message = ''; this.clearTimer();
      this.remember({ lastTrack: this.track.id }); this.changed();
    });
    this.listen('pause', () => { this.playing = false; if (!this.loading) this.intent = false; this.changed(); });
    this.listen('waiting', () => {
      if (this.intent) {
        this.loading = true; this.clearTimer();
        const ticket = this.ticket;
        this.timer = setTimeout(() => this.failure(ticket), this.loadTimeout);
        this.changed();
      }
    });
    this.listen('ended', () => { if (this.intent) { this.playing = false; this.next(true); } });
    this.listen('error', () => {
      if (!this.loadedId || !this.intent) return;
      if (audio.currentSrc && audio.currentSrc !== new URL(this.track.src, this.baseUrl).href) return;
      this.failure(this.ticket);
    });
    for (const name of ['timeupdate', 'durationchange', 'loadedmetadata', 'seeked']) this.listen(name, () => this.dispatchEvent(new Event('progress')));
  }
  get track() { return this.tracks.find(track => track.id === this.queue.current) || null; }
  get state() {
    const realDuration = this.loadedId === this.track?.id && Number.isFinite(this.audio.duration) && this.audio.duration > 0 ? this.audio.duration : 0;
    return { track: this.track, playing: this.playing, intent: this.intent, loading: this.loading,
      muted: this.muted, volume: this.volume, blocked: this.blocked, message: this.message,
      time: this.loadedId === this.track?.id ? Math.max(0, finite(this.audio.currentTime, 0)) : 0,
      duration: realDuration || this.track?.duration || 0, canSeek: !!realDuration, canPrevious: this.queue.canPrevious,
      audible: this.playing && !this.muted && this.volume > 0 };
  }
  listen(name, callback) { this.audio.addEventListener(name, callback); this.listeners.push([name, callback]); }
  changed() { this.dispatchEvent(new Event('change')); }
  clearTimer() { clearTimeout(this.timer); this.timer = null; }
  play() {
    if (this.failed.size === this.tracks.length) this.failed.clear();
    if (this.track) this.failed.delete(this.track.id);
    return this.start();
  }
  start() {
    if (!this.track) { this.message = 'Por ahora no hay música disponible.'; this.changed(); return Promise.resolve(false); }
    if (!this.online()) { this.pause(); this.message = 'Sin conexión. Volvé a intentar cuando tengas internet.'; this.changed(); return Promise.resolve(false); }
    if (this.playing && !this.audio.paused) return Promise.resolve(true);
    const ticket = ++this.ticket;
    this.intent = true; this.loading = true; this.blocked = false; this.message = '';
    this.muted = false; this.audio.muted = false;
    if (this.volume === 0) this.volume = this.lastVolume;
    try { this.audio.volume = this.volume; } catch { /* Device volume remains available. */ }
    this.remember({ muted: false, volume: this.volume });
    if (this.loadedId !== this.track.id) {
      this.audio.src = new URL(this.track.src, this.baseUrl).href;
      this.loadedId = this.track.id;
    }
    this.clearTimer();
    this.timer = setTimeout(() => this.failure(ticket), this.loadTimeout);
    this.changed();
    // Invoke play synchronously in the click handler; iOS must retain the user gesture.
    let started;
    try { started = this.audio.play(); } catch (error) { return this.rejected(error, ticket); }
    return Promise.resolve(started).then(() => {
      if (ticket !== this.ticket) return false;
      if (!this.audio.paused && this.intent) {
        this.playing = true; this.loading = false; this.clearTimer();
        this.remember({ lastTrack: this.track.id }); this.changed(); return true;
      }
      return false;
    }).catch(error => this.rejected(error, ticket));
  }
  rejected(error, ticket) {
    if (ticket !== this.ticket) return false;
    if (error?.name === 'NotAllowedError') {
      this.clearTimer(); this.intent = false; this.playing = false; this.loading = false; this.blocked = true;
      this.message = 'Tocá Reproducir para activar la música.'; this.changed(); return false;
    }
    if (error?.name === 'AbortError') { this.pause(); return false; }
    this.failure(ticket); return false;
  }
  pause() {
    ++this.ticket; this.clearTimer(); this.intent = false; this.playing = false; this.loading = false;
    this.audio.pause(); this.changed();
  }
  toggle() { return this.intent || this.playing ? this.pause() : this.play(); }
  mute() {
    if (!this.muted) {
      this.resumeOnUnmute = this.intent || this.playing;
      this.muted = true; this.audio.muted = true; this.pause();
      this.remember({ muted: true }); this.changed();
    } else {
      this.muted = false; this.audio.muted = false; this.remember({ muted: false });
      if (this.resumeOnUnmute) { this.resumeOnUnmute = false; this.play(); }
      else this.changed();
    }
  }
  setVolume(value) {
    this.volume = bounded(finite(value, this.volume), 0, 1);
    if (this.volume > 0) this.lastVolume = this.volume;
    try { this.audio.volume = this.volume; } catch { /* iOS uses hardware volume. */ }
    this.remember({ volume: this.volume });
    if (this.volume === 0 && !this.muted) this.mute();
    else if (this.volume > 0 && this.muted) this.mute();
    this.changed();
  }
  choose(id, shouldPlay) {
    if (!id) return;
    ++this.ticket; this.clearTimer(); this.audio.pause(); this.playing = false; this.loading = false; this.intent = false;
    if (this.loadedId) { this.audio.removeAttribute('src'); this.audio.load(); }
    this.loadedId = null; this.blocked = false; this.message = '';
    this.changed();
    if (shouldPlay) this.start();
  }
  next(shouldPlay = this.intent || this.playing) { const id = this.queue.next(this.failed); this.choose(id, shouldPlay); }
  previous() { if (this.queue.canPrevious) { const playing = this.intent || this.playing; const id = this.queue.previous(this.failed); this.choose(id, playing); } }
  select(id) {
    if (!this.tracks.some(track => track.id === id) || id === this.track?.id) return;
    const playing = this.intent || this.playing;
    this.failed.delete(id); this.queue.select(id); this.choose(id, playing);
  }
  seek(value) {
    if (!this.state.canSeek) return false;
    try { this.audio.currentTime = bounded(finite(value, 0), 0, this.audio.duration); this.dispatchEvent(new Event('progress')); return true; }
    catch { return false; }
  }
  failure(ticket) {
    if (ticket !== this.ticket || ticket === this.failedTicket || !this.intent || !this.track) return;
    this.failedTicket = ticket; this.failed.add(this.track.id); this.clearTimer();
    if (!this.online()) { this.pause(); this.message = 'Sin conexión. Volvé a intentar cuando tengas internet.'; this.changed(); return; }
    if (this.failed.size >= this.tracks.length) {
      this.pause(); this.loadedId = null;
      this.audio.removeAttribute('src'); this.audio.load();
      this.message = 'No pudimos cargar la música. Revisá tu conexión y volvé a intentar.'; this.changed(); return;
    }
    this.next(true);
  }
  destroy() {
    this.pause();
    for (const [name, callback] of this.listeners) this.audio.removeEventListener(name, callback);
    this.audio.removeAttribute('src'); this.audio.load();
  }
}
