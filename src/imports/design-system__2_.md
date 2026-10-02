# MAISON — Design System & Build Specification v2

> A warm, light, editorial luxury ecommerce experience for premium home decor and furniture, sold at accessible prices. This document is the single source of truth: hand it to a builder (human or Claude in Claude Design) and the site should be reproducible from it alone. Every color, size, spacing value, interaction, and page layout is specified. Placeholder brand name used throughout: **Maison**.

---

## Table of Contents
0. Design Thesis
1. Color System
2. Typography System
3. Spacing, Grid & Layout Tokens
4. Elevation, Borders & Radius
5. Motion System (GSAP)
6. Iconography & Imagery
7. Component Library
8. Page Specifications
9. Category & Subcategory Architecture
10. Product Data Model
11. Accessibility Standard
12. Responsive Behavior
13. **Application Architecture (routes, file/folder structure, component tree, state)**
14. **Page-by-Page Route Map & Navigation Flows**
15. Build Priority & Dummy Data Plan

---

## 0. Design Thesis

**Positioning:** museum-grade craft, honest price. The design must feel like a printed design monograph that happens to be shoppable — confident typography, large calm imagery, generous whitespace, restraint everywhere. Luxury comes from *space and typography*, not ornament or darkness.

**Three pillars every screen honors:**
1. **Editorial scale** — display type is large and unafraid (up to 96px). Whitespace is a material. Imagery is full-bleed and cinematic.
2. **Quiet precision** — thin hairline rules, exact baseline-grid alignment, one accent used sparingly.
3. **Frictionless commerce** — beneath the calm sits a ruthless shopping engine: 3-click purchase, live-priced configurator, faceted filtering with counts. Beauty never costs usability.

**Signature element — "The Measured Line":** a single 1px hairline (`--line`) recurring as section divider, nav-hover underline (drawing left→right), the frame of active filter states, and the wordmark underline. It is the connective tissue that says "considered." No heavy shadows, no gradient blobs, no glassmorphism. Depth comes from imagery, whitespace, and this one disciplined line.

**Explicitly avoided defaults:** terracotta-on-cream Anthropic-adjacent palette; acid-on-black; dense broadsheet columns. We use a warmer paper base with a warm near-black ink and a restrained brass accent, so the site never reads as a generic AI furniture template.

---

## 1. Color System

Warm paper neutrals + warm near-black ink + a single restrained brass accent + muted functional colors. No pure white, no pure black.

### Core
| Token | Hex | Role |
|---|---|---|
| `--paper` | `#F6F3EC` | Page background (the canvas) |
| `--paper-raised` | `#FBF9F4` | Cards, raised surfaces |
| `--paper-sunken` | `#EFEBE1` | Wells, image placeholders, hover fills |
| `--ink` | `#1A1815` | Primary text, wordmark, primary buttons |
| `--ink-soft` | `#4A463F` | Secondary text, body copy |
| `--ink-muted` | `#8A8377` | Tertiary text, captions, metadata, disabled |
| `--line` | `#DBD5C7` | Default hairline borders & dividers |
| `--line-strong` | `#B9B1A0` | Hover/active borders |

### Accent — brass (extreme restraint)
| Token | Hex | Role |
|---|---|---|
| `--brass` | `#A67C3D` | Active links, focus rings, key small moments |
| `--brass-soft` | `#C9A362` | Brass hover, thin accent underlines |
| `--brass-wash` | `#EDE3D0` | Faint fill for selected chips/tabs |

### Functional (muted, never neon)
| Token | Hex | Role |
|---|---|---|
| `--sage` / `--sage-wash` | `#6F7D5E` / `#E7EADD` | In-stock, success |
| `--clay` / `--clay-wash` | `#B4593F` / `#F4E2DB` | Sale badge, error, out-of-stock |
| `--amber` / `--amber-wash` | `#B07C2E` / `#F1E6CF` | Pre-order / made-to-order lead time |

### Enforced usage rules
- **Accent budget:** at most **one** brass-filled element per viewport; elsewhere brass is a hairline, dot, or text. This discipline separates luxury from generic.
- **Body contrast:** copy is `--ink-soft` on `--paper` (AA at 15px+). Never use `--ink-muted` for must-read text.
- **Sale price:** struck original `--ink-muted`; live price stays `--ink`; "Save X%" badge = `--clay` on `--clay-wash`. The number itself is never red — only the badge carries color.
- **Dark sections:** only two moments invert to `--ink` ground / `--paper` text — the pre-footer CTA band and the footer — bookending the light body. Nowhere else.

---

## 2. Typography System

### Families
```css
--font-display: 'Fraunces', 'Playfair Display', Georgia, serif;
--font-sans: 'Inter', -apple-system, 'Segoe UI', sans-serif;
--font-mono: 'IBM Plex Mono', ui-monospace, monospace;
--font-wordmark: 'Cinzel Decorative', serif; /* logo only */
```

**Why Fraunces replaces Cinzel Decorative for headings (deliberate):** Cinzel Decorative is an all-caps ornamental Roman face — great for a *logo*, but it can't do lowercase, italics, or long titles and collapses in readability across a real headline scale. Every editorial reference shared uses a high-contrast display serif with a full character set. Fraunces gives that luxury-serif warmth with optical sizing, true italics, and lowercase, scaling cleanly from 96px hero to 20px subhead. **Cinzel Decorative is kept for the wordmark only**, where its ornamental character is an asset.

### Scale (desktop / mobile)
| Token | Font | Weight | Size | Line-height | Tracking | Use |
|---|---|---|---|---|---|---|
| `display-xl` | Fraunces | 300 | 96 / 48 | 0.95 | -0.02em | Hero headline |
| `display-lg` | Fraunces | 300 | 64 / 36 | 1.0 | -0.02em | Page titles, openers |
| `h1` | Fraunces | 400 | 44 / 30 | 1.05 | -0.01em | PDP product name |
| `h2` | Fraunces | 400 | 32 / 24 | 1.1 | -0.01em | Section titles |
| `h3` | Fraunces | 400 | 24 / 20 | 1.15 | 0 | Subsections, card groups |
| `h4` | Inter | 600 | 18 / 16 | 1.3 | 0 | Product names, form labels |
| `body-lg` | Inter | 400 | 17 / 16 | 1.6 | 0 | Lead paragraphs |
| `body` | Inter | 400 | 15 / 15 | 1.6 | 0 | Default body |
| `body-sm` | Inter | 400 | 13 / 13 | 1.5 | 0 | Captions, secondary |
| `label` | Inter | 500 | 12 / 12 | 1.2 | 0.08em UPPER | Eyebrows, nav, buttons, filter labels |
| `price` | Inter | 500 | 16 / 15 | 1.2 | 0 | Card & inline prices |
| `price-lg` | Fraunces | 400 | 36 / 28 | 1.0 | 0 | PDP hero price |
| `mono` | IBM Plex Mono | 400 | 13 / 13 | 1.4 | 0 | Price breakdown, SKU, spec values |

