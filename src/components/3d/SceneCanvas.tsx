"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, type MutableRefObject } from "react";
import type { Group, Mesh } from "three";
import { HOMEPAGE_SCENES, SCENE_NODE_COUNT, sceneIndexForProgress, type SceneLayout } from "@/config/homepage-scenes";

type Vec3 = [number, number, number];

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Target position for node `i` of `n` in a given layout. Pure, so it is easy to test. */
export function layoutPosition(layout: SceneLayout, i: number, n: number): Vec3 {
  switch (layout) {
    case "cluster": {
      // Fibonacci sphere: an even, compact ball of nodes around the core.
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = GOLDEN_ANGLE * i;
      return [Math.cos(theta) * r * 1.2, y * 1.2, Math.sin(theta) * r * 1.2];
    }
    case "scatter":
      // Fixed, deterministic scatter so the layout is the same on every render.
      return [Math.sin(i * 2.1) * 2.6, Math.cos(i * 1.7) * 1.8, Math.sin(i * 3.3 + 1) * 1.2];
    case "ring": {
      const angle = (i / n) * Math.PI * 2;
      return [Math.cos(angle) * 2.2, Math.sin(angle) * 2.2, 0];
    }
    case "funnel": {
      // Inputs spread on the left and converge into the core on the right.
      const f = i / (n - 1);
      const side = i % 2 === 0 ? 1 : -1;
      return [-2.8 + f * 3, (1 - f) * side * 1.3, 0];
    }
    case "grid": {
      const col = i % 4;
      const row = Math.floor(i / 4);
      return [(col - 1.5) * 1.2, (row - 0.5) * 1.2, 0];
    }
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Position of node `i` at a 0–1 scroll progress, blending into the next scene near its end. */
export function nodePositionAt(progress: number, i: number, n: number): Vec3 {
  const k = sceneIndexForProgress(progress);
  const scene = HOMEPAGE_SCENES[k];
  const current = layoutPosition(scene.layout, i, n);
  const next = HOMEPAGE_SCENES[k + 1];
  if (!next) return current;

  const t = (progress - scene.start) / (scene.end - scene.start);
  const blend = smoothstep(0.55, 1, t);
  const target = layoutPosition(next.layout, i, n);
  return [
    current[0] + (target[0] - current[0]) * blend,
    current[1] + (target[1] - current[1]) * blend,
    current[2] + (target[2] - current[2]) * blend,
  ];
}

export type ScenePalette = "brand" | "mono";

function Constellation({
  progressRef,
  palette,
  spreadX,
  nodeScale,
}: {
  progressRef: MutableRefObject<number>;
  palette: ScenePalette;
  spreadX: number;
  nodeScale: number;
}) {
  const mono = palette === "mono";
  const coreRadius = 0.9 * (1 + (nodeScale - 1) * 0.5);
  const groupRef = useRef<Group>(null);
  const nodeRefs = useRef<(Mesh | null)[]>([]);
  const coreRef = useRef<Mesh>(null);

  useFrame((state) => {
    const p = progressRef.current;
    const elapsed = state.clock.getElapsedTime();
    if (groupRef.current) {
      // Layouts are designed in the screen plane, so the group only sways; a full turn would show them edge-on.
      groupRef.current.rotation.y = Math.sin(p * Math.PI * 2) * 0.3 + Math.sin(elapsed * 0.4) * 0.08;
      groupRef.current.rotation.x = Math.sin(p * Math.PI * 2) * 0.1;
    }
    for (let i = 0; i < SCENE_NODE_COUNT; i++) {
      const mesh = nodeRefs.current[i];
      if (!mesh) continue;
      const [x, y, z] = nodePositionAt(p, i, SCENE_NODE_COUNT);
      mesh.position.set(x * spreadX, y, z);
    }
    if (coreRef.current) {
      // The core is symmetric, so it can turn freely.
      coreRef.current.rotation.y = elapsed * 0.15;
      coreRef.current.rotation.x = elapsed * 0.1;
      const pulse = 1 + Math.sin(elapsed * 1.5) * 0.03;
      coreRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[coreRadius, 1]} />
        {mono ? (
          <meshPhysicalMaterial color="#ffffff" roughness={0.2} metalness={0} transparent opacity={0.72} />
        ) : (
          <meshPhysicalMaterial color="#E0F2FE" roughness={0.15} metalness={0} transparent opacity={0.55} emissive="#22D3EE" emissiveIntensity={0.15} />
        )}
      </mesh>
      {Array.from({ length: SCENE_NODE_COUNT }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.2 * nodeScale, 24, 24]} />
          {mono ? (
            <meshStandardMaterial color={i % 3 === 0 ? "#141414" : "#ffffff"} roughness={0.35} metalness={0.05} />
          ) : (
            <meshStandardMaterial color={i % 2 === 0 ? "#06B6D4" : "#2563EB"} roughness={0.25} metalness={0.1} />
          )}
        </mesh>
      ))}
    </group>
  );
}

export interface SceneCanvasProps {
  /** Scroll progress 0–1, written by the parent on scroll. Read every frame without re-rendering. */
  progressRef: MutableRefObject<number>;
  /** When true, rendering stops (used when the canvas is off-screen). */
  paused: boolean;
  /** `brand` is the cyan/blue scheme; `mono` is ink and paper for the editorial theme. */
  palette?: ScenePalette;
  /** Horizontal stretch of the layouts, for wide, short canvases such as the hero band. */
  spreadX?: number;
  /** Multiplier on node size (the core grows by half as much). */
  nodeScale?: number;
}

export default function SceneCanvas({
  progressRef,
  paused,
  palette = "brand",
  spreadX = 1,
  nodeScale = 1,
}: SceneCanvasProps) {
  return (
    <Canvas
      aria-hidden="true"
      frameloop={paused ? "never" : "always"}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 7.5], fov: 45 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <Constellation progressRef={progressRef} palette={palette} spreadX={spreadX} nodeScale={nodeScale} />
    </Canvas>
  );
}
