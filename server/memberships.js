import { database } from './access.js';
import { HttpError } from './http.js';

export const adminAccess = member => member?.status === 'approved' && !member.deletion_id && ['owner','admin'].includes(member.role);
export function publicAccess(member) {
  return { status: member.status, role: member.role, groupId: member.study_group || null, version: Number(member.version) };
}
export function requireApproved(member) {
  if (!member) throw new HttpError(401, 'ACCOUNT_UNAVAILABLE', 'No pudimos encontrar tu cuenta. Volvé a ingresar.');
  if (member.status !== 'approved' || member.deletion_id) {
    const code = {pending:'ACCOUNT_PENDING',rejected:'ACCOUNT_REJECTED',blocked:'ACCOUNT_BLOCKED'}[member.status] || 'ACCOUNT_BLOCKED';
    throw new HttpError(403, code, 'Tu cuenta todavía no tiene acceso a los estudios. Consultá su estado en Huellas.');
  }
  return member;
}
export function requireAdministrator(member, ownerOnly = false) {
  requireApproved(member);
  if (!adminAccess(member) || (ownerOnly && member.role !== 'owner')) throw new HttpError(403, 'FORBIDDEN', 'No tenés permiso para realizar esta acción.');
  return member;
}
export async function membership(userId, create = true) {
  const sql = database();
  const rows = await sql`/* huellas:membership */ SELECT m.*, p.study_group
    FROM public.huellas_memberships m
    JOIN neon_auth."user" u ON u.id::text = m.user_id
    LEFT JOIN public.huellas_user_preferences p ON p.user_id = m.user_id
    WHERE m.user_id = ${userId}`;
  if (rows[0]) return rows[0];
  if (create) {
    await sql`/* huellas:initialize */ INSERT INTO public.huellas_memberships (user_id)
      SELECT id::text FROM neon_auth."user" WHERE id::text = ${userId}
      AND NOT EXISTS (SELECT 1 FROM public.huellas_admin_audit WHERE target_id = ${userId} AND action = 'delete')
      ON CONFLICT (user_id) DO NOTHING`;
    return membership(userId, false);
  }
  return null;
}
export function databaseError(error) {
  const code = /^HUELLAS_([A-Z_]+)$/.exec(error.message || '')?.[1];
  const known = {
    FORBIDDEN:[403,'No tenés permiso para realizar esta acción.'], OWNER_PROTECTED:[403,'La cuenta propietaria está protegida.'],
    USER_NOT_FOUND:[404,'La cuenta ya no está disponible.'], STALE_USER:[409,'La cuenta cambió. Actualizá el listado y revisá la acción.'],
    EMAIL_NOT_VERIFIED:[409,'La cuenta debe verificar su correo antes de ser aprobada o reactivada.'],
    INVALID_TRANSITION:[409,'La acción no corresponde al estado actual de la cuenta.'],
    DELETION_PENDING:[409,'La eliminación de esta cuenta está pendiente de finalizar.'],
    DELETE_INCOMPLETE:[503,'La identidad todavía figura en Neon. La cuenta sigue bloqueada; revisá el estado antes de reintentar.'],
    CONFIRMATION_REQUIRED:[400,'Escribí el correo de la cuenta para confirmar su eliminación.'],
    INVALID_GROUP:[400,'Elegí uno de los grupos disponibles.'], INVALID_ACTION:[400,'Acción no válida.'],
    ACCESS_DENIED:[403,'Tu cuenta no puede realizar esta operación. Consultá su estado.'],
  };
  if (known[code]) return new HttpError(known[code][0], code === 'ACCESS_DENIED' ? 'ACCOUNT_BLOCKED' : code, known[code][1]);
  return error;
}