### Typographic rules
- **Eyebrows:** each major section is introduced by an uppercase tracked `label` in `--ink-muted`, above the `h2`. Pair with a section number ("01 — New Arrivals") only where content is genuinely sequential.
- **Editorial emphasis:** within body, emphasize key phrases in Fraunces *italic* (not bold), max 1–2 per paragraph — the Barlovento "we *design* and *craft*" move.
- All-caps is reserved for `label`/eyebrow/button text only; never a headline.
- Prices and specs use `font-variant-numeric: tabular-nums`.

---

## 3. Spacing, Grid & Layout

### Spacing scale (8px base)
`--s-1:4  --s-2:8  --s-3:12  --s-4:16  --s-5:24  --s-6:32  --s-7:48  --s-8:64  --s-9:96  --s-10:128  --s-11:160` (px)

- Section vertical padding: `--s-10` (128) desktop / `--s-8` (64) mobile — non-negotiable; cramped sections are the #1 cheapness tell.
- Component padding: multiples of `--s-3`/`--s-4`.

### Grid
- Max content width **1440px**, centered; side gutters `--s-6` (32) desktop / `--s-4` (16) mobile.
- **12-column** base, 24px gutter.
- Editorial sections break to **full-bleed** for imagery, then return to the 1440 container for text — this in/out rhythm is core to the feel.
- Strict **8px baseline grid**: all vertical spacing snaps to 8px multiples.

---

## 4. Elevation, Borders & Radius

- **Radius:** `--radius: 4px` (buttons, inputs, chips), `--radius-lg: 8px` (cards, image containers), `--radius-pill: 999px` (filter chips, small pills). Deliberate reversal of any earlier "boxy zero-radius" idea — the warm editorial references use gentle radii; hard corners fight the softness and read clinical. 4–8px reads crafted.
- **Elevation (3 states total):** cards rest on `--paper-raised` + 1px `--line`, **no shadow**. Hover: `--shadow-hover: 0 12px 32px -12px rgba(26,24,21,.15)`. Floating (dropdown/drawer/modal): `--shadow-float: 0 16px 48px -8px rgba(26,24,21,.18)`.
- **Dividers:** 1px `--line` — The Measured Line.

---

## 5. Motion System (GSAP)

Editorial, restrained, orchestrated. All respects `prefers-reduced-motion` (→ instant / opacity-only).

| Interaction | Behavior | Implementation |
|---|---|---|
| Hero load | Headline words rise+fade, stagger 60ms; image slow 6s scale 1.06→1.0 (Ken Burns); subtext+CTA follow | `gsap.timeline`, word spans `y:24→0`, image `scale ease:none` |
| Nav hover | Brass underline draws left→right | `::after scaleX 0→1`, origin left, .3s |
| Button hover | Primary bg darkens; secondary ink-wipe from left; label nudges 2px | CSS + `::before` scaleX wipe |
| Card hover | Image crossfade to lifestyle + 1.04 zoom; soft shadow lifts; action row slides up; heart fills | timeline: opacity/scale + box-shadow + `y:-4` + action `y:12→0` |
| Scroll reveal | Content rises+fades on enter; images clip-path wipe bottom→top | `ScrollTrigger`, `y:32→0`; `clip-path inset(100% 0 0 0)→inset(0)` |
| PDP gallery | Left gallery pins while right config scrolls (desktop) | `ScrollTrigger pin` |
| Filter apply | Grid old fades out / new fades in, 40ms stagger; result count rolls | fade+stagger + count-up |
| Add to cart | Product-image clone arcs to cart icon; badge pulses; mini-cart slides in | motion-path clone + badge scale + drawer `x` |
| Toast | Slides up bottom-right; brass progress depletes 4s | `fromTo y`; progress `scaleX 1→0` |
| Mega menu | Panel fades+drops 8px; columns stagger | `gsap.from` stagger .04 |

**Timing language:** transitions .3–.4s `power2.out`; entrances .6s; nothing loops except hero Ken Burns. Over-animation is the second-biggest cheapness tell after cramped spacing.

---

## 6. Iconography & Imagery

- **Icons:** one thin-line set (1.5px stroke, Lucide/Feather). 20px default, 18px inline. Only the wishlist heart uses a filled state.
- **Imagery (critical for the luxury read):**
  - Hero/lifestyle: full-bleed, cinematic, warm-lit interiors with real depth and natural light (Auro/Lignora feel).
  - Product silo shots on `--paper`/white with soft natural shadow for cards + PDP gallery.
  - Each card mixes primary silo (rest) + lifestyle (hover).
  - Consistent aspect ratios: cards **4:5**, hero **full-viewport/16:9**, category tiles **1:1**, bento mixed.
  - Placeholders: royalty-free warm-toned furniture photography, one consistent styling family so the catalog feels curated.

---

## 7. Component Library

### 7.1 Buttons
| Variant | Rest | Hover | Use |
|---|---|---|---|
| Primary | `--ink` bg, `--paper` text, `--radius`, 14px label, pad 14×28 | bg→`#2E2A24`, arrow slides in | one key action/view |
| Secondary | transparent, 1px `--ink` border, `--ink` text | ink wipes in from left, text→`--paper` | Buy now, View collection |
| Ghost | no border, `--ink` text, brass underline on hover | brass underline | "View all", "Read story" |
| Icon | 40×40, `--radius`, 1px `--line`, thin icon | border→`--line-strong`, bg→`--paper-sunken` | header actions, card wishlist |

All: min 44px touch; `:focus-visible` 2px `--brass` outline offset 2px; disabled `--ink-muted`/`--line`, no pointer.

### 7.2 THE PRODUCT CARD — the centerpiece

Most-repeated, highest-value component. Three jobs at once: look magazine-grade, expose variants instantly, enable purchase in ≤3 clicks (including from the card).

