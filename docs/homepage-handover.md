# Homepage Upgrade — Handover

> Superseded later on 2026-10-25: the owner chose the editorial theme described in `theme-editorial.md`, and the homepage now follows that layout. The seven-scene stage below is no longer rendered but stays in the tree; to bring it back, render `<ImmersiveHomepage />` in `src/app/(site)/page.tsx` in place of the hero and sections that replaced it.

Seven-scene, scroll-driven 3D homepage built on 2026-10-25. Companion documents: `homepage-upgrade-audit.md` (what was found) and `homepage-technical-decisions.md` (why it was built this way).

## Files

Added:
- `src/config/homepage-scenes.ts` — the seven scenes: copy, scroll ranges, CTAs, 3D layout kind, assistive description. Edit this to change what the homepage says.
- `src/components/home/ImmersiveHomepage.tsx` — client component. Decides the layout after mount, tracks scroll progress, renders the scene copy, mounts the canvas.
- `src/components/3d/SceneCanvas.tsx` — React Three Fiber canvas. Pure layout maths (`layoutPosition`, `nodePositionAt`) plus the procedural placeholder visuals.
- `src/config/__tests__/homepage-scenes.test.ts` — unit tests for the config and layout maths.
- `docs/homepage-upgrade-audit.md`, `docs/homepage-technical-decisions.md`, `docs/homepage-handover.md`.

Modified:
- `src/app/(site)/page.tsx` — two lines: imports `ImmersiveHomepage` instead of `Hero` and renders it in the hero slot. Everything below (Partners, Services, Testimonials, Portfolio, Blog, Why BITSOL, FAQ, final CTA), the metadata and the JSON-LD are unchanged.

Now unused by the homepage but left in place (removal needs owner approval): `src/components/hero/Hero.tsx`, `src/components/hero/Hero3D.tsx`, `src/components/home/SplineSceneBasic.tsx`, `src/components/ui/splite.tsx`, `src/components/ui/spline-scene.tsx`. The `@splinetool/*` packages are still installed because of these files.

No dependencies were added. No database, API, auth, admin, lead, email or WhatsApp code was changed.

## How it works

1. `page.tsx` (server component) renders `<ImmersiveHomepage />`. The server HTML contains all seven scenes' copy, one `<h1>` (scene 1) and six `<h2>`s, so search engines and non-WebGL browsers get the full content.
2. After mount, `ImmersiveHomepage` checks `(min-width: 1024px)`, `(prefers-reduced-motion: reduce)` and WebGL availability. Only if all pass does it switch to the **sticky stage**: a 700vh-tall wrapper with a `position: sticky` full-height viewport inside. Otherwise it stays as the **static stack**: the seven scenes one after another, no canvas.
3. In the sticky stage, scroll progress (0–1 across the wrapper) is written to a ref on each scroll frame. Only the active scene index is React state, so the render loop never re-renders React. Inactive scenes fade out and get the `inert` attribute, so keyboard users cannot tab into hidden links.
4. `SceneCanvas` is loaded with `next/dynamic({ ssr: false })` and reads the progress ref every frame. Each scene has a layout (`cluster`, `scatter`, `ring`, `funnel`, `grid`); nodes blend into the next scene's layout during the last 45% of each scene. Rendering pauses (`frameloop="never"`) while the stage is off-screen. DPR is capped at 1.5.
5. CTA clicks push `{ event: "homepage_cta_click", cta_id }` to `window.dataLayer`, which GTM/GA4 already consume. No personal data is sent.

## Replacing the placeholder 3D visuals

There are no approved GLB models in the repo yet, so the scene uses procedural spheres around a glass icosahedron. To use real assets:

