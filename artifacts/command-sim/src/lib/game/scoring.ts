// Explainable scoring engine. Pure functions over BoardState -> ScoreResult[].
// Every score is 0-100 and every contributing factor is listed so the UI can
// show a transparent breakdown instead of a black-box number.

import type { BoardEntity, BoardState, ScoreFactor, ScoreResult, ScoreKey } from "./types";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function build(
  key: ScoreKey,
  label: string,
  base: number,
  factors: ScoreFactor[],
  summary: string,
): ScoreResult {
  const total = base + factors.reduce((sum, f) => sum + f.contribution, 0);
  return { key, label, value: clamp(total), summary, factors };
}

function policeUnits(entities: BoardEntity[]): BoardEntity[] {
  return entities.filter((e) => e.faction === "police" && (e.category === "unit" || e.category === "vehicle"));
}

function criminalUnits(entities: BoardEntity[]): BoardEntity[] {
  return entities.filter((e) => e.faction === "criminal" && (e.category === "unit" || e.category === "vehicle"));
}

function civilians(entities: BoardEntity[]): BoardEntity[] {
  return entities.filter((e) => e.category === "civilian");
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function computeScores(board: BoardState): ScoreResult[] {
  const { entities } = board;
  const police = policeUnits(entities);
  const criminals = criminalUnits(entities);
  const civs = civilians(entities);
  const evidence = entities.filter((e) => e.category === "evidence");
  const surveillance = entities.filter((e) => e.category === "surveillance");
  const objectives = entities.filter((e) => e.category === "objective");
  const events = entities.filter((e) => e.category === "event");
  const criticalEvents = board.timelineEvents.filter((e) => e.severity === "critical");

  // --- Public Safety ---
  const nearbyRiskPairs = civs.filter((c) =>
    entities.some(
      (e) => e.faction === "criminal" && e.category !== "location" && distance(c, e) < 60,
    ),
  );
  const unrestMarkers = events.filter((e) => e.templateId === "evt-civil-unrest-risk");
  const publicSafety = build(
    "publicSafety",
    "Public Safety",
    75,
    [
      police.length > 0
        ? { label: "Police coverage present", contribution: Math.min(15, police.length * 3), detail: `${police.length} police unit(s)/vehicle(s) deployed.` }
        : { label: "No police presence", contribution: -15, detail: "No police units are on the board to protect civilians." },
      { label: "Civilians near criminal activity", contribution: -nearbyRiskPairs.length * 8, detail: `${nearbyRiskPairs.length} civilian(s) within close range of criminal-faction entities.` },
      { label: "Civil unrest risk markers", contribution: -unrestMarkers.length * 10, detail: `${unrestMarkers.length} civil unrest risk marker(s) placed.` },
      { label: "Critical timeline events", contribution: -criticalEvents.length * 6, detail: `${criticalEvents.length} critical event(s) logged in the timeline.` },
    ],
    "How safe civilians and the public are given current force disposition and events.",
  );

  // --- Evidence Quality ---
  const avgEvidenceIntel = avg(evidence.map((e) => e.attributes.intelligence));
  const evidenceQuality = build(
    "evidenceQuality",
    "Evidence Quality",
    Math.round(avgEvidenceIntel * 0.6),
    [
      { label: "Evidence items collected", contribution: Math.min(25, evidence.length * 6), detail: `${evidence.length} evidence marker(s) placed on the board.` },
      { label: "Investigators present", contribution: entities.some((e) => e.templateId === "police-investigator") ? 10 : 0, detail: "Investigator units strengthen evidence handling and chain of custody." },
      { label: "Forensics support present", contribution: entities.some((e) => e.templateId === "police-forensics") ? 10 : 0, detail: "A forensics team is available to process evidence." },
    ],
    "Strength and reliability of the case being built against the network.",
  );

  // --- Operational Risk ---
  const avgRisk = avg([...police, ...criminals].map((e) => e.attributes.risk));
  const operationalRisk = build(
    "operationalRisk",
    "Operational Risk",
    Math.round(avgRisk),
    [
      { label: "High-risk unit concentration", contribution: [...police, ...criminals].filter((e) => e.attributes.risk > 65).length * 5, detail: "Units with elevated individual risk increase overall operational exposure." },
      { label: "Undercover/embedded assets", contribution: entities.some((e) => e.templateId === "police-undercover" || e.templateId === "sur-informant-marker") ? 12 : 0, detail: "Covert assets carry elevated exposure risk if compromised." },
      { label: "Backup readiness", contribution: entities.some((e) => e.templateId === "police-special-response" || e.templateId === "police-command-post") ? -8 : 0, detail: "Tactical or command support reduces operational risk." },
    ],
    "Exposure to danger, compromise, or mission failure for deployed assets.",
  );

  // --- Detection ---
  const avgVisibilityCriminal = avg(criminals.map((e) => e.attributes.visibility));
  const surveillanceCoverage = surveillance.length;
  const detection = build(
    "detection",
    "Detection",
    Math.round(avgVisibilityCriminal * 0.4),
    [
      { label: "Surveillance assets deployed", contribution: Math.min(35, surveillanceCoverage * 8), detail: `${surveillanceCoverage} surveillance asset(s) providing coverage.` },
      { label: "Intelligence-gathering units", contribution: entities.filter((e) => e.attributes.intelligence > 70 && e.faction === "police").length * 5, detail: "High-intelligence police units improve detection of network activity." },
      { label: "Surveillance blackout zones", contribution: entities.some((e) => e.templateId === "bar-surveillance-blackout") ? -20 : 0, detail: "Blackout zones reduce monitoring coverage." },
    ],
    "Likelihood that criminal-network activity is being detected and tracked.",
  );

  // --- Civilian Impact ---
  const civilianImpact = build(
    "civilianImpact",
    "Civilian Impact",
    80,
    [
      { label: "Civilians in operational area", contribution: -civs.length * 4, detail: `${civs.length} civilian(s) present in the scenario area.` },
      { label: "Crowd markers", contribution: -entities.filter((e) => e.templateId === "neutral-crowd").length * 10, detail: "Crowds amplify disruption and safety complexity." },
      { label: "Negotiator present", contribution: entities.some((e) => e.templateId === "police-negotiator") ? 10 : 0, detail: "A negotiator reduces civilian disruption in tense situations." },
    ],
    "Degree of disruption and risk imposed on uninvolved civilians.",
  );

  // --- Resource Use ---
  const totalResourceLoad = avg([...police, ...criminals].map((e) => e.attributes.resources));
  const resourceUse = build(
    "resourceUse",
    "Resource Use",
    Math.round(100 - totalResourceLoad * 0.3),
    [
      { label: "Total deployed units", contribution: -Math.max(0, entities.filter((e) => e.category === "unit").length - 6) * 4, detail: "Large deployments consume more operational resources." },
      { label: "Resource caches available", contribution: entities.filter((e) => e.category === "resource").length * 5, detail: "Available resource caches offset operational cost." },
    ],
    "Efficiency of resource allocation relative to force size and support.",
  );

  // --- Legitimacy ---
  const avgLegalAuthority = avg(police.map((e) => e.attributes.legalAuthority));
  const legitimacy = build(
    "legitimacy",
    "Legitimacy",
    Math.round(avgLegalAuthority * 0.7 + 20),
    [
      { label: "Legal/court oversight present", contribution: entities.some((e) => e.templateId === "loc-legal-office" || e.templateId === "bar-legal-injunction") ? 12 : 0, detail: "Judicial oversight strengthens the legitimacy of the operation." },
      { label: "Media presence", contribution: entities.some((e) => e.faction === "neutral" && e.templateId === "neutral-media") ? -6 : 0, detail: "Media scrutiny raises the bar for perceived legitimacy." },
      { label: "Political pressure events", contribution: -events.filter((e) => e.templateId === "evt-political-pressure").length * 8, detail: "Political pressure can undermine perceived legitimacy." },
    ],
    "Perceived lawfulness and proportionality of the operation.",
  );

  // --- Network Disruption ---
  const criminalCoverage = criminals.length > 0
    ? avg(criminals.map((e) => 100 - e.attributes.readiness))
    : 0;
  const networkDisruption = build(
    "networkDisruption",
    "Network Disruption",
    Math.round(criminalCoverage * 0.4),
    [
      { label: "Criminal leadership targeted", contribution: entities.some((e) => e.templateId === "criminal-lieutenant" && e.attributes.readiness < 50) ? 15 : 0, detail: "Reduced readiness among network leadership indicates disruption." },
      { label: "Safehouses / fronts identified", contribution: entities.filter((e) => e.templateId === "loc-safehouse" || e.templateId === "loc-business-front").length * 6, detail: "Mapped network locations support targeted disruption." },
      { label: "Financier exposure", contribution: entities.some((e) => e.templateId === "criminal-financier") ? 8 : 0, detail: "Financial nodes are high-value disruption targets." },
    ],
    "How effectively the operation degrades the criminal network's capability.",
  );

  // --- Mission Objectives ---
  const missionObjectives = build(
    "missionObjectives",
    "Mission Objectives",
    objectives.length > 0 ? 40 : 10,
    [
      { label: "Objectives defined", contribution: Math.min(30, objectives.length * 10), detail: `${objectives.length} objective marker(s) placed on the board.` },
      { label: "Phases planned", contribution: Math.min(20, board.phases.length * 5), detail: `${board.phases.length} scenario phase(s) defined.` },
      { label: "Move history recorded", contribution: Math.min(10, board.moveHistory.length * 2), detail: `${board.moveHistory.length} logged move(s)/decision(s).` },
    ],
    "Clarity and progress of the scenario's defined goals.",
  );

  return [
    publicSafety,
    evidenceQuality,
    operationalRisk,
    detection,
    civilianImpact,
    resourceUse,
    legitimacy,
    networkDisruption,
    missionObjectives,
  ];
}
