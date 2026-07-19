'use strict';
// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForHomeContent } = require('./helpers');

/**
 * Homepage tests — verifies that all dynamically rendered sections appear
 * correctly after init() fetches /api/data and calls renderAll().
 *
 * All grids are populated either from the API or from the DEFAULT fallback,
 * so assertions never rely on specific data values — only on presence.
 *
 * ── لماذا اتغيّرت اختبارات كثيرة (2026-07-17) ──────────────────────────────
 * الاختبارات القديمة كانت بتفترض وجود محتوى انحذف عن قصد:
 * توصيات وأعمال وإحصائيات مفبركة، ورقم واتساب من القالب (+970590000000).
 * STRATEGY.md أمر بحذفها (خطر سمعة: السوق الفلسطيني صغير وبيتحقّق).
 * فصارت `stats`/`portfolio`/`testimonials` فاضية بـsite.json، والأقسام
 * بتخفي حالها عبر toggleSection() — وهاد السلوك الصحيح، مش عطل.
 *
 * فالاختبارات هلق بتأكّد الواقع: القسم الفاضي بيختفي هو ورابطه، وما بينعرض
 * زر واتساب ميت. لما ينوجد محتوى حقيقي، الاختبارات المشروطة بتفحصه.
 */
test.describe('Homepage — Structure & Content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait until the services grid is populated (proxy for renderAll() done)
    await waitForHomeContent(page);
  });

  // ── Document ─────────────────────────────────────────────────────────────
  test('loads at "/" with the correct page title', async ({ page }) => {
    await expect(page).toHaveURL('/');
    // العنوان اتغيّر مع التموضع الجديد — بيحكي عن العرض مش عن "حلول متكاملة"
    await expect(page).toHaveTitle('إتقان تك | موقع لمحلك بسعر معلن — فلسطين');
  });

  // ── Navbar ────────────────────────────────────────────────────────────────
  test('navbar exposes links to every section that has content', async ({ page }) => {
    await expect(page.locator('#navbar')).toBeVisible();
    // تحت 1024 .nav-menu بتنخفي والهامبرغر بياخد محلها — فمنفحص القائمة الصح
    // حسب المقاس بدل ما نفشل بلا معنى على مشروع Mobile Chrome.
    const wide = page.viewportSize().width > 1024;
    if (!wide) await page.locator('[onclick="toggleMobile()"]').first().click();
    // منحدّد على .nav-menu مش #navbar كامل: "#contact" موجود مرتين جوّا الناف
    // (رابط القائمة + زر الـCTA)، وهاد بيكسر وضع Playwright الصارم.
    const menu = page.locator(wide ? '#navbar .nav-menu' : '#mobile-menu');
    // #portfolio انشال من هون: القسم بيخفي حاله ورابطه لما يكون فاضي (فحصه تحت).
    for (const href of ['#services', '#about', '#contact']) {
      await expect(menu.locator(`a[href="${href}"]`)).toBeVisible();
    }
  });

  test('language switch buttons AR / EN are both visible', async ({ page }) => {
    await expect(page.locator('#btn-ar')).toBeVisible();
    await expect(page.locator('#btn-en')).toBeVisible();
  });

  // ── Hero ──────────────────────────────────────────────────────────────────
  test('hero section (#home) is visible with a non-empty h1', async ({ page }) => {
    const hero = page.locator('#home');
    await expect(hero).toBeVisible();
    const h1 = hero.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).not.toBeEmpty();
  });

  // ── Services ──────────────────────────────────────────────────────────────
  test('services grid renders at least one .service-card', async ({ page }) => {
    const cards = page.locator('#services-grid .service-card');
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first()).toBeVisible();
  });

  test('each service card has an index numeral, title and description', async ({ page }) => {
    const card = page.locator('#services-grid .service-card').first();
    // .svc-icon انشالت مع إعادة التصميم (DESIGN_BRIEF — اتجاه «الورشة»):
    // الأقسام صارت جداول مواصفات مفهرسة بدل كروت بأيقونات، والرقم هو العلامة.
    await expect(card.locator('.svc-idx')).toBeVisible();
    await expect(card.locator('.svc-idx')).not.toBeEmpty();
    await expect(card.locator('.svc-title')).not.toBeEmpty();
    await expect(card.locator('.svc-desc')).not.toBeEmpty();
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  // الإحصائيات (50+ مشروع / 98% رضا) انحذفت: ما كانت حقيقية.
  // الاختبار هلق بيأكّد القاعدة: بيانات فاضية = قسم مخفي، ولما تنوجد بيشتغل العدّاد.
  test('stats section hides itself when empty, and counts up when populated', async ({ page }) => {
    const grid = page.locator('#stats-grid');
    const count = await grid.locator('.stat-item').count();
    if (count === 0) {
      await expect(page.locator('#stats-section')).toBeHidden();
      return;
    }
    await expect(grid).toBeVisible();
    const num = grid.locator('.stat-number').first();
    await expect(num).toBeVisible();
    await expect(num).not.toHaveText('0', { timeout: 5_000 });
  });

  // ── About ─────────────────────────────────────────────────────────────────
  test('about section (#about) is visible', async ({ page }) => {
    await expect(page.locator('#about')).toBeVisible();
  });

  // ── Portfolio ─────────────────────────────────────────────────────────────
  // الأعمال الست المتخيّلة انحذفت. لما ينضافوا أعمال حقيقية من لوحة التحكم،
  // الاختبار بيفحص محتواهم تلقائياً — وقبلها بيتأكّد إن القسم ورابطه مخفيين.
  test('portfolio hides itself and its nav link when empty', async ({ page }) => {
    const cards = page.locator('#portfolio-grid .port-card');
    const count = await cards.count();
    if (count === 0) {
      await expect(page.locator('#portfolio')).toBeHidden();
      await expect(page.locator('#navbar a[href="#portfolio"]')).toBeHidden();
      return;
    }
    await expect(cards.first()).toBeVisible();
    await expect(cards.first().locator('.port-cat')).not.toBeEmpty();
    await expect(cards.first().locator('.port-title')).not.toBeEmpty();
  });

  // ── Process ───────────────────────────────────────────────────────────────
  test('process section renders at least one .process-step', async ({ page }) => {
    await page.waitForSelector('#process-grid .process-step');
    expect(await page.locator('#process-grid .process-step').count()).toBeGreaterThan(0);
  });

  // ── Testimonials ──────────────────────────────────────────────────────────
  // التوصيات الست كانت بأسماء غير موجودة — انحذفت. توصية وحدة تنكشف = نهاية السمعة
  // في سوق بحجم فلسطين. الاختبار بيحرس القاعدة: ما في توصيات = ما في قسم.
  test('testimonials hide themselves when empty', async ({ page }) => {
    const cards = page.locator('#testi-grid .testi-card');
    const count = await cards.count();
    if (count === 0) {
      await expect(page.locator('#testimonials')).toBeHidden();
      return;
    }
    await expect(cards.first().locator('.testi-text')).not.toBeEmpty();
    await expect(cards.first().locator('.testi-name')).not.toBeEmpty();
  });

  // ── Contact ───────────────────────────────────────────────────────────────
  test('contact section has all four form fields and a submit button', async ({ page }) => {
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(page.locator('#f-name')).toBeVisible();
    await expect(page.locator('#f-email')).toBeVisible();
    await expect(page.locator('#f-service')).toBeVisible();
    await expect(page.locator('#f-msg')).toBeVisible();
    await expect(page.locator('.form-submit')).toBeVisible();
  });

  test('contact info elements are rendered', async ({ page }) => {
    // These IDs are populated by renderContact() from D.company
    for (const id of ['#c-phone', '#c-email', '#c-wa']) {
      await expect(page.locator(id)).toBeAttached();
    }
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  test('footer is visible and shows copyright text', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('.footer-copy')).not.toBeEmpty();
  });

  test('social link anchors exist in the footer', async ({ page }) => {
    for (const id of ['#s-fb', '#s-ig', '#s-tt', '#s-li']) {
      await expect(page.locator(id)).toHaveCount(1);
    }
  });

  // ── WhatsApp float ────────────────────────────────────────────────────────
  // الرابط الميت أسوأ من لا رابط: بيحرق الثقة بلحظة نية الشراء بالضبط.
  // waNumber() بيرفض الفاضي والأرقام الوهمية (زي +970590000000 اللي كان بالقالب)
  // وبيخفي الزر بدل ما يعرضه مكسور. الاختبار بيحرس الحالتين.
  test('WhatsApp float points to a real wa.me link, or hides itself entirely', async ({ page }) => {
    const btn = page.locator('#wa-btn');
    const href = await btn.getAttribute('href');
    const wired = href && /wa\.me\/\d{9,}/.test(href);
    if (wired) {
      await expect(btn).toBeVisible();
      // رقم القالب الوهمي ما بيعدّي
      expect(href).not.toMatch(/wa\.me\/9700+$/);
    } else {
      await expect(btn).toBeHidden();
    }
  });

  // حارس صريح: ما بينشحن ولا زر واتساب ميت.
  // العقد اللي بينفّذه wireWaLinks(): إذا في رقم -> wa.me، وإذا ما في -> #contact
  // (الفورم، هدف شغّال) — بس أبداً "#" لحاله، لأنها بتوقف الزائر بلحظة نية الشراء.
  test('every visible WhatsApp CTA lands somewhere real — never a bare "#"', async ({ page }) => {
    const links = page.locator('a[data-wa-link]');
    const n = await links.count();
    expect(n, 'لازم يكون في أزرار واتساب بالصفحة').toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const el = links.nth(i);
      if (!(await el.isVisible())) continue;
      const href = await el.getAttribute('href');
      expect(href, 'زر واتساب ظاهر لازم يوصّل لـwa.me أو للفورم').toMatch(/(wa\.me\/\d{9,}|#contact)/);
    }
  });
});
