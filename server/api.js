import { lessons } from '../lessons.js';
import { bodyJSON, guard, HttpError, json } from './http.js';
import { getSession, requireUser, publicUser, isAdmin, withCookies } from './auth.js';
import { recordAccess, registeredUsers } from './access.js';

export async function sessionEndpoint(request, config) {
  guard(request, config, ['GET', 'POST']);
  const session = await getSession(request, config);
  if (request.method === 'POST') {
    await bodyJSON(request);
    requireUser(session);
    await recordAccess(session.user.id);
  }
  return withCookies(json({ user: session.user ? publicUser(session.user) : null,
    isAdmin: isAdmin(session.user), googleEnabled: process.env.HUELLAS_GOOGLE_ENABLED === 'true' }), session.cookies);
}

export async function lessonsEndpoint(request, config) {
  guard(request, config, ['GET']);
  const session = await getSession(request, config);
  requireUser(session);
  return withCookies(json({ lessons }), session.cookies);
}

export async function usersEndpoint(request, config) {
  guard(request, config, ['GET']);
  const session = await getSession(request, config, true);
  const user = requireUser(session);
  if (!isAdmin(user)) throw new HttpError(403, 'FORBIDDEN', 'Esta sección es solo para administradores.');
  const raw = new URL(request.url).searchParams.get('offset') || '0';
  if (!/^\d{1,6}$/.test(raw)) throw new HttpError(400, 'INVALID_PAGE', 'Página no válida.');
  return withCookies(json(await registeredUsers(Number(raw))), session.cookies);
}
