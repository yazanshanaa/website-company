require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const getClientIp = require('./lib/getClientIp');
const { getClient } = require('./lib/db');

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('FATAL: SESSION_SECRET is missing or too short (min 32 chars).');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('FATAL: MONGODB_URI is missing.');
  process.exit(1);
}

const app = express();

// Always trust proxy (needed on Vercel)
app.set('trust proxy', 1);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self'",
      "frame-ancestors 'self'"
    ].join('; ')
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (req.path.includes('itqan-cp9x')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

// حفظ الجلسات في MongoDB حتى تبقى محفوظة عبر استدعاءات Vercel المختلفة
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    clientPromise: getClient(),
    dbName: 'itqan',
    collectionName: 'sessions',
    ttl: 2 * 60 * 60,        // انتهاء الجلسة بعد ساعتين (بالثواني)
    autoRemove: 'native',    // حذف الجلسات المنتهية تلقائياً عبر MongoDB TTL index
    touchAfter: 24 * 3600   // تحديث الجلسة مرة واحدة كل 24 ساعة فقط لتقليل الكتابات
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60 * 1000
  }
}));

// CSRF protection: reject cross-origin state-changing requests
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const originHeader = req.headers.origin || req.headers.referer || '';
    if (originHeader) {
      try {
        const originHost = new URL(originHeader).host;
        if (originHost !== req.headers.host) return res.status(403).json({ error: 'Forbidden' });
      } catch {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
  }
  next();
});

// Rate limit contact form
const contactRateMap = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of contactRateMap) {
    if (record.resetAt < now) contactRateMap.delete(ip);
  }
}, 5 * 60 * 1000).unref();

app.use('/api/contact', (req, res, next) => {
  if (req.method !== 'POST') return next();
  const ip = getClientIp(req);
  const now = Date.now();
  const record = contactRateMap.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + 60000;
  }
  record.count++;
  contactRateMap.set(ip, record);
  if (record.count > 5) return res.status(429).json({ error: 'Too many requests.' });
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/data', require('./routes/data'));
app.use('/api/contact', require('./routes/contact'));

app.use(express.static(path.join(__dirname, 'public')));

// Seed DB on startup (non-blocking)
const { seedDatabase } = require('./lib/seed');
seedDatabase().catch(err => console.error('Seed error:', err));

// Global JSON error handler (must be last, after all routes)
app.use((err, req, res, next) => {
  console.error('[GlobalError]', err.message, err.stack);
  if (res.headersSent) return next(err);
  res.status(err.status || err.statusCode || 500).json({ error: err.message || 'Internal server error' });
});

// Only listen when run directly (not on Vercel serverless)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('Itqan server running on http://localhost:' + PORT));
}

module.exports = app;
