import {
  DEFAULT_ATTRIBUTES,
  type BoardState,
  type EntityCategory,
  type Faction,
  type TimelineEventSeverity,
} from "@/lib/game";
import {
  buildLlmWorkspaceContext,
  type LlmWorkspaceMode,
  type UserWorkspaceState,
} from "@/lib/workspace";

export interface AdvisorBuildProposal {
  notesAppend?: string;
  playerProfile?: {
    name?: string;
    biography?: string;
    personality?: string;
    traits?: string[];
    avatarUrl?: string;
    avatarAssetId?: string;
  };
  phases?: Array<{ name: string; description: string }>;
  timelineEvents?: Array<{
    label: string;
    description: string;
    severity?: TimelineEventSeverity;
  }>;
  entities?: Array<{
    label: string;
    category: EntityCategory;
    faction: Faction;
    notes?: string;
  }>;
}

export function buildAdvisorWorkspacePrompt(input: {
  profileContext: string;
  workspace: UserWorkspaceState;
  mode: LlmWorkspaceMode;
  networkContext: string;
  request: string;
}): string {
  return [
    input.profileContext,
    buildLlmWorkspaceContext({ ...input.workspace, chatMode: input.mode }),
    input.networkContext,
    `Current collaboration mode: ${input.mode.toUpperCase()}.`,
    "Current user request:",
    input.request,
  ].join("\n\n");
}

export function createStorylineWorkflowPrompts(input: {
  scenarioName: string;
  scenarioDescription: string;
  moralSpectrum: number;
  currentStoryline?: string;
}): Array<{ mode: LlmWorkspaceMode; title: string; prompt: string }> {
  const common = [
    `Scenario: ${input.scenarioName}.`,
    `Scenario description: ${input.scenarioDescription || "Not specified."}`,
    `Selected fictional moral stance: ${input.moralSpectrum}/100.`,
    `Current storyline: ${input.currentStoryline || "No storyline has been generated yet."}`,
    "Keep all existing board, RAG and DeepSeek content intact. Build additively.",
  ].join("\n");

  return [
    {
      mode: "talk",
      title: "Create Storyline · Talk",
      prompt: `${common}\n\nCollaborate as Story Director. Identify the player fantasy, central conflict, factions, emotional tone, geographic anchors, important unknowns and the first meaningful choice. Ask only the most important unresolved questions, then provide a concise discovery summary. Do not mutate state.`,
    },
    {
      mode: "plan",
      title: "Create Storyline · Plan",
      prompt: `${common}\n\nCreate a structured five-act storyline plan. Include phase objectives, dependencies, missions, factions, NPC roles, assets, shops, skills, map anchors, consequences, validation checks and acceptance criteria. Clearly mark assumptions. Do not claim that state changed.`,
    },
    {
      mode: "build",
      title: "Create Storyline · Build",
      prompt: `${common}\n\nConvert the approved storyline direction into an additive board build proposal. Include human-readable implementation notes and exactly one fenced JSON object compatible with the BUILD MODE schema. Add only the minimum coherent phases, events and entities needed for the first playable storyline slice. Do not delete or overwrite existing content.`,
    },
  ];
}