1. Put the model in `public/models/<name>.glb` (compress with gltf-transform or Draco first).
2. In `SceneCanvas.tsx`, replace the `<mesh>` in `Constellation` with a component that calls `useGLTF("/models/<name>.glb")` from `@react-three/drei` and renders `<primitive object={scene.clone()} />`. Keep the `ref` and the `position.set(...)` in `useFrame`, since the layouts and blending are independent of what each node looks like.
3. To give a scene its own model, add an `asset` field to `HomeScene` in `homepage-scenes.ts` and switch on it inside `Constellation`.
4. Preload with `useGLTF.preload(...)` at module level so the model is ready before the scene is reached.

Layout positions are pure functions (`layoutPosition`) and have unit tests, so new layouts can be added without touching rendering code.

## Verification run on 2026-10-25

| Check | Command | Result |
|---|---|---|
| Type-check | `npx tsc --noEmit` | exit 0 |
| Lint (changed files) | `npx eslint src/components/home/ImmersiveHomepage.tsx src/components/3d/SceneCanvas.tsx src/config "src/app/(site)/page.tsx"` | exit 0 |
| Unit tests | `npm test` | 13 files, 133 tests passed (126 existing, 7 new) |
| Production build | `npm run build` | exit 0, full route table printed |
| Browser (Puppeteer, 1440×900) | scratch script against `npm run dev` | canvas mounts (`three.js r184`), one `<h1>`, stage 7×viewport, correct scene visible at 36%, 50%, 70% and 100% scroll, all hidden scenes `inert`, 6 CTAs resolve to `/contact`, `/services`, `/portfolio` or `wa.me`, 0 console errors |
| Browser, reduced motion | same, `prefers-reduced-motion: reduce` | static stack, 7 scenes visible, no 3D stage |
| Browser, mobile (390×844) | same | static stack, 7 headings, no 3D stage, `scrollWidth == innerWidth` (no horizontal overflow) |

Pre-existing console noise filtered in the browser run: report-only CSP notices from the AdSense frames in `layout.tsx`, and `/api/blog` returning 500 because the local MySQL was not running. Neither comes from this change.

Not measured: Lighthouse / Core Web Vitals. No performance score is claimed. The design choices that matter for CWV are: canvas is desktop-only and dynamically imported, the hero copy and CTAs are in the server HTML, the stage has a fixed height so there is no layout shift when the canvas mounts, and DPR is capped.

## Known issues and open items

- **Evidence scene (06)** uses a capabilities framing with a link to `/portfolio`. No verified testimonials, case-study metrics or client logos were found in the repo. The owner should supply approved proof before adding any numbers.
- **Unverified stats elsewhere on the homepage** ("150+ Successful Projects", "98% Satisfied Clients", "25+ AI Experts", "2M+ Lines of Code") were already on the page before this work and are out of scope, but the brief's no-fabrication rule applies to them too.
- **Scroll length**: the sticky stage is seven viewports tall on desktop. That is the price of a scene per scroll step. If it feels long, reduce `STAGE_HEIGHT_VH` in `ImmersiveHomepage.tsx` (the scenes keep their relative ranges).
- **Old hero files** remain in the tree, see "Files" above.
- The IDE suggests the Tailwind canonical form `top-(--nav-height)` for `top-[var(--nav-height)]`. The bracket form was kept to match the rest of the codebase; both compile.
- The uncommitted social-module changes on this branch (`feat/lead-automation`) are unrelated to this work and were not touched.

## Running locally

```
npm install            # also runs prisma generate
npm run dev            # http://localhost:3000, Turbopack
```
The homepage renders without a database (blog, FAQ and testimonials fall back), so Laragon MySQL is optional for viewing the scenes.

## Deployment and rollback

- Deploy path is unchanged: merge to `main`, GitHub Actions builds with `build:hostinger` and uploads to Hostinger. No migrations are involved. The server starts from `server.js` as before.
- Rollback is a one-file change: in `src/app/(site)/page.tsx`, import `Hero` from `@/components/hero/Hero` and render `<Hero />` in place of `<ImmersiveHomepage />`. Or revert the commit once this work is committed.
- Nothing in this change requires new environment variables.
