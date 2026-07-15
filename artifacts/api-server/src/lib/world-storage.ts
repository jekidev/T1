import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PlacedWorldAssetSchema, applyPlacementVersion, type PlacedWorldAsset } from "@workspace/geo-world";
import type { ImportedWorldRegion } from "./overpass-client";

interface StoredWorldRegion extends ImportedWorldRegion {
  savedAt: string;
}

interface PlacementRecord {
  regionId: string;
  asset: PlacedWorldAsset;
}

export class WorldStorage {
  private readonly root: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(root = process.env.WORLD_STORAGE_ROOT ?? path.resolve(process.cwd(), "data/world")) {
    this.root = root;
  }

  async initialize(): Promise<void> {
    await Promise.all([
      mkdir(this.regionsDirectory(), { recursive: true }),
      mkdir(this.root, { recursive: true }),
    ]);
  }

  async saveRegion(region: ImportedWorldRegion): Promise<StoredWorldRegion> {
    await this.initialize();
    const stored: StoredWorldRegion = { ...structuredClone(region), savedAt: new Date().toISOString() };
    await atomicWriteJson(this.regionPath(region.id), stored);
    return stored;
  }

  async getRegion(id: string): Promise<StoredWorldRegion> {
    await this.initialize();
    return JSON.parse(await readFile(this.regionPath(id), "utf8")) as StoredWorldRegion;
  }

  async listRegions(limit = 100): Promise<StoredWorldRegion[]> {
    await this.initialize();
    const files = (await readdir(this.regionsDirectory())).filter(file => file.endsWith(".json"));
    const regions: StoredWorldRegion[] = [];
    for (const file of files.slice(0, Math.max(1, Math.min(limit, 500)))) {
      try {
        regions.push(JSON.parse(await readFile(path.join(this.regionsDirectory(), file), "utf8")) as StoredWorldRegion);
      } catch {
        // Corrupt region records are skipped and can be diagnosed from storage directly.
      }
    }
    return regions.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async listPlacements(regionId?: string): Promise<PlacementRecord[]> {
    const records = await this.readPlacements();
    return records
      .filter(record => !regionId || record.regionId === regionId)
      .sort((a, b) => a.asset.id.localeCompare(b.asset.id));
  }

  async upsertPlacement(regionId: string, nextInput: unknown): Promise<PlacementRecord> {
    const next = PlacedWorldAssetSchema.parse(nextInput);
    let result: PlacementRecord | undefined;
    await this.serializeWrite(async () => {
      const records = await this.readPlacements();
      const index = records.findIndex(record => record.regionId === regionId && record.asset.id === next.id);
      const current = index >= 0 ? records[index]!.asset : undefined;
      const asset = applyPlacementVersion(current, next);
      result = { regionId, asset };
      if (index >= 0) records[index] = result;
      else records.push(result);
      await atomicWriteJson(this.placementsPath(), records);
    });
    if (!result) throw new Error("Placement write did not complete.");
    return result;
  }

  async deletePlacement(regionId: string, assetId: string, expectedVersion: number): Promise<boolean> {
    let deleted = false;
    await this.serializeWrite(async () => {
      const records = await this.readPlacements();
      const record = records.find(item => item.regionId === regionId && item.asset.id === assetId);
      if (!record) return;
      if (record.asset.version !== expectedVersion) {
        throw new Error(`Placement version conflict: expected current version ${record.asset.version}.`);
      }
      const next = records.filter(item => !(item.regionId === regionId && item.asset.id === assetId));
      await atomicWriteJson(this.placementsPath(), next);
      deleted = true;
    });
    return deleted;
  }

  async clearRegion(id: string): Promise<void> {
    await this.serializeWrite(async () => {
      await rm(this.regionPath(id), { force: true });
      const placements = (await this.readPlacements()).filter(record => record.regionId !== id);
      await atomicWriteJson(this.placementsPath(), placements);
    });
  }

  private async readPlacements(): Promise<PlacementRecord[]> {
    await this.initialize();
    try {
      const parsed = JSON.parse(await readFile(this.placementsPath(), "utf8")) as unknown;
      if (!Array.isArray(parsed)) return [];
      const records: PlacementRecord[] = [];
      for (const value of parsed) {
        if (!value || typeof value !== "object") continue;
        const candidate = value as { regionId?: unknown; asset?: unknown };
        if (typeof candidate.regionId !== "string") continue;
        const asset = PlacedWorldAssetSchema.safeParse(candidate.asset);
        if (asset.success) records.push({ regionId: candidate.regionId, asset: asset.data });
      }
      return records;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async serializeWrite(operation: () => Promise<void>): Promise<void> {
    const previous = this.writeChain;
    let release: (() => void) | undefined;
    this.writeChain = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      await operation();
    } finally {
      release?.();
    }
  }

  private regionsDirectory(): string { return path.join(this.root, "regions"); }
  private placementsPath(): string { return path.join(this.root, "placements.json"); }
  private regionPath(id: string): string { return path.join(this.regionsDirectory(), `${safeSegment(id)}.json`); }
}

export const worldStorage = new WorldStorage();

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
    await rename(temporary, filePath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function safeSegment(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180);
  if (!safe || safe === "." || safe === "..") throw new Error("Invalid world storage identifier.");
  return safe;
}
