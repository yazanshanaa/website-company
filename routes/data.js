'use strict';
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { requireAuth } = require('./auth');
const { hasDb, kvGet, kvSet } = require('../lib/db');

const router    = express.Router();
const DATA_FILE = path.join(__dirname, '../data/site.json');

// âââ MongoDB (optional) âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// عند ضبط DATABASE_URL (Neon على Vercel — نظام الملفات للقراءة فقط) يُخزَّن
// محتوى الموقع صفاً واحداً بجدول app_kv (المفتاح 'site') عبر lib/db.
// محلياً بلا قاعدة بيانات يرجع لملف data/site.json.

async function readSiteData() {
  if (hasDb()) {
    let data = await kvGet('site');
    if (!data) {
      // أول تشغيل: ازرع الصف من الملف المرفق
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      await kvSet('site', data);
    }
    return data;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

async function writeSiteData(data) {
  if (hasDb()) { await kvSet('site', data); return; }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// âââ Validation helpers âââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const REQUIRED_KEYS = ['company', 'content', 'services', 'stats', 'portfolio'];
const ARRAY_KEYS    = ['services', 'stats', 'portfolio', 'process', 'aboutPoints'];

function validateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Invalid data: expected object';
  }
  for (const key of REQUIRED_KEYS) {
    if (!body[key] || typeof body[key] !== 'object') {
      return `Invalid data: missing or invalid key "${key}"`;
    }
  }
  for (const key of ARRAY_KEYS) {
    if (!body[key]) continue;
    for (const lang of ['ar', 'en']) {
      if (body[key][lang] !== undefined && !Array.isArray(body[key][lang])) {
        return `Invalid data: ${key}.${lang} must be an array`;
      }
    }
  }
  return null; // valid
}

// âââ Routes âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

/**
 * GET /api/data
 * Public: returns site data with company.email stripped.
 * Authenticated admin: returns the full record (so the admin panel can display the email).
 */
router.get('/', async (req, res) => {
  try {
    const data = await readSiteData();
    if (!req.session?.admin && data.company) {
      const { email: _stripped, ...safeCompany } = data.company;
      data.company = safeCompany;
    }
    res.json(data);
  } catch (err) {
    console.error('GET /api/data error:', err);
    res.status(500).json({ error: 'Could not read site data' });
  }
});

/**
 * PUT /api/data
 * Admin only. Replaces the entire site data document.
 */
router.put('/', requireAuth, async (req, res) => {
  const validationError = validateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const json = JSON.stringify(req.body);
  if (json.length > 500_000) {
    return res.status(400).json({ error: 'Data too large' });
  }

  try {
    await writeSiteData(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/data error:', err);
    res.status(500).json({ error: 'Could not save site data' });
  }
});

module.exports = router;
