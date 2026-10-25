# Homepage Upgrade — Repository Audit

Audit date: 2026-10-25. Branch at audit time: `feat/lead-automation`, with uncommitted social-module work that is left untouched.

## Application architecture

- Framework: Next.js 16.3.6 (App Router), React 19.2.4, TypeScript 5. Dev uses Turbopack, build uses webpack (`npm run build`).
- Package manager: npm (`package-lock.json`). `postinstall` runs `prisma generate`.
- Styling: Tailwind CSS 4 with tokens in `src/app/globals.css`. Brand colours include `--color-brand-cyan: #00D9FF`. Light is the default theme and `dark:` variants are used.
- Conventions: server components by default; `"use client"` islands for interactivity. UI primitives in `src/components/ui/`. Homepage sections in `src/components/home/`. Hero lives in `src/components/hero/`.
- Scripts: `dev`, `build`, `build:hostinger`, `start` (runs `prisma migrate deploy` then `server.js`), `lint` (eslint), `test` (vitest), `test:integration`.

## Existing 3D and motion dependencies (already installed)

| Package | Version | Status |
|---|---|---|
| `three` | ^0.184.0 | installed |
| `@react-three/fiber` | ^9.6.1 | installed |
| `@react-three/drei` | ^10.7.7 | installed |
| `@splinetool/react-spline`, `@splinetool/runtime` | ^4.1.0 / ^1.12.92 | installed, used by the current hero |
| `gsap` | ^3.15.0 | installed, used only by `components/ui/entropy.tsx` |
| `lenis` | ^1.3.23 | installed, used by `components/SmoothScroll.tsx` |
| `framer-motion` | ^12.38.0 | installed, used widely |
| `lottie-react` | ^2.4.1 | installed |

## Current homepage

`src/app/(site)/page.tsx` renders, in order:

1. `Hero` → `hero/Hero.tsx` → `home/SplineSceneBasic.tsx`. Headline "Grow Your Business with BITSOL Marketing" (the page's only `<h1>`), a Spline scene loaded on idle and skipped below 1024px, and CTAs to `/contact` and `/pricing`.
2. `Partners`, `ServicesGrid`, an about CTA card, `Testimonials` (CMS-backed), `PortfolioPreview`, `BlogPreview` (DB-backed, 3 latest posts), a "Why BITSOL" SEO section, a CMS-backed FAQ with FAQPage JSON-LD, and a final CTA.

`src/components/hero/Hero3D.tsx` is an orphaned R3F sample that nothing imports.

## Business systems the upgrade must not break

- **Database:** Prisma with MySQL (`src/lib/prisma.ts`). The homepage reads `prisma.blog` and CMS tables through `src/lib/cms.ts`. Schema and migrations are not touched by this work.
- **Contact and leads:** `POST /api/contact` (`src/app/api/contact/route.ts`) validates input, applies a honeypot and a 5-per-minute per-IP rate limit, writes a lead row, and sends email through Resend. The `/contact` page hosts `ContactClient` and `ContactForm`, which posts to `/api/contact`. The homepage CTAs point to `/contact`.
- **Admin and auth:** `src/lib/admin/*` (session, RBAC, password), `/admin/*` routes, and the admin layout. No changes planned.
- **Lead automation:** `src/lib/automation/*`, `/api/automation/cron`, and webhooks. No changes planned.
- **WhatsApp:** click-to-chat links to `https://wa.me/923120141581` are used in `ServicesClient`, `PricingClient` and `CareersClient`. The same number and link format are reused. No tokens or Cloud API calls are involved on the client.
- **Analytics:** GTM (`GTM-KMPSR8SX`) and GA4 (`G-J473YSMZKE`) are loaded lazily in `src/app/layout.tsx`. The existing convention is `window.dataLayer.push`. No other event helper exists in the codebase.
- **SEO:** homepage metadata, canonical, OpenGraph and JSON-LD in `page.tsx`. Preserved as-is.

## Environment and deployment

- Hostinger deployment via GitHub Actions (`.github/workflows/deploy.yml`), with `build:hostinger` and `prepare-hostinger.mjs`. The app starts from `server.js`.
- Public assets in `public/`, including `public/logo.svg`. The logo component is `src/components/ui/Logo.tsx`.
- No WebGL-specific restrictions were found. Browser-only 3D code must still be isolated with `next/dynamic` (`ssr: false`).
- Secrets were not printed during this audit.

## Gaps against the brief

- No approved GLB/GLTF model exists in the repo. Scene visuals will be procedural placeholders behind a replaceable asset/layout registry.
- No verified case studies, client testimonials with provenance, or measured outcome metrics were found for the Evidence scene. That scene will use an honest capabilities framing.
- Existing homepage stats ("150+ Successful Projects", "98% Satisfied Clients", etc.) are unverified. They are outside this task's scope, but should be reviewed by the owner.
- No Playwright/puppeteer visual or Core Web Vitals baseline was captured before the change.

## Affected files (planned)

- Replace: `src/app/(site)/page.tsx` (swap `Hero` for the new immersive section).
- Add: `src/config/homepage-scenes.ts`, `src/components/3d/SceneCanvas.tsx`, `src/components/home/ImmersiveHomepage.tsx`, and the two docs.
- Left in place, now unused by the homepage: `hero/Hero.tsx`, `hero/Hero3D.tsx`, `home/SplineSceneBasic.tsx`, `ui/splite.tsx`, `ui/spline-scene.tsx`. Removal needs owner approval.

## Risks

- Sticky, scroll-driven layout can conflict with the existing Lenis smooth scroller. Lenis is in `SmoothScroll.tsx`, so the sticky section must be verified with it active.
- WebGL cost on mid-range mobile. Mitigated by desktop-only canvas, DPR cap, pausing when off-screen, and a static fallback.
- Hydration: the server must render the same markup as the first client render. Layout mode is therefore decided after mount.
