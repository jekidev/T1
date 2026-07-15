import {
  createDefaultEnvironment,
  type BoardEntity,
  type BoardState,
  type EntityProfile,
  type PersonPresenceStatus,
} from "./types";

export function boardNeedsPresentationMigration(board: BoardState): boolean {
  if ((board.version || 0) < 7) return true;
  if (!board.environment) return true;
  const environment = board.environment;
  if (
    !environment.sceneName.trim()
    || !environment.weather
    || !environment.season
    || !/^\d{2}:\d{2}$/.test(environment.localTime)
    || !environment.mapMode
    || !Number.isFinite(environment.temperatureC)
  ) {
    return true;
  }
  return board.entities.some(entity => {
    if (entity.category !== "unit" && entity.category !== "civilian") return false;
    const profile = entity.profile;
    return !profile
      || !profile.username?.trim()
      || !profile.role?.trim()
      || !profile.status
      || !profile.lastSeen?.trim()
      || !Array.isArray(profile.experience)
      || profile.walletMinor === undefined
      || profile.maximumRecordedWalletMinor === undefined
      || !isAccent(profile.accent);
  });
}

export function normalizeBoardPresentation(board: BoardState): BoardState {
  const defaults = createDefaultEnvironment();
  const preferredMapMode = board.world?.mapProvider === "google"
    ? "google"
    : board.world?.mapProvider === "openstreetmap"
      ? "openstreetmap"
      : defaults.mapMode;
  const environment = board.environment;

  return {
    ...board,
    version: Math.max(7, board.version || 0),
    environment: {
      sceneName: environment?.sceneName?.trim() || (board.world ? `${board.world.city} scene` : defaults.sceneName),
      weather: environment?.weather ?? defaults.weather,
      season: environment?.season ?? defaults.season,
      localTime: environment?.localTime && /^\d{2}:\d{2}$/.test(environment.localTime)
        ? environment.localTime
        : defaults.localTime,
      temperatureC: Number.isFinite(environment?.temperatureC)
        ? Math.max(-60, Math.min(60, environment!.temperatureC))
        : defaults.temperatureC,
      mapMode: environment?.mapMode ?? preferredMapMode,
    },
    entities: board.entities.map(entity => normalizePersonEntity(entity)),
  };
}

function normalizePersonEntity(entity: BoardEntity): BoardEntity {
  if (entity.category !== "unit" && entity.category !== "civilian") return entity;
  const existing = entity.profile;
  const existingAccent = existing?.accent;
  const walletMinor = Math.max(0, finiteNumber(existing?.walletMinor));
  const profile: EntityProfile = {
    personality: existing?.personality ?? "Personality develops through game events and player interaction.",
    biography: existing?.biography ?? entity.notes ?? "",
    traits: Array.isArray(existing?.traits) ? existing.traits : [],
    source: existing?.source ?? "generated",
    username: existing?.username?.trim() || `@${slug(entity.label)}`,
    role: existing?.role?.trim() || inferRole(entity),
    status: validStatus(existing?.status),
    lastSeen: existing?.lastSeen?.trim() || "No activity recorded",
    experience: Array.isArray(existing?.experience) ? existing.experience : inferExperience(entity),
    walletMinor,
    maximumRecordedWalletMinor: Math.max(
      finiteNumber(existing?.maximumRecordedWalletMinor),
      walletMinor,
    ),
    accent: isAccent(existingAccent) ? existingAccent : factionAccent(entity.faction),
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

function validStatus(value: PersonPresenceStatus | undefined): PersonPresenceStatus {
  return value === "online" || value === "busy" || value === "offline" || value === "unknown"
    ? value
    : "unknown";
}

function isAccent(value: string | undefined): value is string {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}

function finiteNumber(value: number | undefined): number {
  return Number.isFinite(value) ? value! : 0;
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
