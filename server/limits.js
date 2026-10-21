import { createHmac } from 'node:crypto';
import { database } from './access.js';
import { HttpError } from './http.js';

export async function consumeLimit(key, limit, seconds, config) {
  const digest = createHmac('sha256', config.cookieSecret).update(key).digest('hex');
  const sql = database();
  const rows = await sql`/* huellas:limit */ SELECT public.huellas_consume_limit(${digest}, ${limit}, ${seconds}) AS allowed`;
  if (rows[0]?.allowed !== true) throw new HttpError(429, 'TOO_MANY_REQUESTS', 'Hiciste varios intentos seguidos. Esperá unos minutos antes de volver a intentar.');
}
export async function authLimit(request, path, payload, config) {
  if (path === 'sign-out') return;
  const ip = request.headers.get('x-huellas-client-ip') || 'unavailable';
  const policies = {
    // Allow a group to register together behind the church's shared connection.
    'sign-up/email':[60,900,5,3600], 'sign-in/email':[60,600,25,600],
    'send-verification-email':[40,900,5,900], 'email-otp/verify-email':[60,900,12,900],
    'request-password-reset':[30,900,5,900], 'reset-password':[30,900], 'sign-in/social':[30,900],
  };
  const [ipLimit,ipWindow,emailLimit,emailWindow] = policies[path];
  await consumeLimit(`auth:ip:${path}:${ip}`, ipLimit, ipWindow, config);
  if (emailLimit && payload.email) await consumeLimit(`auth:email:${path}:${payload.email.toLowerCase()}`, emailLimit, emailWindow, config);
}
