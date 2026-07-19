#!/usr/bin/env node
/**
 * مزامنة data/site.json إلى MongoDB.
 *
 * ليش هذا السكربت موجود؟
 * routes/data.js بيزرع من site.json مرة وحدة بس — أول طلب. بعدها MongoDB بتصير
 * المرجع، وأي تعديل على site.json بينتجاهل تماماً على الموقع الحيّ.
 * فبدون هذا السكربت، تصحيح البيانات بالملف ما بيظهر للناس.
 *
 * الاستخدام:
 *   node scripts/sync-data.js            # عرض فقط — بيقارن ولا بيغيّر إشي
 *   node scripts/sync-data.js --apply    # بياخد نسخة احتياطية وبعدين بيكتب
 *
 * لازم MONGODB_URI يكون مضبوط (من .env أو من بيئة التشغيل).
 */
'use strict';

const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch (_) { /* dotenv اختياري */ }

const { MongoClient } = require('mongodb');

const DATA_FILE = path.join(__dirname, '../data/site.json');
const DB_NAME = 'itqan';
const COLLECTION = 'site';       // لازم تطابق routes/data.js
const DOC_ID = 'main';           // لازم تطابق routes/data.js

const APPLY = process.argv.includes('--apply');

function summarize(label, d) {
  if (!d) { console.log(`  ${label}: (فاضي — ما في مستند)`); return; }
  const c = d.company || {};
  console.log(`  ${label}:`);
  console.log(`     الاسم        : ${c.nameAr || '—'} / ${c.nameEn || '—'}`);
  console.log(`     واتساب       : ${c.whatsapp || '(فاضي)'}`);
  console.log(`     التوصيات (ع) : ${(d.testimonials?.ar || []).length}`);
  console.log(`     الأعمال (ع)  : ${(d.portfolio?.ar || []).length}`);
  console.log(`     المنتجات (ع) : ${(d.products?.ar || []).length}`);
  console.log(`     المنتجات (En): ${(d.products?.en || []).length}`);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('✗ MONGODB_URI مش مضبوط.');
    console.error('  حطّه في .env أو شغّل: MONGODB_URI="..." node scripts/sync-data.js');
    process.exit(1);
  }

  const local = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const existing = await col.findOne({ _id: DOC_ID });
  const remote = existing ? (({ _id, ...rest }) => rest)(existing) : null;

  console.log('\n── الوضع الحالي ──────────────────────────────');
  summarize('على MongoDB (اللي بيشوفه الناس هلق)', remote);
  console.log('');
  summarize('في site.json (المصحّح)', local);

  const remoteStr = JSON.stringify(remote);
  if (remoteStr === JSON.stringify(local)) {
    console.log('\n✓ متطابقين — ما في إشي لازم ينزامن.');
    await client.close();
    return;
  }

  if (!APPLY) {
    console.log('\n⚠ MongoDB مختلفة عن site.json.');
    if (remoteStr && (remoteStr.includes('هايتك') || remoteStr.includes('HiTech'))) {
      console.log('  ✗ الموقع الحيّ لسا بيعرض "هايتك" — لازم مزامنة.');
    }
    console.log('\n  للتنفيذ:  node scripts/sync-data.js --apply');
    console.log('  (بياخد نسخة احتياطية أول شي)');
    await client.close();
    return;
  }

  // نسخة احتياطية قبل أي كتابة — ما منمسح إشي بدون رجعة
  if (remote) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = path.join(__dirname, `../data/backup-${stamp}.json`);
    fs.writeFileSync(backup, JSON.stringify(remote, null, 2), 'utf8');
    console.log(`\n✓ نسخة احتياطية: data/backup-${stamp}.json`);
  }

  await col.replaceOne({ _id: DOC_ID }, { _id: DOC_ID, ...local }, { upsert: true });
  console.log('✓ MongoDB اتزامنت من site.json');

  const check = await col.findOne({ _id: DOC_ID });
  const checkStr = JSON.stringify(check);
  console.log(`✓ تأكيد — "هايتك" موجودة بعد المزامنة: ${checkStr.includes('هايتك')}`);
  console.log(`✓ تأكيد — الاسم صار: ${check.company.nameAr} / ${check.company.nameEn}`);

  await client.close();
}

main().catch(err => {
  console.error('✗ فشلت المزامنة:', err.message);
  process.exit(1);
});
