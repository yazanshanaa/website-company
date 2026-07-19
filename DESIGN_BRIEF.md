# Design Brief — Itqan Tech (إتقان تك)

**Status:** approved by owner · Direction C «فخامة هادئة» (Quiet Luxury) · supersedes the earlier «الورشة» (Industrial/Utilitarian) brief below the line
**Date:** 2026-07-17

---

## Reconciliation note (read first)

An earlier version of this file (also dated 2026-07-17) specified an **Industrial/Utilitarian** direction ("الورشة") and was partially implemented directly in `public/index.html`, `public/itqan-cp9x.html`, and `public/css/tokens.css`, with matching `tests/e2e/*.spec.js` updates. That work happened in a separate concurrent session on this same project.

The owner reviewed three genuinely different directions (Swiss/precision, Editorial/personal, Luxury minimal) against real reference sites — [land-book.com](https://land-book.com/), [siteinspire.com](https://www.siteinspire.com/), [shop.aesop.com](https://shop.aesop.com/), [celine.com](https://www.celine.com/) — and explicitly chose **Luxury Minimal**, then confirmed again unprompted: *"اريد منتجة احترافية بشكل حديث و فخم"* (I want a professional result, modern and luxurious). That is a direct contradiction of the Industrial brief's own anti-goals ("no gloss," "a tool, not a brochure," utilitarian by design) — so Industrial cannot be the right read of what the owner wants now, regardless of its earlier "approved" note.

The owner explicitly authorized full discretion over the conflicting work ("افعل بها ما شئت"). Nothing from the Industrial pass was committed to git, so nothing is destroyed in the historical sense — this brief formally supersedes it. `tokens.css` is rewritten in place (same file path, so the existing `<link>` tags in both HTML files keep working). Any Industrial-only structural markup (hazard-stripe divs, outlined mono index numerals, spec-table rows) is replaced with the Luxury system's equivalents below.

---

## Direction

**Archetype: Luxury / Serif Minimal**, restrained toward function (this is a conversion site with pricing and a WhatsApp CTA, not a pure fashion-brand statement piece — luxury *feeling*, small-business *utility*).

**One-line intent:** The site doesn't shout, it simply states things plainly and lets whitespace, restraint and a single quiet accent color do the convincing — quiet confidence, not marketing noise.

**Reference points** (chosen by the owner after reviewing real sites):
- **Aesop** (shop.aesop.com) — warm neutral/paper backgrounds, generous margins, one idea per screen, restrained motion. Primary reference.
- **Céline** (celine.com) — large confident type, near-empty canvas, editorial restraint.

**Why this fits the brand:** The positioning (`STRATEGY.md`) is built on trust and restraint — published prices instead of sales pressure, a payment guarantee instead of hype, a real person instead of a faceless team. A loud gradient-SaaS look — or an intentionally raw industrial one — both contradict that message. A calm, paper-toned, editorial site *performs* the same honesty the copy states.

**Open item:** the shield logo (`public/img/logo.png`) is a glossy chrome/teal 3D render — reads "modern tech" more than "quiet paper luxury." Kept small (nav ~40px, favicon only), never enlarged, so its shine stays a texture detail, not the dominant note.

---

## Typography

**Arabic (primary):**
- Display: **Markazi Text** — elegant Arabic serif, calligraphic warmth, legible at large sizes. h1/h2 and pull statements.
- Body: **IBM Plex Sans Arabic** — clean, legible at small sizes, full weight range for labels/buttons/body.

**Latin (English toggle + numerals/prices in both languages):**
- Display: **Cormorant Garamond** — thin luxury serif, headlines only, English mode.
- Body/UI: **Jost** — geometric, quiet, pairs cleanly with Arabic without competing.

**Hard rules carried over from the Industrial pass (still correct, archetype-independent):**
1. `₪` must render in a face that actually carries the glyph — verify before shipping, same failure mode the Industrial brief documented (Readex Pro had no ₪; IBM Plex Mono's Latin subset didn't deliver it either). IBM Plex Sans Arabic carries it.
2. No `letter-spacing` on Arabic body/paragraph text — connected script, tracking reads as a rendering fault. Micro-label eyebrows (Latin-style small caps) are the one place letter-spacing is used, and only on short Arabic labels where it's a deliberate editorial device (2–3 words max), not running text.

### Scale

| Role | Size | Weight | Notes |
|---|---|---|---|
| H1 | `clamp(34px, 5vw, 58px)` | 500–600 | never heavier — luxury restraint, not bold-SaaS punch |
| H2 | `clamp(26px, 3.5vw, 40px)` | 500 | |
| H3 | `20–22px` | 600 | |
| Body | `16–17px` | 400 | line-height 1.9 — generous, paper-like |
| Small / label | `12–13px` | 600 | wide letter-spacing (0.12–0.18em), small-caps-style eyebrows |
| Price | `clamp(26px, 3.4vw, 42px)` | 500 | Cormorant Garamond numerals, tabular where possible |

---

## Color

Derived from the shield logo's teal, a warm paper base (Aesop reference), and a small brass/gold accent (ties to the "guarantee/seal" positioning). **No cyan/purple gradient, no graphite/hazard-stripe industrial system survives.**

| Token | Value | Role |
|---|---|---|
| `--bg` | `#F6F1E7` | warm ivory/bone — main background |
| `--surface` | `#FBF8F1` | cards/panels, barely lighter than bg |
| `--text` | `#1E1C18` | primary text — warm near-black, never pure #000 |
| `--muted` | `#6B6357` | secondary text, labels |
| `--teal` (accent) | `#1F4E4F` | deep muted teal (from the shield) — links, one CTA, icons |
| `--teal-soft` | `#DCE6E2` | teal tint for hover backgrounds |
| `--brass` | `#A9824C` | small accent — guarantee seal, dividers, price emphasis. Sparing use, never a fill |
| `--band` | `#14201F` | the one dark "statement band" (guarantee section, footer) |
| `--band-text` | `#F1EDE2` | text on the dark band |
| `--wa` | `#25D366` | WhatsApp only (platform color, not a brand color) |
| `--line` | `#E4DDCC` | hairline borders/dividers on the light surface |
| `--radius` | `2px` | near-zero — luxury restraint, not the old pill-everything look |

Light-mode only by design — the calm paper tone *is* the brand decision, not a missing dark-mode toggle.

**Contrast to verify at build time (WCAG AA):** `--text`/`--bg`, `--muted`/`--bg`, `--band-text`/`--band`, `--teal` as button text on `--bg`.

---

## Layout

- Containers: `max-width: 1180px`, generous side padding.
- Section rhythm: **140–160px vertical padding** between sections — the extra air is the luxury signal (was 88px in the Industrial pass, 100px in the original template — both too tight for this direction).
- Grid: hero is **asymmetric, not centered**. In RTL, the headline block anchors **right** (natural reading start) with a small-caps eyebrow + thin rule above it; the admin-panel mockup sits left, smaller and quieter than the type beside it — type leads, the product shot supports.
- Cards: **hairline 1px `--line` borders**, no glow, no shadow. Any glass-blur or glowing-border card from the original template, and any spec-table/hazard-stripe structure from the Industrial pass, is retired.
- Dark band: exactly one full-bleed `--band` section (the guarantee) breaks the ivory rhythm — a deliberate pause, not a second theme.

---

## Signature elements

1. **Eyebrow + hairline rule system** — every section opens with a small-caps label (e.g. "٠١ — الخدمات") and a thin horizontal rule. Replaces both the original pill-badges and the Industrial pass's amber section-badges.
2. **Admin-panel mockup as a "framed plate"** — the existing hero mockup (prices/photos/products/save button — kept, not deleted) gets a thin brass frame line, ivory surface, museum-label caption underneath, instead of a dark glass card or an industrial spec-panel.
3. **Oversized serif index numerals** for the "كيف بشتغل" process steps (٠١ ٠٢ ٠٣ ٠٤ ٠٥ in Markazi Text, large, light-weight, muted-brass outline) — replaces both the emoji-in-circle pattern and the Industrial pass's mono outlined-teal numerals.
4. **Dedicated dark guarantee band** — full-bleed `--band` section, `--band-text`, thin brass rule, the shield logo watermarked faint and large in the background. Promotes the payment guarantee (the #1 trust-closer per `STRATEGY.md`) into a deliberate visual moment instead of a small hero footnote.

---

## Motion

- Scroll reveals: 500–700ms ease-out fades with a small (16–20px) upward drift.
- Hover: understated only — thin underline draw on links, 1.01 scale or opacity shift on cards. **No gradient-sweep hovers, no bounce, no glow, no hazard-stripe animation.**
- Nothing pulses or auto-plays. Motion is a confirmation, never decoration.
- `@media (prefers-reduced-motion: reduce)` opt-out, carried over from the Industrial pass — correct regardless of direction.

---

## Per-section map

| Section | Treatment |
|---|---|
| Nav | Small shield mark (~40px) + "إتقان تك" in Markazi Text, thin bottom hairline — no blurred glass pill, no graphite bar |
| Hero | Asymmetric two-zone; eyebrow + rule above H1; admin-panel "framed plate" mockup; guarantee line as a quiet footnote with a brass rule above it |
| Services | Numbered editorial rows (٠١–٠٦) with hairline dividers — not icon-in-box cards, not spec-table mono rows |
| About ("ليش أنا") | Asymmetric text block; one line from `about.desc` pulled out large in Cormorant/Markazi as an editorial pull-quote |
| Process ("كيف بشتغل") | Oversized index numerals (signature element 3), horizontal hairline timeline |
| Pricing ("الأسعار") | Product cards as refined plates — hairline border, price in large serif numerals, no gradient glow, no amber mono price block |
| **Guarantee** | Full-bleed dark band (signature element 4) — replaces the Industrial pass's amber-bordered band |
| Portfolio / Testimonials | Stay hidden when empty (existing `toggleSection()` logic) — no fabricated placeholders |
| Footer | Dark, matches the guarantee band — wordmark, thin brass rule, social links as understated text links |

---

## Implementation log — QA pass (2026-07-19)

Decisions taken while closing the QA gate, recorded here per the brief-is-the-contract rule.

**Added to the token layer**
- `--fb` / `--ig` / `--li` (Facebook, Instagram, LinkedIn) join `--wa` as *platform* colors — not brand colors. They were previously inline hex on the admin panel's social icons.
- `--danger` / `--success` were already defined but unused; the JS was still passing raw hex from the pre-restyle design.

**Toast: fill → border.** `.toast` was restyled to ivory surface + colored border, but `showToast()` still overrode `background` inline. That put near-black text on a dark fill at **3.04:1**. The state is now carried by `borderColor`, keeping the ivory surface — **16.04:1**. The admin panel's toast is a different pattern (ivory text on a colored fill) and measured 4.53:1 / 4.97:1, so it was left alone.

**Focus rings.** `:focus-visible` covered only `.btn` on the site, and was *completely absent* from the admin panel — keyboard navigation there had no visible focus at all. A global rule now covers `a/button/input/select/textarea/[tabindex]` in both files, switching to `--band-text` over the dark band, footer and sidebar.

**Touch targets.** Enlarged to ≥44×44 under `@media (pointer:coarse)` only, so the desktop's deliberately compact proportions are untouched. Previously undersized: language toggle (32×30), hamburger (40×38), mobile close (42×42), footer links (21px tall).

**Contrast, measured not eyeballed.** All token pairs pass at their applicable threshold. `--brass` on `--bg` is **3.12:1** — below the 4.5:1 body-text bar, but brass is used *only* for icons, hairline rules, star glyphs and the large price (`--price` ≥26px), all of which sit under the 3:1 large-text/graphic threshold. This was already reasoned about in a CSS comment at the `.product-price` rule and remains correct. On the dark band brass measures 4.76:1.

**Open deviation — numerals.** The brief specifies Arabic-Indic index numerals (٠١ ٠٢ ٠٣). The build renders Latin (01 02 03) across services, process and pricing. This is left as-is deliberately: prices, opening hours and the `₪` amounts all use Latin numerals, and Palestinian/Levantine usage commonly favours them — mixing scripts would read as inconsistent rather than editorial. **Flagged for the owner's call**, not silently settled.

---

## What does NOT change

All copy, positioning, WhatsApp-link logic (`waLink`, `wireWaLinks`), empty-section hiding (`pickList`, `toggleSection`), honest form behavior, and the MongoDB sync flow already built stay exactly as implemented. This brief is a **visual system replacement only** — no regression on the trust/conversion fixes already shipped, from either pass.
