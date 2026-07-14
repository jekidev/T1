// Bundled tutorial scenario: a fully-populated example board, loaded on demand
// (never as the default state) so new players can see how a finished scenario looks.

import { nanoid } from "nanoid";
import type { BoardEntity, BoardState, BoardZone } from "./types";
import { DEFAULT_ATTRIBUTES } from "./types";
import { getEntityTemplate } from "./entityCatalog";

function entity(templateId: string, x: number, y: number, overrides: Partial<BoardEntity> = {}): BoardEntity {
  const template = getEntityTemplate(templateId)!;
  return {
    id: nanoid(10),
    templateId,
    category: template.category,
    faction: template.faction,
    label: template.label,
    x,
    y,
    rotation: 0,
    scale: template.defaultScale,
    zIndex: 0,
    layerId: "layer-default",
    zoneId: null,
    groupId: null,
    locked: false,
    attributes: { ...DEFAULT_ATTRIBUTES, ...template.defaultAttributes },
    notes: "",
    ...overrides,
  };
}

function zone(name: string, kind: BoardZone["kind"], x: number, y: number, width: number, height: number, color: string, notes = ""): BoardZone {
  return { id: nanoid(10), name, kind, x, y, width, height, color, notes };
}

export function buildTutorialScenario(): BoardState {
  const planningId = "phase-planning";
  const surveillanceId = nanoid(8);
  const interdictionId = nanoid(8);

  return {
    version: 1,
    mapTemplateId: "norrebro",
    zones: [
      zone("Suspected Network Zone", "risk", 340, 40, 240, 420, "#dc2626", "Reported network activity cluster near the business front."),
      zone("Community Watch Area", "visibility", 40, 540, 240, 220, "#2563eb", "Higher civilian foot traffic and community presence."),
    ],
    entities: [
      entity("loc-safehouse", 460, 160, { notes: "Believed to be the network's primary base of operations." }),
      entity("loc-business-front", 420, 300),
      entity("criminal-lieutenant", 470, 200, { attributes: { ...DEFAULT_ATTRIBUTES, ...getEntityTemplate("criminal-lieutenant")!.defaultAttributes, readiness: 70 } }),
      entity("criminal-lookout", 400, 120),
      entity("criminal-street-crew", 500, 260),
      entity("neutral-civilian", 150, 620),
      entity("neutral-civilian", 190, 660),
      entity("neutral-witness", 220, 600, { notes: "Reported seeing network activity near the business front." }),
      entity("police-command-post", 80, 80),
      entity("police-investigator", 160, 140),
      entity("police-undercover", 430, 250, { notes: "Embedded asset monitoring the safehouse." }),
      entity("sur-observation-post", 300, 100),
      entity("sur-cctv", 380, 260),
      entity("evi-financial-record", 470, 210, { notes: "Linked to the business front's irregular transactions." }),
      entity("obj-primary", 460, 165, { notes: "Confirm and disrupt network base of operations." }),
      entity("obj-evidence-recovery", 420, 300),
    ],
    layers: [{ id: "layer-default", name: "Ground", visible: true, locked: false, order: 0 }],
    phases: [
      { id: planningId, name: "Planning", description: "Initial intelligence review and force disposition.", order: 0 },
      { id: surveillanceId, name: "Surveillance", description: "Covert monitoring to confirm network activity before acting.", order: 1 },
      { id: interdictionId, name: "Interdiction", description: "Coordinated, lawful action against confirmed targets.", order: 2 },
    ],
    currentPhaseId: planningId,
    timelineEvents: [
      {
        id: nanoid(10),
        phaseId: planningId,
        label: "Witness statement received",
        description: "A local witness reported unusual activity around the business front on Nørrebrogade.",
        severity: "info",
        createdAt: new Date(2026, 5, 1, 9, 30).toISOString(),
      },
      {
        id: nanoid(10),
        phaseId: planningId,
        label: "Financial irregularity flagged",
        description: "Analysts flagged irregular transaction patterns linked to the business front.",
        severity: "caution",
        createdAt: new Date(2026, 5, 1, 14, 15).toISOString(),
      },
    ],
    moveHistory: [
      {
        id: nanoid(10),
        summary: "Deployed observation post and CCTV coverage overlooking the suspected zone.",
        actorFaction: "police",
        createdAt: new Date(2026, 5, 1, 10, 0).toISOString(),
      },
    ],
    notes:
      "Tutorial scenario: a fictional neighborhood investigation. Use this to explore zones, phases, evidence, and the AI advisor before building your own scenario.",
  };
}
