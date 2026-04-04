const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../lib/db');

// Brute-force protection
const loginAttempts = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of loginAttempts) {
    if (rec.resetAt < now) loginAttempts.delete(ip);
  }
}, 5 * 60 * 1000).unref();

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password required' });
    }

    // Brute-force check
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const rec = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
    if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + 15 * 60 * 1000; }
    if (rec.count >= 5) {
      const wait = Math.ceil((rec.resetAt - Date.now()) / 60000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${wait} min.` });
    }

    // Use ADMIN_PASS_HASH env var directly (no DB query needed for auth)
    const storedHash = process.env.ADMIN_PASS_HASH;
    if (!storedHash) {
      return res.status(500).json({ error: 'Server configuration error: ADMIN_PASS_HASH not set' });
    }

    const match = await bcrypt.compare(password, storedHash);
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
        // Even if session save fails, return success (session will be in-memory)
        return res.json({ ok: true });
      }
      return res.json({ ok: true });
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
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

    const storedHash = process.env.ADMIN_PASS_HASH;
    if (!storedHash) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const match = await bcrypt.compare(currentPassword, storedHash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Generate new hash and update MongoDB settings
    const newHash = await bcrypt.hash(newPassword, 10);
    try {
      const db = await getDb();
      await db.collection('settings').updateOne(
        { _id: 'adminPassword' },
        { $set: { hash: newHash, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (dbErr) {
      console.error('DB update error:', dbErr);
    }

    return res.json({ ok: true, note: 'Update ADMIN_PASS_HASH in Vercel env vars to: ' + newHash });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.requireAuth = requireAuth;
module.exports = router;
