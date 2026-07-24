import { Sky, Stars } from "@react-three/drei";
import { useMemo } from "react";
import { useGraphicsStore } from "@/state/useGraphicsStore";

interface EnvironmentLightingProps {
  timeOfDay?: number;
  fog?: boolean;
}

export function EnvironmentLighting({ timeOfDay = 14, fog = true }: EnvironmentLightingProps) {
  const preset = useGraphicsStore((state) => state.preset);
  const sun = useMemo<[number, number, number]>(() => {
    const angle = ((timeOfDay - 6) / 24) * Math.PI * 2;
    return [Math.cos(angle) * 80, Math.max(-10, Math.sin(angle) * 70), 30];
  }, [timeOfDay]);
  const daylight = Math.max(0.08, Math.min(1, sun[1] / 50));

  return (
    <>
      <color attach="background" args={[daylight > 0.15 ? "#8fb7d8" : "#07111f"]} />
      {fog && <fog attach="fog" args={[daylight > 0.15 ? "#9db6c8" : "#07111f", 40, preset.drawDistance]} />}
      <ambientLight intensity={0.18 + daylight * 0.22} />
      <hemisphereLight args={["#dbefff", "#30352f", 0.25 + daylight * 0.5]} />
      <directionalLight
        castShadow={preset.shadowMapSize > 0}
        position={sun}
        intensity={0.5 + daylight * 2.2}
        color={daylight > 0.3 ? "#fff2da" : "#7aa2dd"}
        shadow-mapSize-width={Math.max(512, preset.shadowMapSize)}
        shadow-mapSize-height={Math.max(512, preset.shadowMapSize)}
        shadow-camera-far={preset.shadowDistance || 80}
      />
      <Sky distance={450000} sunPosition={sun} inclination={0.5} azimuth={0.25} />
      {daylight < 0.25 && <Stars radius={120} depth={60} count={preset.quality === "potato" ? 300 : 1800} factor={3} saturation={0} fade speed={0.2} />}
    </>
  );
}
