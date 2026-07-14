export type GraphicsQuality = "potato" | "low" | "medium" | "high" | "ultra";

export interface PostProcessingSettings {
  enabled: boolean;
  bloom: boolean;
  depthOfField: boolean;
  vignette: boolean;
  chromaticAberration: boolean;
  noise: boolean;
}

export interface GraphicsPreset {
  quality: GraphicsQuality;
  maxDpr: number;
  shadowMapSize: number;
  shadowDistance: number;
  maxLights: number;
  textureScale: number;
  particleBudget: number;
  grassDensity: number;
  reflectionQuality: number;
  drawDistance: number;
  lodMultiplier: number;
  antialias: boolean;
  environmentDetail: number;
  postProcessing: PostProcessingSettings;
}

export const GRAPHICS_PRESETS: Record<GraphicsQuality, GraphicsPreset> = {
  potato: {
    quality: "potato", maxDpr: 0.8, shadowMapSize: 0, shadowDistance: 0, maxLights: 1,
    textureScale: 0.25, particleBudget: 100, grassDensity: 0, reflectionQuality: 0,
    drawDistance: 120, lodMultiplier: 0.5, antialias: false, environmentDetail: 0.2,
    postProcessing: { enabled: false, bloom: false, depthOfField: false, vignette: false, chromaticAberration: false, noise: false },
  },
  low: {
    quality: "low", maxDpr: 1, shadowMapSize: 512, shadowDistance: 60, maxLights: 2,
    textureScale: 0.5, particleBudget: 350, grassDensity: 0.15, reflectionQuality: 0,
    drawDistance: 220, lodMultiplier: 0.75, antialias: false, environmentDetail: 0.4,
    postProcessing: { enabled: false, bloom: false, depthOfField: false, vignette: false, chromaticAberration: false, noise: false },
  },
  medium: {
    quality: "medium", maxDpr: 1.5, shadowMapSize: 1024, shadowDistance: 120, maxLights: 4,
    textureScale: 0.75, particleBudget: 900, grassDensity: 0.4, reflectionQuality: 0.35,
    drawDistance: 400, lodMultiplier: 1, antialias: true, environmentDetail: 0.65,
    postProcessing: { enabled: true, bloom: true, depthOfField: false, vignette: true, chromaticAberration: false, noise: false },
  },
  high: {
    quality: "high", maxDpr: 2, shadowMapSize: 2048, shadowDistance: 220, maxLights: 8,
    textureScale: 1, particleBudget: 2200, grassDensity: 0.75, reflectionQuality: 0.7,
    drawDistance: 700, lodMultiplier: 1.35, antialias: true, environmentDetail: 0.9,
    postProcessing: { enabled: true, bloom: true, depthOfField: false, vignette: true, chromaticAberration: false, noise: false },
  },
  ultra: {
    quality: "ultra", maxDpr: 2.5, shadowMapSize: 4096, shadowDistance: 350, maxLights: 12,
    textureScale: 1, particleBudget: 5000, grassDensity: 1, reflectionQuality: 1,
    drawDistance: 1200, lodMultiplier: 1.75, antialias: true, environmentDetail: 1,
    postProcessing: { enabled: true, bloom: true, depthOfField: true, vignette: true, chromaticAberration: false, noise: false },
  },
};

export interface GraphicsCapabilities {
  webgl2: boolean;
  webgpu: boolean;
  mobile: boolean;
  deviceMemoryGb?: number;
  logicalCores?: number;
  maxTextureSize?: number;
}

export function detectGraphicsCapabilities(): GraphicsCapabilities {
  if (typeof window === "undefined") return { webgl2: false, webgpu: false, mobile: false };
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number; gpu?: unknown };
  return {
    webgl2: Boolean(gl),
    webgpu: Boolean(navigatorWithMemory.gpu),
    mobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
    deviceMemoryGb: navigatorWithMemory.deviceMemory,
    logicalCores: navigator.hardwareConcurrency,
    maxTextureSize: gl?.getParameter(gl.MAX_TEXTURE_SIZE) as number | undefined,
  };
}

export function recommendGraphicsQuality(capabilities: GraphicsCapabilities): GraphicsQuality {
  if (!capabilities.webgl2) return "potato";
  if (capabilities.mobile) {
    if ((capabilities.deviceMemoryGb ?? 4) <= 3 || (capabilities.logicalCores ?? 4) <= 4) return "potato";
    return "low";
  }
  if ((capabilities.deviceMemoryGb ?? 8) >= 12 && (capabilities.logicalCores ?? 8) >= 12 && capabilities.webgpu) return "ultra";
  if ((capabilities.deviceMemoryGb ?? 8) >= 8 && (capabilities.logicalCores ?? 8) >= 8) return "high";
  return "medium";
}