**Anatomy (4:5 image + info block):**
```
┌────────────────────────────────┐
│ ┌────────────────────────────┐ │  image container, --radius-lg, --paper-sunken
│ │ [NEW IN]              ♡     │ │  status badge TL; wishlist heart TR (always visible)
│ │       PRODUCT IMAGE         │ │  4:5 silo at rest → lifestyle crossfade on hover
│ │  ┌──────────────────────┐  │ │  ACTION ROW (hidden at rest, slides up on hover/tap)
│ │  │ ● ● ● ●  [Add ✓] [→] │  │ │  swatches + Add-to-cart + Buy-now
│ │  └──────────────────────┘  │ │
│ └────────────────────────────┘ │
│ Sofas · Living Room             │  category eyebrow, label, --ink-muted
│ Hollis 2-Seater Sofa            │  h4, --ink
│ ★ 4.8 (36)                      │  rating, body-sm, star --brass
│ ₹21,400 – ₹32,000               │  price range OR single; struck original if sale
└────────────────────────────────┘
```

**States (exhaustive):**

1. **Rest** — silo image on `--paper-sunken`, 4:5. One status badge (priority Sold Out > Sale > Pre-order > New): `NEW IN` (`--ink`/`--paper`), `SALE −13%` (`--clay`/`--clay-wash`), `PRE-ORDER` (`--amber`/`--amber-wash`), `SOLD OUT` (`--ink-muted`/`--paper-sunken`). Wishlist heart always visible (outline→fills `--clay` with pop-scale). Info block: eyebrow, name (h4), rating if any, price.
   **Price logic:** equal variant prices → single; differing → range "₹21,400 – ₹32,000"; on sale → struck `--ink-muted` + live `--ink`. tabular-nums.

2. **Hover (desktop)** — card lifts (`--shadow-hover`, `translateY(-4px)`); image crossfades to lifestyle + 1.04 zoom; **action row slides up** over a subtle bottom scrim:
   - up to 4 **color swatches** (18px, `--line` ring; selected `--ink` ring) — hovering/selecting **swaps the card image** to that color live;
   - **Add to cart** (primary compact) → adds selected-or-default variant, fires fly-to-cart + mini-cart. Card-level Click 1.
   - **Buy now** (compact `→`) → adds & jumps to checkout.
   - if a material axis exists, a small "+3 more" hints deeper options live on the PDP (color-only on the card).

3. **Tap (mobile, no hover)** — swatches render **always-visible** under the price; inline **Add** button; Buy-now hidden on compact mobile card; tapping image → PDP.

4. **Loading skeleton** — `--paper-sunken` shimmer block + `--line` text bars during filter/pagination.

5. **Out-of-stock** — image desaturated ~90%, `SOLD OUT` badge, action row shows **Notify me** instead of Add.

**Variant-default safety:** card add uses the tapped swatch or first variant; mini-cart line always names exact variant with inline **Change** — wrong default is a one-click fix, never a checkout surprise.

**Accessibility:** anchor covers image+title; swatches/buttons/heart are sibling focusable controls (never nested in the anchor), each with `aria-label` ("Colour: Walnut"). Keyboard users tab straight to Add and swatches. Focus-visible ring on all.

### 7.3 Inputs & Form Controls
- Text input: `--paper-raised`, 1px `--line`, `--radius`, 44px, 15px Inter; label **above** (never placeholder-only); focus border→`--brass` + 2px brass ring.
- Select: same shell + thin chevron; menu on `--paper-raised` + `--shadow-float`.
- Checkbox/radio: 18px, 4px radius; checked `--ink` fill + `--paper` check; radio selected brass dot.
- Quantity stepper `[− n +]`, bordered, 44px.
- Price range slider: 2px `--line` track, `--ink` fill between two 18px handles (brass focus ring) + live min/max number inputs.
- Error: 1px `--clay`, `--clay` helper + inline icon (never color-only), `aria-describedby`.

### 7.4 Badges, Chips & Tags
- Status badge: small `--radius`, 11px uppercase, colors per 7.2.
- Filter chip (applied): pill, `--brass-wash`, `--ink`, ✕ to remove; live above the grid.
- Selectable tab/pill: rest 1px `--line`; selected `--ink` bg + `--paper` text (or `--brass-wash` + brass border in lighter contexts) — one consistent selected treatment per context.

### 7.5 Header & Navigation
- Utility bar (optional): `--ink` text on `--paper`, 12px — "Free white-glove delivery over ₹25,000", region/currency, "Track order".
- Main bar: `--paper`, 1px `--line` bottom, 80px. Left wordmark (Cinzel). Center nav: `Living Room` `Bedroom` `Dining` `Decor` (mega) + `New` `Sale` (plain). Right: Search, Call (`tel:`), Wishlist(count), Account, Cart(count).
- Sticky: on scroll-down utility collapses, main shrinks to 64px + faint `--shadow-float`; on scroll-up persists. .3s.
- Counts: small brass-outlined numeral top-right of icon.
- Mobile: center wordmark, hamburger left, cart right; drawer from left with search field, accordion categories, account/wishlist/call.

### 7.6 Mega Menu
Full-width `--paper-raised`, 1px `--line` top, `--shadow-float`. 3–4 text columns of subcategories grouped by function, each led by a brass uppercase group label; links `--ink-soft`→`--brass` with draw-underline. Right: promo tile (lifestyle image, caption, "Shop the edit →"). Bottom: "Shop all [Category] →". Keyboard nav, `Esc` closes, focus-trapped, restores focus.

### 7.7 Mini-Cart Drawer
Right, 420px, full height, `--paper-raised`, `--shadow-float`. Opens on any add.
```
Your cart (3)                         ✕
──────────────────────────────────────
[img] Hollis 2-Seater Sofa
      Oak · Beige · 2-seater   [Change]
      [− 1 +]                  ₹21,400
──────────────────────────────────────
Subtotal                     ₹42,300
  (if pre-order/custom present):
  Pay now (30% advance)      ₹12,690
  Balance on delivery        ₹29,610
──────────────────────────────────────
[ Checkout → ]        (primary, full-width)
 View full cart              (ghost)
Free white-glove delivery included ✓
```
Click 1→2 of the 3-click path. Items name exact variant + inline Change. Empty: quiet line + "Your cart is empty" + "Explore new arrivals →".

### 7.8 Toast System
Bottom-right, `--paper-raised`, 1px `--line`, `--shadow-float`, 3px left accent bar (`--sage`/`--clay`/`--amber`). Square thumb + "Added to cart" + variant line + "View cart" ghost + ✕. Auto-dismiss 4s with depleting brass progress. `aria-live="polite"`. Max 3 stacked.

### 7.9 Search Overlay
Full-width command bar under header + scrim. Debounced 200ms grouped results: **Products** (thumb+name+price, ≤6), **Categories**; empty state shows **Popular searches** + **Trending categories**. Keyboard: ↑↓ move, Enter open, Esc close. "See all results for '…' →" → filtered listing.

