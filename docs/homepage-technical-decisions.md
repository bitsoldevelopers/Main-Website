# Homepage Upgrade — Technical Decisions

## Decision: React Three Fiber (already installed) for the seven scenes

**Chosen:** `@react-three/fiber` + `@react-three/drei` + `three`, all already in `package.json`.

**Why:**
- The repo already depends on these packages, so adding a renderer is not needed. The brief asks to avoid unnecessary dependencies.
- A single R3F canvas can be driven by one scroll progress value (0–1). Camera and node layouts are computed per frame from that value with no React state updates in the render loop.
- Scene content is React, so the text and the 3D layouts can share a single config file (`src/config/homepage-scenes.ts`).

**Rejected:**
- **Spline (current hero):** authored scenes are harder to keep in sync with scroll, add a large runtime, and the brief wants replaceable assets. It stays in the repo for now, but is no longer on the homepage.
- **Raw Three.js:** more boilerplate for the same result with no benefit here.
- **CSS-only:** cannot deliver the abstract 3D objects the brief asks for.

## Decision: no GSAP ScrollTrigger

Scroll progress is read from `window.scrollY` against the height of a tall section, and clamped to 0–1. This works with native scrolling and with Lenis. ScrollTrigger would add a second animation system alongside Lenis and framer-motion, which the brief warns against.

## Decision: layout chosen after mount

The server and the first client render produce the static stacked layout. The sticky 3D layout is enabled in an effect, only on `(min-width: 1024px)` and when `prefers-reduced-motion` is not set. This avoids hydration mismatches and keeps all copy and the single `<h1>` in the server HTML for SEO.

## Decision: the canvas is client-only and lazy

`SceneCanvas` is loaded with `next/dynamic({ ssr: false })`, so the R3F code is split out of the homepage's initial JavaScript. The canvas is mounted only when the immersive layout is active and WebGL is available. It pauses (`frameloop="never"`) when its container is off-screen.

## Decision: placeholder visuals behind a layout registry

No approved 3D model exists in the repo. Each scene maps to a procedural layout kind (`cluster`, `scatter`, `ring`, `funnel`, `grid`) in `src/config/homepage-scenes.ts`. To use an approved model later, replace the node mesh in `SceneCanvas` with a GLTF loaded through drei `useGLTF`, keeping the same scene config.

## Decision: honest Evidence scene

The Evidence scene (Scene 06) describes capabilities and the measurement approach. It does not show client names, logos, testimonials, percentages, or ROAS figures, since none were verified in the repo.

## Decision: analytics through the existing dataLayer

CTA clicks push `{ event: "homepage_cta_click", cta_id }` to `window.dataLayer`, the same channel GTM and GA4 already use. No form data or personal information is sent.

## Not done in this change

- No database, API, auth, admin, or lead-workflow changes.
- No new dependencies.
- No deletion of the old Hero or Spline files.
