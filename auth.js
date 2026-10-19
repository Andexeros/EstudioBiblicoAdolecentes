const $ = id => document.getElementById(id);
const screen = $('auth-screen');
const application = $('huellas-app');
const form = $('auth-form');
const fields = $('auth-fields');
const tabs = [...$('auth-tabs').querySelectorAll('[role="tab"]')];
let mode = 'login', busy = false, available = false, googleEnabled = false;
let currentUser = null, mounted = false, checkingSession = false, resendUntil = 0, resendTimer;
let usersOffset = 0, usersHasMore = false;
const entry = new URL(location.href);
let resetToken = entry.searchParams.get('auth') === 'reset' ? entry.searchParams.get('token') : '';
const resetExpired = entry.searchParams.get('auth') === 'reset' && !resetToken;
const loginError = entry.searchParams.get('auth') === 'error';

const descriptions = {
  login: ['Volvé a la Palabra.', 'Ingresá a tu cuenta para explorar las clases.', 'Ingresar'],
  register: ['Dejá tu primera huella.', 'Creá tu cuenta y encontrá tu próximo estudio.', 'Crear cuenta'],
  verify: ['Confirmá tu correo.', 'Escribí el código de tu correo. Revisá también la carpeta de spam; si lo necesitás, podés solicitar otro.', 'Verificar correo'],
  forgot: ['Volvamos a encontrarnos.', 'Te enviaremos un enlace para elegir una nueva contraseña.', 'Enviar enlace'],
  reset: ['Un nuevo comienzo.', 'Elegí una contraseña de al menos 8 caracteres para tu cuenta.', 'Guardar contraseña'],
};

function message(text = '', error = false, id = 'auth-message') {
  $(id).textContent = text;
  $(id).dataset.error = String(error);
}

function displayField(id, show, required = show) {
  const wrapper = $(id);
  wrapper.hidden = !show;
  wrapper.querySelectorAll('input').forEach(input => { input.disabled = !show; input.required = show && required; });
}

function setMode(next, note = '') {
  mode = next;
  const [title, description] = descriptions[mode];
  $('auth-title').textContent = title;
  $('auth-description').textContent = description;
  const normal = ['login', 'register'].includes(mode);
  $('auth-tabs').hidden = !normal;
  form.setAttribute('aria-labelledby', normal ? `auth-${mode}-tab` : 'auth-title');
  tabs.forEach(tab => {
    const selected = tab.dataset.mode === mode;
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
  });
  displayField('auth-name-field', mode === 'register');
  displayField('auth-email-field', mode !== 'reset');
  displayField('auth-password-field', ['login', 'register', 'reset'].includes(mode));
  displayField('auth-confirm-field', mode === 'reset');
  displayField('auth-code-field', mode === 'verify');
  $('auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('auth-password').value = ''; $('auth-confirm').value = ''; $('auth-code').value = '';
  $('auth-password').type = 'password';
  $('auth-toggle-password').setAttribute('aria-pressed', 'false');
  $('auth-toggle-password').setAttribute('aria-label', 'Mostrar contraseña');
  $('auth-forgot').hidden = mode !== 'login';
  $('auth-remember-field').hidden = mode !== 'login';
  $('auth-verify-actions').hidden = mode !== 'verify';
  $('auth-back').hidden = normal || mode === 'verify';
  $('auth-google').hidden = !googleEnabled || !normal;
  $('auth-register-note').hidden = mode !== 'register';
  $('auth-retry').hidden = true;
  message(note);
  setBusy(false);
  updateResend();
}

function setBusy(value) {
  busy = value;
  fields.disabled = value || !available;
  form.setAttribute('aria-busy', String(value));
  $('auth-submit').textContent = value ? 'Un momento…' : descriptions[mode][2];
  for (const id of ['auth-google-button', 'auth-back', 'auth-other-account']) $(id).disabled = value;
  tabs.forEach(tab => { tab.disabled = value; });
  $('auth-resend').disabled = value || Date.now() < resendUntil;
}

async function request(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || 'No pudimos completar la solicitud. Intentá nuevamente.');
      error.code = data.code; error.status = response.status; throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('No pudimos conectarnos. Revisá tu conexión y volvé a intentar.');
    throw error;
  } finally { clearTimeout(timeout); }
}

function errorText(error) {
  const code = error.code || '';
  if (error.status === 429) return 'Hiciste varios intentos seguidos. Esperá un momento y volvé a intentar.';
  if (/INVALID_EMAIL_OR_PASSWORD|INVALID_PASSWORD|USER_NOT_FOUND/.test(code)) return 'El correo o la contraseña no son correctos.';
  if (/ALREADY_EXISTS|USER_ALREADY/.test(code)) return 'Podés ingresar con tu cuenta o recuperar tu contraseña.';
  if (/OTP|VERIFICATION_CODE/.test(code)) return 'El código no es válido o venció. Revisalo o solicitá uno nuevo.';
  if (/PASSWORD_TOO_SHORT|PASSWORD_TOO_LONG/.test(code)) return 'La contraseña debe tener entre 8 y 128 caracteres.';
  if (/INVALID_TOKEN|TOKEN_EXPIRED/.test(code)) return 'El enlace venció o no es válido. Solicitá uno nuevo.';
  return error.message;
}

