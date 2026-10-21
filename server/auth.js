import {
  handleAuthProxyRequest, handleAuthRequest, handleAuthResponse, processAuthMiddleware,
  extractNeonAuthCookies, NEON_AUTH_SESSION_COOKIE_NAME, NEON_AUTH_SESSION_DATA_COOKIE_NAME,
  NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME, serializeSetCookie,
} from '@neondatabase/auth/server';
import { HttpError, bodyJSON, guard, json } from './http.js';
import { fullNameMessage, normalizeFullName, validFullName } from '../name-rules.js';
import { authLimit } from './limits.js';

const endpoints = new Set(['sign-up/email', 'sign-in/email', 'sign-in/social', 'sign-out',
  'send-verification-email', 'email-otp/verify-email', 'request-password-reset', 'reset-password']);

export function safeHash(value) { return typeof value === 'string' && /^#[a-z0-9-]+(?:\/(?:historia|claves|conclusion|referencias))?$/i.test(value) ? value : ''; }
export function publicUser(user) {
  return { id: user.id, name: user.name || '', email: user.email, emailVerified: user.emailVerified === true, createdAt: user.createdAt };
}

export async function getSession(request, config, fresh = false) {
  const cookies = extractNeonAuthCookies(request.headers);
  if (!cookies.split(';').some(cookie => cookie.trim().startsWith(NEON_AUTH_SESSION_COOKIE_NAME + '='))) return { user: null, cookies: [] };
  const sessionRequest = new Request(new URL('/api/auth/get-session', config.origin), { headers: request.headers });
  const response = fresh
    ? await handleAuthResponse(await handleAuthRequest(config.baseUrl, sessionRequest, 'get-session'), config.baseUrl,
      { secret: config.cookieSecret, sessionDataTtl: config.sessionDataTtl, sameSite: config.sameSite })
    : await handleAuthProxyRequest({ ...config, request: sessionRequest, path: 'get-session' });
  if (!response.ok) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'No pudimos verificar tu sesión. Intentá nuevamente.');
  const data = await response.json();
  const user = data?.user;
  const valid = user?.id && user.email && data?.session?.userId === user.id && Date.parse(data.session.expiresAt) > Date.now();
  return { user: valid ? user : null, cookies: response.headers.getSetCookie() };
}

export function requireUser(session) {
  if (!session.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Ingresá a tu cuenta para continuar.');
  if (session.user.emailVerified !== true) throw new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verificá tu correo para continuar.');
  return session.user;
}
export function withCookies(response, cookies) { for (const cookie of cookies) response.headers.append('Set-Cookie', cookie); return response; }

function email(value) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new HttpError(400, 'INVALID_EMAIL', 'Ingresá un correo válido.');
  return value.trim();
}
function password(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) throw new HttpError(400, 'INVALID_PASSWORD', 'La contraseña debe tener entre 8 y 128 caracteres.');
  return value;
}

