import { musicPlaylist } from './music-playlist.js?v=20261019-music1';
import { MusicEngine, readMusicSettings, writeMusicSettings, playerBounds, clampPosition, restorePosition, rememberPosition, panelPosition } from './music-core.js?v=20261021-music-end1';

const icons = {
  speaker: '<path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  silent: '<path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  previous: '<path d="M5 5v14m14-14L8 12l11 7V5Z"/>',
  next: '<path d="M19 5v14M5 5l11 7-11 7V5Z"/>',
  shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3.5-2 5-5m2-2c1.5-3 3-5 5-5h3m-4-4 4 4-4 4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};
const symbol = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const timeText = value => { const seconds = Math.max(0, Math.floor(Number(value) || 0)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };
let mounted = null;

export function mountMusic(application, tracks = musicPlaylist) {
  if (mounted) return mounted;
  let storage;
  try { storage = window.localStorage; } catch { /* The player also works with storage disabled. */ }
  let settings = readMusicSettings(storage);
  const remember = patch => { settings = { ...settings, ...patch }; writeMusicSettings(storage, settings); };
  const root = document.createElement('div');
  root.className = 'hm-player'; root.id = 'huellas-music';
  root.innerHTML = `
    <span class="hm-safe-area" aria-hidden="true"></span>
    <button class="hm-orb" id="hm-toggle" type="button" aria-expanded="false" aria-controls="hm-panel" aria-describedby="hm-move-help">
      <span class="hm-orb-icon">${symbol('silent')}</span><span class="hm-playing-dot" aria-hidden="true"></span>
    </button>
    <span class="sr-only" id="hm-move-help">Abrí los controles con Enter. Podés arrastrar este botón. Para moverlo con teclado, mantené Alt y usá las flechas.</span>
    <section class="hm-panel" id="hm-panel" aria-labelledby="hm-heading" hidden inert>
      <div class="hm-panel-header"><span id="hm-heading" class="hm-eyebrow">UN MOMENTO EN CALMA</span><button id="hm-close" class="hm-small-button" type="button" aria-label="Cerrar controles de música">${symbol('close')}</button></div>
      <div class="hm-now"><span class="hm-visual" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><div><span class="hm-caption">MÚSICA INSTRUMENTAL</span><h2 id="hm-title"></h2></div></div>
      <div class="hm-progress"><label class="sr-only" for="hm-seek">Posición de la canción</label><input id="hm-seek" type="range" min="0" max="1" step="1" value="0" disabled><div class="hm-times" aria-hidden="true"><span id="hm-elapsed">0:00</span><span id="hm-duration">0:00</span></div></div>
      <div class="hm-controls"><button id="hm-previous" class="hm-control" type="button" aria-label="Canción anterior">${symbol('previous')}</button><button id="hm-play" class="hm-play" type="button" aria-label="Reproducir música">${symbol('play')}</button><button id="hm-next" class="hm-control" type="button" aria-label="Siguiente canción">${symbol('next')}</button><span class="hm-control-separator" aria-hidden="true"></span><button id="hm-mute" class="hm-control hm-mute" type="button" aria-label="Silenciar música" aria-pressed="false">${symbol('speaker')}</button></div>
      <div id="hm-volume-row" class="hm-volume"><label for="hm-volume">Volumen</label><input id="hm-volume" type="range" min="0" max="100" step="1" value="35"><span id="hm-volume-value" aria-hidden="true">35%</span></div>
      <p id="hm-device-volume" class="hm-device-volume" hidden>Usá los botones del dispositivo para ajustar el volumen.</p>
      <div class="hm-shuffle">${symbol('shuffle')}<span>Siempre en aleatorio</span></div>
      <details id="hm-songs" class="hm-songs"><summary><span>Elegir una canción <span id="hm-count"></span></span>${symbol('chevron')}</summary><ul id="hm-list" aria-label="Canciones disponibles"></ul></details>
      <p class="hm-message" id="hm-message" role="status" aria-live="polite"></p>
      <p class="hm-drag-note">Arrastrá el círculo para encontrar tu lugar.</p>
    </section>`;
  const audio = document.createElement('audio');
  audio.setAttribute('aria-hidden', 'true'); audio.setAttribute('playsinline', '');
  root.append(audio); application.append(root);
  const get = id => root.querySelector('#' + id);
  const toggle = get('hm-toggle'), panel = get('hm-panel'), seek = get('hm-seek');
  const engine = new MusicEngine(tracks, audio, { settings, remember, baseUrl: document.baseURI, online: () => navigator.onLine !== false });
  const startEvents = ['click', 'pointerup', 'touchend', 'keydown'];
  let startPending = !settings.muted && settings.volume > 0, startInFlight = false;
  function cancelAutomaticStart() {
    startPending = false;
    for (const name of startEvents) document.removeEventListener(name, startOnInteraction, true);
  }
  function startOnInteraction(event) {
    if (!startPending || !event.isTrusted || application.hidden || application.inert || document.visibilityState === 'hidden') return;
    if (event.type === 'keydown' && (event.repeat || !['Enter', ' '].includes(event.key))) return;
    if (event.type === 'pointerup' && (event.pointerType === 'mouse' || event.isPrimary === false)) return;
    if (event.button !== undefined && event.button !== 0) return;
    // An explicit player action takes priority, especially pause, mute and volume.
    if (panel.contains(event.target) || event.target.closest?.('#auth-logout')) { cancelAutomaticStart(); return; }
    if (engine.state.muted || engine.state.volume === 0) { cancelAutomaticStart(); return; }
    if (startInFlight) return;
    if (engine.state.intent || engine.state.playing) { cancelAutomaticStart(); return; }
    startInFlight = true;
    // Keep play() inside the real gesture. touchend also covers swipes that cancel Pointer Events.
    engine.play().then(started => {
      startInFlight = false;
      if (started || !engine.state.blocked) cancelAutomaticStart();
      // If this gesture was denied, a later real tap may still authorize playback.
    });
  }
  if (startPending) {
    for (const name of startEvents) document.addEventListener(name, startOnInteraction, { capture: true, passive: true });
  }
  for (const name of ['pointerdown', 'click', 'keydown', 'input']) panel.addEventListener(name, cancelAutomaticStart, { capture: true, passive: true });
  let opened = false, closeTimer, animationFrame, pointer = null, suppressClickUntil = 0, seeking = false;
  let position, bounds, dragBounds, lastTrack = null, lastAnnouncement = '', scrollTimer;
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  get('hm-volume-row').hidden = ios; get('hm-device-volume').hidden = !ios;
  const viewport = () => window.visualViewport || { width: window.innerWidth, height: window.innerHeight, offsetTop: 0, offsetLeft: 0 };
  function measureBounds() {
    const style = getComputedStyle(root.querySelector('.hm-safe-area'));
    return playerBounds(viewport(), { top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0,
      left: parseFloat(style.paddingLeft) || 0, right: parseFloat(style.paddingRight) || 0 });
  }
  function place(value) {
    position = clampPosition(value, bounds);
    root.style.left = position.x + 'px'; root.style.top = position.y + 'px';
    if (opened) placePanel();
  }
  function placePanel() {
    const width = Math.min(340, bounds.maxX + bounds.size - bounds.minX);
    const maxHeight = bounds.maxY + bounds.size - bounds.minY;
    panel.style.width = width + 'px'; panel.style.maxHeight = maxHeight + 'px';
    const height = Math.min(panel.offsetHeight || 410, maxHeight);
    const target = panelPosition(position, bounds, width, height);
    panel.style.left = target.x - position.x + 'px'; panel.style.top = target.y - position.y + 'px';
  }
  function resize() {
    if (pointer) finishPointer(true);
    bounds = measureBounds(); place(restorePosition(settings.position, bounds));
    avoidControls();
  }
  // Keep the closed circle away from links and buttons as the reading page scrolls.
  function overlapsControl(point) {
    if (!document.elementsFromPoint) return false;
    return [[28, 28], [8, 28], [48, 28], [28, 8], [28, 48]].some(([dx, dy]) =>
      document.elementsFromPoint(point.x + dx, point.y + dy).some(element =>
        !root.contains(element) && element.closest?.('button,a,input,select,textarea,[role="button"]')));
  }
  function avoidControls() {
    if (opened || pointer || root.hidden || document.querySelector('dialog[open]') || !overlapsControl(position)) return;
    for (const offset of [-68, 68, -136, 136, -204, 204]) {
      const candidate = clampPosition({ x: position.x, y: position.y + offset }, bounds);
      if (!overlapsControl(candidate)) { place(candidate); return; }
    }
    const opposite = clampPosition({ x: position.x > (bounds.minX + bounds.maxX) / 2 ? bounds.minX : bounds.maxX, y: position.y }, bounds);
    if (!overlapsControl(opposite)) place(opposite);
  }
  function openPanel() {
    clearTimeout(closeTimer); opened = true;
    panel.hidden = false; panel.inert = false; toggle.setAttribute('aria-expanded', 'true');
    placePanel();
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => { if (opened) panel.classList.add('hm-open'); });
    render();
  }
  function closePanel(restoreFocus = false) {
    if (!opened) return;
    opened = false; cancelAnimationFrame(animationFrame);
    if (restoreFocus || panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    panel.inert = true; panel.classList.remove('hm-open'); toggle.setAttribute('aria-expanded', 'false');
    clearTimeout(closeTimer); closeTimer = setTimeout(() => { if (!opened) panel.hidden = true; }, reduced() ? 0 : 160);
    render();
  }
  toggle.addEventListener('click', event => {
    if (event.detail !== 0 && performance.now() < suppressClickUntil) { event.preventDefault(); return; }
    opened ? closePanel() : openPanel();
  });
  get('hm-close').addEventListener('click', () => closePanel(true));
  document.addEventListener('click', event => { if (opened && !root.contains(event.target)) closePanel(); });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && opened) { event.preventDefault(); event.stopPropagation(); closePanel(true); return; }
    if (event.target === toggle && event.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const step = event.shiftKey ? 32 : 16;
      place({ x: position.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        y: position.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) });
      remember({ position: rememberPosition(position, bounds) });
    }
    // The lesson's keyboard arrows must not navigate while operating music controls.
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', ' '].includes(event.key)) event.stopPropagation();
  });
  toggle.addEventListener('pointerdown', event => {
    if (event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
    dragBounds = measureBounds();
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, start: { ...position }, dragged: false };
    try { toggle.setPointerCapture(event.pointerId); } catch { /* Pointer capture may be unavailable in older embedded browsers. */ }
  });
  toggle.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (!pointer.dragged && Math.hypot(dx, dy) < 7) return;
    if (!pointer.dragged) { pointer.dragged = true; root.classList.add('hm-dragging'); closePanel(); }
    event.preventDefault(); bounds = dragBounds;
    place({ x: pointer.start.x + dx, y: pointer.start.y + dy });
  });
  function finishPointer(cancelled = false) {
    if (!pointer) return;
    const finished = pointer; pointer = null; root.classList.remove('hm-dragging');
    try { toggle.releasePointerCapture(finished.id); } catch { /* Capture is already released after cancellation. */ }
    if (finished.dragged || cancelled) {
      suppressClickUntil = performance.now() + 450;
      avoidControls(); remember({ position: rememberPosition(position, bounds) });
    }
  }
  toggle.addEventListener('pointerup', event => { if (pointer?.id === event.pointerId) finishPointer(); });
  toggle.addEventListener('pointercancel', () => finishPointer(true));
  toggle.addEventListener('lostpointercapture', () => { if (pointer) finishPointer(true); });
  get('hm-play').addEventListener('click', () => engine.toggle());
  get('hm-previous').addEventListener('click', () => engine.previous());
  get('hm-next').addEventListener('click', () => engine.next());
  get('hm-mute').addEventListener('click', () => engine.mute());
  get('hm-volume').addEventListener('input', event => engine.setVolume(Number(event.target.value) / 100));
  seek.addEventListener('pointerdown', () => { seeking = true; });
  seek.addEventListener('input', () => { engine.seek(Number(seek.value)); get('hm-elapsed').textContent = timeText(seek.value); });
  seek.addEventListener('change', () => { engine.seek(Number(seek.value)); seeking = false; progress(); });
  seek.addEventListener('pointercancel', () => { seeking = false; progress(); });
  window.addEventListener('pointerup', () => { if (seeking) { seeking = false; progress(); } });
  get('hm-songs').addEventListener('toggle', () => { if (opened) placePanel(); });
  const songButtons = new Map();
  engine.tracks.forEach((track, index) => {
    const item = document.createElement('li'), button = document.createElement('button');
    button.type = 'button'; button.className = 'hm-song'; button.dataset.track = track.id;
    const number = document.createElement('span'); number.className = 'hm-song-number'; number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('span'); title.textContent = track.title || track.id;
    const indicator = document.createElement('span'); indicator.className = 'hm-song-indicator'; indicator.setAttribute('aria-hidden', 'true');
    button.append(number, title, indicator); item.append(button); get('hm-list').append(item);
    button.setAttribute('aria-label', 'Seleccionar ' + (track.title || track.id));
    button.addEventListener('click', () => engine.select(track.id)); songButtons.set(track.id, button);
  });
  get('hm-count').textContent = engine.tracks.length;
  function mediaMetadata(track) {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist || 'Música instrumental',
      album: 'Huellas · Estudios Bíblicos', artwork: [{ src: new URL('huellas-icon-192-v2.png', document.baseURI).href, sizes: '192x192', type: 'image/png' },
        { src: new URL('huellas-icon-512-v2.png', document.baseURI).href, sizes: '512x512', type: 'image/png' }] }); } catch { /* Optional OS controls must never affect audio playback. */ }
  }
  function progress() {
    const state = engine.state;
    get('hm-elapsed').textContent = timeText(state.time); get('hm-duration').textContent = timeText(state.duration);
    seek.disabled = !state.canSeek;
    seek.max = Math.max(1, state.duration || 1);
    if (!seeking) seek.value = Math.min(state.time, state.duration || 0);
    seek.setAttribute('aria-valuetext', `${timeText(state.time)} de ${timeText(state.duration)}`);
    seek.style.setProperty('--hm-progress', `${state.duration ? Math.min(100, state.time / state.duration * 100) : 0}%`);
    if (navigator.mediaSession?.setPositionState && state.canSeek) {
      try { navigator.mediaSession.setPositionState({ duration: state.duration, playbackRate: 1, position: Math.min(state.time, state.duration) }); } catch { /* Some browsers support only part of Media Session. */ }
    }
  }
  function render() {
    const state = engine.state;
    root.classList.toggle('hm-audible', state.audible); root.classList.toggle('hm-loading', state.loading);
    get('hm-title').textContent = state.track?.title || 'Tu momento de música';
    get('hm-play').innerHTML = symbol(state.intent ? 'pause' : 'play');
    get('hm-play').setAttribute('aria-label', state.intent ? 'Pausar música' : state.muted ? 'Reproducir y activar el sonido' : 'Reproducir música');
    get('hm-play').setAttribute('aria-busy', String(state.loading));
    get('hm-mute').innerHTML = symbol(state.muted || state.volume === 0 ? 'silent' : 'speaker');
    get('hm-mute').setAttribute('aria-label', state.muted ? 'Activar sonido' : 'Silenciar música');
    get('hm-mute').setAttribute('aria-pressed', String(state.muted));
    toggle.querySelector('.hm-orb-icon').innerHTML = symbol(state.audible ? 'speaker' : 'silent');
    toggle.setAttribute('aria-label', `Música ${state.loading ? 'cargando' : state.audible ? 'en reproducción' : state.muted ? 'silenciada' : 'en pausa'}. ${opened ? 'Cerrar' : 'Abrir'} controles.`);
    get('hm-previous').disabled = !state.canPrevious;
    for (const id of ['hm-play', 'hm-next', 'hm-mute']) get(id).disabled = !state.track;
    get('hm-volume').value = Math.round(state.volume * 100); get('hm-volume-value').textContent = Math.round(state.volume * 100) + '%';
    for (const [id, button] of songButtons) {
      if (id === state.track?.id) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
    }
    if (state.message !== lastAnnouncement) { get('hm-message').textContent = state.message; lastAnnouncement = state.message; }
    if (state.track?.id !== lastTrack) { if (state.track) mediaMetadata(state.track); lastTrack = state.track?.id; }
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused'; } catch { /* Optional API. */ } }
    progress();
    if (opened) placePanel();
  }
  engine.addEventListener('change', render); engine.addEventListener('progress', progress);
  if (navigator.mediaSession?.setActionHandler) {
    const actions = { play: () => engine.play(), pause: () => engine.pause(), stop: () => engine.pause(),
      nexttrack: () => engine.next(), previoustrack: () => engine.previous(),
      seekto: detail => engine.seek(detail.seekTime), seekbackward: detail => engine.seek(engine.state.time - (detail.seekOffset || 10)),
      seekforward: detail => engine.seek(engine.state.time + (detail.seekOffset || 10)) };
    for (const [action, callback] of Object.entries(actions)) { try { navigator.mediaSession.setActionHandler(action, detail => { cancelAutomaticStart(); callback(detail); }); } catch { /* Unsupported actions are simply omitted. */ } }
  }
  window.addEventListener('resize', resize, { passive: true });
  window.visualViewport?.addEventListener('resize', resize, { passive: true });
  window.visualViewport?.addEventListener('scroll', resize, { passive: true });
  window.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(avoidControls, 120); }, { passive: true });
  window.addEventListener('pagehide', () => { cancelAutomaticStart(); engine.pause(); });
  const gate = new MutationObserver(() => {
    const available = !application.hidden && !application.inert;
    root.hidden = !available;
    if (!available) { cancelAutomaticStart(); closePanel(); engine.pause(); }
    else resize();
  });
  gate.observe(application, { attributes: true, attributeFilter: ['hidden', 'inert'] });
  mounted = { root, engine, open: openPanel, close: closePanel, resize };
  bounds = measureBounds(); place(restorePosition(settings.position, bounds)); render(); avoidControls();
  return mounted;
}

const application = document.getElementById('huellas-app');
if (application) {
  function whenAuthenticated() {
    if (!application.hidden && !application.inert) { mountMusic(application); observer.disconnect(); }
  }
  const observer = new MutationObserver(whenAuthenticated);
  observer.observe(application, { attributes: true, attributeFilter: ['hidden', 'inert'] });
  whenAuthenticated();
}
