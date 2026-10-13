const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const M = require('../models');
const { requireAdmin, requireXHR } = require('../middleware/auth');
const { issueReset } = require('../lib/reset');
const mailer = require('../lib/mailer');

const router = express.Router();
router.use(requireAdmin, requireXHR);

/* ------------------------------------------------------------------ *
 * Generic CRUD for every content collection
 * ------------------------------------------------------------------ */
const collections = {
  events: M.Event,
  values: M.Value,
  services: M.Service,
  pillars: M.Pillar,
  approach: M.Approach,
  why: M.Why,
  team: M.Team,
  crew: M.Crew,
  media: M.Media,
};

// Only allow fields declared in each schema (blocks mass-assignment of _id, createdAt, etc.)
function pick(Model, body) {
  const out = {};
  Object.keys(Model.schema.paths).forEach((k) => {
    if (['_id', '__v', 'createdAt', 'updatedAt'].includes(k)) return;
    if (body[k] !== undefined) out[k] = body[k];
  });
  return out;
}

Object.entries(collections).forEach(([name, Model]) => {
  router.get(`/${name}`, async (req, res, next) => {
    try { res.json(await Model.find().sort({ order: 1, createdAt: 1 }).lean()); } catch (e) { next(e); }
  });

  router.post(`/${name}`, async (req, res, next) => {
    try {
      const data = pick(Model, req.body);
      if (data.order === undefined || data.order === '') {
        const last = await Model.findOne().sort({ order: -1 }).select('order').lean();
        data.order = last ? (last.order || 0) + 1 : 1;
      }
      res.status(201).json(await Model.create(data));
    } catch (e) { next(e); }
  });

  router.put(`/${name}/:id`, async (req, res, next) => {
    try {
      const doc = await Model.findByIdAndUpdate(req.params.id, pick(Model, req.body), {
        new: true, runValidators: true,
      });
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json(doc);
    } catch (e) { next(e); }
  });

  router.delete(`/${name}/:id`, async (req, res, next) => {
    try {
      const doc = await Model.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
});

/* ------------------------------------------------------------------ *
 * Site settings (one document, edited section by section)
 * ------------------------------------------------------------------ */
router.get('/settings', async (req, res, next) => {
  try {
    const s = await M.Setting.findOne({ key: 'site' }).lean();
    res.json((s && s.data) || {});
  } catch (e) { next(e); }
});

router.put('/settings', async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Invalid settings payload' });
    }
    const s = await M.Setting.findOneAndUpdate(
      { key: 'site' },
      { $set: { data: req.body } },
      { new: true, upsert: true }
    );
    res.json(s.data);
  } catch (e) { next(e); }
});

/* ------------------------------------------------------------------ *
 * Contact-form inbox
 * ------------------------------------------------------------------ */