export async function authProxy(request, config) {
  guard(request, config, ['POST']);
  const path = new URL(request.url).pathname.replace(/^\/api\/auth\//, '');
  if (!endpoints.has(path)) throw new HttpError(404, 'NOT_FOUND', 'Recurso no encontrado.');
  const input = await bodyJSON(request);
  const callback = new URL('/api/auth-return', config.origin);
  callback.searchParams.set('next', safeHash(input.returnHash));
  let payload;
  switch (path) {
    case 'sign-up/email': {
      const name = normalizeFullName(input.name);
      if (!validFullName(name)) throw new HttpError(400, 'INVALID_NAME', fullNameMessage);
      payload = { name, email: email(input.email), password: password(input.password), callbackURL: callback.href, rememberMe: input.rememberMe !== false };
      break;
    }
    case 'sign-in/email': payload = { email: email(input.email), password: password(input.password), callbackURL: callback.href, rememberMe: input.rememberMe !== false }; break;
    case 'sign-in/social':
      if (process.env.HUELLAS_GOOGLE_ENABLED !== 'true') throw new HttpError(404, 'GOOGLE_NOT_ENABLED', 'El ingreso con Google todavía no está habilitado.');
      payload = { provider: 'google', callbackURL: callback.href, newUserCallbackURL: callback.href, errorCallbackURL: new URL('/?auth=error', config.origin).href };
      break;
    case 'send-verification-email': payload = { email: email(input.email), callbackURL: callback.href }; break;
    case 'email-otp/verify-email':
      if (typeof input.otp !== 'string' || !/^\d{4,10}$/.test(input.otp)) throw new HttpError(400, 'INVALID_OTP', 'Revisá el código que recibiste por correo.');
      payload = { email: email(input.email), otp: input.otp }; break;
    case 'request-password-reset': payload = { email: email(input.email), redirectTo: new URL('/?auth=reset', config.origin).href }; break;
    case 'reset-password':
      if (typeof input.token !== 'string' || !input.token || input.token.length > 4096) throw new HttpError(400, 'INVALID_TOKEN', 'El enlace no es válido. Solicitá uno nuevo.');
      payload = { token: input.token, newPassword: password(input.newPassword) }; break;
    case 'sign-out': payload = {}; break;
  }
  await authLimit(request, path, payload, config);
  const proxyRequest = new Request(new URL('/api/auth/' + path, config.origin), {
    method: 'POST', headers: request.headers, body: JSON.stringify(payload),
  });
  const upstream = await handleAuthProxyRequest({ ...config, request: proxyRequest, path });
  const data = await upstream.json().catch(() => ({}));
  let authOrigin;
  if (upstream.ok && path === 'sign-in/social') {
    // Managed Auth can return its own initialization URL before redirecting to Google.
    // Trust the configured service origin, never an origin supplied by the client/provider JSON.
    authOrigin = new URL(config.baseUrl).origin;
    let target;
    try { if (typeof data?.url === 'string') target = new URL(data.url); } catch { /* Reject invalid destinations below. */ }
    if (!target || target.protocol !== 'https:' || target.username || target.password ||
        ![authOrigin, 'https://accounts.google.com', 'https://accounts.googleusercontent.com'].includes(target.origin)) {
      throw new HttpError(502, 'INVALID_OAUTH_REDIRECT', 'No pudimos abrir Google. Intentá nuevamente.');
    }
  }
  // Session tokens and provider metadata stay out of browser-readable responses.
  const safe = upstream.ok ? {
    ...(data.user ? { user: publicUser(data.user) } : {}),
    ...(typeof data.url === 'string' ? { url: data.url } : {}),
    ...(authOrigin ? { authOrigin } : {}),
    ...(typeof data.status === 'boolean' ? { status: data.status } : {}),
  } : { code: typeof data.code === 'string' ? data.code : 'AUTH_ERROR', message: 'No pudimos completar la solicitud. Revisá tus datos e intentá nuevamente.' };
  const response = withCookies(json(path === 'sign-out' ? { status: true } : safe, path === 'sign-out' ? 200 : upstream.status), upstream.headers.getSetCookie());
  if (path === 'sign-out') {
    for (const name of [NEON_AUTH_SESSION_COOKIE_NAME, NEON_AUTH_SESSION_DATA_COOKIE_NAME, NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME]) {
      response.headers.append('Set-Cookie', serializeSetCookie({ name, value: '', path: '/', maxAge: 0, httpOnly: true, secure: true, sameSite: 'lax' }));
    }
  }
  return response;
}

export async function authReturn(request, config) {
  // OAuth callbacks are cross-site top-level navigations; the SDK checks the challenge/verifier pair.
  if (request.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
  const url = new URL(request.url);
  const next = safeHash(url.searchParams.get('next'));
  const decision = await processAuthMiddleware({ ...config, request, pathname: url.pathname,
    loginUrl: '/ingresar', skipRoutes: [], logLevel: 'silent' });
  const target = decision.action === 'redirect_oauth' ? decision.redirectUrl.href
    : decision.action === 'allow' ? new URL('/' + next, config.origin).href
    : new URL('/?auth=error' + next, config.origin).href;
  if (new URL(target).origin !== config.origin) throw new HttpError(400, 'INVALID_REDIRECT', 'Dirección no válida.');
  return withCookies(new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } }), decision.cookies || []);
}
