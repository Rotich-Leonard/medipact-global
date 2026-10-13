require('dotenv').config();
const path = require('path');
require('express-async-errors'); // lets async route handlers forward errors to the error handler
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const { JWT_SECRET, MONGODB_URI, PORT = 3000, NODE_ENV } = process.env;
if (!JWT_SECRET || JWT_SECRET.length < 24 || JWT_SECRET.startsWith('change-me')) {
  if (NODE_ENV === 'production') {
    console.error('FATAL: set a strong JWT_SECRET in your environment.');
    process.exit(1);
  }
  console.warn('WARNING: using a weak JWT_SECRET. Set a long random value before deploying.');
}
if (!MONGODB_URI) {
  console.error('FATAL: MONGODB_URI is not set (copy .env.example to .env).');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // correct client IPs / secure cookies behind Nginx, Render, Railway, etc.

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // The design uses the Tailwind Play CDN, which injects styles at runtime.
      scriptSrc: ["'self'", 'https://cdn.tailwindcss.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      mediaSrc: ["'self'", 'https:', 'blob:'],
      frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com', 'https://www.facebook.com', 'https://web.facebook.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// API
app.use('/api', require('./routes/public'));
app.use('/api/admin/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
}));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join(', ') });
  if (err.code === 11000) return res.status(409).json({ error: 'That email address is already in use.' });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
  console.error(err);
  res.status(500).json({ error: NODE_ENV === 'production' ? 'Server error' : err.message });
});

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Website  → http://localhost:${PORT}`);
      console.log(`Admin    → http://localhost:${PORT}/admin/`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
