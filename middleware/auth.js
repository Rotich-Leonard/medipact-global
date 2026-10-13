const jwt = require('jsonwebtoken');
const { Admin } = require('../models');

const COOKIE = 'mig_admin';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8,
    path: '/',
  };
}

function sign(admin) {
  return jwt.sign({ sub: String(admin._id), v: admin.tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies && req.cookies[COOKIE];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(payload.sub).select('-passwordHash');
    if (!admin || (payload.v || 0) !== (admin.tokenVersion || 0)) return res.status(401).json({ error: 'Session expired, please sign in again' });
    req.admin = admin;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

// CSRF defence in depth: cookies are SameSite=strict, and we additionally require
// a custom header on every state-changing admin request (browsers will not add it cross-site).
function requireXHR(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'fetch') return res.status(403).json({ error: 'Forbidden' });
  next();
}

module.exports = { COOKIE, cookieOptions, sign, requireAdmin, requireXHR };
