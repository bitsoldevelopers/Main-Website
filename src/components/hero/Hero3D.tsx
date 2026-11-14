"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere, MeshDistortMaterial, Points, PointMaterial } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

function AnimatedSphere() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    meshRef.current.rotation.x = Math.cos(time / 4);
    meshRef.current.rotation.y = Math.sin(time / 2);
  });

  return (
    <Float speed={4} rotationIntensity={1} floatIntensity={2}>
      <Sphere
        args={[1, 100, 200]}
        scale={2.4}
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <MeshDistortMaterial
          color={hovered ? "#141414" : "#0066ff"}
          attach="material"
          distort={0.5}
          speed={2}
          roughness={0}
        />
      </Sphere>
    </Float>
  );
}

/**
 * `count` points scattered through a 10-unit cube. A seeded generator keeps
 * rendering pure: the cloud is the same on every render instead of being
 * rebuilt (and jumping) each time the component renders.
 */
function scatterPoints(count: number): Float32Array {
  let seed = 0x2f6b9d3;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < positions.length; i++) positions[i] = (random() - 0.5) * 10;
  return positions;
}

function Particles({ count = 5000 }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const particlesPosition = useMemo(() => scatterPoints(count), [count]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    pointsRef.current.rotation.y = time * 0.05;
  });

  return (
    <Points ref={pointsRef} positions={particlesPosition} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#0066ff"
        size={0.02}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

export default function Hero3D() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[-10, -10, -5]} color="#141414" intensity={2} />
        <AnimatedSphere />
        <Particles />
      </Canvas>
    </div>
  );
}
