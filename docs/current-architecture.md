# Current Architecture Audit — گرم (Gram)

**Phase:** 0 — Repository Audit  
**Date:** 2026-08-07  
**Status:** Complete  
**Homepage:** Must remain intact — no redesign

---

## 1. Executive summary

The repository currently contains a **single Next.js 15 marketing website** (public landing page only). There is **no authenticated product**, **no API**, **no database**, **no auth**, and **no monorepo**.

The landing page is production-quality visually (RTL, Vazirmatn, gold/dark design system, GSAP marketing motion). The product platform described in the master build prompt must be **built around** this homepage, reusing its design language without overwriting it.

---

## 2. Current stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js `^15.4.5` (App Router) | Turbopack via `next dev --turbopack` |
| Language | TypeScript `^5.9` | `strict: true` in tsconfig |
| UI | React `19` | Client components for interactive sections |
| Styling | Tailwind CSS `v4` (`@tailwindcss/postcss`) | Tokens via `@theme inline` + `:root` CSS vars |
| Icons | `lucide-react` | Gold line-icon style |
| Charts | `recharts` | Used in phone mockups / marketing charts |
| Motion (marketing) | `gsap` + ScrollTrigger (dynamic import) | Hero + AppShowcase |
| Motion (utility) | `motion` package present | Partially prepared; homepage uses GSAP more |
| Utils | `clsx` + `tailwind-merge` | `cn()` helper |
| Font | Vazirmatn (Google Fonts via `next/font`) | Weights 300–800, `lang="fa"` `dir="rtl"` |
| Package manager | npm | `package-lock.json` present |
| Backend | **None** | No NestJS / Prisma / Redis |
| Auth | **None** | |
| Tests | **None** | No Jest/Vitest/Playwright scripts |
| Env | **None** | No `.env` files |
| CI | **None** | |
| PWA | **None** | |
| Monorepo | **No** | Flat single-app repo |

### Scripts

```json
"dev": "next dev --turbopack",
"build": "next build",
"start": "next start",
"lint": "next lint"
```

Missing (needed for platform): `test`, `test:e2e`, `db:*`, `api:dev`, `admin:dev`, `typecheck`.

---

## 3. Repository structure (as-is)

```
Geram/
├── app/
│   ├── globals.css          # Design tokens + global utilities
│   ├── layout.tsx           # Root RTL layout + Vazirmatn + metadata
│   └── page.tsx             # Marketing homepage composition
├── components/
│   ├── home/                # Landing sections
│   ├── layout/              # Header, Footer
│   └── ui/                  # Shared marketing UI primitives
├── lib/
│   ├── data.ts              # Static Persian marketing content
│   ├── motion.ts            # Motion helpers / reduced-motion
│   └── utils.ts             # cn, formatFaNumber, formatToman
├── public/
│   ├── images/              # hero-bg.png, gold-rock.png, refs
│   ├── icons/               # empty
│   └── mockups/             # empty
├── package.json
├── next.config.ts
├── tsconfig.json            # paths: @/* → ./*
├── postcss.config.mjs
├── eslint.config.mjs
└── README.md                # Minimal landing README
```

**Not present:** `apps/`, `packages/`, `prisma/`, `docs/` (created by this audit), API, admin, auth, tests.

---

## 4. Routes (current)

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Full marketing landing |

Hash anchors used by marketing nav:

| Anchor | Section |
|---|---|
| `#home` | Hero |
| `#features` | Feature grid |
| `#price` | App showcase / price area |
| `#club` | Metrics / trust strip |
| `#guide` | Placeholder anchor in AppShowcase |
| `#about` | Footer |
| `#contact` | Footer contact |

**Authenticated routes (`/app/*`) and admin routes do not exist yet.**

---

## 5. Homepage composition

`app/page.tsx` assembles:

1. `CustomCursor` (desktop only)
2. `Header` (sticky, blur after scroll, mobile fullscreen menu)
3. `HeroSection` (full-bleed `hero-bg.png` background + left copy)
4. `FeatureGrid` (floating 5-feature panel)
5. `MetricsSection` (trust metrics)
6. `AppShowcase` (dual phone mockups + GSAP ScrollTrigger)
7. `NewsletterSection`
8. `Footer`

Global film-grain overlay is rendered from `layout.tsx`.

---

## 6. Reusable components

### Layout

| Component | Path | Reuse for product? |
|---|---|---|
| `Header` | `components/layout/Header.tsx` | Marketing only — product needs AppShell |
| `Footer` | `components/layout/Footer.tsx` | Marketing only |

### Home (marketing-only)

| Component | Path |
|---|---|
| `HeroSection` | `components/home/HeroSection.tsx` |
| `FeatureGrid` | `components/home/FeatureGrid.tsx` |
| `MetricsSection` / `TrustStrip` | `components/home/MetricsSection.tsx` |
| `AppShowcase` | `components/home/AppShowcase.tsx` |
| `NewsletterSection` | `components/home/NewsletterSection.tsx` |

