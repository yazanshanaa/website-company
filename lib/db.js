const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'itqan';

let cachedClient = null;
let cachedDb = null;
// وعد واحد مشترك يمنع فتح أكثر من اتصال واحد عند التشغيل المتوازي
let connectionPromise = null;

async function getDb() {
  if (cachedDb) return cachedDb;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  if (!connectionPromise) {
    connectionPromise = (async () => {
      const client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 7000,
        maxPoolSize: 10,
        minPoolSize: 0,
      });
      await client.connect();
      cachedClient = client;
      cachedDb = client.db(DB_NAME);
    })();
  }

  await connectionPromise;
  return cachedDb;
}

// يُعيد وعداً بالـ MongoClient لإعادة استخدامه في connect-mongo
async function getClient() {
  await getDb();
  return cachedClient;
}

module.exports = { getDb, getClient };