### 7.10 Bento Grid (Brand Values)
5 asymmetric tiles (`grid-template-areas`) on `--paper-raised` + 1px `--line`, `--radius-lg`. Mix: one large value statement (Fraunces), two stat tiles (big numeral + caption: "2,400+ homes furnished", "40+ artisan partners"), two icon+text values ("Made to order", "Responsibly sourced"). One tile may invert to `--ink`. Scroll-reveal staggered.

---

## 8. Page Specifications

### 8.1 Homepage
```
01 UTILITY BAR + HEADER (7.5)
02 HERO — full-viewport bg image (cinematic interior), overlaid:
     eyebrow "NEW COLLECTION 2026", display-xl headline (2 lines max),
     body-lg subtext, [Shop the collection] primary + [Our story] ghost.
     Slow crossfade slider 3–5 slides (6s hold, 1.2s fade). Ken Burns on active slide.
     Bottom-center scroll cue (thin line + chevron).
03 TOP CATEGORIES — eyebrow + h2 "Shop by category"; horizontal snap-scroll row of
     1:1 category tiles (image + name + item count), 5–6 visible, drag/scroll on mobile.
04 BRAND VALUES BENTO (7.10) — "Why Maison" — 5 tiles.
05 NEW ARRIVALS — eyebrow "01 — New Arrivals" + h2 + one-line desc;
     category filter pill row (All / Living / Bedroom / Dining / Decor);
     4-col product-card grid (12 cards), tablet 2-col, mobile 1–2 col.
06 EDITORIAL BREAK — full-bleed lifestyle image + short brand story
     (Fraunces italic emphasis) + [Read our story] ghost. Parallax-lite on scroll.
07 BESTSELLERS / PRODUCT SHOWCASE — infinite lazy-scroll (load 12 after 1–2 triggers),
     then [Load more] ghost + [View all products →] secondary side by side.
08 SERVICE STRIP — 3–4 inline assurances (thin-line icon + label):
     "White-glove delivery" · "Made to order" · "10-yr warranty" · "Custom design service".
09 PRE-FOOTER CTA (dark --ink band) — display-lg headline "Find the piece that feels at home."
     + [Explore collection] primary + [Book a consultation] secondary.
10 FOOTER (8.7, dark).
```

### 8.2 All Products / Listing — FULL FILTER SPEC

Layout: left sticky filter rail (280px) + right results. Mobile: filters behind a [Filters ⌥] button → bottom sheet.

```
Home / Collection
ALL PRODUCTS                                       (display-lg)
─────────────────────────────────────────────────────────────
[category chip row: quick jump — Living / Bedroom / Dining …]
─────────────────────────────────────────────────────────────
Showing 1–24 of 700            [applied chips ✕✕✕][Clear all]   Sort by [Relevance ▾]  [▦ / ▤ view]
┌──────────┬────────────────────────────────────────────────┐
│ FILTERS   │  ┌────┬────┬────┬────┐                          │
│           │  │card│card│card│card│                          │
│ Category  │  ├────┼────┼────┼────┤                          │
│  accordion│  │card│card│CUSTOM  │  ← "Looking for something │
│  per cat, │  │    │    │ TILE│  │     custom?" tile every    │
│  subcats  │  ├────┴────┴────┴────┤     ~12 items (dark)      │
│  w/ counts│  │      pagination      │                        │
│ Availability                                                 │
│  ☑ In stock (612)  ☐ Pre-order (74)  ☐ Customizable (140)    │
│ Price  [histogram + dual-handle slider] min[] max[]          │
│ Material ☐ Oak(88) ☐ Walnut(60) ☐ Bouclé(45) … +show more    │
│ Colour  [swatch grid, multi-select]                          │
│ Size/Type (contextual per category)                          │
│ Rating  ☐ 4★ & up                                            │
│ [Clear all]                                                  │
└──────────┴────────────────────────────────────────────────┘
```