### UI primitives (reusable in product with care)

| Component | Path | Product guidance |
|---|---|---|
| `GoldButton` | `components/ui/GoldButton.tsx` | Reuse as primary CTA; add `loading` / `disabled` variants |
| `GoldIcon` | `components/ui/GoldIcon.tsx` | Extend icon map |
| `SectionLabel` | `components/ui/SectionLabel.tsx` | Useful for section eyebrows |
| `PriceChart` | `components/ui/PriceChart.tsx` | Adapt for market page; keep sparse |
| `PhoneMockup` | `components/ui/PhoneMockup.tsx` | Marketing only |
| `CustomCursor` | `components/ui/CustomCursor.tsx` | Marketing only — disable in app |

### Lib

| Export | Path | Notes |
|---|---|---|
| `cn` | `lib/utils.ts` | Keep |
| `formatFaNumber` / `formatToman` | `lib/utils.ts` | **Unsafe for money** — uses JS `number`. Replace with bigint/microgram money utils in Phase 2 |
| Marketing content arrays | `lib/data.ts` | Keep for homepage; isolate from product config |
| `prefersReducedMotion`, fade helpers | `lib/motion.ts` | Keep |

### Brand / logo

Logo is an **inline SVG mark** (`LogoMark`) inside `Header` / `Footer`, plus typographic «گرم».  
No dedicated logo asset file in `public/icons` yet. Extract to a shared `BrandLogo` component for web + app + admin consistency.

---

## 7. Design tokens

Defined in `app/globals.css`.

### Colors (current)

| Token | Value | Tailwind class |
|---|---|---|
| Background | `#080B0D` | `bg-bg` |
| Secondary | `#0D1114` | `bg-bg-secondary` |
| Card | `#101417` | `bg-card` |
| Elevated | `#14191D` | `bg-card-elevated` |
| Border | `rgba(255,255,255,0.07)` | `border-border` |
| Gold | `#D6A84B` | `text-gold` / `bg-gold` |
| Gold highlight | `#F0C568` | `text-gold-highlight` |
| Gold dark | `#8A6526` | `text-gold-dark` |
| Soft gold | `#BE913D` | `text-gold-soft` |
| Text | `#F4F2ED` | `text-text` |
| Secondary text | `#AAA9A4` | `text-text-secondary` |
| Muted | `#717671` | `text-text-muted` |
| Positive | `#4CAF75` | `text-positive` |
| Negative | `#C75A5A` | `text-negative` |

Metallic gold gradient:

```css
linear-gradient(135deg, #8A6526 0%, #D6A84B 40%, #F0C568 60%, #A97A2E 100%)
```

### Product-layer token additions (recommended, Phase 1)

Align with master prompt without breaking homepage:

| Token | Suggested | Purpose |
|---|---|---|
| `--color-card-app` | `#111619` | App cards (slightly distinct from marketing) |
| `--color-elevated-app` | `#151B1F` | Elevated app surfaces |
| `--color-text-muted-app` | `#8E928D` | Calmer muted for dense UI |
| `--color-warning` | `#D49B45` | Warnings / market paused |

Homepage tokens stay untouched; app shell can consume extended tokens.

### Typography

- Font: **Vazirmatn**
- Marketing hero: ~42–68px / weight 800 / line-height ~1.45
- Section titles: ~36–50px
- Body: 15–17px
- Small: 12–14px

Product UI should use a tighter scale (14–16 body, 20–28 titles) while keeping the same family.

### Layout conventions

- Max content width: `1320px` (`.container-site`)
- Desktop padding: 48–72px
- Mobile padding: 20px
- Header height: `84px`
- Full RTL: `html[dir=rtl]`

### Motion conventions

- Marketing: GSAP timelines, ScrollTrigger scrub ~0.6, desktop parallax
- Respect `prefers-reduced-motion`
- Product: prefer `motion/react` subtle transitions; avoid cinematic GSAP on financial confirmations

---

## 8. Assets

| Asset | Path | Role |
|---|---|---|
| Hero background | `public/images/hero-bg.png` | Full-bleed hero photo (phone + gold + ring) |
| Gold rock | `public/images/gold-rock.png` | Legacy / unused in current hero composition |
| Reference screenshots | `public/images/*-ref*.png` | Design references — should not ship to production CDN long-term |

`public/icons` and `public/mockups` are empty placeholders.

---

## 9. Environment & config

- No `.env`, `.env.example`, or secrets management
- `next.config.ts` only sets image formats + `outputFileTracingRoot`
- No feature flags
- Marketing metrics in `lib/data.ts` are **hardcoded display strings** (e.g. user counts) — must not be treated as factual production claims; move to CMS/config later and mark sandbox/demo where appropriate

---

## 10. Authentication / backend / data

