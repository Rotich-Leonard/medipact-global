/* Mail helper. SMTP settings come from the admin console (stored encrypted in MongoDB)
 * and fall back to SMTP_* variables in .env. */
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Setting } = require('../models');

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oneLine = (v) => String(v || '').replace(/[\r\n]+/g, ' ').trim();

/* ---- encrypt the SMTP password at rest (AES-256-GCM) ---- */
const key = () => crypto.scryptSync(process.env.SETTINGS_KEY || process.env.JWT_SECRET || 'dev-only', 'medimpact-smtp', 32);
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function decrypt(b64) {
  const raw = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
}

/* ---- config + transport ---- */
let cache; // undefined = not loaded, null = not configured, object = ready
function resetCache() { cache = undefined; }

async function loadConfig() {
  const s = await Setting.findOne({ key: 'smtp' }).lean();
  const d = s && s.data;
  if (d && d.host && d.user && d.passEnc) {
    try {
      return { host: d.host, port: Number(d.port) || 587, secure: !!d.secure, user: d.user, pass: decrypt(d.passEnc), from: d.from || d.user, source: 'admin' };
    } catch (e) {
      console.error('Saved SMTP password could not be decrypted (did JWT_SECRET / SETTINGS_KEY change?). Re-enter it in Admin → Email (SMTP).');
    }
  }
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const port = Number(SMTP_PORT || 587);
    return { host: SMTP_HOST, port, secure: SMTP_SECURE === 'true' || port === 465, user: SMTP_USER, pass: SMTP_PASS, from: MAIL_FROM || SMTP_USER, source: 'env' };
  }
  return null;
}

async function getMailer() {
  if (cache !== undefined) return cache;
  const cfg = await loadConfig();
  cache = cfg && {
    cfg,
    transport: nodemailer.createTransport({
      host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    }),
  };
  return cache;
}

/** Generic send. Never throws: returns { sent, error? } */
async function sendMail({ to, subject, text, html, replyTo }) {
  try {
    const m = await getMailer();
    if (!m) return { sent: false, error: 'SMTP is not configured (Admin → Email (SMTP))' };
    if (!to) return { sent: false, error: 'No recipient' };
    await m.transport.sendMail({
      from: `"${(process.env.MAIL_FROM_NAME || 'MedImpact Global').replace(/"/g, '')}" <${m.cfg.from.replace(/^.*<|>$/g, '')}>`,
      to, subject: oneLine(subject), text, html, ...(replyTo ? { replyTo } : {}),
    });
    return { sent: true };
  } catch (e) {
    console.error('Mail failed:', e.message);
    return { sent: false, error: String(e.message).slice(0, 240) };
  }
}

/* ---- templates ---- */
async function sendContactEmail(m, to) {
  const name = oneLine(`${m.firstName} ${m.lastName}`);
  const rows = [['Name', name], ['Email', m.email], ['Phone / WhatsApp', m.phone], ['Category', m.category || '—']];
  return sendMail({
    to,
    replyTo: `"${name.replace(/"/g, '')}" <${oneLine(m.email)}>`,
    subject: `[Website enquiry] ${oneLine(m.category) || 'New message'} – ${name}`,
    text: `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nMessage:\n${m.message}\n`,
    html: `<div style="font-family:Arial,sans-serif;max-width:620px">
      <h2 style="color:#bb0112;margin:0 0 12px">New website enquiry</h2>
      <table style="border-collapse:collapse;width:100%">${rows.map(([k, v]) =>
        `<tr><td style="padding:6px 10px;background:#eff4ff;font-weight:bold;width:160px">${esc(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(v)}</td></tr>`).join('')}</table>
      <h3 style="margin:18px 0 6px">Message</h3>
      <p style="white-space:pre-wrap;background:#f8f9ff;padding:12px;border-radius:6px;margin:0">${esc(m.message)}</p>
      <p style="color:#777;font-size:12px;margin-top:16px">Reply directly to this email to respond to the sender.</p></div>`,
  });
}

async function sendResetEmail({ to, name, link, invite }) {
  const title = invite ? 'You have been invited as an admin' : 'Reset your admin password';
  const lead = invite
    ? 'An administrator created an account for you on the MedImpact Global website console. Use the button below to choose your password.'
    : 'We received a request to reset the password for your MedImpact Global admin account.';
  const valid = invite ? '48 hours' : '1 hour';
  return sendMail({
    to,
    subject: invite ? 'MedImpact Global – set up your admin account' : 'MedImpact Global – password reset',
    text: `Hello ${oneLine(name)},\n\n${lead}\n\n${link}\n\nThis link is valid for ${valid} and can be used once. If you did not expect this email, you can ignore it.\n`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px">
      <h2 style="color:#bb0112;margin:0 0 12px">${esc(title)}</h2>
      <p>Hello ${esc(name)},</p><p>${esc(lead)}</p>
      <p style="margin:24px 0"><a href="${esc(link)}" style="background:#0d1c32;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">${invite ? 'Set my password' : 'Reset my password'}</a></p>
      <p style="color:#555;font-size:13px">Or paste this link into your browser:<br><span style="word-break:break-all">${esc(link)}</span></p>
      <p style="color:#777;font-size:12px">Valid for ${valid} · single use. If you did not expect this email, ignore it — your password will not change.</p></div>`,
  });
}

module.exports = { sendMail, sendContactEmail, sendResetEmail, encrypt, resetCache, getMailer };
