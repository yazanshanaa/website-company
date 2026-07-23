'use strict';
const express     = require('express');
const bcrypt      = require('bcryptjs');
const fs          = require('fs');
const path        = require('path');
const getClientIp = require('../lib/getClientIp');
const { hasDb, kvGet, kvSet } = require('../lib/db');

const router    = express.Router();
const PASS_FILE = path.join(__dirname, '../data/password.txt');

// âââ MongoDB (optional) âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// الأولوية: ADMIN_PASS_HASH من البيئة، ثم قاعدة البيانات (Neon، الصف 'admin')،
// ثم ملف محلي. على Vercel نظام الملفات للقراءة فقط، فالبيئة/القاعدة هي المصدر.

async function readPassHash() {
  // الأولوية 1: متغيّر البيئة (مطلوب على Vercel، ويبقى مصدر الحقيقة إذا ضُبط)
  if (process.env.ADMIN_PASS_HASH) return process.env.ADMIN_PASS_HASH;
  // الأولوية 2: قاعدة البيانات (Neon) — الصف 'admin' في app_kv
  if (hasDb()) {
    const doc = await kvGet('admin');
    if (doc?.passHash) return doc.passHash;
  }
  // الأولوية 3: ملف محلي (تطوير)
  return fs.readFileSync(PASS_FILE, 'utf8').trim();
}

async function writePassHash(hash) {
  if (hasDb()) { await kvSet('admin', { passHash: hash }); return; }
  fs.writeFileSync(PASS_FILE, hash);
}

// âââ IP-based brute-force lockout âââââââââââââââââââââââââââââââââââââââââââââ

const lockouts    = new Map(); // ip â { attempts, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000; // 15 minutes

// Prune expired entries every 10 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, r] of lockouts) {
    if (r.lockedUntil <= now) lockouts.delete(ip);
  }
}, 10 * 60 * 1000).unref();

function getRecord(ip) {
  if (!lockouts.has(ip)) lockouts.set(ip, { attempts: 0, lockedUntil: 0 });
  return lockouts.get(ip);
}

function isLocked(ip) {
  const r = getRecord(ip);
  if (r.lockedUntil > Date.now()) return true;
  if (r.lockedUntil && r.lockedUntil <= Date.now()) lockouts.delete(ip);
  return false;
}

// âââ Middleware âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function requireAuth(req, res, next) {
  if (req.session?.admin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// âââ Routes âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

/** GET /api/auth/me â returns whether the current session is admin */
router.get('/me', (req, res) => {
  res.json({ admin: req.session?.admin === true });
});

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  const ip = getClientIp(req);

  if (isLocked(ip)) {
    const r = getRecord(ip);
    const remaining = Math.ceil((r.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({ error: 'locked', remaining });
  }

  const { password } = req.body;
  // حارس النوع: قيمة truthy غير نصية ({}، []، رقم) كانت تعدّي `!password`
  // ثم تُرفض داخل bcrypt.compare كـunhandled rejection فتُسقط العملية —
  // إزعاج خدمة عن بُعد بلا مصادقة. التحقق من string يقفل هذا المسار.
  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Password required' });
  }

  let hash;
  try {
    hash = await readPassHash();
  } catch {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    const r = getRecord(ip);
    r.attempts += 1;
    if (r.attempts >= MAX_ATTEMPTS) {
      r.lockedUntil = Date.now() + LOCKOUT_MS;
      return res.status(429).json({ error: 'locked', remaining: 15 });
    }
    return res.status(401).json({ error: 'wrong' });
  }

  // Regenerate session to prevent session-fixation attacks
  lockouts.delete(ip);
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.admin = true;
    res.json({ ok: true });
  });
});

/** POST /api/auth/logout */
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

/**
 * POST /api/auth/change-password
 * Body: { oldPassword, newPassword }
 *
 * On Vercel + MongoDB: the new hash is saved to the database.
 * On Vercel without MongoDB: only ADMIN_PASS_HASH env var is used for login;
 * change-password will succeed but won't persist â update the env var manually.
 */
router.post('/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  // نفس حارس النوع كـ/login: قيمة غير نصية تُرفض داخل bcrypt.compare أدناه.
  if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || !oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Both fields required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password too short (min 8 characters)' });
  }

  let hash;
  try {
    hash = await readPassHash();
  } catch {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const ok = await bcrypt.compare(oldPassword, hash);
  if (!ok) return res.status(401).json({ error: 'Old password is incorrect' });

  const newHash = await bcrypt.hash(newPassword, 10);
  await writePassHash(newHash);
  res.json({ ok: true });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
