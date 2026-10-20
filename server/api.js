import { bodyJSON, guard, HttpError, json } from './http.js';
import { getSession, requireUser, publicUser, isAdmin, withCookies } from './auth.js';
import { recordAccess, registeredUsers } from './access.js';
import { userGroup, saveUserGroup } from './preferences.js';
import { studyForGroup } from './studies.js';

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
  const params = new URL(request.url).searchParams;
  const preview = params.get('previewGroup');
  const session = await getSession(request, config, preview !== null);
  const user = requireUser(session);
  if (preview !== null && !isAdmin(user)) throw new HttpError(403, 'FORBIDDEN', 'Esta vista es solo para administradores.');
  const groupId = preview ?? await userGroup(user.id);
  if (!groupId) throw new HttpError(409, 'GROUP_REQUIRED', 'Elegí tu grupo de estudio para continuar.');
  return withCookies(json(studyForGroup(groupId, params.get('collection') || '')), session.cookies);
}

export async function preferencesEndpoint(request, config) {
  guard(request, config, ['GET', 'POST']);
  const session = await getSession(request, config);
  const user = requireUser(session);
  let groupId;
  if (request.method === 'POST') {
    const input = await bodyJSON(request);
    if (Object.keys(input).some(key => key !== 'groupId')) throw new HttpError(400, 'INVALID_PREFERENCE', 'Revisá la selección de tu grupo.');
    groupId = await saveUserGroup(user.id, input.groupId);
  } else groupId = await userGroup(user.id);
  return withCookies(json({ groupId, study: groupId ? studyForGroup(groupId) : null }), session.cookies);
}

export async function usersEndpoint(request, config) {
  guard(request, config, ['GET']);
  const session = await getSession(request, config, true);
  const user = requireUser(session);
  if (!isAdmin(user)) throw new HttpError(403, 'FORBIDDEN', 'Esta sección es solo para administradores.');
  const raw = new URL(request.url).searchParams.get('offset') || '0';
  if (!/^\d{1,6}$/.test(raw)) throw new HttpError(400, 'INVALID_PAGE', 'Página no válida.');
  const group = new URL(request.url).searchParams.get('group') || '';
  return withCookies(json(await registeredUsers(Number(raw), group)), session.cookies);
}
