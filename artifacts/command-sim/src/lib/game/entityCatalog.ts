// Side-palette catalog: every draggable template a player can place on the board.
// Fictional, abstract tabletop-simulation content only — no real-world tactics.

import type { EntityAttributes, EntityCategory, Faction } from "./types";
import { DEFAULT_ATTRIBUTES } from "./types";

export interface EntityTemplate {
  id: string;
  category: EntityCategory;
  faction: Faction;
  label: string;
  description: string;
  defaultAttributes: EntityAttributes;
  defaultScale: number;
}

function attrs(overrides: Partial<EntityAttributes>): EntityAttributes {
  return { ...DEFAULT_ATTRIBUTES, ...overrides };
}

export const ENTITY_TEMPLATES: EntityTemplate[] = [
  // ---- Police / Blue Team units ----
  {
    id: "police-patrol-unit",
    category: "unit",
    faction: "police",
    label: "Patrol Unit",
    description: "Marked patrol pair providing area coverage and visible deterrence.",
    defaultAttributes: attrs({ mobility: 60, visibility: 80, legalAuthority: 90, readiness: 60, risk: 25 }),
    defaultScale: 1,
  },
  {
    id: "police-investigator",
    category: "unit",
    faction: "police",
    label: "Investigator",
    description: "Plainclothes detective building the case through evidence and interviews.",
    defaultAttributes: attrs({ mobility: 50, visibility: 25, intelligence: 80, legalAuthority: 85, readiness: 55 }),
    defaultScale: 1,
  },
  {
    id: "police-special-response",
    category: "unit",
    faction: "police",
    label: "Special Response Team",
    description: "High-readiness tactical team for high-risk, authorized operations.",
    defaultAttributes: attrs({ mobility: 55, visibility: 70, legalAuthority: 95, readiness: 90, risk: 55 }),
    defaultScale: 1.1,
  },
  {
    id: "police-k9",
    category: "unit",
    faction: "police",
    label: "K9 Unit",
    description: "Canine team supporting search, detection, and area denial.",
    defaultAttributes: attrs({ mobility: 65, visibility: 75, intelligence: 60, legalAuthority: 85, readiness: 70 }),
    defaultScale: 1,
  },
  {
    id: "police-undercover",
    category: "unit",
    faction: "police",
    label: "Undercover Officer",
    description: "Deep-cover operative gathering intelligence from within the network.",
    defaultAttributes: attrs({ mobility: 55, visibility: 10, intelligence: 85, legalAuthority: 70, risk: 70 }),
    defaultScale: 1,
  },
  {
    id: "police-forensics",
    category: "unit",
    faction: "police",
    label: "Forensics Team",
    description: "Specialist team processing physical and digital evidence on-scene.",
    defaultAttributes: attrs({ mobility: 30, visibility: 40, intelligence: 90, legalAuthority: 80, readiness: 50 }),
    defaultScale: 1,
  },
  {
    id: "police-negotiator",
    category: "unit",
    faction: "police",
    label: "Crisis Negotiator",
    description: "De-escalation specialist for high-tension standoffs.",
    defaultAttributes: attrs({ mobility: 30, visibility: 45, influence: 75, legalAuthority: 85, morale: 75 }),
    defaultScale: 1,
  },
  {
    id: "police-command-post",
    category: "unit",
    faction: "police",
    label: "Mobile Command Post",
    description: "Forward coordination hub for operational command and control.",
    defaultAttributes: attrs({ mobility: 15, visibility: 60, intelligence: 70, legalAuthority: 90, readiness: 80 }),
    defaultScale: 1.2,
  },

  // ---- Criminal Network / Red Team units ----
  {
    id: "criminal-street-crew",
    category: "unit",
    faction: "criminal",
    label: "Street Crew",
    description: "Low-level network members handling local activity and area presence.",
    defaultAttributes: attrs({ mobility: 55, visibility: 55, legalAuthority: 0, risk: 60, morale: 55 }),
    defaultScale: 1,
  },
  {
    id: "criminal-lieutenant",
    category: "unit",
    faction: "criminal",
    label: "Lieutenant",
    description: "Mid-tier organizer directing several crews and local resources.",
    defaultAttributes: attrs({ mobility: 45, visibility: 35, influence: 70, legalAuthority: 0, risk: 65 }),
    defaultScale: 1.05,
  },
  {
    id: "criminal-courier",
    category: "unit",
    faction: "criminal",
    label: "Courier",
    description: "Moves resources or information between network nodes.",
    defaultAttributes: attrs({ mobility: 85, visibility: 45, legalAuthority: 0, risk: 55 }),
    defaultScale: 0.9,
  },
  {
    id: "criminal-lookout",
    category: "unit",
    faction: "criminal",
    label: "Lookout",
    description: "Monitors an area for law-enforcement activity and signals the network.",
    defaultAttributes: attrs({ mobility: 30, visibility: 30, intelligence: 55, legalAuthority: 0, risk: 35 }),
    defaultScale: 0.9,
  },
  {
    id: "criminal-fixer",
    category: "unit",
    faction: "criminal",
    label: "Fixer / Contact",
    description: "Arranges deals and relationships across the network; abstract role, no operational detail.",
    defaultAttributes: attrs({ mobility: 40, visibility: 20, influence: 80, legalAuthority: 0, risk: 50 }),
    defaultScale: 1,
  },
  {
    id: "criminal-safehouse-guard",
    category: "unit",
    faction: "criminal",
    label: "Safehouse Guard",
    description: "Protects a fixed network location from intrusion.",
    defaultAttributes: attrs({ mobility: 15, visibility: 25, legalAuthority: 0, readiness: 65, risk: 45 }),
    defaultScale: 1,
  },
  {
    id: "criminal-financier",
    category: "unit",
    faction: "criminal",
    label: "Financier",
    description: "Manages network funding and financial concealment structures.",
    defaultAttributes: attrs({ mobility: 20, visibility: 15, influence: 65, resources: 85, legalAuthority: 0, risk: 40 }),
    defaultScale: 1,
  },
  {
    id: "criminal-enforcer",
    category: "unit",
    faction: "criminal",
    label: "Enforcer",
    description: "Handles internal discipline and intimidation; represented abstractly for risk modeling only.",
    defaultAttributes: attrs({ mobility: 45, visibility: 50, legalAuthority: 0, risk: 80, morale: 60 }),
    defaultScale: 1,
  },

  // ---- Neutral: civilians, media, witnesses ----
  {
    id: "neutral-civilian",
    category: "civilian",
    faction: "neutral",
    label: "Civilian",
    description: "Uninvolved resident whose safety and disruption level matter to scoring.",
    defaultAttributes: attrs({ mobility: 40, visibility: 60, legalAuthority: 0, risk: 20, influence: 10 }),
    defaultScale: 0.85,
  },
  {
    id: "neutral-crowd",
    category: "civilian",
    faction: "neutral",
    label: "Civilian Crowd",
    description: "A gathered group of bystanders, increasing complexity and visibility risk.",
    defaultAttributes: attrs({ mobility: 20, visibility: 80, legalAuthority: 0, risk: 35, influence: 20 }),
    defaultScale: 1.1,
  },
  {
    id: "neutral-witness",
    category: "civilian",
    faction: "neutral",
    label: "Witness",
    description: "Individual with potentially valuable testimony about network activity.",
    defaultAttributes: attrs({ mobility: 35, visibility: 40, intelligence: 55, legalAuthority: 0, risk: 40 }),
    defaultScale: 0.85,
  },
  {
    id: "neutral-media",
    category: "civilian",
    faction: "neutral",
    label: "Media Reporter",
    description: "Press presence that can shift public narrative and legitimacy scoring.",
    defaultAttributes: attrs({ mobility: 45, visibility: 85, influence: 70, legalAuthority: 0, risk: 15 }),
    defaultScale: 0.9,
  },

  // ---- Locations ----
  { id: "loc-safehouse", category: "location", faction: "criminal", label: "Safehouse", description: "Concealed network base of operations.", defaultAttributes: attrs({ visibility: 15, risk: 40 }), defaultScale: 1.2 },
  { id: "loc-business-front", category: "location", faction: "criminal", label: "Business Front", description: "Legitimate-looking storefront used by the network.", defaultAttributes: attrs({ visibility: 55, risk: 35 }), defaultScale: 1.2 },
  { id: "loc-police-station", category: "location", faction: "police", label: "Police Station", description: "Law-enforcement base of operations and holding facility.", defaultAttributes: attrs({ visibility: 90, legalAuthority: 100, risk: 10 }), defaultScale: 1.3 },
  { id: "loc-warehouse", category: "location", faction: "neutral", label: "Warehouse", description: "Large storage structure with limited natural surveillance.", defaultAttributes: attrs({ visibility: 30, risk: 30 }), defaultScale: 1.3 },
  { id: "loc-transit-hub", category: "location", faction: "neutral", label: "Transit Hub", description: "High-traffic public transport node.", defaultAttributes: attrs({ visibility: 80, risk: 25 }), defaultScale: 1.3 },
  { id: "loc-residential-block", category: "location", faction: "neutral", label: "Residential Block", description: "Housing area with resident civilians.", defaultAttributes: attrs({ visibility: 50, risk: 20 }), defaultScale: 1.3 },
  { id: "loc-harbor-dock", category: "location", faction: "neutral", label: "Harbor Dock", description: "Restricted-access waterfront loading point.", defaultAttributes: attrs({ visibility: 35, risk: 45 }), defaultScale: 1.3 },
  { id: "loc-legal-office", category: "location", faction: "police", label: "Legal / Court Office", description: "Judicial oversight and warrant authority location.", defaultAttributes: attrs({ visibility: 70, legalAuthority: 100, risk: 5 }), defaultScale: 1.2 },

  // ---- Resources ----
  { id: "res-funding", category: "resource", faction: "neutral", label: "Funding Pool", description: "Available financial resources for an operation.", defaultAttributes: attrs({ resources: 80 }), defaultScale: 0.8 },
  { id: "res-intel-cache", category: "resource", faction: "neutral", label: "Intelligence Cache", description: "Gathered information available for analysis.", defaultAttributes: attrs({ intelligence: 80 }), defaultScale: 0.8 },
  { id: "res-equipment-cache", category: "resource", faction: "neutral", label: "Equipment Cache", description: "Operational equipment reserve.", defaultAttributes: attrs({ readiness: 75 }), defaultScale: 0.8 },
  { id: "res-vehicle-pool", category: "resource", faction: "neutral", label: "Vehicle Pool", description: "Reserve of available vehicles.", defaultAttributes: attrs({ mobility: 75 }), defaultScale: 0.8 },
  { id: "res-informant-network", category: "resource", faction: "police", label: "Informant Network", description: "Network of sources feeding information to investigators.", defaultAttributes: attrs({ intelligence: 85, risk: 45 }), defaultScale: 0.8 },

  // ---- Barriers ----
  { id: "bar-checkpoint", category: "barrier", faction: "police", label: "Checkpoint", description: "Controlled access point along a route.", defaultAttributes: attrs({ legalAuthority: 90 }), defaultScale: 1 },
  { id: "bar-roadblock", category: "barrier", faction: "police", label: "Roadblock", description: "Temporary route closure.", defaultAttributes: attrs({ legalAuthority: 85 }), defaultScale: 1 },
  { id: "bar-perimeter-fence", category: "barrier", faction: "neutral", label: "Perimeter Fence", description: "Physical boundary restricting access.", defaultAttributes: attrs({}), defaultScale: 1 },
  { id: "bar-legal-injunction", category: "barrier", faction: "police", label: "Legal Injunction", description: "Court-ordered restriction on an area or activity.", defaultAttributes: attrs({ legalAuthority: 100 }), defaultScale: 1 },
  { id: "bar-surveillance-blackout", category: "barrier", faction: "criminal", label: "Surveillance Blackout Zone", description: "Area with disrupted or absent monitoring coverage.", defaultAttributes: attrs({ visibility: 10 }), defaultScale: 1 },

  // ---- Objectives ----
  { id: "obj-primary", category: "objective", faction: "neutral", label: "Primary Objective", description: "The scenario's main goal marker.", defaultAttributes: attrs({}), defaultScale: 1.1 },
  { id: "obj-secondary", category: "objective", faction: "neutral", label: "Secondary Objective", description: "A supporting scenario goal.", defaultAttributes: attrs({}), defaultScale: 1 },
  { id: "obj-extraction", category: "objective", faction: "police", label: "Extraction Point", description: "Planned withdrawal or transport location.", defaultAttributes: attrs({}), defaultScale: 1 },
  { id: "obj-arrest-target", category: "objective", faction: "police", label: "Arrest Target Marker", description: "Fictional target identified for lawful apprehension.", defaultAttributes: attrs({}), defaultScale: 1 },
  { id: "obj-evidence-recovery", category: "objective", faction: "police", label: "Evidence Recovery Point", description: "Location targeted for evidence collection.", defaultAttributes: attrs({}), defaultScale: 1 },

  // ---- Evidence ----
  { id: "evi-physical", category: "evidence", faction: "police", label: "Physical Evidence", description: "Tangible item of investigative value.", defaultAttributes: attrs({ intelligence: 70 }), defaultScale: 0.7 },
  { id: "evi-digital", category: "evidence", faction: "police", label: "Digital Evidence", description: "Electronic records or communications of investigative value.", defaultAttributes: attrs({ intelligence: 75 }), defaultScale: 0.7 },
  { id: "evi-witness-testimony", category: "evidence", faction: "police", label: "Witness Testimony", description: "Recorded account supporting the case.", defaultAttributes: attrs({ intelligence: 65 }), defaultScale: 0.7 },
  { id: "evi-financial-record", category: "evidence", faction: "police", label: "Financial Record", description: "Documented financial transaction of interest.", defaultAttributes: attrs({ intelligence: 70 }), defaultScale: 0.7 },
  { id: "evi-forensic-sample", category: "evidence", faction: "police", label: "Forensic Sample", description: "Lab-analyzable trace evidence.", defaultAttributes: attrs({ intelligence: 80 }), defaultScale: 0.7 },

  // ---- Vehicles ----
  { id: "veh-patrol-car", category: "vehicle", faction: "police", label: "Patrol Car", description: "Marked police vehicle.", defaultAttributes: attrs({ mobility: 80, visibility: 85, legalAuthority: 90 }), defaultScale: 1 },
  { id: "veh-unmarked", category: "vehicle", faction: "police", label: "Unmarked Vehicle", description: "Low-visibility surveillance or transport vehicle.", defaultAttributes: attrs({ mobility: 75, visibility: 25, legalAuthority: 85 }), defaultScale: 1 },
  { id: "veh-cargo-van", category: "vehicle", faction: "criminal", label: "Cargo Van", description: "Transport vehicle used by the network.", defaultAttributes: attrs({ mobility: 65, visibility: 45, legalAuthority: 0 }), defaultScale: 1 },
  { id: "veh-boat", category: "vehicle", faction: "neutral", label: "Boat", description: "Waterborne transport, relevant near harbor zones.", defaultAttributes: attrs({ mobility: 60, visibility: 40 }), defaultScale: 1 },
  { id: "veh-motorcycle", category: "vehicle", faction: "criminal", label: "Motorcycle", description: "Fast, low-profile transport.", defaultAttributes: attrs({ mobility: 90, visibility: 40, legalAuthority: 0 }), defaultScale: 0.9 },

  // ---- Surveillance ----
  { id: "sur-cctv", category: "surveillance", faction: "police", label: "CCTV Camera", description: "Fixed visual monitoring point.", defaultAttributes: attrs({ intelligence: 60, mobility: 0 }), defaultScale: 0.7 },
  { id: "sur-wiretap", category: "surveillance", faction: "police", label: "Authorized Wiretap", description: "Court-authorized communications monitoring, represented abstractly.", defaultAttributes: attrs({ intelligence: 80, legalAuthority: 90 }), defaultScale: 0.7 },
  { id: "sur-drone", category: "surveillance", faction: "police", label: "Surveillance Drone", description: "Aerial monitoring asset.", defaultAttributes: attrs({ intelligence: 70, mobility: 70 }), defaultScale: 0.8 },
  { id: "sur-observation-post", category: "surveillance", faction: "police", label: "Static Observation Post", description: "Fixed lookout position for monitoring an area.", defaultAttributes: attrs({ intelligence: 55, mobility: 0 }), defaultScale: 0.8 },
  { id: "sur-informant-marker", category: "surveillance", faction: "police", label: "Informant Marker", description: "Represents a human intelligence source location, kept abstract.", defaultAttributes: attrs({ intelligence: 75, risk: 55 }), defaultScale: 0.7 },

  // ---- Event markers ----
  { id: "evt-public-event", category: "event", faction: "neutral", label: "Public Event", description: "Scheduled gathering that changes crowd density and visibility.", defaultAttributes: attrs({ visibility: 80 }), defaultScale: 1 },
  { id: "evt-media-alert", category: "event", faction: "neutral", label: "Media Alert", description: "A news story breaks, shifting public attention.", defaultAttributes: attrs({ influence: 70 }), defaultScale: 1 },
  { id: "evt-political-pressure", category: "event", faction: "neutral", label: "Political Pressure", description: "Outside pressure affecting legitimacy and pacing.", defaultAttributes: attrs({ influence: 75 }), defaultScale: 1 },
  { id: "evt-weather", category: "event", faction: "neutral", label: "Weather / Environmental Event", description: "Environmental condition affecting mobility and visibility.", defaultAttributes: attrs({ mobility: 30 }), defaultScale: 1 },
  { id: "evt-civil-unrest-risk", category: "event", faction: "neutral", label: "Civil Unrest Risk", description: "Elevated tension marker affecting public-safety scoring.", defaultAttributes: attrs({ risk: 70 }), defaultScale: 1 },
];

export function getEntityTemplate(id: string): EntityTemplate | undefined {
  return ENTITY_TEMPLATES.find((t) => t.id === id);
}

export const CATEGORY_LABELS: Record<EntityCategory, string> = {
  unit: "Units",
  location: "Locations",
  resource: "Resources",
  barrier: "Barriers",
  objective: "Objectives",
  evidence: "Evidence",
  vehicle: "Vehicles",
  surveillance: "Surveillance",
  civilian: "Civilians & Media",
  event: "Event Markers",
};
