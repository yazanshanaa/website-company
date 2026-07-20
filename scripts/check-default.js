#!/usr/bin/env node
/**
 * فحص تطابق: كتلة DEFAULT جوّا public/index.html مقابل data/site.json
 *
 * ليش هذا الفحص موجود؟
 * index.html بيرسم فوراً من كائن DEFAULT مثبّت بالكود (عشان LCP)، وبعدين
 * بيجيب /api/data وبيعيد الرسم. يعني نفس المحتوى مكتوب بمكانين.
 * إذا اختلفوا، الزائر بيشوف "وميض" — محتوى قديم بيتبدّل قدام عينه،
 * وأسوأ حالة: بيشوف كلام مش موجود بقاعدة البيانات إطلاقاً.
 *
 * الفحص ما بيصلّح — بيقول لك وين الفرق قبل ما يوصل للإنتاج.
 *
 * الاستخدام:  node scripts/check-default.js
 * بيرجّع exit 1 إذا في فرق — عشان ينفع بـCI.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '../public/index.html');
const JSON_FILE = path.join(__dirname, '../data/site.json');

function extractDefault(html) {
  const start = html.indexOf('const DEFAULT = {');
  if (start === -1) return null;
  // منعدّ الأقواس عشان نلاقي نهاية الكائن بالضبط — مش بـregex
  const from = html.indexOf('{', start);
  let depth = 0, inStr = false, quote = '', esc = false;
  for (let i = from; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = true; quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return html.slice(from, i + 1); }
  }
  return null;
}

// بيقارن الشجرتين وبيرجّع مسارات الاختلاف — مش بس "مختلفين"
function diffPaths(a, b, p = '', out = []) {
  const ta = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a;
  const tb = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;
  if (ta !== tb) { out.push(`${p || '(الجذر)'}: نوع مختلف (${ta} ≠ ${tb})`); return out; }
  if (ta === 'array') {
    if (a.length !== b.length) out.push(`${p}: طول مختلف (DEFAULT=${a.length} ≠ site.json=${b.length})`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diffPaths(a[i], b[i], `${p}[${i}]`, out);
    return out;
  }
  if (ta === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) { out.push(`${p}.${k}: موجود بـsite.json بس مش بـDEFAULT`); continue; }
      if (!(k in b)) { out.push(`${p}.${k}: موجود بـDEFAULT بس مش بـsite.json`); continue; }
      diffPaths(a[k], b[k], `${p}.${k}`, out);
    }
    return out;
  }
  if (a !== b) {
    const s = v => { const t = String(v); return t.length > 42 ? t.slice(0, 42) + '…' : t; };
    out.push(`${p}: قيمة مختلفة\n      DEFAULT   : ${s(a)}\n      site.json : ${s(b)}`);
  }
  return out;
}

const html = fs.readFileSync(HTML, 'utf8');
const src = extractDefault(html);
if (!src) {
  console.error('✗ ما لقيت "const DEFAULT = {" جوّا public/index.html');
  process.exit(1);
}

let def;
try {
  def = (0, eval)('(' + src + ')');   // كتلة نعرفها من ملفنا — مش مدخل خارجي
} catch (e) {
  console.error('✗ ما قدرت أقرا كتلة DEFAULT:', e.message);
  process.exit(1);
}

const local = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const diffs = diffPaths(def, local);

if (!diffs.length) {
  console.log('✓ DEFAULT (index.html) و data/site.json متطابقين تماماً.');
  process.exit(0);
}

console.log(`\n⚠ في ${diffs.length} اختلاف بين DEFAULT و site.json.`);
console.log('  الزائر رح يشوف محتوى DEFAULT أول ما تفتح الصفحة، وبعدين بيتبدّل');
console.log('  لما يوصل /api/data — يعني وميض محتوى قدام عينه.\n');
diffs.slice(0, 25).forEach(d => console.log('  · ' + d));
if (diffs.length > 25) console.log(`  … و${diffs.length - 25} كمان`);
console.log('\n  الحل: صلّح كتلة DEFAULT بـpublic/index.html تطابق data/site.json.');
process.exit(1);
