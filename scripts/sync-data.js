#!/usr/bin/env node
/**
 * مزامنة data/site.json إلى قاعدة البيانات (Neon Postgres).
 *
 * ليش هذا السكربت موجود؟
 * routes/data.js بيزرع من site.json مرة وحدة بس — أول طلب. بعدها قاعدة البيانات
 * بتصير المرجع، وأي تعديل على site.json بينتجاهل تماماً على الموقع الحيّ.
 * فبدون هذا السكربت، تصحيح البيانات بالملف ما بيظهر للناس.
 *
 * الاستخدام:
 *   node scripts/sync-data.js            # عرض فقط — بيقارن ولا بيغيّر إشي
 *   node scripts/sync-data.js --apply    # بياخد نسخة احتياطية وبعدين بيكتب
 *
 * لازم DATABASE_URL يكون مضبوط (من .env أو من بيئة التشغيل).
 */
'use strict';

const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch (_) { /* dotenv اختياري */ }

const { hasDb, kvGet, kvSet } = require('../lib/db');

const DATA_FILE = path.join(__dirname, '../data/site.json');
const KEY = 'site'; // لازم يطابق routes/data.js

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
  if (!hasDb()) {
    console.error('✗ DATABASE_URL مش مضبوط.');
    console.error('  حطّه في .env أو شغّل: DATABASE_URL="..." node scripts/sync-data.js');
    process.exit(1);
  }

  const local = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const remote = await kvGet(KEY); // كائن أو null

  console.log('\n── الوضع الحالي ──────────────────────────────');
  summarize('على قاعدة البيانات (اللي بيشوفه الناس هلق)', remote);
  console.log('');
  summarize('في site.json (المصحّح)', local);

  const remoteStr = JSON.stringify(remote);
  if (remoteStr === JSON.stringify(local)) {
    console.log('\n✓ متطابقين — ما في إشي لازم ينزامن.');
    return;
  }

  if (!APPLY) {
    console.log('\n⚠ قاعدة البيانات مختلفة عن site.json.');
    console.log('\n  للتنفيذ:  node scripts/sync-data.js --apply');
    console.log('  (بياخد نسخة احتياطية أول شي)');
    return;
  }

  // نسخة احتياطية قبل أي كتابة — ما منمسح إشي بدون رجعة
  if (remote) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = path.join(__dirname, `../data/backup-${stamp}.json`);
    fs.writeFileSync(backup, JSON.stringify(remote, null, 2), 'utf8');
    console.log(`\n✓ نسخة احتياطية: data/backup-${stamp}.json`);
  }

  await kvSet(KEY, local);
  console.log('✓ قاعدة البيانات اتزامنت من site.json');

  const check = await kvGet(KEY);
  console.log(`✓ تأكيد — الاسم صار: ${check.company.nameAr} / ${check.company.nameEn}`);
}

main().catch(err => {
  console.error('✗ فشلت المزامنة:', err.message);
  process.exit(1);
}).then(() => process.exit(0));
