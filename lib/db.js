'use strict';

// ══════════════════════════════════════════════════════════════════
//  طبقة قاعدة البيانات — Neon (PostgreSQL) عبر @neondatabase/serverless
//
//  كان الكود سابقاً على MongoDB، وبثلاث تسميات collections غير متطابقة
//  (site / config / siteData) — فبريد نموذج التواصل مثلاً كان يقرأ من
//  collection ما يكتبه أحد. نُقل كله لـPostgres ووُحّد بجدول key/value
//  واحد بعمود JSONB:
//     key='site'  → كامل محتوى الموقع (نفس شكل data/site.json)
//     key='admin' → { passHash: "..." }  (هاش كلمة مرور اللوحة)
//
//  ليش JSONB وليس جداول علائقية: البيانات وثيقة واحدة كبيرة يحرّرها
//  الأدمن دفعة واحدة (PUT /api/data يستبدل كل شي)، فالنمذجة العلائقية
//  عبء بلا فائدة. JSONB يخزّن الوثيقة كما هي مع فهرسة مفتاح واحد.
//
//  بدون DATABASE_URL يرجع الكود لملف data/site.json (تطوير محلي) —
//  نفس منطق fallback القديم، فالتشغيل المحلي بلا قاعدة بيانات يظل يعمل.
//
//  السائق: @neondatabase/serverless — مصمّم لبيئة Vercel serverless
//  (اتصال عبر WebSocket، بلا استنزاف مجمّع الاتصالات). واجهة Pool
//  متطابقة مع node-postgres، فـconnect-pg-simple (مخزن الجلسات) يستعملها
//  مباشرة، ونفس الاستعلامات تُختبَر محلياً بـpg-mem.
// ══════════════════════════════════════════════════════════════════

// Neon/Vercel يحقن DATABASE_URL؛ POSTGRES_URL بديل تحقنه بعض التكاملات.
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

let _pool         = null;
let _schemaReady  = null; // وعد واحد مشترك — ينشئ الجدول مرة واحدة فقط

function hasDb() {
  return !!DATABASE_URL;
}

// مجمّع اتصالات كسول: لا يُنشأ ولا يُستورد السائق إلا عند وجود عنوان فعلي،
// فالتطوير المحلي بلا DATABASE_URL ما يلمس الشبكة إطلاقاً.
function getPool() {
  if (!DATABASE_URL) return null;
  if (!_pool) {
    const { Pool } = require('@neondatabase/serverless');
    _pool = new Pool({ connectionString: DATABASE_URL });
  }
  return _pool;
}

async function ensureSchema() {
  const pool = getPool();
  if (!pool) return;
  if (!_schemaReady) {
    _schemaReady = pool.query(
      'CREATE TABLE IF NOT EXISTS app_kv (key TEXT PRIMARY KEY, value JSONB NOT NULL)'
    );
  }
  await _schemaReady;
}

// يرجّع القيمة (كائن JS مفكوك من JSONB) أو null إذا المفتاح غير موجود.
async function kvGet(key) {
  const pool = getPool();
  if (!pool) return null;
  await ensureSchema();
  const { rows } = await pool.query('SELECT value FROM app_kv WHERE key = $1', [key]);
  return rows.length ? rows[0].value : null;
}

// upsert ذرّي: يمنع فقدان التحديث عند حفظين متزامنين (last-write-wins واضح).
// نمرّر JSON نصاً ونصبّه ::jsonb — الربط كنص ثم التحويل هو الشكل المضمون
// عبر السائقين، بدل الاعتماد على تسلسل ضمني للكائن.
async function kvSet(key, value) {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL غير مضبوط — لا يمكن الكتابة لقاعدة البيانات');
  await ensureSchema();
  await pool.query(
    `INSERT INTO app_kv (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)]
  );
}

module.exports = { hasDb, getPool, ensureSchema, kvGet, kvSet };
