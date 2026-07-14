import { AdaptiveDpr, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { Suspense, useEffect } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import { EnvironmentLighting } from "@/game/environment/EnvironmentLighting";
import { Player3D } from "@/game/entities/Player3D";
import { PostProcessing } from "@/game/effects/PostProcessing";
import { PhysicsWorld } from "@/game/physics/PhysicsWorld";
import { useGraphicsStore } from "@/state/useGraphicsStore";

interface PrimaryGameSceneProps {
  debugPhysics?: boolean;
}

function Ground() {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[250, 250, 1, 1]} />
        <meshStandardMaterial color="#485546" roughness={0.9} metalness={0} />
      </mesh>
    </RigidBody>
  );
}

function SceneContent({ debugPhysics = false }: PrimaryGameSceneProps) {
  const setAverageFps = useGraphicsStore((state) => state.setAverageFps);

  return (
    <>
      <PerformanceMonitor
        flipflops={3}
        onIncline={() => setAverageFps(60)}
        onDecline={() => setAverageFps(22)}
      />
      <AdaptiveDpr pixelated />
      <EnvironmentLighting timeOfDay={14} />
      <PhysicsWorld debug={debugPhysics}>
        <Ground />
        <Player3D />
        <RigidBody type="fixed" position={[4, 1, -3]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="#63788a" roughness={0.65} metalness={0.1} />
          </mesh>
        </RigidBody>
      </PhysicsWorld>
      <OrbitControls makeDefault target={[0, 1, 0]} maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={35} />
      <PostProcessing />
    </>
  );
}

export function PrimaryGameScene({ debugPhysics = false }: PrimaryGameSceneProps) {
  const initialize = useGraphicsStore((state) => state.initialize);
  const preset = useGraphicsStore((state) => state.preset);
  const capabilities = useGraphicsStore((state) => state.capabilities);

  useEffect(() => initialize(), [initialize]);

  if (capabilities && !capabilities.webgl2) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="max-w-md rounded-lg border bg-card p-6">
          <h2 className="font-semibold">3D runtime unavailable</h2>
          <p className="mt-2 text-sm text-muted-foreground">This browser does not expose WebGL2. The existing tactical board remains available.</p>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      shadows={preset.shadowMapSize > 0}
      dpr={[0.65, preset.maxDpr]}
      camera={{ position: [8, 7, 12], fov: 55, near: 0.1, far: preset.drawDistance }}
      gl={{ antialias: preset.antialias, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
      }}
    >
      <Suspense fallback={null}>
        <SceneContent debugPhysics={debugPhysics} />
      </Suspense>
    </Canvas>
  );
}
