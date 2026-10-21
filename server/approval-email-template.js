import { groupLabel } from '../groups.js';

export const HUELLAS_EMAIL_URL = 'https://estudiosbiblicossr.vercel.app';
export const APPROVAL_SUBJECT = '¡Tu cuenta de Huellas fue aprobada! 📖';
export const LOGO_CID = 'huellas-biblia@estudiosbiblicossr.vercel.app';
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));

export function approvalEmailTemplate({ name, groupId }) {
  const person = String(name || '').trim();
  const greeting = person ? `¡Paz del Señor, ${person}!` : '¡Paz del Señor!';
  const group = groupLabel(groupId);
  const text = `${greeting}\n\n¡Tu cuenta de Huellas fue aprobada!\n\nYa podés ingresar y explorar las clases y enseñanzas bíblicas preparadas para tu grupo.\n\nTu grupo: ${group}\n\nIngresar a Huellas: ${HUELLAS_EMAIL_URL}\n\nCada encuentro con la Palabra de Dios deja una huella en nuestra vida.\n\nHuellas — Estudios Bíblicos`;
  // Tables, inline styles and an embedded PNG keep the message usable without
  // external fonts, SVG support, remote images or JavaScript in email clients.
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>${APPROVAL_SUBJECT}</title></head>
<body style="margin:0;padding:0;background-color:#080f14;color:#e8f0ef;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">Tu cuenta está lista. Te esperamos en los estudios bíblicos de tu grupo.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#080f14" style="width:100%;background-color:#080f14;"><tr><td align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#101b22" style="width:100%;max-width:560px;border:1px solid #263d48;border-radius:16px;background-color:#101b22;">
<tr><td style="padding:32px 28px 24px;border-bottom:1px solid #263d48;">
<img src="cid:${LOGO_CID}" alt="Biblia abierta" width="60" height="60" style="display:block;border:0;width:60px;height:60px;margin:0 0 16px;border-radius:12px;">
<p style="margin:0;color:#d5edf5;font-size:20px;font-weight:600;line-height:1.4;">Huellas — Estudios Bíblicos</p>
<p style="margin:8px 0 0;color:#83d7ce;font-size:11px;line-height:1.5;letter-spacing:2px;">BIENVENIDO A ESTA COMUNIDAD</p>
</td></tr>
<tr><td style="padding:28px;">
<p style="margin:0 0 20px;color:#b9ced5;font-size:16px;line-height:1.7;overflow-wrap:anywhere;">${escape(greeting)}</p>
<h1 style="margin:0 0 20px;color:#e8f0ef;font-size:29px;line-height:1.25;font-weight:600;">¡Tu cuenta de Huellas<br>fue aprobada!</h1>
<p style="margin:0 0 24px;color:#b9ced5;font-size:16px;line-height:1.8;">Ya podés ingresar y explorar las clases y enseñanzas bíblicas preparadas para tu grupo.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#142831" style="background-color:#142831;border-radius:8px;"><tr><td style="padding:16px 18px;color:#c3e5ee;font-size:14px;line-height:1.6;"><strong>Tu grupo:</strong> ${escape(group)}</td></tr></table>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;"><tr><td align="center" bgcolor="#9cdbf4" style="background-color:#9cdbf4;border-radius:8px;mso-padding-alt:16px 24px;"><a href="${HUELLAS_EMAIL_URL}" style="display:inline-block;padding:16px 24px;color:#0a1921;font-size:15px;line-height:1.4;font-weight:bold;text-decoration:none;border:1px solid #9cdbf4;border-radius:8px;">Ingresar a Huellas</a></td></tr></table>
<p style="margin:0;color:#9bb5bf;font-size:14px;line-height:1.8;">Cada encuentro con la Palabra de Dios deja una huella en nuestra vida.</p>
</td></tr>
<tr><td style="padding:22px 28px;border-top:1px solid #263d48;"><p style="margin:0;color:#8ca7b2;font-size:12px;line-height:1.8;">Si el botón no funciona, ingresá desde este enlace:<br><a href="${HUELLAS_EMAIL_URL}" style="color:#9cdbf4;text-decoration:underline;overflow-wrap:anywhere;">${HUELLAS_EMAIL_URL}</a></p></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="margin:20px 0 0;color:#7895a1;font-size:11px;line-height:1.7;">Huellas · Estudios Bíblicos · San Rafael</p>
</td></tr></table>
</body></html>`;
  return { subject: APPROVAL_SUBJECT, html, text };
}
