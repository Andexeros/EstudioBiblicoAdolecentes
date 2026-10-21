import nodemailer from 'nodemailer';
import { readFile } from 'node:fs/promises';
import { database } from './access.js';
import { databaseError } from './memberships.js';
import { approvalEmailTemplate, LOGO_CID } from './approval-email-template.js';

const validAddress = value => typeof value === 'string' && value.length <= 254 && /^[^\s@<>,;:"()\[\]\\]+@[^\s@<>,;:"()\[\]\\]+$/.test(value);
const failure = code => Object.assign(new Error(code), { code });
export function smtpConfiguration(env = process.env) {
  const host = env.HUELLAS_SMTP_HOST?.trim(), user = env.HUELLAS_SMTP_USER?.trim();
  const pass = env.HUELLAS_SMTP_PASSWORD, from = env.HUELLAS_SMTP_FROM?.trim();
  const rawPort = env.HUELLAS_SMTP_PORT || '587', port = Number(rawPort);
  if (!host || !/^[a-zA-Z0-9.-]+$/.test(host) || !user || !pass || !validAddress(from)
      || !/^\d{1,5}$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) throw failure('SMTP_NOT_CONFIGURED');
  return { host, port, secure: port === 465, requireTLS: port !== 465,
    auth: { user, pass }, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: 4000, greetingTimeout: 3000, socketTimeout: 5000, dnsTimeout: 3000,
    logger: false, debug: false, transactionLog: false, pool: false,
    disableFileAccess: true, disableUrlAccess: true,
    from: { name: 'Huellas — Estudios Bíblicos', address: from } };
}

export async function sendApprovalSMTP(notification) {
  const options = smtpConfiguration();
  if (!validAddress(notification.email)) throw failure('SMTP_INVALID_RECIPIENT');
  const logo = await readFile(new URL('../huellas-icon-192-v2.png', import.meta.url));
  const transport = nodemailer.createTransport(options);
  const message = { ...approvalEmailTemplate(notification), from: options.from,
    to: { address: notification.email },
    messageId: `<huellas-approval.${notification.id}.${notification.attemptId}@${options.from.address.split('@')[1]}>`,
    attachments: [{ filename: 'huellas-biblia.png', content: logo, contentType: 'image/png', cid: LOGO_CID, contentDisposition: 'inline' }] };
  let timer;
  try {
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { transport.close(); reject(failure('SMTP_DEADLINE')); }, 11000); });
    const result = await Promise.race([transport.sendMail(message), deadline]);
    if (!result.accepted?.some(value => String(value).toLowerCase() === notification.email.toLowerCase())) throw failure('SMTP_REJECTED');
    return { messageId: result.messageId };
  } finally { clearTimeout(timer); transport.close(); }
}

function deliveryFailure(error) {
  if (error?.code === 'SMTP_NOT_CONFIGURED') return { status: 'failed', code: 'SMTP_NOT_CONFIGURED' };
  if (error?.code === 'EAUTH') return { status: 'failed', code: 'SMTP_AUTH_FAILED' };
  if (['EENVELOPE','EMESSAGE','SMTP_INVALID_RECIPIENT','SMTP_REJECTED'].includes(error?.code)
      || (error?.responseCode >= 400 && error.responseCode <= 599)) return { status: 'failed', code: 'SMTP_REJECTED' };
  if (['EDNS','ECONNECTION','ESOCKET'].includes(error?.code) && ['CONN','EHLO','HELO','STARTTLS'].includes(error?.command)) return { status: 'failed', code: 'SMTP_UNAVAILABLE' };
  // A dropped connection after DATA may have delivered the message. Never
  // retry automatically: let an administrator check and explicitly resend.
  return { status: 'uncertain', code: 'SMTP_UNCERTAIN' };
}

export async function notifyApproval(actorId, targetId, version, { manual = false, send = sendApprovalSMTP } = {}) {
  const sql = database();
  let notification;
  try {
    const rows = await sql`/* huellas:approval-email-claim */ SELECT public.huellas_claim_approval_email(${actorId},${targetId},${version},${manual}) AS result`;
    notification = rows[0]?.result;
  } catch (error) { throw databaseError(error); }
  if (notification?.status !== 'claimed') return { status: notification?.status || 'unavailable' };
  let outcome, messageId = null;
  try {
    const result = await send(notification);
    outcome = { status: 'sent', code: null }; messageId = result.messageId || null;
  } catch (error) { outcome = deliveryFailure(error); }
  try {
    const rows = await sql`/* huellas:approval-email-finish */ SELECT public.huellas_finish_approval_email(${notification.id}::uuid,${notification.attemptId}::uuid,${outcome.status},${messageId},${outcome.code}) AS saved`;
    if (rows[0]?.saved !== true) return { status: 'uncertain' };
  } catch {
    console.error('Huellas approval email: OUTCOME_NOT_RECORDED');
    return { status: 'uncertain' };
  }
  return { status: outcome.status, ...(outcome.code ? { code: outcome.code } : {}) };
}
