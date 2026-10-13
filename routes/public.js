const express = require('express');
const rateLimit = require('express-rate-limit');
const M = require('../models');
const { sendContactEmail } = require('../lib/mailer');

const router = express.Router();

const bySort = { order: 1, createdAt: 1 };
const live = { published: true };

// Everything the public page needs, in one request
router.get('/site', async (req, res, next) => {
  try {
    const [setting, events, values, services, pillars, approach, why, team, crew, media] = await Promise.all([
      M.Setting.findOne({ key: 'site' }).lean(),
      M.Event.find(live).sort(bySort).lean(),
      M.Value.find(live).sort(bySort).lean(),
      M.Service.find(live).sort(bySort).lean(),
      M.Pillar.find(live).sort(bySort).lean(),
      M.Approach.find(live).sort(bySort).lean(),
      M.Why.find(live).sort(bySort).lean(),
      M.Team.find(live).sort(bySort).lean(),
      M.Crew.find(live).sort(bySort).lean(),
      M.Media.find(live).sort(bySort).lean(),
    ]);
    res.set('Cache-Control', 'no-cache');
    res.json({ site: (setting && setting.data) || {}, events, values, services, pillars, approach, why, team, crew, media });
  } catch (e) { next(e); }
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/contact', contactLimiter, async (req, res, next) => {
  try {
    const b = req.body || {};
    // Honeypot: real users never fill this hidden field
    if (b.website) return res.json({ ok: true });

    const doc = {
      firstName: String(b.firstName || '').trim(),
      lastName: String(b.lastName || '').trim(),
      email: String(b.email || '').trim(),
      phone: String(b.phone || '').trim(),
      category: String(b.category || '').trim(),
      message: String(b.message || '').trim(),
    };
    if (!doc.firstName || !doc.lastName || !doc.email || !doc.phone || !doc.message) {
      return res.status(400).json({ error: 'Please complete all required fields.' });
    }
    if (!EMAIL_RE.test(doc.email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    const saved = await M.Message.create({ ...doc, ip: req.ip });

    // Forward to the notification inbox (admin setting → MAIL_TO → public contact email).
    // The message is already stored, so a mail problem never loses the enquiry.
    try {
      const setting = await M.Setting.findOne({ key: 'site' }).lean();
      const c = (setting && setting.data && setting.data.contact) || {};
      const to = [c.notifyEmail, process.env.MAIL_TO, c.email].map((x) => String(x || '').trim()).find((x) => EMAIL_RE.test(x));
      const result = await sendContactEmail(doc, to);
      await M.Message.updateOne({ _id: saved._id }, { emailed: !!result.sent, emailError: result.error || '' });
    } catch (e) { console.error('Mail step failed:', e.message); }

    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