async function openApplication(session) {
  if (!session.user?.emailVerified) {
    if (session.user?.email) $('auth-email').value = session.user.email;
    setMode(session.user ? 'verify' : 'login');
    return false;
  }
  currentUser = session.user;
  $('auth-password').value = ''; $('auth-confirm').value = '';
  message('Abriendo tus clases…');
  // One access write per page opening; no polling or background activity tracking.
  await request('/api/session', {});
  const data = await request('/api/lessons');
  if (!Array.isArray(data.lessons) || !data.lessons.length) throw new Error('No pudimos cargar las clases. Volvé a intentar.');
  $('account-name').textContent = session.user.name || 'Tu cuenta';
  $('account-email').textContent = session.user.email;
  $('open-users').hidden = !session.isAdmin;
  screen.hidden = true;
  application.hidden = false;
  application.inert = false;
  try {
    if (!mounted) {
      const app = await import('./app.js?v=20261019-login1');
      app.mountHuellas(data.lessons);
      mounted = true;
    }
  } catch (error) {
    application.hidden = true;
    application.inert = true;
    screen.hidden = false;
    throw error;
  }
  document.title = 'Huellas · Estudios Bíblicos';
  return true;
}

async function bootstrap() {
  available = false; setBusy(true); message('Comprobando tu sesión…'); $('auth-retry').hidden = true;
  try {
    const session = await request('/api/session');
    available = true; googleEnabled = session.googleEnabled === true;
    if (resetToken) { setMode('reset'); return; }
    if (resetExpired) { setMode('forgot', 'El enlace venció o no es válido. Solicitá uno nuevo.'); return; }
    if (session.user) { if (await openApplication(session)) return; }
    else setMode('login', loginError ? 'El ingreso no se completó. Podés volver a intentar.' : '');
  } catch (error) {
    if (currentUser?.email) { $('auth-email').value = currentUser.email; setMode('login'); }
    message(errorText(error), true); $('auth-retry').hidden = false;
  } finally { setBusy(false); }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !available || !form.reportValidity()) return;
  if (mode === 'reset' && $('auth-password').value !== $('auth-confirm').value) {
    message('Las contraseñas no coinciden.', true); $('auth-confirm').focus(); return;
  }
  const email = $('auth-email').value.trim();
  const payload = { email, password: $('auth-password').value, name: $('auth-name').value.trim(),
    rememberMe: mode === 'login' ? $('auth-remember').checked : true, returnHash: location.hash };
  setBusy(true); message();
  try {
    if (mode === 'forgot') {
      await request('/api/auth/request-password-reset', { email });
      message('Si existe una cuenta con ese correo, te enviamos un enlace. Revisá también la carpeta de spam.');
    } else if (mode === 'reset') {
      await request('/api/auth/reset-password', { token: resetToken, newPassword: payload.password });
      resetToken = '';
      await request('/api/auth/sign-out', {});
      setMode('login', 'Contraseña actualizada. Ya podés ingresar.');
    } else if (mode === 'verify') {
      await request('/api/auth/email-otp/verify-email', { email, otp: $('auth-code').value.trim() });
      const session = await request('/api/session');
      if (session.user?.emailVerified) await openApplication(session);
      else setMode('login', 'Correo verificado. Ingresá con tu contraseña.');
    } else {
      const signingUp = mode === 'register';
      const result = await request('/api/auth/' + (signingUp ? 'sign-up/email' : 'sign-in/email'), payload);
      if (signingUp && result.user?.emailVerified !== true) {
        setMode('verify'); $('auth-email').value = email; $('auth-code').focus();
      } else await openApplication(await request('/api/session'));
    }
  } catch (error) {
    if (error.code === 'EMAIL_NOT_VERIFIED') { setMode('verify'); $('auth-email').value = email; $('auth-code').focus(); }
    else { message(errorText(error), true); if (currentUser?.emailVerified) $('auth-retry').hidden = false; }
  } finally { setBusy(false); }
});

tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
$('auth-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || busy) return;
  event.preventDefault();
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (tabs.indexOf(document.activeElement) + 1) % 2;
  setMode(tabs[index].dataset.mode); tabs[index].focus();
});
$('auth-forgot').addEventListener('click', () => { setMode('forgot'); $('auth-email').focus(); });
$('auth-back').addEventListener('click', () => setMode('login'));
$('auth-toggle-password').addEventListener('click', () => {
  const show = $('auth-password').type === 'password';
  $('auth-password').type = show ? 'text' : 'password';
  $('auth-toggle-password').setAttribute('aria-pressed', String(show));
  $('auth-toggle-password').setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
});
$('auth-retry').addEventListener('click', bootstrap);