export function extractAdvisorBuildProposal(text: string): AdvisorBuildProposal | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (!fenced) return null;
  try {
    const parsed = JSON.parse(fenced) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return sanitizeProposal(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function applyAdvisorBuildProposal(board: BoardState, proposal: AdvisorBuildProposal): BoardState {
  const createdAt = new Date().toISOString();
  const baseOrder = board.phases.reduce((maximum, phase) => Math.max(maximum, phase.order), -1) + 1;
  const newPhases = (proposal.phases ?? []).slice(0, 20).map((phase, index) => ({
    id: `phase-ai-${crypto.randomUUID()}`,
    name: phase.name.slice(0, 160),
    description: phase.description.slice(0, 4000),
    order: baseOrder + index,
  }));
  const phaseId = board.currentPhaseId ?? newPhases[0]?.id ?? null;
  const newEvents = (proposal.timelineEvents ?? []).slice(0, 50).map(event => ({
    id: `event-ai-${crypto.randomUUID()}`,
    phaseId,
    label: event.label.slice(0, 160),
    description: event.description.slice(0, 4000),
    severity: event.severity ?? "info",
    createdAt,
    sourceStatus: "fictional" as const,
  }));
  const newEntities = (proposal.entities ?? []).slice(0, 100).map((entity, index) => {
    const x = 420 + (index % 5) * 55;
    const y = 420 + Math.floor(index / 5) * 55;
    return {
      id: `entity-ai-${crypto.randomUUID()}`,
      templateId: templateForCategory(entity.category),
      category: entity.category,
      faction: entity.faction,
      label: entity.label.slice(0, 160),
      x,
      y,
      rotation: 0,
      scale: 1,
      zIndex: board.entities.length + index,
      layerId: board.layers[0]?.id ?? "layer-default",
      zoneId: null,
      groupId: null,
      locked: false,
      attributes: { ...DEFAULT_ATTRIBUTES },
      notes: (entity.notes ?? "AI storyline build proposal").slice(0, 4000),
      sourceStatus: "fictional" as const,
    };
  });

  const playerEntityId = board.playerWorkspace?.bossEntityId;
  const playerProfile = proposal.playerProfile;
  const entities = board.entities.map(entity => {
    if (!playerProfile || !playerEntityId || entity.id !== playerEntityId) return entity;
    return {
      ...entity,
      label: playerProfile.name?.trim() ? playerProfile.name.trim().slice(0, 160) : entity.label,
      profile: {
        personality: playerProfile.personality?.trim().slice(0, 2000) || entity.profile?.personality || "",
        biography: playerProfile.biography?.trim().slice(0, 4000) || entity.profile?.biography || "",
        traits: playerProfile.traits?.filter(Boolean).slice(0, 30) ?? entity.profile?.traits ?? [],
        source: "generated" as const,
        ...(playerProfile.avatarUrl?.startsWith("https://") ? { avatarUrl: playerProfile.avatarUrl } : entity.profile?.avatarUrl ? { avatarUrl: entity.profile.avatarUrl } : {}),
        ...(playerProfile.avatarAssetId?.trim() ? { avatarAssetId: playerProfile.avatarAssetId.trim() } : entity.profile?.avatarAssetId ? { avatarAssetId: entity.profile.avatarAssetId } : {}),
      },
    };
  });

  return {
    ...board,
    notes: [board.notes.trim(), proposal.notesAppend?.trim()].filter(Boolean).join("\n\n"),
    phases: [...board.phases, ...newPhases],
    timelineEvents: [...board.timelineEvents, ...newEvents],
    entities: [...entities, ...newEntities],
  };
}

function sanitizeProposal(input: Record<string, unknown>): AdvisorBuildProposal {
  const result: AdvisorBuildProposal = {};
  if (typeof input.notesAppend === "string") result.notesAppend = input.notesAppend.slice(0, 20_000);
  if (input.playerProfile && typeof input.playerProfile === "object" && !Array.isArray(input.playerProfile)) {
    const profile = input.playerProfile as Record<string, unknown>;
    result.playerProfile = {
      ...(typeof profile.name === "string" ? { name: profile.name } : {}),
      ...(typeof profile.biography === "string" ? { biography: profile.biography } : {}),
      ...(typeof profile.personality === "string" ? { personality: profile.personality } : {}),
      ...(Array.isArray(profile.traits) ? { traits: profile.traits.filter((value): value is string => typeof value === "string") } : {}),
      ...(typeof profile.avatarUrl === "string" ? { avatarUrl: profile.avatarUrl } : {}),
      ...(typeof profile.avatarAssetId === "string" ? { avatarAssetId: profile.avatarAssetId } : {}),
    };
  }
  if (Array.isArray(input.phases)) {
    result.phases = input.phases.flatMap(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const phase = value as Record<string, unknown>;
      return typeof phase.name === "string" && typeof phase.description === "string"
        ? [{ name: phase.name, description: phase.description }]
        : [];
    });
  }
  if (Array.isArray(input.timelineEvents)) {
    result.timelineEvents = input.timelineEvents.flatMap(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const event = value as Record<string, unknown>;
      if (typeof event.label !== "string" || typeof event.description !== "string") return [];
      const severity = event.severity === "caution" || event.severity === "critical" ? event.severity : "info";
      return [{ label: event.label, description: event.description, severity }];
    });
  }
  if (Array.isArray(input.entities)) {
    result.entities = input.entities.flatMap(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const entity = value as Record<string, unknown>;
      if (typeof entity.label !== "string" || !isCategory(entity.category) || !isFaction(entity.faction)) return [];
      return [{
        label: entity.label,
        category: entity.category,
        faction: entity.faction,
        ...(typeof entity.notes === "string" ? { notes: entity.notes } : {}),
      }];
    });
  }
  return result;
}

function isCategory(value: unknown): value is EntityCategory {
  return ["unit", "location", "resource", "barrier", "objective", "evidence", "vehicle", "surveillance", "civilian", "event"].includes(String(value));
}

function isFaction(value: unknown): value is Faction {
  return value === "police" || value === "criminal" || value === "neutral";
}

function templateForCategory(category: EntityCategory): string {
  switch (category) {
    case "unit": return "unit-network";
    case "location": return "location-building";
    case "resource": return "resource-supply";
    case "objective": return "objective-primary";
    case "evidence": return "evidence-document";
    case "vehicle": return "vehicle-car";
    case "surveillance": return "surveillance-camera";
    default: return `generated-${category}`;
  }
}