router.get('/messages', async (req, res, next) => {
  try { res.json(await M.Message.find().sort({ createdAt: -1 }).limit(500).lean()); } catch (e) { next(e); }
});
router.patch('/messages/:id', async (req, res, next) => {
  try {
    const doc = await M.Message.findByIdAndUpdate(req.params.id, { read: !!req.body.read }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (e) { next(e); }
});
router.delete('/messages/:id', async (req, res, next) => {
  try { await M.Message.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

/* ------------------------------------------------------------------ *
 * Dashboard counters
 * ------------------------------------------------------------------ */
router.get('/stats', async (req, res, next) => {
  try {
    const entries = await Promise.all(Object.entries(collections).map(async ([k, Model]) => [k, await Model.countDocuments()]));
    const stats = Object.fromEntries(entries);
    stats.messages = await M.Message.countDocuments();
    stats.unread = await M.Message.countDocuments({ read: false });
    res.json(stats);
  } catch (e) { next(e); }
});

/* ------------------------------------------------------------------ *
 * Admin users  (create, invite by email, send reset link, delete)
 * ------------------------------------------------------------------ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/admins', async (req, res, next) => {
  try {
    const rows = await M.Admin.find().sort({ createdAt: 1 }).select('-passwordHash -resetTokenHash').lean();
    res.json(rows.map((a) => ({
      _id: a._id, name: a.name, email: a.email, lastLoginAt: a.lastLoginAt, createdAt: a.createdAt,
      pendingInvite: !!(a.resetExpires && a.resetExpires > new Date() && !a.lastLoginAt),
      isYou: String(a._id) === String(req.admin._id),
    })));
  } catch (e) { next(e); }
});

router.post('/admins', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    if (!name) return res.status(400).json({ error: 'Please enter a name.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password && password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters (or leave it blank to email an invitation).' });

    const invite = !password;
    const admin = await M.Admin.create({
      name, email,
      passwordHash: await bcrypt.hash(password || require('crypto').randomBytes(24).toString('hex'), 12),
    });
    let mail = null;
    if (invite) mail = await issueReset(admin, req, { invite: true });
    res.status(201).json({
      _id: admin._id, name: admin.name, email: admin.email, invited: invite,
      emailSent: mail ? !!mail.sent : null, emailError: mail && !mail.sent ? mail.error : undefined,
    });
  } catch (e) { next(e); }
});

router.post('/admins/:id/send-reset', async (req, res, next) => {
  try {
    const admin = await M.Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Not found' });
    const r = await issueReset(admin, req);
    if (!r.sent) return res.status(502).json({ error: 'Could not send the email: ' + r.error });
    res.json({ ok: true, to: admin.email });
  } catch (e) { next(e); }
});

router.delete('/admins/:id', async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.admin._id)) return res.status(400).json({ error: 'You cannot delete your own account.' });
    if ((await M.Admin.countDocuments()) <= 1) return res.status(400).json({ error: 'At least one admin must remain.' });
    const doc = await M.Admin.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ------------------------------------------------------------------ *
 * SMTP settings  (password stored AES-encrypted, never returned to the browser)
 * ------------------------------------------------------------------ */
router.get('/smtp', async (req, res, next) => {
  try {
    const s = await M.Setting.findOne({ key: 'smtp' }).lean();
    const d = (s && s.data) || {};
    const fromEnv = !d.host && !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    res.json({
      host: d.host || '', port: d.port || 587, secure: !!d.secure, user: d.user || '', from: d.from || '',
      hasPassword: !!d.passEnc, usingEnv: fromEnv,
    });
  } catch (e) { next(e); }
});

router.put('/smtp', async (req, res, next) => {
  try {
    const b = req.body || {};
    const old = await M.Setting.findOne({ key: 'smtp' }).lean();
    const prev = (old && old.data) || {};
    const host = String(b.host || '').trim();
    const port = Number(b.port) || 587;
    const user = String(b.user || '').trim();
    const pass = String(b.password || '');
    if (host && (!/^[A-Za-z0-9.-]+$/.test(host) || port < 1 || port > 65535)) return res.status(400).json({ error: 'Enter a valid SMTP host and port.' });
    if (host && !user) return res.status(400).json({ error: 'Enter the SMTP username.' });
    const data = { host, port, secure: !!b.secure, user, from: String(b.from || '').trim().slice(0, 200) };
    if (pass) data.passEnc = mailer.encrypt(pass);
    else if (prev.passEnc) data.passEnc = prev.passEnc;      // blank = keep the saved password
    if (host && !data.passEnc) return res.status(400).json({ error: 'Enter the SMTP password.' });
    await M.Setting.findOneAndUpdate({ key: 'smtp' }, { $set: { data } }, { upsert: true });
    mailer.resetCache();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/smtp/test', async (req, res, next) => {
  try {
    const to = String((req.body || {}).to || req.admin.email).trim();
    if (!EMAIL_RE.test(to)) return res.status(400).json({ error: 'Enter a valid email address to send the test to.' });
    mailer.resetCache();
    const r = await mailer.sendMail({
      to, subject: 'MedImpact Global – SMTP test',
      text: 'Success! Your SMTP settings work. Contact-form messages and admin password-reset emails will now be delivered.',
      html: '<div style="font-family:Arial,sans-serif"><h2 style="color:#bb0112">SMTP test successful ✔</h2><p>Your SMTP settings work. Contact-form messages and admin password-reset emails will now be delivered.</p></div>',
    });
    if (!r.sent) return res.status(502).json({ error: r.error });
    res.json({ ok: true, to });
  } catch (e) { next(e); }
});

/* ------------------------------------------------------------------ *
 * Image uploads  (stored in /uploads and served at /uploads/<file>)
 * ------------------------------------------------------------------ */
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // Never trust the client's file name; derive the extension from the validated MIME type
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (EXT[file.mimetype]) return cb(null, true);
    cb(new Error('Only JPG, PNG, WEBP, GIF or AVIF images are allowed'));
  },
});

router.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

/* Video clips (events). Served with HTTP range support so they can be scrubbed/streamed. */
const VIDEO_EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/ogg': '.ogv' };
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB) || 150;
const uploadVideo = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${VIDEO_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_VIDEO_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (VIDEO_EXT[file.mimetype] ? cb(null, true) : cb(new Error('Only MP4, WEBM, MOV or OGG video files are allowed'))),
});

router.post('/upload-video', (req, res) => {
  uploadVideo.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `Video is too large (max ${MAX_VIDEO_MB} MB). Compress it, or paste a YouTube/Vimeo link instead.` : err.message;
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

module.exports = router;
