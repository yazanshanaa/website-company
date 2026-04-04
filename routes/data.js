const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('./auth');
const { getDb } = require('../lib/db');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '../data/site.json');

router.get('/', async (req, res) => {
  let raw = null;

  // Try MongoDB first (with timeout already set in db.js)
  try {
    const db = await getDb();
    const siteDataCollection = db.collection('siteData');
    const siteDataDoc = await siteDataCollection.findOne({ _id: 'site' });
    raw = siteDataDoc?.data || null;
  } catch (mongoErr) {
    console.error('MongoDB read failed, falling back to file:', mongoErr.message);
  }

  // Fall back to static file if MongoDB failed or has no data
  if (!raw) {
    try {
      raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (fileErr) {
      console.error('File read failed:', fileErr.message);
      return res.status(500).json({ error: 'Could not read site data' });
    }
  }

  if (!req.session?.admin && raw.company) {
    const { email: _stripped, ...safeCompany } = raw.company;
    raw.company = safeCompany;
  }
  res.json(raw);
});

router.put('/', requireAuth, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid data: expected object' });
  }
  const required = ['company', 'content', 'services', 'stats', 'portfolio', 'process', 'aboutPoints', 'testimonials'];
  for (const key of required) {
    if (!body[key] || typeof body[key] !== 'object') {
      return res.status(400).json({ error: `Invalid data: missing or invalid key "${key}"` });
    }
  }
  const arrays = ['services', 'stats', 'portfolio', 'process', 'aboutPoints', 'testimonials'];
  for (const key of arrays) {
    if (body[key]) {
      for (const lang of ['ar', 'en']) {
        if (body[key][lang] !== undefined && !Array.isArray(body[key][lang])) {
          return res.status(400).json({ error: `Invalid data: ${key}.${lang} must be an array` });
        }
      }
    }
  }

  try {
    const json = JSON.stringify(body, null, 2);
    if (json.length > 500000) {
      return res.status(400).json({ error: 'Data too large' });
    }

    const db = await getDb();
    const siteDataCollection = db.collection('siteData');
    await siteDataCollection.updateOne(
      { _id: 'site' },
      {
        $set: {
          data: body,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Error saving site data:', error);
    res.status(500).json({ error: 'Could not save site data' });
  }
});

module.exports = router;
