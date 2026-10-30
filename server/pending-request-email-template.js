import { groupLabel } from '../groups.js';
import { HUELLAS_EMAIL_URL, LOGO_CID } from './approval-email-template.js';

export const OWNER_NOTIFICATION_EMAIL = 'abelpravata@gmail.com';
export const ADMIN_REVIEW_URL = `${HUELLAS_EMAIL_URL}/#solicitudes-pendientes`;
export const PENDING_REQUEST_SUBJECT = 'Nueva solicitud pendiente en Huellas 📖';
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));

export function pendingRequestEmailTemplate({ name, applicantEmail, groupId }) {
  const group = groupLabel(groupId);
  const text = `Hay una nueva solicitud pendiente de aprobación en Huellas.\n\nNombre completo: ${name}\nCorreo electrónico: ${applicantEmail}\nGrupo seleccionado: ${group}\n\nEl correo de esta persona ya fue verificado.\n\nRevisar solicitud: ${ADMIN_REVIEW_URL}\n\nSolo los administradores autorizados pueden revisar y aprobar solicitudes.\n\nHuellas — Estudios Bíblicos`;
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>${PENDING_REQUEST_SUBJECT}</title></head>
<body style="margin:0;padding:0;background-color:#080f14;color:#e8f0ef;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Una persona verificó su correo y eligió su grupo. Su solicitud está lista para revisar.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#080f14" style="width:100%;background-color:#080f14;"><tr><td align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#101b22" style="width:100%;max-width:560px;border:1px solid #263d48;border-radius:16px;background-color:#101b22;">
<tr><td style="padding:32px 28px 24px;border-bottom:1px solid #263d48;">
<img src="cid:${LOGO_CID}" alt="Biblia abierta" width="60" height="60" style="display:block;border:0;width:60px;height:60px;margin:0 0 16px;border-radius:12px;">
<p style="margin:0;color:#d5edf5;font-size:20px;font-weight:600;line-height:1.4;">Huellas — Estudios Bíblicos</p>
<p style="margin:8px 0 0;color:#83d7ce;font-size:11px;line-height:1.5;letter-spacing:2px;">UNA NUEVA SOLICITUD</p>
</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 20px;color:#e8f0ef;font-size:29px;line-height:1.25;font-weight:600;">Hay una cuenta<br>esperando aprobación.</h1>
<p style="margin:0 0 24px;color:#b9ced5;font-size:16px;line-height:1.8;">Esta persona ya verificó su correo electrónico y eligió su grupo de estudio. Podés revisar su solicitud en el panel administrativo.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#142831" style="width:100%;table-layout:fixed;background-color:#142831;border-radius:8px;">
<tr><td style="padding:18px 18px 8px;color:#9bb5bf;font-size:12px;line-height:1.6;">Nombre completo<br><strong style="color:#d5edf5;font-size:16px;overflow-wrap:anywhere;word-break:break-word;">${escape(name)}</strong></td></tr>
<tr><td style="padding:8px 18px;color:#9bb5bf;font-size:12px;line-height:1.6;">Correo electrónico<br><span style="color:#c3e5ee;font-size:15px;overflow-wrap:anywhere;word-break:break-word;">${escape(applicantEmail)}</span></td></tr>
<tr><td style="padding:8px 18px 18px;color:#9bb5bf;font-size:12px;line-height:1.6;">Grupo seleccionado<br><strong style="color:#83d7ce;font-size:15px;">${escape(group)}</strong></td></tr>
</table>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;"><tr><td align="center" bgcolor="#9cdbf4" style="background-color:#9cdbf4;border-radius:8px;mso-padding-alt:16px 24px;"><a href="${ADMIN_REVIEW_URL}" style="display:inline-block;padding:16px 24px;color:#0a1921;font-size:15px;line-height:1.4;font-weight:bold;text-decoration:none;border:1px solid #9cdbf4;border-radius:8px;">Revisar solicitud</a></td></tr></table>
<p style="margin:0;color:#9bb5bf;font-size:13px;line-height:1.8;">El enlace abre las solicitudes pendientes. Para revisarlas, necesitás iniciar sesión con una cuenta administradora autorizada.</p>
</td></tr>
<tr><td style="padding:22px 28px;border-top:1px solid #263d48;"><p style="margin:0;color:#8ca7b2;font-size:12px;line-height:1.8;">Si el botón no funciona, ingresá desde este enlace:<br><a href="${ADMIN_REVIEW_URL}" style="color:#9cdbf4;text-decoration:underline;overflow-wrap:anywhere;">${ADMIN_REVIEW_URL}</a></p></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="margin:20px 0 0;color:#7895a1;font-size:11px;line-height:1.7;">Huellas · Estudios Bíblicos · San Rafael</p>
</td></tr></table>
</body></html>`;
  return { subject: PENDING_REQUEST_SUBJECT, html, text };
}
