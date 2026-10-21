import { HttpError } from './http.js';

export function deletionConfigured() {
  return Boolean(process.env.NEON_API_KEY && /^[a-z0-9-]{1,60}$/.test(process.env.NEON_PROJECT_ID || '') && /^[a-z0-9-]{1,60}$/.test(process.env.NEON_BRANCH_ID || ''));
}
export async function deletionService(config) {
  if (!deletionConfigured()) throw new HttpError(503,'DELETE_NOT_CONFIGURED','La eliminación necesita configurar la API administrativa de Neon. Las otras acciones siguen disponibles.');
  const path = `https://console.neon.tech/api/v2/projects/${process.env.NEON_PROJECT_ID}/branches/${process.env.NEON_BRANCH_ID}/auth`;
  const headers = { Authorization: `Bearer ${process.env.NEON_API_KEY}`, Accept:'application/json' };
  let response, data;
  try { response = await fetch(path, {headers,signal:AbortSignal.timeout(4000),redirect:'error'}); data = await response.json(); }
  catch { throw new HttpError(503,'DELETE_UNAVAILABLE','No pudimos verificar la configuración de eliminación. Volvé a intentar.'); }
  const dbName = decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.slice(1));
  if (!response.ok || data.auth_provider !== 'better_auth' || data.branch_id !== process.env.NEON_BRANCH_ID || data.db_name !== dbName
      || typeof data.base_url !== 'string' || data.base_url.replace(/\/+$/,'') !== config.baseUrl.replace(/\/+$/,'')) {
    throw new HttpError(503,'DELETE_CONFIGURATION_MISMATCH','La configuración de eliminación debe corresponder a la misma base, rama y servicio de autenticación de Huellas.');
  }
  return async userId => {
    let deleted;
    try { deleted = await fetch(path + '/users/' + encodeURIComponent(userId), {method:'DELETE',headers,signal:AbortSignal.timeout(7000),redirect:'error'}); }
    catch { throw new HttpError(503,'DELETE_INCOMPLETE','No se pudo confirmar la eliminación. La cuenta sigue bloqueada; el propietario puede revisar y reintentar.'); }
    // A repeated, explicitly confirmed operation can finish cleanup after a previous partial success.
    if (!deleted.ok && deleted.status !== 404) throw new HttpError(503,'DELETE_INCOMPLETE','Neon no confirmó la eliminación. La cuenta sigue bloqueada; revisá la configuración antes de reintentar.');
  };
}
