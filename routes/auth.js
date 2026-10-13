const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { Admin } = require('../models');
const { COOKIE, cookieOptions, sign, requireAdmin, requireXHR } = require('../middleware/auth');
const { sha, issueReset } = require('../lib/reset');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const limiter = (windowMs, max, error) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error } });
const loginLimiter = limiter(15 * 60 * 1000, 10, 'Too many login attempts. Try again in 15 minutes.');
const forgotLimiter = limiter(60 * 60 * 1000, 5, 'Too many reset requests. Try again later.');
const resetLimiter = limiter(60 * 60 * 1000, 10, 'Too many attempts. Try again later.');

router.post('/login', requireXHR, loginLimiter, async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const admin = await Admin.findOne({ email });
  // Always run a compare to keep timing similar whether or not the user exists
  const hash = admin ? admin.passwordHash : '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await bcrypt.compare(password, hash);
  if (!admin || !ok) return res.status(401).json({ error: 'Invalid email or password' });

  admin.lastLoginAt = new Date();
  await admin.save();
  res.cookie(COOKIE, sign(admin), cookieOptions());
  res.json({ email: admin.email, name: admin.name });
});

router.post('/logout', requireXHR, (req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ id: String(req.admin._id), email: req.admin.email, name: req.admin.name });
});

/* ---- Forgot password: emails a single-use link to the address on the admin profile ---- */
router.post('/forgot', requireXHR, forgotLimiter, async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (EMAIL_RE.test(email)) {
    const admin = await Admin.findOne({ email });
    // Fire-and-forget so response time does not reveal whether the account exists
    if (admin) issueReset(admin, req).catch((e) => console.error('Reset email failed:', e.message));
  }
  res.json({ ok: true, message: 'If that email belongs to an admin account, a reset link has been sent. It is valid for 1 hour.' });
});

/* ---- Reset password (also used by invited admins to set their first password) ---- */
router.post('/reset', requireXHR, resetLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || token.length < 20) return res.status(400).json({ error: 'This link is invalid or has expired.' });
  if (typeof password !== 'string' || password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters.' });
  const admin = await Admin.findOne({ resetTokenHash: sha(token), resetExpires: { $gt: new Date() } });
  if (!admin) return res.status(400).json({ error: 'This link is invalid or has expired. Request a new one.' });
  admin.passwordHash = await bcrypt.hash(password, 12);
  admin.resetTokenHash = '';
  admin.resetExpires = undefined;
  admin.tokenVersion = (admin.tokenVersion || 0) + 1; // signs out any old sessions
  await admin.save();
  res.json({ ok: true });
});

router.post('/change-password', requireAdmin, requireXHR, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 10) {
    return res.status(400).json({ error: 'New password must be at least 10 characters' });
  }
  const admin = await Admin.findById(req.admin._id);
  if (!(await bcrypt.compare(String(currentPassword || ''), admin.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  admin.passwordHash = await bcrypt.hash(String(newPassword), 12);
  admin.tokenVersion = (admin.tokenVersion || 0) + 1;
  await admin.save();
  res.cookie(COOKIE, sign(admin), cookieOptions()); // keep this session alive, drop the others
  res.json({ ok: true });
});

/* ---- Profile (name + the email that receives reset links) ---- */
router.put('/profile', requireAdmin, requireXHR, async (req, res, next) => {
  try {
    const name = String((req.body || {}).name || '').trim().slice(0, 80);
    const email = String((req.body || {}).email || '').toLowerCase().trim();
    if (!name) return res.status(400).json({ error: 'Please enter your name.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    const admin = await Admin.findById(req.admin._id);
    if (email !== admin.email) {
      if (!(await bcrypt.compare(String((req.body || {}).currentPassword || ''), admin.passwordHash))) {
        return res.status(400).json({ error: 'Enter your current password to change your email address.' });
      }
      admin.email = email;
    }
    admin.name = name;
    await admin.save();
    res.json({ id: String(admin._id), email: admin.email, name: admin.name });
  } catch (e) { next(e); }
});

module.exports = router;
