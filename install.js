// Installation is independent of the class renderer. No offline cache or service worker.
const catalog = document.getElementById('catalog-dialog');
const installDialog = document.getElementById('install-dialog');
const installButton = document.getElementById('install-app');
const installArea = document.getElementById('catalog-install');
const announcement = document.getElementById('install-status');
const displayModes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']
  .map(mode => window.matchMedia(`(display-mode: ${mode})`));
let deferredPrompt = null;
let installedThisSession = false;
let prompting = false;
let returnToCatalog = false;
let catalogScroll = 0;

function isInstalled() {
  return installedThisSession || navigator.standalone === true || displayModes.some(mode => mode.matches);
}

function updateInstallState() {
  const installed = isInstalled();
  installArea.hidden = installed;
  installButton.disabled = prompting;
  if (installed) {
    deferredPrompt = null;
    if (document.activeElement === installButton) document.getElementById('close-catalog').focus();
    if (installDialog.open) {
      returnToCatalog = false;
      installDialog.close();
    }
  }
}

function pauseCatalog() {
  returnToCatalog = catalog.open;
  if (returnToCatalog) {
    catalogScroll = catalog.scrollTop;
    catalog.close();
  }
}

function restoreCatalog() {
  const shouldReturn = returnToCatalog && !isInstalled();
  returnToCatalog = false;
  if (shouldReturn) {
    if (!catalog.open) catalog.showModal();
    catalog.scrollTop = catalogScroll;
    installButton.focus({ preventScroll: true });
  } else {
    document.getElementById('open-catalog').focus({ preventScroll: true });
  }
}

const symbols = {
  safari: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.6 5.4L8 16l2.6-5.4Z"/>',
  share: '<path d="M8 8H5v13h14V8h-3M12 15V2m-4 4 4-4 4 4"/>',
  home: '<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  menu: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
  desktop: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8"/>'
};

function installationGuide() {
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return {
    title: /iPad/i.test(ua) || navigator.platform === 'MacIntel' ? 'Huellas en tu iPad.' : 'Huellas en tu iPhone.',
    steps: [
      ['safari', 'Abrí Huellas desde Safari', 'Si estás en otra app o navegador, copiá el enlace y abrilo en Safari.'],
      ['share', 'Tocá Compartir', 'Buscá el cuadrado con la flecha hacia arriba. Puede estar dentro del menú Más.'],
      ['home', 'Agregá a pantalla de inicio', 'Elegí «Agregar a pantalla de inicio» o «Agregar a Inicio».'],
      ['check', 'Confirmá «Agregar»', 'Dejá el nombre Huellas. Si aparece «Abrir como app», activalo antes de tocar «Agregar».']
    ],
    help: 'Después, abrí Huellas desde su nuevo ícono en la pantalla de inicio.'
  };
  if (/Android/i.test(ua)) return {
    title: 'Huellas en tu celular.',
    steps: [
      ['menu', 'Abrí el menú del navegador', 'En Chrome, tocá los tres puntos de la esquina superior.'],
      ['download', 'Elegí «Instalar app»', 'También puede aparecer como «Agregar a pantalla de inicio».'],
      ['check', 'Confirmá Huellas', 'Tocá «Instalar» o «Agregar» y seguí las indicaciones.']
    ],
    help: 'Si no aparece la opción, abrí Huellas en Chrome o Edge. Las clases también están disponibles desde la web.'
  };
  const safari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
  if (safari && /Mac/i.test(ua)) return {
    title: 'Huellas en tu Mac.',
    steps: [
      ['safari', 'Abrí el menú Archivo', 'En Safari, buscá Archivo en la barra de menús de tu Mac.'],
      ['desktop', 'Elegí «Agregar al Dock»', 'Safari prepara una app para abrir Huellas desde el Dock.'],
      ['check', 'Confirmá Huellas', 'Mantené el nombre Huellas y tocá «Agregar».']
    ],
    help: 'Si tu versión de Safari no ofrece esta opción, podés abrir Huellas en Chrome o Edge.'
  };
  return {
    title: 'Huellas en tu computadora.',
    steps: [
      ['desktop', 'Buscá la opción de instalación', 'Revisá el ícono junto a la dirección o abrí el menú del navegador.'],
      ['download', 'Elegí instalar como aplicación', 'Puede estar en «Transmitir, guardar y compartir» o en «Aplicaciones».'],
      ['check', 'Confirmá Huellas', 'Comprobá el nombre y el ícono de la Biblia, y elegí «Instalar».']
    ],
    help: 'Si tu navegador no ofrece instalación, probá abrir Huellas en Chrome o Edge. Podés seguir recorriendo las clases desde la web.'
  };
}

function showInstructions(catalogPaused = false) {
  if (isInstalled()) return;
  if (!catalogPaused) pauseCatalog();
  const guide = installationGuide();
  document.getElementById('install-title').textContent = guide.title;
  document.getElementById('install-help').textContent = guide.help;
  const steps = document.getElementById('install-steps');
  steps.replaceChildren();
  for (const [symbol, title, text] of guide.steps) {
    const item = document.createElement('li');
    item.className = 'install-step';
    const icon = document.createElement('span');
    icon.className = 'install-step-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = `<svg viewBox="0 0 24 24">${symbols[symbol]}</svg>`;
    const copy = document.createElement('div');
    const heading = document.createElement('h3');
    const paragraph = document.createElement('p');
    heading.textContent = title;
    paragraph.textContent = text;
    copy.append(heading, paragraph);
    item.append(icon, copy);
    steps.append(item);
  }
  if (!installDialog.open) installDialog.showModal();
}

window.addEventListener('beforeinstallprompt', event => {
  if (isInstalled()) return;
  event.preventDefault();
  deferredPrompt = event;
  updateInstallState();
});

installButton.addEventListener('click', async () => {
  if (prompting || isInstalled()) return;
  if (!deferredPrompt) {
    showInstructions();
    return;
  }
  const request = deferredPrompt;
  deferredPrompt = null; // A BeforeInstallPromptEvent can only be used once.
  pauseCatalog();
  prompting = true;
  updateInstallState();
  try {
    // Invoke prompt synchronously inside this user gesture, before any await.
    const result = await request.prompt();
    const choice = request.userChoice ? await request.userChoice : result;
    if (!isInstalled()) announcement.textContent = choice?.outcome === 'accepted'
      ? 'Completá la instalación de Huellas desde el navegador.'
      : 'Podés instalar Huellas más adelante desde el catálogo de clases.';
    prompting = false;
    updateInstallState();
    restoreCatalog();
  } catch {
    showInstructions(true);
  } finally {
    prompting = false;
    updateInstallState();
  }
});

window.addEventListener('appinstalled', () => {
  installedThisSession = true;
  deferredPrompt = null;
  announcement.textContent = 'Huellas se instaló correctamente.';
  updateInstallState();
});

document.getElementById('close-install').addEventListener('click', () => installDialog.close());
document.getElementById('install-done').addEventListener('click', () => installDialog.close());
installDialog.addEventListener('close', restoreCatalog);
installDialog.addEventListener('cancel', event => {
  event.preventDefault();
  installDialog.close();
});
installDialog.addEventListener('click', event => {
  if (event.target !== installDialog) return;
  const rect = installDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) installDialog.close();
});
for (const mode of displayModes) {
  if (mode.addEventListener) mode.addEventListener('change', updateInstallState);
  else mode.addListener?.(updateInstallState);
}
window.addEventListener('pageshow', updateInstallState);
window.addEventListener('focus', updateInstallState);
document.addEventListener('visibilitychange', updateInstallState);
updateInstallState();
