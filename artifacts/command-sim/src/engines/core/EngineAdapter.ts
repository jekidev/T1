export type EngineId = "three" | "babylon" | "playcanvas" | "galacean";

export interface EngineCapabilities {
  webgl2: boolean;
  webgpu: boolean;
  physics: boolean;
  xr: boolean;
  postProcessing: boolean;
  compressedTextures: boolean;
  offscreenCanvas: boolean;
}

export interface EngineAdapter {
  readonly id: EngineId;
  readonly capabilities: EngineCapabilities;
  initialize(container: HTMLElement): Promise<void>;
  loadScene(sceneId: string): Promise<void>;
  pause(): void;
  resume(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export interface EngineAdapterFactory {
  readonly id: EngineId;
  load(): Promise<EngineAdapter>;
}
