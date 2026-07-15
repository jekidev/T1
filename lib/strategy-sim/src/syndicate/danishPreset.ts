import type { SyndicateRole, SyndicateRoleKind } from "./types";

export interface FictionalBackgroundPreset {
  id: string;
  label: string;
  contextTags: string[];
  supportNeeds: string[];
  gameplayModifiers: Record<string, never>;
}

/**
 * A decentralized council/cell structure adapted to a fictional Danish urban setting.
 * It borrows only the abstract organizational idea of a central council, deputies,
 * territorial coordinators and autonomous local teams. It does not reproduce a real
 * criminal organization, membership rules, rituals or operating procedures.
 */
export const DANISH_DECENTRALIZED_SYNDICATE_ROLES: SyndicateRole[] = [
  role("role-leader", "leader", "Council Lead", ["sets strategic direction", "chairs succession decisions"], ["strategy", "relationships"], ["all"], 120, 65, 55, 70, 18, 5, 100),
  role("role-underboss", "underboss", "Deputy Coordinator", ["coordinates district teams", "maintains continuity"], ["operations", "members"], ["assign_role", "approve_budget"], 90, 60, 50, 65, 14, 4, 90),
  role("role-advisor", "advisor", "Council Advisor", ["reviews risk", "supports negotiation", "records institutional memory"], ["strategy", "relationships"], ["review_plan", "view_intelligence"], 75, 55, 55, 70, 12, 4, 80),
  role("role-captain", "captain", "District Coordinator", ["leads a local team", "reports local conditions"], ["territory", "members"], ["assign_task", "request_budget"], 65, 55, 45, 60, 10, 3, 70),
  role("role-operator", "operator", "Project Operator", ["executes validated game objectives"], ["missions"], ["execute_order"], 45, 45, 45, 55, 6, 2, 50),
  role("role-associate", "associate", "Associate", ["supports teams", "builds trust and experience"], ["missions", "business"], ["basic_access"], 30, 35, 40, 40, 3, 1, 20),
  role("role-business-manager", "business_manager", "Business Manager", ["runs fictional businesses", "reports production"], ["economy", "business"], ["manage_business", "request_budget"], 60, 50, 50, 65, 8, 3, 45),
  role("role-driver", "driver", "Mobility Coordinator", ["moves units and supplies in the simulation"], ["transport"], ["move_assets"], 40, 40, 45, 55, 4, 2, 25),
  role("role-security", "security", "Safety Coordinator", ["protects locations", "reduces disruption"], ["defense"], ["defend_location"], 50, 50, 55, 60, 6, 2, 35),
  role("role-negotiator", "negotiator", "Community Negotiator", ["handles agreements", "reduces hostility"], ["relationships"], ["propose_agreement"], 55, 50, 60, 65, 8, 3, 40),
  role("role-accountant", "accountant", "Resource Controller", ["tracks generic resources", "flags shortages"], ["economy"], ["view_budget", "prepare_report"], 55, 55, 50, 70, 7, 3, 40),
  role("role-informant", "informant", "Information Contact", ["provides uncertain information"], ["intelligence"], ["submit_report"], 35, 35, 35, 45, 5, 1, 10),
];

/**
 * These presets add social context only. They deliberately carry no gameplay modifiers:
 * religion, ethnicity, psychiatric diagnosis, disability, recovery or substance-use
 * history must never alter aggression, honesty, competence, loyalty or criminality.
 */
export const FICTIONAL_DANISH_BACKGROUND_PRESETS: FictionalBackgroundPreset[] = [
  { id: "local-trade", label: "Local trade and logistics background", contextTags: ["working-class", "transport", "local-network"], supportNeeds: [], gameplayModifiers: {} },
  { id: "biker-community", label: "Motorcycle-club social background", contextTags: ["motorcycle-community", "mechanical-skills", "club-relations"], supportNeeds: [], gameplayModifiers: {} },
  { id: "muslim-community", label: "Muslim community and family-network background", contextTags: ["muslim", "family-network", "community-life"], supportNeeds: ["respect religious schedule and dietary preferences"], gameplayModifiers: {} },
  { id: "mental-health-support", label: "Mental-health support experience", contextTags: ["lived-experience", "peer-support"], supportNeeds: ["predictable schedule", "access to voluntary support"], gameplayModifiers: {} },
  { id: "recovery-peer", label: "Substance-recovery peer background", contextTags: ["recovery", "peer-support", "resilience"], supportNeeds: ["recovery-safe environment", "optional peer support"], gameplayModifiers: {} },
  { id: "new-dane", label: "New-Dane multilingual background", contextTags: ["multilingual", "cross-cultural", "diaspora-network"], supportNeeds: ["language preference"], gameplayModifiers: {} },
  { id: "creative-nightlife", label: "Creative and nightlife work background", contextTags: ["music", "events", "hospitality"], supportNeeds: ["nonstandard work hours"], gameplayModifiers: {} },
];

export function applyDanishSyndicatePreset<T extends { hierarchy: SyndicateRole[] }>(syndicate: T): T {
  return { ...syndicate, hierarchy: structuredClone(DANISH_DECENTRALIZED_SYNDICATE_ROLES) };
}

function role(
  id: string,
  kind: SyndicateRoleKind,
  title: string,
  responsibilities: string[],
  workAreas: string[],
  permissions: string[],
  upkeep: number,
  loyaltyRequirement: number,
  heartRequirement: number,
  competenceRequirement: number,
  influence: number,
  accessLevel: number,
  successionPriority: number,
): SyndicateRole {
  return {
    id,
    kind,
    title,
    responsibilities,
    workAreas,
    permissions,
    upkeep,
    loyaltyRequirement,
    heartRequirement,
    competenceRequirement,
    influence,
    accessLevel,
    factionRelationshipModifiers: {},
    successionPriority,
  };
}
