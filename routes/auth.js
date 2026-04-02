const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../lib/db');

// Brute-force protection: max 5 attempts per IP per 15 minutes
const loginAttempts = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts) {
    if (rec.resetAt < now) loginAttempts.delete(ip);
  }
}, 5 * 60 * 1000).unref();

function checkBruteForce(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + 15 * 60 * 1000; }
  return rec;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const rec = checkBruteForce(ip);
    if (rec.count >= 5) {
      const wait = Math.ceil((rec.resetAt - Date.now()) / 60000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${wait} min.` });
    }

    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password required' });
    }

    const db = await getDb();
    const settings = await db.collection('settings').findOne({ key: 'admin' });
    if (!settings || !settings.passwordHash) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const match = await bcrypt.compare(password, settings.passwordHash);
    if (!match) {
      rec.count++;
      loginAttempts.set(ip, rec);
      return res.status(401).json({ error: 'Invalid password' });
    }

    loginAttempts.delete(ip);
    req.session.admin = true;
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session error' });
      }
      return res.json({ ok: true });
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    return res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  return res.json({ admin: !!(req.session && req.session.admin) });
});

// PUT /api/auth/change-password
router.put('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both passwords required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const db = await getDb();
    const settings = await db.collection('settings').findOne({ key: 'admin' });
    if (!settings || !settings.passwordHash) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const match = await bcrypt.compare(currentPassword, settings.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.collection('settings').updateOne(
      { key: 'admin' },
      { $set: { passwordHash: newHash, updatedAt: new Date() } }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.requireAuth = requireAuth;
module.exports = router;