function updateResend() {
  clearTimeout(resendTimer);
  const remaining = Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000));
  $('auth-resend').textContent = remaining ? `Reenviar en ${remaining}s` : 'Reenviar código';
  $('auth-resend').disabled = busy || remaining > 0;
  if (mode === 'verify' && remaining) resendTimer = setTimeout(updateResend, 1000);
}
$('auth-resend').addEventListener('click', async () => {
  if (busy || Date.now() < resendUntil || !$('auth-email').reportValidity()) return;
  setBusy(true);
  try {
    await request('/api/auth/send-verification-email', { email: $('auth-email').value.trim(), returnHash: location.hash });
    resendUntil = Date.now() + 60000; message('Enviamos una nueva verificación a tu correo.');
  } catch (error) { message(errorText(error), true); }
  finally { setBusy(false); updateResend(); }
});
$('auth-other-account').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try { await request('/api/auth/sign-out', {}); currentUser = null; setMode('login'); }
  catch (error) { message(errorText(error), true); }
  finally { setBusy(false); }
});
$('auth-google-button').addEventListener('click', async () => {
  if (busy || !googleEnabled) return;
  setBusy(true); message('Abriendo Google…');
  try {
    const data = await request('/api/auth/sign-in/social', { returnHash: location.hash });
    const url = new URL(data.url);
    if (url.protocol !== 'https:' || !['accounts.google.com', 'accounts.googleusercontent.com'].includes(url.hostname)) throw new Error('No pudimos abrir Google. Intentá nuevamente.');
    location.assign(url.href);
  } catch (error) { message(errorText(error), true); setBusy(false); }
});

function bindDialog(id, closeId) {
  const dialog = $(id);
  $(closeId).addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) $('account-button').focus({ preventScroll: true }); });
}
bindDialog('account-dialog', 'close-account'); bindDialog('users-dialog', 'close-users');
$('account-button').addEventListener('click', () => { message('', false, 'account-message'); $('account-dialog').showModal(); });
$('auth-logout').addEventListener('click', async () => {
  $('auth-logout').disabled = true; message('Cerrando tu sesión…', false, 'account-message');
  try { await request('/api/auth/sign-out', {}); location.replace(location.pathname + location.hash); }
  catch (error) { message(errorText(error), true, 'account-message'); $('auth-logout').disabled = false; }
});

const dateFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' });
function dateText(value) { return value && !Number.isNaN(Date.parse(value)) ? dateFormat.format(new Date(value)) : 'Sin acceso registrado'; }
async function loadUsers(offset) {
  $('users-previous').disabled = true; $('users-next').disabled = true;
  message('Cargando usuarios…', false, 'users-message');
  try {
    const data = await request('/api/users?offset=' + offset);
    usersOffset = offset; usersHasMore = data.hasMore;
    const fragment = document.createDocumentFragment();
    data.users.forEach(user => {
      const row = document.createElement('tr');
      const person = document.createElement('td');
      const name = document.createElement('strong'); name.textContent = user.name || 'Sin nombre';
      const email = document.createElement('span'); email.textContent = user.email;
      if (user.emailVerified !== true) { const pending = document.createElement('span'); pending.textContent = 'Correo pendiente de verificación'; person.append(pending); }
      person.prepend(name, email); row.append(person);
      for (const value of [user.createdAt, user.last_seen_at]) { const cell = document.createElement('td'); cell.textContent = dateText(value); row.append(cell); }
      fragment.append(row);
    });
    $('users-rows').replaceChildren(fragment);
    message(`${data.total} ${data.total === 1 ? 'cuenta registrada' : 'cuentas registradas'}.`, false, 'users-message');
    $('users-page').textContent = data.total ? `${offset + 1}–${offset + data.users.length}` : 'Sin usuarios';
  } catch (error) {
    $('users-rows').replaceChildren(); message(errorText(error), true, 'users-message');
  } finally { $('users-previous').disabled = usersOffset === 0; $('users-next').disabled = !usersHasMore; }
}
$('open-users').addEventListener('click', () => { $('account-dialog').close(); $('users-dialog').showModal(); loadUsers(0); });
$('users-previous').addEventListener('click', () => loadUsers(Math.max(0, usersOffset - 50)));
$('users-next').addEventListener('click', () => loadUsers(usersOffset + 50));
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !mounted || checkingSession) return;
  checkingSession = true;
  try {
    const session = await request('/api/session');
    if (!session.user?.emailVerified || session.user.id !== currentUser?.id) {
      application.hidden = true; application.inert = true; location.reload();
    }
  }
  catch { /* Keep the page readable during a temporary connection failure; APIs still validate each request. */ }
  finally { checkingSession = false; }
});
window.addEventListener('pageshow', event => {
  // A restored page may still hold the previous user's content after logout in another tab.
  if (!event.persisted || !mounted) return;
  application.hidden = true; application.inert = true;
  location.reload();
});

if (entry.searchParams.has('neon_auth_session_verifier')) {
  const callback = new URL('/api/auth-return', location.origin);
  callback.searchParams.set('neon_auth_session_verifier', entry.searchParams.get('neon_auth_session_verifier'));
  callback.searchParams.set('next', location.hash);
  location.replace(callback.pathname + callback.search);
} else {
  // Keep reset tokens out of subsequent referrers and browsing history entries.
  if (entry.search) history.replaceState(null, '', location.pathname + location.hash);
  bootstrap();
}
