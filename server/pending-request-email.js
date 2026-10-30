import { database } from './access.js';
import { needsNameConfirmation } from './memberships.js';
import { validFullName } from '../name-rules.js';
import { groupById } from '../groups.js';
import { sendHuellasSMTP, deliveryFailure } from './approval-email.js';
import { pendingRequestEmailTemplate, OWNER_NOTIFICATION_EMAIL } from './pending-request-email-template.js';

export function sendPendingRequestSMTP(notification) {
  // The applicant's address is message content, never the notification recipient.
  return sendHuellasSMTP({ ...notification, email: OWNER_NOTIFICATION_EMAIL },
    pendingRequestEmailTemplate(notification), 'pending-request');
}

export async function notifyPendingRequest(user, member, { send = sendPendingRequestSMTP } = {}) {
  if (!user?.id || user.emailVerified !== true || member?.user_id !== user.id
      || member.status !== 'pending' || member.deletion_id || needsNameConfirmation(member)
      || !groupById(member.study_group) || !validFullName(member.full_name || user.name)) {
    return { status: 'not_applicable' };
  }
  let sql, notification;
  try {
    sql = database();
    // SQL rechecks current status, verified identity, name and group. Its unique
    // user_id permits only one attempt, even across simultaneous server instances.
    const rows = await sql`/* huellas:pending-request-email-claim */ SELECT public.huellas_claim_pending_request_email(${user.id}) AS result`;
    notification = rows[0]?.result;
  } catch {
    console.error('Huellas pending request email: NOTIFICATION_UNAVAILABLE');
    return { status: 'unavailable' };
  }
  if (notification?.status !== 'claimed') return { status: notification?.status || 'unavailable' };
  let outcome, messageId = null;
  try {
    const result = await send(notification);
    outcome = { status: 'sent', code: null }; messageId = result.messageId || null;
  } catch (error) {
    outcome = deliveryFailure(error);
    console.error(`Huellas pending request email: ${outcome.code}`);
  }
  try {
    const rows = await sql`/* huellas:pending-request-email-finish */ SELECT public.huellas_finish_pending_request_email(${notification.id}::uuid,${notification.attemptId}::uuid,${outcome.status},${messageId},${outcome.code}) AS saved`;
    if (rows[0]?.saved !== true) throw new Error('OUTCOME_NOT_RECORDED');
  } catch {
    // Never retry an ambiguous SMTP outcome or fail the successful onboarding.
    console.error('Huellas pending request email: OUTCOME_NOT_RECORDED');
    return { status: 'uncertain' };
  }
  return { status: outcome.status };
}
