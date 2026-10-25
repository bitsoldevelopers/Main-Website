import { describe, expect, it } from "vitest";
import { HOMEPAGE_SCENES, SCENE_NODE_COUNT, sceneIndexForProgress } from "../homepage-scenes";
import { layoutPosition, nodePositionAt } from "@/components/3d/SceneCanvas";

describe("homepage scenes config", () => {
  it("has seven scenes that tile 0–1 without gaps or overlap", () => {
    expect(HOMEPAGE_SCENES).toHaveLength(7);
    expect(HOMEPAGE_SCENES[0].start).toBe(0);
    expect(HOMEPAGE_SCENES[HOMEPAGE_SCENES.length - 1].end).toBe(1);
    for (let i = 1; i < HOMEPAGE_SCENES.length; i++) {
      expect(HOMEPAGE_SCENES[i].start).toBe(HOMEPAGE_SCENES[i - 1].end);
    }
  });

  it("uses only routes that exist in the app, or WhatsApp click-to-chat", () => {
    const known = new Set(["/contact", "/services", "/portfolio", "/pricing", "/about"]);
    for (const scene of HOMEPAGE_SCENES) {
      for (const cta of scene.ctas ?? []) {
        const ok = known.has(cta.href) || cta.href.startsWith("https://wa.me/");
        expect(ok, `${scene.id}: ${cta.href}`).toBe(true);
      }
    }
  });

  it("maps progress to the containing scene", () => {
    expect(sceneIndexForProgress(0)).toBe(0);
    expect(sceneIndexForProgress(0.139)).toBe(0);
    expect(sceneIndexForProgress(0.14)).toBe(1);
    expect(sceneIndexForProgress(0.5)).toBe(3);
    expect(sceneIndexForProgress(0.89)).toBe(6);
    expect(sceneIndexForProgress(1)).toBe(6);
    expect(sceneIndexForProgress(-1)).toBe(0);
    expect(sceneIndexForProgress(2)).toBe(6);
  });
});

describe("scene layouts", () => {
  const layouts = ["cluster", "scatter", "ring", "funnel", "grid"] as const;

  it("returns finite positions for every layout and node", () => {
    for (const layout of layouts) {
      for (let i = 0; i < SCENE_NODE_COUNT; i++) {
        const p = layoutPosition(layout, i, SCENE_NODE_COUNT);
        expect(p).toHaveLength(3);
        for (const v of p) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it("is deterministic", () => {
    expect(layoutPosition("scatter", 3, SCENE_NODE_COUNT)).toEqual(layoutPosition("scatter", 3, SCENE_NODE_COUNT));
  });

  it("holds the scene layout early in a scene and reaches the next layout at its end", () => {
    const scene = HOMEPAGE_SCENES[1];
    const next = HOMEPAGE_SCENES[2];
    const early = nodePositionAt(scene.start + 0.001, 2, SCENE_NODE_COUNT);
    expect(early).toEqual(layoutPosition(scene.layout, 2, SCENE_NODE_COUNT));

    const atEnd = nodePositionAt(scene.end - 1e-9, 2, SCENE_NODE_COUNT);
    const target = layoutPosition(next.layout, 2, SCENE_NODE_COUNT);
    for (let k = 0; k < 3; k++) expect(atEnd[k]).toBeCloseTo(target[k], 4);
  });

  it("does not blend past the last scene", () => {
    const last = HOMEPAGE_SCENES[HOMEPAGE_SCENES.length - 1];
    expect(nodePositionAt(1, 0, SCENE_NODE_COUNT)).toEqual(layoutPosition(last.layout, 0, SCENE_NODE_COUNT));
  });
});
