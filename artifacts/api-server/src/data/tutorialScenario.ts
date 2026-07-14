// Server-side copy of the bundled tutorial scenario board, served via
// GET /tutorial-scenario. Keep in sync with
// artifacts/command-sim/src/lib/game/tutorialScenario.ts.

export function buildTutorialScenarioBoard(): Record<string, unknown> {
  return {
    version: 1,
    mapTemplateId: "norrebro",
    zones: [
      { id: "zone-network", name: "Suspected Network Zone", kind: "risk", x: 340, y: 40, width: 240, height: 420, color: "#dc2626", notes: "Reported network activity cluster near the business front." },
      { id: "zone-watch", name: "Community Watch Area", kind: "visibility", x: 40, y: 540, width: 240, height: 220, color: "#2563eb", notes: "Higher civilian foot traffic and community presence." },
    ],
    entities: [
      entity("tut-1", "loc-safehouse", "location", "criminal", "Safehouse", 460, 160, { notes: "Believed to be the network's primary base of operations." }),
      entity("tut-2", "loc-business-front", "location", "criminal", "Business Front", 420, 300),
      entity("tut-3", "criminal-lieutenant", "unit", "criminal", "Lieutenant", 470, 200, { readiness: 70 }),
      entity("tut-4", "criminal-lookout", "unit", "criminal", "Lookout", 400, 120),
      entity("tut-5", "criminal-street-crew", "unit", "criminal", "Street Crew", 500, 260),
      entity("tut-6", "neutral-civilian", "civilian", "neutral", "Civilian", 150, 620),
      entity("tut-7", "neutral-civilian", "civilian", "neutral", "Civilian", 190, 660),
      entity("tut-8", "neutral-witness", "civilian", "neutral", "Witness", 220, 600, { notes: "Reported seeing network activity near the business front." }),
      entity("tut-9", "police-command-post", "unit", "police", "Mobile Command Post", 80, 80),
      entity("tut-10", "police-investigator", "unit", "police", "Investigator", 160, 140),
      entity("tut-11", "police-undercover", "unit", "police", "Undercover Officer", 430, 250, { notes: "Embedded asset monitoring the safehouse." }),
      entity("tut-12", "sur-observation-post", "surveillance", "police", "Static Observation Post", 300, 100),
      entity("tut-13", "sur-cctv", "surveillance", "police", "CCTV Camera", 380, 260),
      entity("tut-14", "evi-financial-record", "evidence", "police", "Financial Record", 470, 210, { notes: "Linked to the business front's irregular transactions." }),
      entity("tut-15", "obj-primary", "objective", "neutral", "Primary Objective", 460, 165, { notes: "Confirm and disrupt network base of operations." }),
      entity("tut-16", "obj-evidence-recovery", "objective", "police", "Evidence Recovery Point", 420, 300),
    ],
    layers: [{ id: "layer-default", name: "Ground", visible: true, locked: false, order: 0 }],
    phases: [
      { id: "phase-planning", name: "Planning", description: "Initial intelligence review and force disposition.", order: 0 },
      { id: "phase-surveillance", name: "Surveillance", description: "Covert monitoring to confirm network activity before acting.", order: 1 },
      { id: "phase-interdiction", name: "Interdiction", description: "Coordinated, lawful action against confirmed targets.", order: 2 },
    ],
    currentPhaseId: "phase-planning",
    timelineEvents: [
      { id: "evt-1", phaseId: "phase-planning", label: "Witness statement received", description: "A local witness reported unusual activity around the business front on Nørrebrogade.", severity: "info", createdAt: "2026-06-01T09:30:00.000Z" },
      { id: "evt-2", phaseId: "phase-planning", label: "Financial irregularity flagged", description: "Analysts flagged irregular transaction patterns linked to the business front.", severity: "caution", createdAt: "2026-06-01T14:15:00.000Z" },
    ],
    moveHistory: [
      { id: "move-1", summary: "Deployed observation post and CCTV coverage overlooking the suspected zone.", actorFaction: "police", createdAt: "2026-06-01T10:00:00.000Z" },
    ],
    notes: "Tutorial scenario: a fictional neighborhood investigation. Use this to explore zones, phases, evidence, and the AI advisor before building your own scenario.",
  };
}

function entity(
  id: string,
  templateId: string,
  category: string,
  faction: string,
  label: string,
  x: number,
  y: number,
  extra: Record<string, unknown> = {},
) {
  const { notes, ...attributeOverrides } = extra;
  return {
    id,
    templateId,
    category,
    faction,
    label,
    x,
    y,
    rotation: 0,
    scale: 1,
    zIndex: 0,
    layerId: "layer-default",
    zoneId: null,
    groupId: null,
    locked: false,
    attributes: {
      mobility: 50,
      visibility: 50,
      intelligence: 50,
      influence: 50,
      resources: 50,
      readiness: 50,
      legalAuthority: 0,
      risk: 30,
      morale: 60,
      ...attributeOverrides,
    },
    notes: notes ?? "",
  };
}
