import { handleAuthProxyRequest } from '@neondatabase/auth/server';
import { database } from './access.js';
import { databaseError } from './memberships.js';
import { HttpError } from './http.js';

// Neon updates its own identity through the supported API. Huellas keeps the
// confirmed name separately so later OAuth profile synchronization cannot replace it.
export async function confirmName(request, config, user, member, name) {
  if (member.name_confirmed_at) {
    if (member.full_name !== name) throw new HttpError(409,'PROFILE_CONFIRMED','El nombre ya fue confirmado. Actualizá la página para continuar.');
    return [];
  }
  if (member.google_account !== true) throw new HttpError(400,'PROFILE_NOT_REQUIRED','Esta cuenta no necesita confirmar un nombre de Google.');
  const response = await handleAuthProxyRequest({ ...config, path:'update-user', request:new Request(new URL('/api/profile',config.origin), {
    method:'POST', headers:request.headers, body:JSON.stringify({name}),
  }) });
  if (!response.ok) throw new HttpError(response.status === 401 ? 401 : 503,'PROFILE_UPDATE_FAILED','No pudimos guardar tu nombre en Neon. Volvé a intentar.');
  const sql=database();
  try { await sql`/* huellas:confirm-name */ SELECT public.huellas_confirm_name(${user.id},${name})`; }
  catch(error) { throw databaseError(error); }
  return response.headers.getSetCookie();
}
