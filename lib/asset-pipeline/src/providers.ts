import type { AssetGenerator } from "./types";

export type AssetProviderRuntime = "gpu-worker" | "blender-worker" | "offline-desktop" | "browser-worker";
export type AssetProviderCapability =
  | "image_to_mesh"
  | "mesh_texturing"
  | "fast_preview"
  | "parametric_human"
  | "face_reconstruction"
  | "clothed_human_reconstruction"
  | "video_mocap"
  | "realtime_tracking";

export interface AssetProviderDescriptor {
  id: AssetGenerator;
  repository: string;
  runtime: AssetProviderRuntime;
  capabilities: readonly AssetProviderCapability[];
  defaultEnabled: boolean;
  productionRole: "primary" | "fallback" | "specialized" | "experimental";
  requiresGpu: boolean;
  notes: string;
}

export const ASSET_PROVIDER_CATALOG: readonly AssetProviderDescriptor[] = [
  {
    id: "hunyuan3d-2",
    repository: "Tencent-Hunyuan/Hunyuan3D-2",
    runtime: "gpu-worker",
    capabilities: ["image_to_mesh", "mesh_texturing"],
    defaultEnabled: true,
    productionRole: "primary",
    requiresGpu: true,
    notes: "Primary high-quality image-to-3D generator. Output must pass Blender optimization and glTF validation.",
  },
  {
    id: "instantmesh",
    repository: "TencentARC/InstantMesh",
    runtime: "gpu-worker",
    capabilities: ["image_to_mesh", "fast_preview"],
    defaultEnabled: true,
    productionRole: "fallback",
    requiresGpu: true,
    notes: "Fast preview and fallback image-to-mesh path.",
  },
  {
    id: "triposr",
    repository: "Stability-AI/TripoSR",
    runtime: "gpu-worker",
    capabilities: ["image_to_mesh", "fast_preview"],
    defaultEnabled: true,
    productionRole: "fallback",
    requiresGpu: true,
    notes: "Fast single-image reconstruction fallback.",
  },
  {
    id: "flashvdm",
    repository: "Tencent/FlashVDM",
    runtime: "gpu-worker",
    capabilities: ["image_to_mesh", "fast_preview"],
    defaultEnabled: false,
    productionRole: "experimental",
    requiresGpu: true,
    notes: "Experimental accelerated reconstruction path, disabled until benchmarked against project assets.",
  },
  {
    id: "mpfb2",
    repository: "makehumancommunity/mpfb2",
    runtime: "blender-worker",
    capabilities: ["parametric_human"],
    defaultEnabled: true,
    productionRole: "primary",
    requiresGpu: false,
    notes: "Primary reproducible human generator through Blender headless presets and the project skeleton.",
  },
  {
    id: "makehuman",
    repository: "makehumancommunity/makehuman",
    runtime: "offline-desktop",
    capabilities: ["parametric_human"],
    defaultEnabled: true,
    productionRole: "fallback",
    requiresGpu: false,
    notes: "Fallback parametric human source and preset authoring tool.",
  },
  {
    id: "deca",
    repository: "yfeng95/DECA",
    runtime: "gpu-worker",
    capabilities: ["face_reconstruction"],
    defaultEnabled: false,
    productionRole: "specialized",
    requiresGpu: true,
    notes: "Leader-face reconstruction only; output must be retopologized and adapted to the common skeleton.",
  },
  {
    id: "econ",
    repository: "YuliangXiu/ECON",
    runtime: "gpu-worker",
    capabilities: ["clothed_human_reconstruction"],
    defaultEnabled: false,
    productionRole: "specialized",
    requiresGpu: true,
    notes: "Special characters only; never imported directly without retopology, rigging, weights and animation validation.",
  },
  {
    id: "freemocap",
    repository: "freemocap/freemocap",
    runtime: "offline-desktop",
    capabilities: ["video_mocap"],
    defaultEnabled: true,
    productionRole: "primary",
    requiresGpu: false,
    notes: "Offline video-to-motion source followed by smoothing, foot correction and retargeting.",
  },
  {
    id: "mediapipe",
    repository: "google-ai-edge/mediapipe",
    runtime: "browser-worker",
    capabilities: ["realtime_tracking"],
    defaultEnabled: true,
    productionRole: "primary",
    requiresGpu: false,
    notes: "Realtime pose, face and hand tracking adapter. Tracking data is not an authoritative character mesh.",
  },
] as const;

export function getAssetProvider(id: AssetGenerator): AssetProviderDescriptor {
  const provider = ASSET_PROVIDER_CATALOG.find(entry => entry.id === id);
  if (!provider) throw new Error(`Unknown asset provider: ${id}`);
  return provider;
}

export function selectAvailableGenerator(
  preferences: readonly AssetGenerator[],
  available: ReadonlySet<AssetGenerator>,
): AssetGenerator | undefined {
  return preferences.find(generator => available.has(generator));
}
