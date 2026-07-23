const express    = require('express');
const nodemailer = require('nodemailer');
const { hasDb, kvGet } = require('../lib/db');

const router = express.Router();

function sanitizeHeader(s) {
  return String(s || '').replace(/[\r\n\t]/g, ' ').slice(0, 100);
}

// POST /api/contact
router.post('/', async (req, res) => {
  const { name, email, message, service } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'name, email, and message are required' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // بريد المستلم من قاعدة البيانات (الصف 'site' في app_kv) مع التحقق من الصيغة.
  // سابقاً كان يقرأ collection 'siteData' التي لا يكتبها أحد فيسقط دائماً على
  // SMTP_FROM — وُحّد الآن مع مصدر محتوى الموقع الفعلي.
  let recipient = process.env.SMTP_FROM;
  try {
    if (hasDb()) {
      const site = await kvGet('site');
      const dbEmail = site?.company?.email;
      if (dbEmail && /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(dbEmail)) {
        recipient = dbEmail;
      }
    }
  } catch { /* fallback to SMTP_FROM */ }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[contact] SMTP not configured. Message received (details omitted).');
    return res.json({ ok: true, note: 'smtp_not_configured' });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    await transporter.sendMail({
      from: { name: sanitizeHeader(name), address: process.env.SMTP_FROM || process.env.SMTP_USER },
      replyTo: { name: sanitizeHeader(name), address: sanitizeHeader(email) },
      to: recipient,
      subject: `رسالة جديدة من ${sanitizeHeader(name)} — موقع إتقان`,
      text: `الاسم: ${sanitizeHeader(name)}\nالبريد: ${sanitizeHeader(email)}\nالخدمة: ${sanitizeHeader(service || '—')}\n\n${sanitizeHeader(String(message).slice(0, 5000))}`
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[contact] Mail error:', err.message);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

module.exports = router;
