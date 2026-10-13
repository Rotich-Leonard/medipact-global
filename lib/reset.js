const crypto = require('crypto');
const { sendResetEmail } = require('./mailer');

const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

// Base URL used inside emailed links. In production APP_URL must be set (avoids Host-header poisoning).
function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (process.env.NODE_ENV !== 'production') return `${req.protocol}://${req.get('host')}`;
  return null;
}

/** Creates a single-use token for `admin` and emails the link to the address on their profile. */
async function issueReset(admin, req, { invite = false } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  admin.resetTokenHash = sha(token);
  admin.resetExpires = new Date(Date.now() + (invite ? 48 : 1) * 3600 * 1000);
  await admin.save();

  const base = appUrl(req);
  if (!base) return { sent: false, error: 'APP_URL is not set on the server' };
  const link = `${base}/admin/#reset=${token}`;
  const result = await sendResetEmail({ to: admin.email, name: admin.name, link, invite });
  if (!result.sent && process.env.NODE_ENV !== 'production') console.log(`[dev] ${admin.email} reset link: ${link}`);
  return result;
}

module.exports = { sha, issueReset };
