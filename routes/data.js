'use strict';
const express                = require('express');
const { requireAuth }        = require('./auth');
const { getData, saveData }  = require('../lib/storage');

const router = express.Router();

// GET /api/data — public (strips company.email); admin gets full record
router.get('/', async (req, res) => {
  try {
    const raw = await getData();
    // Strip email from public response to prevent scraping.
    // Skip when request comes from an authenticated admin so saveAll()
    // never overwrites email with an empty string.
    if (!req.session?.admin && raw.company) {
      const { email: _stripped, ...safeCompany } = raw.company;
      raw.company = safeCompany;
    }
    res.json(raw);
  } catch {
    res.status(500).json({ error: 'Could not read site data' });
  }
});

// PUT /api/data — requires admin session
router.put('/', requireAuth, async (req, res) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid data: expected object' });
  }

  const required = ['company', 'content', 'services', 'stats', 'portfolio'];
  for (const key of required) {
    if (!body[key] || typeof body[key] !== 'object') {
      return res.status(400).json({ error: `Invalid data: missing or invalid key "${key}"` });
    }
  }

  const arrays = ['services', 'stats', 'portfolio', 'process', 'aboutPoints'];
  for (const key of arrays) {
    if (body[key]) {
      for (const lang of ['ar', 'en']) {
        if (body[key][lang] !== undefined && !Array.isArray(body[key][lang])) {
          return res.status(400).json({ error: `Invalid data: ${key}.${lang} must be an array` });
        }
      }
    }
  }

  const json = JSON.stringify(body);
  if (json.length > 500000) {
    return res.status(400).json({ error: 'Data too large' });
  }

  try {
    await saveData(body);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Could not save site data' });
  }
});

module.exports = router;
