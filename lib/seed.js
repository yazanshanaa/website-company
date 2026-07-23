'use strict';

// ══════════════════════════════════════════════════════════════════
//  زرع أولي اختياري لقاعدة بيانات Neon.
//
//  ملاحظة: routes/data.js يزرع محتوى الموقع تلقائياً أول قراءة، وكلمة مرور
//  اللوحة مصدرها ADMIN_PASS_HASH من البيئة — فهذا الملف ليس ضرورياً للتشغيل،
//  وهو أداة يدوية للتهيئة المسبقة فقط. أُعيدت كتابته للنموذج الجديد (app_kv)
//  بعد أن كان يشير لـcollections MongoDB بأسماء غير متطابقة (siteData/settings).
// ══════════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');
const { hasDb, kvGet, kvSet } = require('./db');

async function seedDatabase() {
  if (!hasDb()) {
    console.log('DATABASE_URL غير مضبوط — لا زرع (التطوير المحلي يقرأ من data/site.json).');
    return;
  }

  // محتوى الموقع — لا تُكتب إلا إذا كان الصف غير موجود (لا تدُس تعديلات الأدمن).
  const existingSite = await kvGet('site');
  if (!existingSite) {
    const siteData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/site.json'), 'utf8'));
    await kvSet('site', siteData);
    console.log('✓ زُرع محتوى الموقع (المفتاح site).');
  }

  // هاش كلمة المرور — فقط إذا لم يكن موجوداً وتوفّر ADMIN_PASS_HASH.
  const existingAdmin = await kvGet('admin');
  if (!existingAdmin && process.env.ADMIN_PASS_HASH) {
    await kvSet('admin', { passHash: process.env.ADMIN_PASS_HASH });
    console.log('✓ زُرع هاش كلمة المرور (المفتاح admin).');
  }

  console.log('اكتمل الزرع.');
}

module.exports = { seedDatabase };
