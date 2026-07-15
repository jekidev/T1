import {
  createDefaultEnvironment,
  type BoardEntity,
  type BoardState,
  type EntityProfile,
} from "./types";

export function normalizeBoardPresentation(board: BoardState): BoardState {
  const defaultEnvironment = createDefaultEnvironment();
  const mapMode = board.world?.mapProvider === "google"
    ? "google"
    : board.world?.mapProvider === "openstreetmap"
      ? "openstreetmap"
      : defaultEnvironment.mapMode;

  return {
    ...board,
    version: Math.max(7, board.version || 0),
    environment: {
      ...defaultEnvironment,
      ...(board.world ? {
        sceneName: `${board.world.city} scene`,
        mapMode,
      } : {}),
      ...board.environment,
    },
    entities: board.entities.map(entity => normalizePersonEntity(entity)),
  };
}

function normalizePersonEntity(entity: BoardEntity): BoardEntity {
  if (entity.category !== "unit" && entity.category !== "civilian") return entity;
  const existing = entity.profile;
  const profile: EntityProfile = {
    personality: existing?.personality ?? "Personality develops through game events and player interaction.",
    biography: existing?.biography ?? entity.notes ?? "",
    traits: existing?.traits ?? [],
    source: existing?.source ?? "generated",
    username: existing?.username ?? `@${slug(entity.label)}`,
    role: existing?.role ?? inferRole(entity),
    status: existing?.status ?? "unknown",
    lastSeen: existing?.lastSeen ?? "No activity recorded",
    experience: existing?.experience ?? inferExperience(entity),
    walletMinor: Math.max(0, existing?.walletMinor ?? 0),
    maximumRecordedWalletMinor: Math.max(
      existing?.maximumRecordedWalletMinor ?? 0,
      existing?.walletMinor ?? 0,
    ),
    accent: existing?.accent ?? factionAccent(entity.faction),
    ...(existing?.avatarAssetId ? { avatarAssetId: existing.avatarAssetId } : {}),
    ...(existing?.avatarUrl ? { avatarUrl: existing.avatarUrl } : {}),
  };
  return { ...entity, profile };
}

function inferRole(entity: BoardEntity): string {
  const firstLine = entity.notes.split("\n").map(value => value.trim()).find(Boolean);
  if (firstLine && firstLine.length <= 80 && !firstLine.toLowerCase().startsWith("goal:")) return firstLine;
  if (entity.category === "civilian") return "Civilian";
  if (entity.faction === "police") return "Blue Team unit";
  if (entity.faction === "criminal") return "Syndicate unit";
  return "Independent unit";
}

function inferExperience(entity: BoardEntity): string[] {
  const goal = entity.notes.split("\n").find(line => line.trim().toLowerCase().startsWith("goal:"));
  return goal ? [goal.replace(/^goal:\s*/i, "").trim()].filter(Boolean) : [];
}

function factionAccent(faction: BoardEntity["faction"]): string {
  if (faction === "police") return "#4f8cff";
  if (faction === "criminal") return "#ff5c6c";
  return "#f4b860";
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "unit";
}
