'use strict';
// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForHomeContent } = require('./helpers');

// ── Desktop navigation ────────────────────────────────────────────────────────
test.describe('Navigation — Desktop', () => {
  // بنثبّت مقاس سطح مكتب: هالكتلة بتشتغل كمان تحت مشروع Mobile Chrome (Pixel 5)،
  // وهناك .nav-menu بتكون display:none — فكانت بتفشل بلا معنى.
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForHomeContent(page);
  });

  test('clicking "services" link scrolls #services into view', async ({ page }) => {
    await page.locator('#navbar a[href="#services"]').click();
    await expect(page.locator('#services')).toBeInViewport({ ratio: 0.3 });
  });

  // الأعمال فاضية (انحذفت الأعمال المتخيّلة) -> القسم ورابطه بيخفوا حالهم.
  // لما تنضاف أعمال حقيقية، الاختبار بيفحص التمرير تلقائياً.
  test('"portfolio" link scrolls into view when the section has content', async ({ page }) => {
    const link = page.locator('#navbar .nav-menu a[href="#portfolio"]');
    if (!(await link.isVisible())) {
      await expect(page.locator('#portfolio')).toBeHidden();
      return;
    }
    await link.click();
    await expect(page.locator('#portfolio')).toBeInViewport({ ratio: 0.3 });
  });

  test('clicking "about" link scrolls #about into view', async ({ page }) => {
    await page.locator('#navbar a[href="#about"]').click();
    await expect(page.locator('#about')).toBeInViewport({ ratio: 0.3 });
  });

  test('clicking "contact" link scrolls #contact into view', async ({ page }) => {
    // .nav-menu مش #navbar: "#contact" موجود مرتين بالناف (رابط القائمة + زر الـCTA)
    // وهاد بيكسر وضع Playwright الصارم.
    await page.locator('#navbar .nav-menu a[href="#contact"]').click();
    await expect(page.locator('#contact')).toBeInViewport({ ratio: 0.3 });
  });

  // ── Language switch ─────────────────────────────────────────────────────
  test('#btn-en switches html[dir] to ltr', async ({ page }) => {
    await page.locator('#btn-en').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('#btn-ar restores html[dir] to rtl after switching to EN', async ({ page }) => {
    await page.locator('#btn-en').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.locator('#btn-ar').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('switching to EN changes nav link text (AR ≠ EN)', async ({ page }) => {
    const link = page.locator('#navbar .nav-menu a[href="#services"]');
    // الموقع بيكشف لغة المتصفح (navigator.language)، وPlaywright بيشتغل en-US —
    // فما منفترض إنّا بلشنا بالعربي، مننقر ع عشان نتأكد.
    await page.locator('#btn-ar').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const arText = (await link.innerText()).trim();

    await page.locator('#btn-en').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    const enText = (await link.innerText()).trim();

    expect(enText).not.toEqual(arText);
    expect(enText.length).toBeGreaterThan(0);
  });

  test('hero CTA buttons link to #contact', async ({ page }) => {
    // Both primary and secondary hero buttons link to the contact section
    const cta = page.locator('#home a[href="#contact"]').first();
    await expect(cta).toBeVisible();
  });

  // رقم الواتساب لسا ما انحطّ (كان +970590000000 من القالب — رقم ميت، انحذف).
  // waNumber() بيخفي الزر بدل ما يعرضه مكسور. الاختبار بيحرس السلوكين.
  test('WhatsApp button carries a valid wa.me number, or stays hidden', async ({ page }) => {
    const btn = page.locator('#wa-btn');
    const href = await btn.getAttribute('href');
    if (href && /wa\.me\/\d{9,}/.test(href)) {
      await expect(btn).toBeVisible();
    } else {
      await expect(btn).toBeHidden();
    }
  });
});

// ── Mobile navigation ─────────────────────────────────────────────────────────
test.describe('Navigation — Mobile (390 × 844)', () => {
  // Override viewport for this entire describe block
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForHomeContent(page);
  });

  test('hamburger button is visible; desktop .nav-menu is hidden', async ({ page }) => {
    // Hamburger: onclick="toggleMobile()" — no id, but unique by its onclick
    await expect(page.locator('[onclick="toggleMobile()"]').first()).toBeVisible();
    // .nav-menu is hidden via CSS at ≤768 px
    await expect(page.locator('.nav-menu')).toBeHidden();
  });

  test('clicking hamburger reveals #mobile-menu', async ({ page }) => {
    await page.locator('[onclick="toggleMobile()"]').first().click();
    await expect(page.locator('#mobile-menu')).toBeVisible();
  });

  test('mobile menu contains a link to every section that has content', async ({ page }) => {
    await page.locator('[onclick="toggleMobile()"]').first().click();
    const menu = page.locator('#mobile-menu');
    // #portfolio انشال: القسم فاضي فبيخفي رابطه — بالموبايل زي الديسكتوب
    for (const href of ['#services', '#about', '#contact']) {
      await expect(menu.locator(`a[href="${href}"]`)).toBeVisible();
    }
    await expect(menu.locator('a[href="#portfolio"]')).toBeHidden();
  });

  test('clicking a mobile menu link hides the menu', async ({ page }) => {
    await page.locator('[onclick="toggleMobile()"]').first().click();
    await expect(page.locator('#mobile-menu')).toBeVisible();
    // The mobile-close button (×) or any nav link closes the menu
    await page.locator('#mobile-menu a[href="#contact"]').click();
    await expect(page.locator('#mobile-menu')).toBeHidden();
  });

  // أزرار اللغة بالموبايل ساكنة جوّا #mobile-menu، واللي بيكون display:none وهو مسكّر.
  // الاختبارات القديمة كانت بتدوّر عليها بدون ما تفتح القائمة — فبتفشل دايماً.
  test('mobile language buttons are visible once the menu is open', async ({ page }) => {
    await expect(page.locator('#btn-ar-m')).toBeHidden();
    await page.locator('[onclick="toggleMobile()"]').first().click();
    await expect(page.locator('#btn-ar-m')).toBeVisible();
    await expect(page.locator('#btn-en-m')).toBeVisible();
  });

  test('mobile EN button switches html[dir] to ltr', async ({ page }) => {
    await page.locator('[onclick="toggleMobile()"]').first().click();
    await page.locator('#btn-en-m').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('mobile AR button restores html[dir] to rtl', async ({ page }) => {
    await page.locator('[onclick="toggleMobile()"]').first().click();
    await page.locator('#btn-en-m').click();
    await page.locator('#btn-ar-m').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
