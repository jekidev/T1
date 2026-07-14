import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  GRAPHICS_PRESETS,
  detectGraphicsCapabilities,
  recommendGraphicsQuality,
  type GraphicsCapabilities,
  type GraphicsPreset,
  type GraphicsQuality,
  type PostProcessingSettings,
} from "@/config/graphics";

interface GraphicsState {
  quality: GraphicsQuality;
  preset: GraphicsPreset;
  capabilities: GraphicsCapabilities | null;
  autoQuality: boolean;
  averageFps: number | null;
  initialize: () => void;
  setQuality: (quality: GraphicsQuality) => void;
  setAutoQuality: (enabled: boolean) => void;
  setAverageFps: (fps: number) => void;
  setPostProcessing: (patch: Partial<PostProcessingSettings>) => void;
}

export const useGraphicsStore = create<GraphicsState>()(
  persist(
    (set, get) => ({
      quality: "medium",
      preset: GRAPHICS_PRESETS.medium,
      capabilities: null,
      autoQuality: true,
      averageFps: null,
      initialize: () => {
        const capabilities = detectGraphicsCapabilities();
        const quality = get().autoQuality ? recommendGraphicsQuality(capabilities) : get().quality;
        set({ capabilities, quality, preset: GRAPHICS_PRESETS[quality] });
      },
      setQuality: (quality) => set({ quality, preset: GRAPHICS_PRESETS[quality], autoQuality: false }),
      setAutoQuality: (enabled) => {
        if (!enabled) return set({ autoQuality: false });
        const capabilities = get().capabilities ?? detectGraphicsCapabilities();
        const quality = recommendGraphicsQuality(capabilities);
        set({ autoQuality: true, capabilities, quality, preset: GRAPHICS_PRESETS[quality] });
      },
      setAverageFps: (fps) => {
        const state = get();
        if (!state.autoQuality) return set({ averageFps: fps });
        let quality = state.quality;
        if (fps < 24) quality = quality === "ultra" ? "high" : quality === "high" ? "medium" : quality === "medium" ? "low" : "potato";
        if (fps > 57 && state.capabilities && !state.capabilities.mobile) quality = quality === "potato" ? "low" : quality === "low" ? "medium" : quality;
        set({ averageFps: fps, quality, preset: GRAPHICS_PRESETS[quality] });
      },
      setPostProcessing: (patch) => set((state) => ({
        preset: {
          ...state.preset,
          postProcessing: { ...state.preset.postProcessing, ...patch },
        },
      })),
    }),
    {
      name: "operation-kobenhavn:graphics-v1",
      partialize: (state) => ({ quality: state.quality, preset: state.preset, autoQuality: state.autoQuality }),
    },
  ),
);
