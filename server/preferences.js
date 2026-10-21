import { database } from './access.js';
import { HttpError } from './http.js';
import { groupById } from '../groups.js';
import { databaseError } from './memberships.js';

export function validateGroup(groupId) {
  if (!groupById(groupId)) throw new HttpError(400, 'INVALID_GROUP', 'Elegí uno de los grupos disponibles.');
  return groupId;
}
export async function userGroup(userId) {
  const sql = database();
  const rows = await sql`SELECT study_group FROM public.huellas_user_preferences WHERE user_id = ${userId}`;
  return groupById(rows[0]?.study_group)?.id || null;
}
export async function saveUserGroup(userId, groupId) {
  validateGroup(groupId);
  const sql = database();
  try { await sql`/* huellas:own-group */ SELECT public.huellas_set_own_group(${userId},${groupId})`; }
  catch (error) { throw databaseError(error); }
  return groupId;
}
