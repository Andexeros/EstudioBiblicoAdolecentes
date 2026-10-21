import { bodyJSON, guard, HttpError, json } from './http.js';
import { getSession, requireUser, publicUser, withCookies } from './auth.js';
import { recordAccess, registeredUsers } from './access.js';
import { saveUserGroup, validateGroup } from './preferences.js';
import { studyForGroup } from './studies.js';
import { membership, publicAccess, requireApproved, requireConfirmedName, requireAdministrator, adminAccess } from './memberships.js';
import { consumeLimit } from './limits.js';
import { overview, audit, mutate, finishDelete, identityExists } from './admin-data.js';
import { deletionConfigured, deletionService } from './neon-admin.js';
import { fullNameMessage, normalizeFullName, validFullName } from '../name-rules.js';
import { confirmName } from './profile.js';

async function context(request, config) {
  const session = await getSession(request, config, true);
  const user = requireUser(session);
  const member = await membership(user.id);
  if (!member) throw new HttpError(401,'ACCOUNT_UNAVAILABLE','No pudimos encontrar tu cuenta. Volvé a ingresar.');
  return { session, user, member };
}
export async function sessionEndpoint(request, config) {
  guard(request, config, ['GET','POST']);
  const session = await getSession(request, config, true);
  const member = session.user ? await membership(session.user.id) : null;
  if (session.user && !member) throw new HttpError(401,'ACCOUNT_UNAVAILABLE','No pudimos encontrar tu cuenta. Volvé a ingresar.');
  if (request.method === 'POST') {
    await bodyJSON(request); requireUser(session);
    if (!['pending','approved'].includes(member.status) || member.deletion_id) requireApproved(member);
    await recordAccess(session.user.id);
  }
  return withCookies(json({ user: session.user ? publicUser({ ...session.user, name:member?.full_name || session.user.name }) : null,
    access: member ? publicAccess(member) : null,
    isAdmin: session.user?.emailVerified === true && adminAccess(member),
    googleEnabled: process.env.HUELLAS_GOOGLE_ENABLED === 'true' }),session.cookies);
}
export async function lessonsEndpoint(request, config) {
  guard(request, config, ['GET']);
  const { session, member } = await context(request, config); requireApproved(member);
  const params = new URL(request.url).searchParams, preview = params.get('previewGroup');
  if (preview !== null) requireAdministrator(member);
  const groupId = preview ?? member.study_group;
  if (!groupId) throw new HttpError(409,'GROUP_REQUIRED','Elegí tu grupo de estudio para continuar.');
  return withCookies(json(studyForGroup(groupId,params.get('collection') || '')),session.cookies);
}
export async function preferencesEndpoint(request, config) {
  guard(request, config, ['GET','POST']);
  const { session, user, member: initial } = await context(request, config);
  if (!['pending','approved'].includes(initial.status) || initial.deletion_id) requireApproved(initial);
  requireConfirmedName(initial);
  let member = initial, groupId = initial.study_group || null;
  if (request.method === 'POST') {
    const input = await bodyJSON(request);
    if (Object.keys(input).some(key => key !== 'groupId')) throw new HttpError(400,'INVALID_PREFERENCE','Revisá la selección de tu grupo.');
    validateGroup(input.groupId);
    await consumeLimit('group:'+user.id,30,300,config);
    groupId = await saveUserGroup(user.id,input.groupId);
    member = await membership(user.id,false);
    if (!member) throw new HttpError(401,'ACCOUNT_UNAVAILABLE','Volvé a ingresar.');
  }
  const access = publicAccess(member);
  return withCookies(json({ groupId, access, study: member.status === 'approved' && !member.deletion_id && groupId ? studyForGroup(groupId) : null }),session.cookies);
}
export async function profileEndpoint(request, config) {
  guard(request,config,['POST']);
  const {session,user,member}=await context(request,config);
  if (!['pending','approved'].includes(member.status) || member.deletion_id) requireApproved(member);
  const input=await bodyJSON(request);
  if (Object.keys(input).some(key=>key!=='name')) throw new HttpError(400,'INVALID_PROFILE','Solo podés confirmar tu propio nombre.');
  const name=normalizeFullName(input.name);
  if (!validFullName(name)) throw new HttpError(400,'INVALID_NAME',fullNameMessage);
  await consumeLimit('profile:'+user.id,10,300,config);
  const cookies=await confirmName(request,config,user,member,name);
  return withCookies(json({ok:true}),[...session.cookies,...cookies]);
}
export async function usersEndpoint(request, config) {
  guard(request, config, ['GET']);
  const { session, member } = await context(request, config); requireAdministrator(member);
  const params = new URL(request.url).searchParams, raw = params.get('offset') || '0';
  if (!/^\d{1,6}$/.test(raw)) throw new HttpError(400,'INVALID_PAGE','Página no válida.');
  const result = await registeredUsers(Number(raw),params.get('group') || '',{
    status:params.get('status') || '',role:params.get('role') || '',search:(params.get('search') || '').trim(),sort:params.get('sort') || 'registered_desc',
  });
  return withCookies(json(result),session.cookies);
}
export async function adminEndpoint(request, config) {
  guard(request,config,['GET','POST']);
  const { session, user, member } = await context(request,config); requireAdministrator(member);
  if (request.method === 'GET') {
    const params = new URL(request.url).searchParams, view = params.get('view') || 'overview';
    if (view === 'overview') return withCookies(json({metrics:await overview(),deletionEnabled:member.role === 'owner' && deletionConfigured()}),session.cookies);
    if (view !== 'audit') throw new HttpError(400,'INVALID_VIEW','Sección no válida.');
    requireAdministrator(member,true);
    const before = params.get('before');
    if (before !== null && !/^[1-9]\d{0,17}$/.test(before)) throw new HttpError(400,'INVALID_PAGE','Página no válida.');
    return withCookies(json(await audit(before)),session.cookies);
  }
  const input = await bodyJSON(request);
  if (Object.keys(input).some(key => !['action','userId','version','groupId','confirmation','confirmed'].includes(key))
    || !['approve','reject','block','reactivate','set_group','grant_admin','revoke_admin','delete'].includes(input.action)
    || typeof input.userId !== 'string' || !input.userId || input.userId.length > 200
    || !Number.isInteger(input.version) || input.version < 0 || input.version > 2147483647) throw new HttpError(400,'INVALID_ACTION','Revisá la acción y la cuenta seleccionada.');
  if (input.confirmed !== true) throw new HttpError(400,'CONFIRMATION_REQUIRED','Confirmá la acción antes de continuar.');
  if (['grant_admin','revoke_admin','delete'].includes(input.action)) requireAdministrator(member,true);
  if (input.action === 'set_group') validateGroup(input.groupId);
  else if (input.groupId !== undefined) throw new HttpError(400,'INVALID_ACTION','La acción no admite un grupo.');
  if (input.action !== 'delete' && input.confirmation !== undefined) throw new HttpError(400,'INVALID_ACTION','Revisá los datos de la acción.');
  if (input.action === 'delete' && (typeof input.confirmation !== 'string' || input.confirmation.length > 254)) throw new HttpError(400,'CONFIRMATION_REQUIRED','Escribí el correo de la cuenta.');
  await consumeLimit('admin:'+user.id,60,60,config);
  if (input.action === 'delete') {
    const remove = await deletionService(config);
    const result = await mutate(user.id,input.userId,'delete_prepare',input.version,null,input.confirmation.trim());
    try {
      await remove(input.userId);
      if (await identityExists(input.userId)) throw new HttpError(503,'DELETE_INCOMPLETE','La identidad todavía figura en Neon. La cuenta sigue bloqueada; revisá el estado antes de reintentar.');
    } catch (error) { await finishDelete(user.id,input.userId,result.operationId,false).catch(() => {}); throw error; }
    await finishDelete(user.id,input.userId,result.operationId,true);
  } else await mutate(user.id,input.userId,input.action,input.version,input.groupId || null);
  return withCookies(json({ok:true}),session.cookies);
}
