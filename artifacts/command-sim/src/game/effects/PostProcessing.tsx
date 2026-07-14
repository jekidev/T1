import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useGraphicsStore } from "@/state/useGraphicsStore";

export function PostProcessing() {
  const settings = useGraphicsStore((state) => state.preset.postProcessing);
  if (!settings.enabled) return null;

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {settings.bloom ? (
        <Bloom intensity={0.22} luminanceThreshold={1.1} luminanceSmoothing={0.35} mipmapBlur />
      ) : null}
      {settings.vignette ? <Vignette offset={0.22} darkness={0.28} eskil={false} /> : null}
    </EffectComposer>
  );
}