**Filter behavior — build every one of these:**
- **Facet counts** beside each option (live-updating as other filters apply) — "Sofas (18)". This is a core IKEA/West-Elm trust signal.
- **Price:** dual-handle slider **over a histogram** of the current result distribution + editable min/max number inputs. Slider snaps to sensible steps.
- **Logic:** OR within a group, AND across groups. Selecting a facet updates all other counts and the grid without full reload.
- **Applied-filter chips** above the grid (removable ✕) + **Clear all**.
- **URL sync:** every filter/sort/page → query params (`?category=sofas&material=oak,walnut&price=20000-40000&sort=price_asc&page=2`) → shareable, bookmarkable, back-button-safe, deep-linkable.
- **Sort:** Relevance, Newest, Price low→high, Price high→low, Best rated.
- **View toggle:** grid (default 4-col) / dense list.
- **Pagination:** numbered (1 2 3 … 10) for intentional browsing — distinct from the homepage's casual infinite scroll.
- **Loading:** skeleton cards during transitions; result-count number rolls.
- **Empty state:** "No pieces match that combination yet. Try removing a filter." + [Clear all] + 3 suggested popular products. Never a blank page.
- **Mobile:** [Filters] opens a full-height bottom sheet; a sticky footer in the sheet shows "Show 128 results" (live count) + [Apply]; [Clear all] top-right; applied count badge on the Filters button.
- **Embedded custom-order tile:** every ~12 cards, a dark `--ink` tile "Looking for something custom? → Start a request" keeps the bespoke path always in view (mirrors Barlovento's dark "custom" tile).

### 8.3 PRODUCT DETAIL PAGE — the configurator

Modeled on the Formly reference: separate variant axes, per-option prices, live price breakdown. Desktop = sticky gallery left, scrolling config right.

```
Home / Living Room / Sofas / Hollis 2-Seater          (breadcrumb)
┌─────────────────────────────┬─────────────────────────────────┐
│ GALLERY (sticky)             │ [BESTSELLER] [IN PRODUCTION · 6-WK LEAD]│
│  ┌───────────────────────┐   │ Sofas · Modular                        │
│  │  main image (silo/     │   │ Hollis 2-Seater Sofa            (h1)   │
│  │  lifestyle), zoom on    │   │ ★ 4.8 (36) · Bestseller since 2024    │
│  │  hover, 01/05 counter   │   │ W240 · D95 · H85 · Made-to-order      │
│  └───────────────────────┘   │                                        │
│  [t][t][t][t][t] thumbs      │ SIZE                                   │
│                              │ [2-Seat        ][3-Seat        ]        │
│                              │ [ From ₹1,490  ][ From ₹1,890 ✓]        │
│                              │ [4-Seat ₹2,290 ][Corner ₹2,690 ]        │
│                              │                                        │
│                              │ FABRIC        Cashmere Bouclé · 40k rub │
│                              │ ● ● ● ● ● ● ● ●  (swatch row)           │
│                              │ COLOUR        Walnut #D8C7AD            │
│                              │ ● ● ● ● ● ● ●                            │
│                              │ LEG FINISH                              │
│                              │ [Walnut ✓][Brushed brass][Powder ink]   │
│                              │ FIRMNESS      Medium · most ordered     │
│                              │ [Soft][Medium ✓][Firm]                  │
│                              │                                        │
│                              │ FROM  ₹1,890     6-wk lead · free deliv │
│                              │ ── live price breakdown (mono) ──       │
│                              │ Base 3-seat · walnut legs      ₹1,690  │
│                              │ Cashmere bouclé upgrade         +₹120  │
│                              │ Medium firmness · down topper    +₹80  │
│                              │ ─────────────────────────────────────  │
│                              │ [ Add to cart — ₹1,890 ]  ♡   (primary)│
│                              │ ✓100-day trial ✓10-yr warranty         │
│                              │ ✓Free EU delivery ✓White-glove setup   │
│                              │ Want a different size or fabric?        │
│                              │   Request a custom version →            │
└─────────────────────────────┴─────────────────────────────────────────┘

TABS: [Description][Dimensions][Materials & care][Shipping & returns]
  each: label→value rows; Dimensions includes a small line diagram.
CUSTOMER REVIEWS: 4.8 avg + 5→1 star distribution bars + 3 review cards.
YOU MAY ALSO LIKE: 4 product cards (7.2).
PRE-FOOTER CTA (dark) + FOOTER.
```

**Configurator rules — build all:**
- **Independent axes:** Size, Fabric, Colour, Leg finish, Firmness — each its own control. Size = price tiles each showing "From ₹X". Fabric/Colour = swatch rows with the selected name + spec shown to the right. Leg/Firmness = labeled pills.
- **Live price + breakdown:** the FROM price and the mono line-item breakdown recompute on every selection, itemizing base + each upgrade delta. This transparency is a premium-trust signal.
- **Unavailable combos:** disable (don't hide) invalid swatches/tiles with a diagonal strike + tooltip "Not available with 2-seater".
- **Lead-time / order-type:** made-to-order shows an `IN PRODUCTION · N-WK LEAD` badge + inline "Pay 30% now, balance on delivery" note near the price — never buried in a tab.
- **Add to cart shows the resolved price** in the button label ("Add to cart — ₹1,890") so there's zero ambiguity. This is Click 1 of the 3-click path from the PDP.
- **Custom entry:** "Request a custom version →" opens the custom form (8.5) pre-filled with this product.
- **Gallery:** thumbnails + main image, hover-zoom, image swaps live when Colour changes, 01/05 counter, keyboard arrow support, `alt` = product + variant.

### 8.4 Cart & 3-Click Checkout
**Target:** a returning customer with saved address+payment goes decision→placed in **3 clicks**.
1. **Add to cart** (card or PDP) → mini-cart drawer opens.
2. **Checkout** (in drawer) → single-page checkout.
3. **Place order** (checkout primary CTA) → confirmation.

**Single-page checkout (one scroll, not a wizard):**
- Sections stacked: Contact/email · Delivery address (pre-filled if logged in, inline-editable) · Delivery method · Payment (saved cards/UPI as selectable tiles, "Add new" expands inline) · Order summary.
- **Advance/balance auto-render:** if any pre-order/custom item is present, the summary automatically shows "Pay now (30%) ₹X · Balance on delivery ₹Y". Never hidden.
- **Guest checkout** supported (email+address inline) with no forced signup; offer "Save these details?" *after* confirmation.
- Full cart page (from "View full cart") mirrors the summary with editable quantities/variants + a cross-sell row.
- Confirmation: order number, itemized total, payment split, expected delivery window, [Track order].

### 8.5 Custom Request Flow (quote-driven — separate from the fast path)
1. Trigger from PDP "Request a custom version" or footer "Custom Orders".
2. Single-page form: reference product (auto-filled), desired dimensions, material/colour preference (free text + optional swatch picker), reference image upload, contact, notes.
3. Confirmation: "We'll send a quote within 2 business days" + appears in Account → Custom Requests, status **Submitted**.
4. (Admin sets quote — out of client scope.)
5. Customer notified; status **Quote ready — ₹X**; [Confirm & pay advance] routes into 8.4 checkout with fixed advance % on the quoted price.

### 8.6 Account Area
Left vertical nav (desktop) / top tabs (mobile):
- **Profile** (name, email, phone, password)
- **Addresses** (add/edit/delete, default)
- **Payment methods** (tokenized, last-4)
- **Orders** — status chips: Processing / Pre-Booked / Awaiting Balance / Shipped / Delivered / Cancelled; expandable to line items, advance/balance, 4-step delivery tracker.
- **Custom Requests** — Submitted / Quote Ready / Confirmed / In Production / Delivered.
- **Wishlist** — product-card grid + "Move to cart".
- **Settings** — notifications, delete account.
- **Logout.**

### 8.7 Footer (dark `--ink` ground, `--paper` text)
- Col 1: wordmark + one-line statement + newsletter email input (brass-outline submit).
- Col 2 Shop (categories) · Col 3 Company (About, Craftsmanship, Careers, Press) · Col 4 Support (Shipping & Returns, Track Order, Warranty, FAQs, Custom Orders, Trade Enquiry).
- Bottom bar: copyright, social icons, payment icons, Terms/Privacy. Giant wordmark watermark across the base (CIRA-style) as a signature flourish.

---

## 9. Category & Subcategory Architecture (~700 products)

| Category | Subcategories |
|---|---|
| Living Room | Sofas · Sofa Beds · Sofa Sections · Armchairs · Ottomans · Coffee & Side Tables · TV Units · Bookshelves |
| Bedroom | Beds · Mattresses · Bedside Tables · Wardrobes · Dressers & Chests |
| Dining | Dining Tables · Dining Chairs · Bar Stools · Sideboards & Buffets |
| Home Office | Desks · Office Chairs · Shelving |
| Lighting | Pendant Lights · Table Lamps · Floor Lamps · Wall Lights |
| Decor & Accessories | Vases · Mirrors · Wall Art · Cushions & Throws · Rugs & Textiles · Clocks · Homewares |
| Outdoor | Outdoor Seating · Outdoor Tables · Loungers · Outdoor Decor |
| Storage | Cabinets · Console Tables · Shelving Units |

Top-level nav shows the 4 highest-traffic categories as mega-menus (Living Room, Bedroom, Dining, Decor); the rest live under a "Shop all" mega tab + full listing filters, keeping the header lean.

---

## 10. Product Data Model

```json
{
  "id": "sofa-hollis-001",
  "name": "Hollis 2-Seater Sofa",
  "category": "Living Room",
  "subcategory": "Sofas",
  "description": "Hand-finished oak frame with a bouclé wool blend cover.",
  "craftsmanship_note": "Kiln-dried oak, interlaced elastic webbing seat base.",
  "rating": 4.8,
  "review_count": 36,
  "badges": ["bestseller"],
  "base_price": 169000,
  "axes": {
    "size":    [{"label":"2-Seat","delta":0},{"label":"3-Seat","delta":20000},{"label":"4-Seat","delta":60000}],
    "fabric":  [{"label":"Linen","delta":0},{"label":"Cashmere Bouclé","delta":12000}],
    "colour":  [{"label":"Beige","swatch":"#D8C7AD","image":"..."},{"label":"Walnut","swatch":"#6B4B32","image":"..."}],
    "leg":     [{"label":"Walnut","delta":0},{"label":"Brushed Brass","delta":8000}],
    "firmness":[{"label":"Soft","delta":0},{"label":"Medium","delta":8000},{"label":"Firm","delta":0}]
  },
  "unavailable_combos": [["size:2-Seat","leg:Brushed Brass"]],
  "order_type": "made_to_order",
  "lead_time": "6 weeks",
  "in_stock_variants": ["size:3-Seat|colour:Beige"],
  "customizable": true,
  "customization_starting_price": 320000,
  "images": {"silo":["..."],"lifestyle":["..."],"by_colour":{"Beige":"...","Walnut":"..."}},
  "specs": {"frame":"Solid oak, FSC-certified","cushion_fill":"HR foam & feather","cover":"100% wool bouclé, removable","assembly":"Legs attach in minutes","dimensions":"W240·D95·H85 cm","weight":"38 kg"},
  "care":"Spot clean damp cloth; machine-washable cover 30°C.",
  "warranty":"10-year frame warranty"
}
```
Price resolution: `base_price + Σ(selected axis deltas)`. Card price range = min/max over valid combos.

---

## 11. Accessibility Standard (WCAG 2.1 AA, non-negotiable)
- Contrast: body `--ink-soft` on `--paper` and all interactive text pass AA; never `--ink-muted` for must-read text.
- Every interactive element: visible `:focus-visible` (2px `--brass`, 2px offset), keyboard reachable, logical tab order.
- Mega menu / search / cart drawer / modals: focus-trapped, `Esc` to close, focus restored to trigger.
- Images: meaningful `alt` (product + variant, not filenames).
- Live regions: toasts + filter-result updates `aria-live="polite"`; count changes announced.
- Motion: full `prefers-reduced-motion` support (→ opacity-only/instant); no animation blocks interaction.
- Forms: labels above inputs, inline errors via `aria-describedby`, error state never color-alone (icon+text).
- Touch targets ≥44×44 everywhere incl. swatches and card actions.
- Product card: anchor + sibling controls pattern (no button-in-anchor nesting).

---

## 12. Responsive Behavior
| Breakpoint | Grid | Card cols | Nav | Filters |
|---|---|---|---|---|
| ≥1280 desktop | 12-col, 1440 max | 4 | full mega menu | sticky left rail |
| 1024–1279 | 12-col | 3 | mega menu | sticky left rail |
| 768–1023 tablet | 8-col | 2 | condensed + mega | top [Filters] → sheet |
| <768 mobile | 4-col | 1–2 | hamburger drawer | bottom sheet |
Type scale shifts to the mobile column of §2. Section padding drops to `--s-8`. Hero headline `display-xl`→48px. PDP gallery un-pins and stacks above config.

---

## 13. Application Architecture

### 13.1 Platform target & constraints
This builds as a **single-page React application** with **client-side routing** and **in-memory state** (React Context + hooks). It runs fully in the browser with **no backend, no database, and no browser storage** — all data (products, cart, wishlist, account, orders) lives in React state seeded from a static dummy dataset. This is a deliberate constraint for a front-end prototype: it keeps the whole app self-contained and instantly demoable, and every "persisted" action (add to cart, place order, save address) mutates in-memory state and survives navigation within the session, resetting on refresh. When this graduates to production, the same component tree swaps its data layer for real API calls with minimal churn — the architecture below isolates that seam.

**Routing:** use a lightweight hash or in-memory router (a small custom `<Router>`/`useRoute` built on `useState` + `history`-like state is fine in a sandbox; if a library router is available, use it). URLs are still *modeled* (see §14) so filter/sort/pagination state is expressed as route+query even if held in state — this keeps the mental model correct and makes real-URL migration trivial.

### 13.2 Folder & file structure
Organized by **feature domain first, shared primitives second** — the structure a senior front-end team would recognize. If the platform forces a single file, preserve this as the in-file section order and comment-banner each block with its path.

```
maison/
├─ index.html                      # font <link>s (Fraunces, Inter, IBM Plex Mono, Cinzel Decorative), root mount
├─ main.jsx                        # app entry: mounts <App/>, wraps global providers
├─ App.jsx                         # <Router> + <Providers> + <Layout> shell + route table
│
├─ styles/
│   ├─ tokens.css                  # ALL design tokens from §1–4 as CSS custom properties (source of truth)
│   ├─ base.css                    # reset, baseline grid, typography classes (display-xl … mono)
│   └─ utilities.css               # container, section-padding, hairline, sr-only, focus-ring helpers
│
├─ router/
│   ├─ Router.jsx                  # route matching, current-route context
│   ├─ routes.js                   # route table: path → page component (see §14)
│   └─ useRoute.js                 # hook: current path, params, query; navigate(); back()
│
├─ providers/                      # global in-memory state (Context + reducer per domain)
│   ├─ CartProvider.jsx            # cart items, add/remove/updateQty/changeVariant, totals, advance/balance calc
│   ├─ WishlistProvider.jsx        # wishlist ids, toggle, move-to-cart
│   ├─ AccountProvider.jsx         # auth state, profile, addresses, payment methods, orders, custom requests
│   ├─ CatalogProvider.jsx         # products dataset, category tree, lookups, search index
│   ├─ FilterProvider.jsx          # listing filter/sort/page state + derived facet counts + result set
│   └─ UIProvider.jsx              # global UI: mini-cart open, search-overlay open, mega-menu open, toasts
│
├─ data/
│   ├─ products.js                 # 70–80 dummy products (§10 shape)
│   ├─ categories.js               # category → subcategory tree (§9) with counts
│   ├─ reviews.js                  # dummy reviews keyed by product id
│   └─ images.js                   # curated royalty-free image URL sets (silo/lifestyle/by-colour)
│
├─ lib/                            # pure logic, no React
│   ├─ pricing.js                  # resolvePrice(product, selection), priceRange(product), advanceSplit()
│   ├─ filtering.js                # applyFilters(products, filterState) → results + facetCounts + histogram
│   ├─ search.js                   # buildIndex(products), query(index, term) → grouped results
│   ├─ format.js                   # currency, tabular number, percent, lead-time formatting
│   └─ variants.js                 # combo validity (unavailable_combos), default variant, resolve selection
│
├─ components/                     # SHARED, presentational primitives (design-system components §7)
│   ├─ primitives/
│   │   ├─ Button.jsx              # primary | secondary | ghost | icon (§7.1)
│   │   ├─ Badge.jsx               # status/sale/pre-order/sold-out (§7.4)
│   │   ├─ Chip.jsx                # applied-filter chip, selectable tab/pill (§7.4)
│   │   ├─ Input.jsx  Select.jsx  Checkbox.jsx  Radio.jsx  QtyStepper.jsx  RangeSlider.jsx  # (§7.3)
│   │   ├─ Rating.jsx              # star rating display
│   │   ├─ Skeleton.jsx            # shimmer blocks
│   │   ├─ Eyebrow.jsx             # uppercase tracked section label (+ optional number)
│   │   └─ MeasuredLine.jsx        # the 1px signature divider / hover-underline util
│   ├─ product/
│   │   ├─ ProductCard.jsx         # THE centerpiece, all states (§7.2)
│   │   ├─ ProductGrid.jsx         # responsive grid + skeleton + embedded custom tile
│   │   ├─ SwatchRow.jsx           # colour swatches w/ live image swap
│   │   └─ CustomOrderTile.jsx     # dark "looking for something custom?" grid tile
│   ├─ cart/
│   │   ├─ MiniCartDrawer.jsx      # right drawer (§7.7)
│   │   ├─ CartLineItem.jsx        # thumb + variant + Change + qty + price
│   │   └─ FlyToCart.jsx           # add-to-cart arc animation controller
│   ├─ overlays/
│   │   ├─ SearchOverlay.jsx       # (§7.9)
│   │   ├─ Toaster.jsx  Toast.jsx  # (§7.8)
│   │   └─ Modal.jsx               # focus-trapped base for dialogs/sheets
│   └─ nav/
│       ├─ Header.jsx  UtilityBar.jsx
│       ├─ MegaMenu.jsx            # (§7.6)
│       ├─ MobileNavDrawer.jsx     # accordion category drawer
│       └─ Footer.jsx              # dark footer + wordmark watermark (§8.7)
│
├─ features/                       # PAGE-level composition, one folder per route area
│   ├─ home/
│   │   ├─ HomePage.jsx            # orchestrates sections 01–10 (§8.1)
│   │   └─ sections/               # Hero, TopCategories, BrandBento, NewArrivals,
│   │       …                      #   EditorialBreak, Bestsellers, ServiceStrip, PreFooterCTA
│   ├─ listing/
│   │   ├─ ListingPage.jsx         # (§8.2) layout + results
│   │   ├─ FilterRail.jsx          # desktop sticky rail
│   │   ├─ FilterSheet.jsx         # mobile bottom sheet
│   │   ├─ FacetGroup.jsx          # one accordion facet w/ counts
│   │   ├─ PriceHistogramSlider.jsx
│   │   ├─ AppliedChips.jsx  SortMenu.jsx  Pagination.jsx  ViewToggle.jsx  ListingEmpty.jsx
│   ├─ product/
│   │   ├─ ProductPage.jsx         # (§8.3) sticky gallery + config column
│   │   ├─ Gallery.jsx             # thumbs + main + zoom + colour-linked swap
│   │   ├─ Configurator.jsx        # independent axes (Size/Fabric/Colour/Leg/Firmness)
│   │   ├─ PriceBreakdown.jsx      # live mono line-item panel
│   │   ├─ SpecTabs.jsx            # Description/Dimensions/Materials/Shipping
│   │   ├─ ReviewsBlock.jsx        # avg + distribution + review cards
│   │   └─ RelatedProducts.jsx     # "You may also like"
│   ├─ checkout/
│   │   ├─ CartPage.jsx            # full cart (from "view full cart")
│   │   ├─ CheckoutPage.jsx        # single-page checkout (§8.4)
│   │   ├─ ContactSection.jsx  AddressSection.jsx  DeliverySection.jsx  PaymentSection.jsx  OrderSummary.jsx
│   │   └─ OrderConfirmation.jsx   # number, split, delivery window, track link
│   ├─ custom/
│   │   ├─ CustomRequestPage.jsx   # (§8.5) form
│   │   └─ CustomRequestConfirm.jsx
│   └─ account/
│       ├─ AccountLayout.jsx       # side nav (desktop) / top tabs (mobile)
│       ├─ ProfileTab.jsx  AddressesTab.jsx  PaymentTab.jsx
│       ├─ OrdersTab.jsx  OrderDetail.jsx  DeliveryTracker.jsx
│       ├─ CustomRequestsTab.jsx  WishlistTab.jsx  SettingsTab.jsx
│       └─ AuthPage.jsx            # login / register (in-memory)
│
└─ hooks/                          # cross-cutting reusable hooks
    ├─ useFocusTrap.js  useEscapeKey.js  useScrollLock.js   # a11y for overlays
    ├─ useReducedMotion.js         # gates all GSAP
    ├─ useMediaQuery.js            # breakpoint logic (§12)
    └─ useScrollReveal.js          # ScrollTrigger wrapper for section reveals
```

### 13.3 Component tree (runtime composition)
```
<App>
 ├─ <Providers>  (UI ▸ Catalog ▸ Filter ▸ Cart ▸ Wishlist ▸ Account)   ← nesting order = dependency order
 └─ <Router>
     └─ <Layout>                         # persistent shell across routes
         ├─ <UtilityBar/> <Header/>      # Header renders <MegaMenu/> on hover
         ├─ <main> {routed page} </main> # HomePage | ListingPage | ProductPage | …
         ├─ <Footer/>
         ├─ <MiniCartDrawer/>            # portal-level, controlled by UIProvider
         ├─ <SearchOverlay/>             # portal-level
         ├─ <MobileNavDrawer/>           # portal-level
         └─ <Toaster/>                   # portal-level, aria-live region
```
Rule: the four portal-level overlays live in `<Layout>`, not inside pages, so they persist and never remount on navigation. Pages never render their own header/footer/toaster.

### 13.4 State ownership (which provider owns what)
| Provider | Owns | Key actions |
|---|---|---|
| `CatalogProvider` | products, category tree, search index (read-only seed) | `getProduct(id)`, `getByCategory`, `search(term)` |
| `FilterProvider` | listing filter/sort/page/view state | `setFacet`, `clearAll`, `setSort`, `setPage`; derives `results`, `facetCounts`, `histogram` |
| `CartProvider` | cart line items | `add(product, selection)`, `remove`, `updateQty`, `changeVariant`; derives `subtotal`, `advanceDue`, `balanceDue`, `count` |
| `WishlistProvider` | wishlist ids | `toggle(id)`, `moveToCart(id)` |
| `AccountProvider` | auth, profile, addresses, payments, orders, custom requests | `login`, `logout`, `placeOrder(cart)`, `submitCustomRequest`, address/payment CRUD |
| `UIProvider` | overlay open-states, toasts, active mega-menu | `openMiniCart`, `openSearch`, `pushToast`, `openMega(cat)` |

Derived values (totals, facet counts, price ranges) are computed in `lib/` pure functions and memoized in providers — never duplicated in components.

---

## 14. Page-by-Page Route Map & Navigation Flows

### 14.1 Route table
| Route | Page | Notes |
|---|---|---|
| `/` | HomePage | §8.1 |
| `/shop` | ListingPage (all) | all products, no category filter |
| `/shop/:category` | ListingPage | pre-filtered by category (e.g. `/shop/living-room`) |
| `/shop/:category/:subcategory` | ListingPage | pre-filtered by subcategory |
| `/shop?...query` | ListingPage | filters/sort/page as query params (see 14.2) |
| `/product/:id` | ProductPage | PDP configurator §8.3 |
| `/search?q=...` | ListingPage (search mode) | full results for a query |
| `/cart` | CartPage | full cart §8.4 |
| `/checkout` | CheckoutPage | single-page §8.4 |
| `/order/:orderId` | OrderConfirmation | post-purchase |
| `/custom` | CustomRequestPage | §8.5 (also opened pre-filled from PDP) |
| `/custom/submitted` | CustomRequestConfirm | |
| `/account` | AccountLayout → OrdersTab (default) | requires auth; else AuthPage |
| `/account/profile` `/addresses` `/payment` `/orders` `/orders/:id` `/custom-requests` `/wishlist` `/settings` | Account tabs | §8.6 |
| `/login` `/register` | AuthPage | in-memory auth |
| `/about` `/craftsmanship` `/shipping` `/returns` `/warranty` `/faqs` `/track` `/trade` | Static content pages | footer links; simple editorial layout, share tokens |
| `*` | NotFound | on-brand 404 → "Back to collection" |

### 14.2 Query-param model (listing)
`/shop/living-room?material=oak,walnut&colour=beige&availability=in-stock,made-to-order&price=20000-60000&rating=4&sort=price_asc&view=grid&page=2`
- multi-value facets are comma-joined; price is `min-max`; single-value for `sort`/`view`/`page`/`rating`.
- `FilterProvider` is the source of truth and serializes to/from this string so state is shareable, back/forward-safe, and deep-linkable — even when held in memory.

### 14.3 Primary navigation flows
- **Browse → buy (3-click target):** any ProductCard `Add` → `openMiniCart()` (Click 1) → drawer `Checkout` (Click 2) → CheckoutPage `Place order` (Click 3) → `/order/:id`. Returning+authed users skip address/payment entry because `AccountProvider` pre-fills.
- **Discover → configure → buy:** Header/Mega → `/shop/:category` → apply facets (URL updates) → ProductCard image/title → `/product/:id` → configure axes (live price) → `Add to cart — ₹X` → mini-cart → checkout.
- **Search:** Header search icon → `SearchOverlay` (live grouped results) → pick product (`/product/:id`) or "See all" (`/search?q=`).
- **Custom path:** PDP "Request a custom version" → `/custom` (pre-filled) → submit → `/custom/submitted` → later Account ▸ Custom Requests shows "Quote ready" → `Confirm & pay advance` → `/checkout`.
- **Wishlist:** heart on card/PDP → `WishlistProvider.toggle` → toast; Account ▸ Wishlist → "Move to cart".
- **Guest vs returning at checkout:** `/checkout` renders full field set for guests; for authed users, Address/Payment collapse to pre-filled summaries with inline "Edit" — this is what makes 3 clicks real. Post-order, guests get "Save these details?" → optional account creation.

### 14.4 Persistent shell vs per-page
Persistent (in `<Layout>`, never remount): UtilityBar, Header, MegaMenu, Footer, MiniCartDrawer, SearchOverlay, MobileNavDrawer, Toaster. Everything else is swapped by the router. Scroll position resets to top on route change except when only query params change (filter/sort/page keep scroll).

---

## 15. Build Priority & Dummy Data Plan

**Build order (each stage demoable):**
0. Scaffold per §13.2 — `index.html` font links, `styles/tokens.css` (all §1–4 tokens), Router + Providers shell, seed `data/`. Everything downstream imports from these.
1. Tokens (color/type/space) + button/link primitives + "Measured Line".
2. Header + mega menu + mobile drawer.
3. **Product card** (all states) + 70–80 dummy products.
4. Homepage (all 10 sections).
5. Listing page + full filter engine (facet counts, price histogram, chips, URL sync, sort, pagination, mobile sheet, empty state).
6. PDP configurator (independent axes, live breakdown, unavailable combos).
7. Mini-cart drawer + toast + fly-to-cart.
8. Single-page checkout (3-click flow, advance/balance).
9. Account area.
10. Custom request flow.

**Dummy data (70–80 products):** distribute ~ Living 18 · Bedroom 12 · Dining 10 · Lighting 10 · Decor 12 · Home Office 6 · Outdoor 8 · Storage 6. Each: 3–4 warm-toned royalty-free images (silo + lifestyle + detail), 2–4 axes, realistic prices, mixed order types (≈70% in-stock, 20% made-to-order, 10% customizable), a few on sale, a few sold out, ratings 3.9–5.0. One consistent styling family so the catalog reads curated.

---

*End of specification. All names, numbers, categories, and copy are placeholders reflecting the business brief — replace with real inventory, stats, and photography as available. Every visual/interaction decision above is deliberate and derived from the warm-light editorial luxury direction; build to it exactly.*
