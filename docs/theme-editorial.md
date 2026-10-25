# Editorial Theme — Handover

On 2026-10-25 the owner asked for the whole site to take the look of https://orionix.framer.website/, and later the same day pasted that page's source and asked for the landing page to be reverse-engineered and rebuilt the same way for BITSOL. This document records what that look is, how it is wired into the codebase, what changed, and how it was verified. It supersedes the seven-scene homepage described in `homepage-handover.md`.

## The system

| Role | Value |
|---|---|
| Page background ("paper") | `#f9f8f6` |
| Ink (text, primary buttons, dark panels) | `#141414` |
| Secondary text | `#656565`; tertiary `#a4a4a4` |
| Accent (label-pill dots, stat suffixes, nav dot, hover) | `--brand-accent`, `#0066ff`. The reference uses pure red here; the owner's blue was kept. Changing it is one line in `globals.css`. |
| Cards | white, 1px `rgba(0,0,0,0.06)` border, 28px radius, soft shadow on hover; images sit in a white 6px frame |
| Buttons | pill, 40px; ink with white text, or hairline outline; white on dark panels |
| Display type (h1–h3 and `.font-heading` on the public site) | Fraunces, weight ~370, `"opsz" 72, "SOFT" 100, "WONK" 1` (the reference's settings), letter-spacing −0.025em (h1 −0.035em) |
| Text | Inter |
| Labels, dates, small data | Geist Mono, 11px, uppercase, 0.08em tracking (`Eyebrow` pill with the accent dot) |
| Page column | `wrap`: 1440px max, 24px gutters on phones, 72px from the tablet breakpoint |
| Mode | light only; the theme is forced light and the toggles are gone |

## Where it lives

- `src/app/globals.css`
  - `@theme`: the old brand names (`brand-cyan`, `brand-purple`, …) and the whole `slate` scale are remapped to the editorial palette; `--animate-marquee`, `--animate-marquee-reverse` and `--animate-coin` loops (all switched off under `prefers-reduced-motion`).
  - `@utility wrap`, `rule-dotted`, `rule-dotted-dark` (the pricing cards' dotted rules).
  - `@theme inline`: the three font stacks. They must stay `inline`: next/font sets `--font-inter` etc. on `<body>`, and a plain `@theme` evaluates the stack on `:root`, where those variables do not exist, so the whole stack falls back to the browser serif.
  - `:root`: `--nav-height: 96px`, `--brand-accent`, and the shadcn tokens. Note `--accent` is shadcn's (a background colour); the dot colour deliberately has its own name.
  - `.site-editorial :is(h1, h2, h3, .font-heading)`: serif display type. Unlayered on purpose so it wins over `font-bold`; it therefore also wins over `font-sans`, so sans text inside those slots (the FAQ questions) is a `span`, not a heading.
- `src/app/layout.tsx`: Fraunces with `axes: ["opsz", "SOFT", "WONK"]`, Inter, Geist Mono (and Montserrat for the logo); `ThemeProvider` has `forcedTheme="light"`.
- `src/app/(site)/layout.tsx`: adds `site-editorial`; navbar, footer, smooth scroll, floating widgets.
- `src/components/navbar/Navbar.tsx`, `navbar.css`: transparent over the hero frame, paper + hairline once scrolled; 96px tall on laptops (72px scrolled); an accent dot under the current section's link and on hover; ink "Book a call" pill.
- `src/components/Footer.tsx`: the reference's closing frame on every page: dark rounded panel with the "Goal → Growth" CTA and the glass spheres, a mono row of social links, the "bitsol" wordmark set huge in a grey gradient, then a slim bar with the copyright and the site links (company + legal). The four link columns of the previous footer are gone; `ClosingCta.tsx` is no longer rendered anywhere.
- `src/components/home/editorial.tsx`: `Eyebrow`, `Tag` (`light` | `muted` | `dark`), `SectionHeading`.

## Homepage, section for section

`src/app/(site)/page.tsx` keeps its metadata, canonical, JSON-LD (WebPage + FAQPage) and data fetching (blog posts now include `image`), and renders, in the reference's order:

| # | Reference | BITSOL component | Notes |
|---|---|---|---|
| 1 | Hero: rounded frame, "We make / Creative Things." with a highlight band, editor-toolbar chip, iridescent 3D coins both sides, GMT clock / tagline / email | `EditorialHero` + `HeroCoins` + `HeroClock` + `CopyEmail` | Coins are CSS (conic holographic sweep on 3D-rotated circles, dark glass core, rim behind): no asset, no WebGL. The tagline sits under the chip rather than in the bottom bar because the site's floating dock covers the bottom centre. On phones the discs run in a band under the text. Email copies to the clipboard with a mailto fallback. |
| 2 | "Our clients": heading left, three drifting rows of grey logos | `Partners` | Row one is the owner's four partner claims (Meta, Microsoft, AUDI Pakistan, Shahnawaz Motors, each with its claim line); rows two and three name platforms the services run on. Text wordmarks with small glyphs, no third-party logo files. The grid tracks are `minmax(0, …)` so the `w-max` marquee cannot size the column. |
| 3 | "Watch our reel": giant sliding serif band, centred video with a mirrored reflection | `ReelSection` (server) + `ReelMedia` + `GlassSpheres` | Drop the showreel at `public/videos/reel.mp4` (optional `reel-poster.jpg`) and it plays muted on loop, click to pause, with the band reading "Watch our reel". Until then the panel shows the glass spheres and the band reads "Strategy · Creative · Growth". |
| 4 | "Featured work": heading + ink button, six portrait cards in two stepped columns | `PortfolioPreview` + `ParallaxImage` | First six of `lib/portfolio.ts`; 4:5 frames (the reference is 3:4, the sources are landscape); per-card width/offset presets; tags = category + two tech. Images drift ±7% on scroll. |
| 5 | Services: pinned stage, dial of numbers on the left turning as you scroll, service blocks sliding through the centre (next one blurred below), clay object on the right | `ServicesGrid` + `Sculpture` | All eight services, 70vh of scroll each; `framer-motion` `useScroll` drives the dial rotation, block offsets/blur and sculpture crossfade. The dial shows from `xl`; the pinned stage from `lg`; below that a plain numbered list. Sculptures are eight CSS "clay" compositions. |
| 6 | "How we work": heading left, three columns with round icon chips | `ProcessSteps` | Same three steps as before, with small gradient glyphs in white chips. |
| 7 | Pricing: icon + plan name, copy, dotted rule, five benefits with line icons, dotted rule, price, full-width "Inquire for …" button; featured plan inverted | `PricingPreview` | The three plans from `lib/pricing.ts`; the popular one is the dark card. Buttons go to `/contact?plan=<name>`. |
| 8 | "Client voices": centred heading, three dark portrait cards fanned out, faint lines at the edges; then three rolling stats with a red suffix | `Testimonials` + `StatsRow` | CMS testimonials (title + quote); a round monogram stands in for the portrait, no roles or names are invented. Stats count up on first view; the suffix takes the accent. |
| 9 | "Insights": heading + white "View all" pill; cards with date, serif title, copy, grey tag, thumbnail | `BlogPreview` | Uses the post's `image`; a slug-keyed duotone wash with the tag initial stands in when there is none. Hidden when the database is unreachable (the `/api/blog` fallback returns 500 locally). |
| 10 | — | "Why BITSOL" | Kept for its keyword content; restyled to the card system with the city links. |
| 11 | FAQ: heading left, numbered rows with a round chevron | inline in `page.tsx` | Serif numbers in tertiary, sans questions, `details`/`summary`. |
| 12 | Dark CTA + socials + wordmark + copyright | `Footer` | On every page. |

## Verification on 2026-10-25 (rebuild)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint` on every file added or rewritten | exit 0 |
| `npm test` | 13 files, 133 tests passed |
| `npm run build` | exit 0 (compiled in 26s, 66 static pages; the only warning is the pre-existing Cache-Control notice) |
| Puppeteer, 1440×900, `/`: hero, partners, reel, works, pinned services stage at five scroll positions, process, pricing, testimonials, stats, Why BITSOL, FAQ, footer | all render as designed; `document.documentElement.scrollWidth` = 1440 (no horizontal overflow); console clean apart from the report-only CSP notes for Google ad frames and the `/api/blog` 500 (local MySQL down) |
| Puppeteer, 390×844, `/`: hero, partners, services list, process, pricing, FAQ, footer | no horizontal overflow; dock and chat widget overlap the hero's bottom bar at the very bottom of the first screen (site chrome, pre-existing) |
| Blog cards | seen with the three latest real posts once local MySQL was started (date, serif title, excerpt, tag chip, thumbnail); `/blog` returns 200 |
| Lighthouse / Core Web Vitals | not measured; no score is claimed |

Full-page puppeteer captures of this page are unreliable: the pinned stage uses `vh`, and the capture's tall emulated viewport stretches it and reflows the page. Use viewport captures at scroll positions.

## Known issues and follow-ups

- No showreel video exists yet; the reel slot shows the spheres until one is added at `public/videos/reel.mp4`.
- The testimonial cards show monograms; if the CMS gains a photo field, `Testimonials.tsx` has the slot for it.
- The footer no longer lists the service pages (the reference has no link columns). They remain linked from the navbar's hub link, the homepage services section and the mega menu. Add a row back if internal linking for the service pages drops.
- `ContactPopup` opens on scroll depth (pre-existing) and sits over whatever is on screen; the floating dock covers bottom-centre content on every section.
- The OG image (`src/app/opengraph-image.tsx`) and the email templates still use the old cyan/purple; they are separate assets and were left alone.
- `SplineSceneBasic.tsx`, `hero/Hero.tsx`, `Hero3D.tsx`, `HeroObject.tsx`, `ImmersiveHomepage.tsx`, `ClosingCta.tsx`, `ui/splite.tsx`, `ui/spline-scene.tsx`, `ui/entropy.tsx`, `ui/theme-toggle.tsx`, `ui/footer-theme-toggle.tsx`, `ui/morphing-card-stack.tsx` are unused by the site. Removing them and the `@splinetool/*` packages needs the owner's approval.
- `dark:` classes across the site are dead under the forced light theme; harmless.
- The stats ("150+", "25+", "98%") and the partner claims are the owner's existing content and were not verified here.
- Dev-only: the `public, max-age=31536000, immutable` Cache-Control rules in `next.config.mjs` apply only when `NODE_ENV === "production"`. Browsers that stored dev chunks under the old header kept executing them even after hard reloads (dynamic chunks such as `FloatingDock` are fetched after the page load, outside the reload's cache bypass), which showed as "module factory is not available" for the removed `Moon` import and as hydration mismatches on edited class names. `next.config.mjs` now sets a `deploymentId` of `dev-<timestamp>` on every dev-server start, which appends `?dpl=<id>` to every asset URL, so those stale entries are never requested again. Production sets no id and is unchanged.

## Rollback

Nothing is committed. The working tree also holds unrelated, uncommitted social-module changes, so do not `git checkout .`. To undo only the theme, restore these paths: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/(site)/layout.tsx`, `src/app/(site)/page.tsx`, `src/components/{Footer,FloatingDock}.tsx`, `src/components/navbar/{Navbar.tsx,navbar.css}`, `src/components/ui/{button,glowing-card,Logo}.tsx`, `src/components/home/*`, `src/lib/{services,pricing}.ts`, plus the remapped files listed by `git diff --stat`, and delete the new files under `src/components/home/` (`HeroCoins`, `CopyEmail`, `GlassSpheres`, `ReelMedia`, `ReelSection`, `ParallaxImage`, `Sculpture`) and `docs/theme-editorial.md`.