| Concern | Status |
|---|---|
| Auth (OTP / session) | Missing |
| KYC | Missing |
| Wallet / ledger | Missing |
| Pricing / quotes | Missing |
| Payments | Missing |
| Prisma / PostgreSQL | Missing |
| Redis / queues | Missing |
| Provider adapters | Missing |
| Admin | Missing |
| API (NestJS) | Missing |
| Tests | Missing |

---

## 11. Architectural problems & technical debt

1. **Single-app flat repo** — cannot cleanly host web + admin + API without structure migration.
2. **Money helpers use `number`** — `formatFaNumber`/`formatToman` are unsafe for financial amounts; need bigint rial + microgram gold.
3. **No design-system package** — tokens live only in `globals.css`; risk of divergence between marketing and product.
4. **Logo duplicated** as inline SVG in Header/Footer.
5. **Marketing claims hardcoded** in `lib/data.ts` (users, tons, satisfaction).
6. **No test/lint CI pipeline** beyond basic ESLint config.
7. **Film-grain + custom cursor** applied globally via layout — must be scoped to marketing routes so product pages stay calm.
8. **Watchpack EMFILE / port conflicts** observed during local development — operational friction, not product debt.
9. **No shadcn/ui installed yet** despite planned usage for product forms/tables.
10. **`motion` dependency underused** — homepage leans on GSAP; product should standardize on motion/react.

---

## 12. Recommended migration path

### Principle

Preserve `/` marketing homepage exactly. Introduce platform alongside it.

### Target monorepo (gradual)

```
apps/
  web/          # Next.js — marketing + /app product (or split later)
  admin/        # Next.js admin
  api/          # NestJS modular monolith
packages/
  ui/           # shared components (GoldButton, BrandLogo, …)
  design-system/# tokens, Tailwind preset
  types/
  validation/   # Zod schemas
  financial/    # money/gold/fee/ledger primitives
  config/
  eslint-config/
  tsconfig/
docs/           # already started
```

### Pragmatic Phase 1 approach (minimize homepage risk)

Until monorepo tooling is ready, prefer **in-place expansion** of the current Next app:

```
app/
  (marketing)/page.tsx     # move current homepage here
  (marketing)/layout.tsx   # grain, cursor, marketing chrome
  app/                     # authenticated product routes
  auth/                    # login OTP flow
  api/                     # Next route handlers as temporary BFF (optional)
```

Then extract NestJS API + admin in Phase 2–3 once financial model exists.

**Homepage move rule:** relocate files with route-group layouts; do not rewrite Hero/Feature components.

### Provider architecture (mandatory from Phase 2)

All external systems behind interfaces with **mock implementations** first:

- GoldPriceProvider, KycProvider, PaymentGatewayProvider, BankPayoutProvider
- CustodyProvider, RegulatorProvider, SmsProvider, EmailProvider
- NotificationProvider, StorageProvider, IdentityVerificationProvider, LendingProvider

### Financial core (Phase 2 gate)

Before buy/sell UI:

1. Prisma schema + PostgreSQL
2. Double-entry ledger
3. Quote engine + fee engine
4. Trade state machine
5. Unit tests for money/ledger/fees/transitions

---

## 13. Phase execution map (from master prompt)

| Phase | Focus | Depends on |
|---|---|---|
| **0** | This audit | — |
| **1** | Auth sandbox, AppShell, nav, design-system extension, PWA foundation | 0 |
| **2** | DB, wallet, ledger, pricing, quotes, fees, mock providers + tests | 1 |
| **3** | Buy / sell UX + receipts + E2E | 2 |
| **4** | Dashboard wired to backend sandbox data | 3 |
| **5** | KYC / profile / security | 1–2 |
| **6** | Saving goals + scheduled purchases | 2–3 |
| **7** | Physical delivery | 2 |
| **8** | Trust center | 2 |
| **9** | Admin RBAC platform | 2–5 |
| **10** | Reconciliation | 2, 9 |
| **11** | Hardening, a11y, docs, load | all |

---

## 14. Constraints for subsequent phases

1. **Do not redesign or overwrite the existing homepage.**
2. Scope marketing-only effects (`film-grain`, `CustomCursor`) to marketing layout.
3. Reuse brand tokens; product UI = premium + calm + financial (not cinematic).
4. DEMO / SANDBOX mode only — label simulated trust/reserve data.
5. Never embed provider logic in UI components.
6. Never use JS float for money/gold.
7. Every balance mutation must go through double-entry ledger.
8. Persian UX language: professional, no fake urgency / guaranteed profit.

---

## 15. Immediate next step

Proceed to **Phase 1 — Application Foundation**:

- Route groups: marketing vs app
- Sandbox OTP auth UI
- App shell (desktop right nav + mobile bottom nav)
- Shared `BrandLogo` + extended design tokens
- User context stub
- PWA manifest foundation
- Ensure `/` homepage still builds and renders unchanged functionally

---

*End of Phase 0 audit.*
