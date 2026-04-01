'use strict';
const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/site.json');

// ── MongoDB connection cache ──────────────────────────────────────────────────
// Module-level variables persist across warm Vercel invocations (same container).
// A new MongoClient is only created on a cold start.
let cachedClient = null;
let cachedDb     = null;

async function connectMongo() {
  if (cachedClient && cachedDb) return cachedDb;

  const { MongoClient, ServerApiVersion } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
      version:           ServerApiVersion.v1,
      strict:            true,
      deprecationErrors: true,
    },
    maxPoolSize:              1,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS:         5000,
  });

  await client.connect();
  cachedClient = client;
  cachedDb     = client.db('itqan');
  return cachedDb;
}

// Seed MongoDB on first run from data/site.json if the collection is empty
async function seedIfEmpty(col) {
  const existing = await col.findOne({ _id: 'site' });
  if (existing) return;

  const seed = fs.existsSync(DATA_FILE)
    ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    : { company: {}, content: {}, services: {}, stats: {}, portfolio: {} };

  seed._id = 'site';
  try {
    await col.insertOne(seed);
    console.log('[storage] MongoDB seeded from data/site.json');
  } catch (e) {
    // Ignore duplicate key — two concurrent cold starts both tried to seed
    if (e.code !== 11000) throw e;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function getData() {
  if (process.env.MONGODB_URI) {
    const db  = await connectMongo();
    const col = db.collection('sitedata');
    await seedIfEmpty(col);
    const doc = await col.findOne({ _id: 'site' });
    if (!doc) throw new Error('Site document not found in MongoDB');
    const { _id, ...data } = doc;
    return data;
  }
  // Local development fallback
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

async function saveData(data) {
  if (process.env.MONGODB_URI) {
    const db  = await connectMongo();
    const col = db.collection('sitedata');
    await col.replaceOne(
      { _id: 'site' },
      { _id: 'site', ...data },
      { upsert: true }
    );
    return;
  }
  // Local development fallback
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = { getData, saveData };
