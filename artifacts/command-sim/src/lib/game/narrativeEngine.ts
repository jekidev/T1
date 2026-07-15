import { nanoid } from "nanoid";
import type { BoardState, TimelineEvent, TimelineEventSeverity } from "./types";

export interface NarrativeEventTemplate {
  id: string;
  label: string;
  description: string;
  severity: TimelineEventSeverity;
  minTurn?: number;
  maxTurn?: number;
  phaseId?: string;
  weight: number;
  conditions?: Array<{
    metric: "cityTension" | "evidenceQuality" | "publicConfidence" | "mediaPressure" | "blueTeamCoordination" | "economyIndex";
    min?: number;
    max?: number;
  }>;
}

// Fictional, non-operational narrative hooks. They are triggered by simulation
// thresholds and the current campaign act to make turns feel like a developing story.
export const DEFAULT_NARRATIVE_CATALOG: NarrativeEventTemplate[] = [
  {
    id: "act1-rumors",
    label: "Rumors on the street",
    description: "Whispers in {city} describe a new crew trying to establish itself. Nothing is verified yet.",
    severity: "info",
    minTurn: 1,
    maxTurn: 10,
    phaseId: "phase-act-1",
    weight: 1,
  },
  {
    id: "act1-supplier",
    label: "Supplier pressure",
    description: "A regional supplier reports unusual demand patterns in {city}. Prices begin to fluctuate.",
    severity: "info",
    minTurn: 3,
    maxTurn: 15,
    phaseId: "phase-act-1",
    weight: 1,
    conditions: [{ metric: "economyIndex", min: 90 }],
  },
  {
    id: "act2-signals",
    label: "Signals detected",
    description: "Blue Team analysts notice coordinated communication patterns matching an archived case pattern.",
    severity: "caution",
    minTurn: 8,
    maxTurn: 30,
    phaseId: "phase-act-2",
    weight: 1,
    conditions: [{ metric: "blueTeamCoordination", min: 25 }],
  },
  {
    id: "act2-informant",
    label: "Informant contact",
    description: "A civilian contact offers a tip, but credibility is disputed inside the team.",
    severity: "caution",
    minTurn: 12,
    maxTurn: 35,
    phaseId: "phase-act-2",
    weight: 1,
    conditions: [{ metric: "evidenceQuality", min: 20, max: 55 }],
  },
  {
    id: "act3-networks",
    label: "Network overlap",
    description: "Two previously unconnected factions are seen using identical dead-drop procedures.",
    severity: "caution",
    minTurn: 25,
    maxTurn: 55,
    phaseId: "phase-act-3",
    weight: 1,
    conditions: [{ metric: "evidenceQuality", min: 40 }],
  },
  {
    id: "act3-media",
    label: "Media interest",
    description: "A local journalist begins asking questions about activity in {city}. Public attention rises.",
    severity: "caution",
    minTurn: 28,
    maxTurn: 60,
    phaseId: "phase-act-3",
    weight: 1,
    conditions: [{ metric: "mediaPressure", min: 35 }],
  },
  {
    id: "act4-fracture",
    label: "Internal disagreement",
    description: "A faction member disputes a recent decision. Loyalties are tested as pressure mounts.",
    severity: "critical",
    minTurn: 45,
    maxTurn: 85,
    phaseId: "phase-act-4",
    weight: 1,
    conditions: [{ metric: "cityTension", min: 55 }],
  },
  {
    id: "act4-leak",
    label: "Evidence leak",
    description: "A partial case file reaches the public before it can be verified. Trust in the process drops.",
    severity: "critical",
    minTurn: 50,
    maxTurn: 90,
    phaseId: "phase-act-4",
    weight: 1,
    conditions: [{ metric: "mediaPressure", min: 55 }, { metric: "publicConfidence", max: 45 }],
  },
  {
    id: "act5-showdown",
    label: "Citywide escalation",
    description: "Competing pressures converge in {city}. All factions must choose between negotiation and confrontation.",
    severity: "critical",
    minTurn: 70,
    maxTurn: 150,
    phaseId: "phase-act-5",
    weight: 1,
    conditions: [{ metric: "cityTension", min: 70 }],
  },
  {
    id: "act5-resolution",
    label: "Case file ready",
    description: "Blue Team assembles a coherent case from the accumulated evidence. The city watches closely.",
    severity: "info",
    minTurn: 80,
    maxTurn: 150,
    phaseId: "phase-act-5",
    weight: 1,
    conditions: [{ metric: "evidenceQuality", min: 70 }, { metric: "blueTeamCoordination", min: 60 }],
  },
];

function interpolate(template: string, board: BoardState): string {
  const city = board.world?.city ?? "the city";
  const criminal = board.simulation?.factions.find((f) => f.faction === "criminal")?.name ?? "the network";
  const police = board.simulation?.factions.find((f) => f.faction === "police")?.name ?? "Blue Team";
  return template
    .replace(/{city}/g, city)
    .replace(/{criminal}/g, criminal)
    .replace(/{police}/g, police);
}

function matches(template: NarrativeEventTemplate, board: BoardState): boolean {
  const sim = board.simulation;
  if (!sim) return false;
  const turn = sim.turn;
  if (template.minTurn !== undefined && turn < template.minTurn) return false;
  if (template.maxTurn !== undefined && turn > template.maxTurn) return false;
  if (template.phaseId && board.currentPhaseId !== template.phaseId) return false;
  if (template.conditions) {
    for (const condition of template.conditions) {
      const value = sim[condition.metric];
      if (condition.min !== undefined && value < condition.min) return false;
      if (condition.max !== undefined && value > condition.max) return false;
    }
  }
  return true;
}

export function selectNarrativeEvents(board: BoardState, catalog: NarrativeEventTemplate[] = DEFAULT_NARRATIVE_CATALOG): TimelineEvent[] {
  const matchesSet = catalog.filter((template) => matches(template, board));
  if (matchesSet.length === 0) return [];

  // Weighted random selection of up to one event per call so the timeline
  // stays readable and events feel distinct rather than spammy.
  const totalWeight = matchesSet.reduce((sum, t) => sum + t.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const template of matchesSet) {
    roll -= template.weight;
    if (roll <= 0) {
      return [
        {
          id: nanoid(10),
          phaseId: board.currentPhaseId,
          label: interpolate(template.label, board),
          description: interpolate(template.description, board),
          severity: template.severity,
          createdAt: new Date().toISOString(),
          sourceStatus: "fictional",
          narrativePatternId: template.id,
        },
      ];
    }
  }
  return [];
}
