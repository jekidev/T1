import { SyndicateCommandSchema, type SyndicateCommand } from "./commands";
import type {
  FactionRelationship,
  PowerProfile,
  StrategyEvaluation,
  Syndicate,
  SyndicateBusiness,
  SyndicateEvent,
  SyndicateMembership,
  SyndicateResources,
  SyndicateRole,
  SyndicateRoleKind,
  SyndicateStrategy,
  SyndicateWorldState,
  Territory,
} from "./types";

export const DEFAULT_SYNDICATE_ROLES: SyndicateRole[] = [
  role("role-leader", "leader", "Leader", ["sets strategic direction", "resolves succession"], ["strategy", "diplomacy"], ["all"], 120, 65, 55, 70, 18, 5, 100),
  role("role-underboss", "underboss", "Deputy", ["coordinates captains", "maintains continuity"], ["operations", "members"], ["assign_role", "approve_budget"], 90, 60, 50, 65, 14, 4, 90),
  role("role-advisor", "advisor", "Advisor", ["reviews risk", "supports negotiation"], ["strategy", "relationships"], ["review_plan", "view_intelligence"], 75, 55, 55, 70, 12, 4, 80),
  role("role-captain", "captain", "Captain", ["leads a team", "reports local conditions"], ["territory", "members"], ["assign_task", "request_budget"], 65, 55, 45, 60, 10, 3, 70),
  role("role-operator", "operator", "Operator", ["executes validated game objectives"], ["missions"], ["execute_order"], 45, 45, 45, 55, 6, 2, 50),
  role("role-associate", "associate", "Associate", ["supports teams", "builds reputation"], ["missions", "business"], ["basic_access"], 30, 35, 40, 40, 3, 1, 20),
  role("role-business-manager", "business_manager", "Business Manager", ["runs fictional businesses", "reports production"], ["economy", "business"], ["manage_business", "request_budget"], 60, 50, 50, 65, 8, 3, 45),
  role("role-driver", "driver", "Driver", ["moves units and supplies in the simulation"], ["transport"], ["move_assets"], 40, 40, 45, 55, 4, 2, 25),
  role("role-security", "security", "Security", ["protects locations", "reduces disruption"], ["defense"], ["defend_location"], 50, 50, 55, 60, 6, 2, 35),
  role("role-negotiator", "negotiator", "Negotiator", ["handles agreements", "reduces hostility"], ["relationships"], ["propose_agreement"], 55, 50, 60, 65, 8, 3, 40),
  role("role-accountant", "accountant", "Accountant", ["tracks generic resources", "flags shortages"], ["economy"], ["view_budget", "prepare_report"], 55, 55, 50, 70, 7, 3, 40),
  role("role-informant", "informant", "Informant", ["provides uncertain information"], ["intelligence"], ["submit_report"], 35, 35, 35, 45, 5, 1, 10),
];

export function createSyndicateWorld(seed: number, territories: Territory[] = []): SyndicateWorldState {
  return {
    version: 1,
    seed: Math.trunc(seed),
    tick: 0,
    syndicates: [],
    memberships: [],
    territories: structuredClone(territories),
    businesses: [],
    events: [],
    missionRules: [],
    sourceCases: [],
    ragRevision: "none",
    updatedAtTick: 0,
  };
}

export function applySyndicateCommand(stateInput: SyndicateWorldState, commandInput: SyndicateCommand): SyndicateWorldState {
  const state = structuredClone(stateInput);
  const command = SyndicateCommandSchema.parse(commandInput);
  if (command.tick < state.tick) throw new Error("Syndicate commands cannot target a past tick.");
  if (state.events.some(event => event.deterministicKey === command.commandId)) return state;
  state.tick = Math.max(state.tick, command.tick);

  switch (command.type) {
    case "create_syndicate":
      createSyndicate(state, command);
      break;
    case "recruit_member":
      recruitMember(state, command);
      break;
    case "assign_role":
      assignRole(state, command);
      break;
    case "influence_territory":
      influenceTerritory(state, command);
      break;
    case "establish_business":
      establishBusiness(state, command);
      break;
    case "set_relationship":
      setRelationship(state, command);
      break;
    case "resolve_internal_politics":
      resolveInternalPolitics(state, command.syndicateId, command.commandId);
      break;
    case "choose_strategy":
      chooseStrategy(state, command.syndicateId, command.strategy, command.reason, command.commandId);
      break;
    case "advance_tick":
      advanceTicks(state, command.ticks, command.commandId);
      break;
    case "update_world_from_rag":
      state.ragRevision = command.ragRevision;
      appendEvent(state, command.commandId, "world_updated", state.syndicates.map(item => item.id), command.npcIds, `World knowledge refreshed from RAG revision ${command.ragRevision}.`);
      break;
  }

  recalculateDerivedState(state);
  state.updatedAtTick = state.tick;
  state.events = state.events.slice(-10_000);
  return state;
}

export function evaluateSyndicateStrategies(state: SyndicateWorldState, syndicateId: string): StrategyEvaluation[] {
  const syndicate = requireSyndicate(state, syndicateId);
  const values: Array<[SyndicateStrategy, number, string[]]> = [
    ["economic_expansion", 100 - syndicate.power.economicPower + syndicate.resources.capital / 50_000, ["Economic power is below capacity", "Capital can fund generic businesses"]],
    ["territorial_consolidation", 100 - syndicate.power.territorialControl + syndicate.power.organizationalStability * 0.25, ["Territory control can be consolidated", "Stable organizations can sustain influence"]],
    ["recruitment", 100 - syndicate.resources.workforce + syndicate.power.socialInfluence * 0.2, ["Workforce is limited", "Social influence supports recruitment"]],
    ["diplomacy", averageRelationshipHostility(syndicate) + (100 - syndicate.power.politicalInfluence) * 0.3, ["Hostility creates diplomatic value", "Political influence is limited"]],
    ["public_legitimacy", 100 - syndicate.power.publicLegitimacy + syndicate.publicPressure * 0.5, ["Public legitimacy reduces resistance", "Public pressure is elevated"]],
    ["intelligence_gathering", 100 - syndicate.power.intelligenceCapacity + syndicate.publicPressure * 0.2, ["Information capacity is limited", "Pressure increases uncertainty"]],
    ["internal_stability", 100 - syndicate.power.organizationalStability + (100 - syndicate.internalLoyalty) * 0.8, ["Internal loyalty needs attention", "Stability prevents faction splits"]],
    ["defensive_preparation", syndicate.publicPressure + syndicate.power.fear * 0.25 + hostileRelationshipCount(syndicate) * 10, ["Pressure and hostile relations increase defensive utility"]],
  ];
  return values
    .map(([strategy, utility, reasons]) => ({ strategy, utility: round1(clamp(utility)), reasons }))
    .sort((a, b) => b.utility - a.utility || a.strategy.localeCompare(b.strategy));
}

export function selectDeterministicStrategy(state: SyndicateWorldState, syndicateId: string): StrategyEvaluation {
  return evaluateSyndicateStrategies(state, syndicateId)[0]!;
}

function createSyndicate(state: SyndicateWorldState, command: Extract<SyndicateCommand, { type: "create_syndicate" }>): void {
  if (state.syndicates.some(item => item.id === command.syndicateId)) throw new Error("Syndicate id already exists.");
  const syndicate: Syndicate = {
    id: command.syndicateId,
    name: command.name,
    leaderNpcId: command.leaderNpcId,
    hierarchy: structuredClone(DEFAULT_SYNDICATE_ROLES),
    memberIds: [],
    controlledTerritoryIds: [],
    businessIds: [],
    resources: { capital: 100_000, supplies: 50, workforce: 10, intelligence: 10, influence: 10 },
    reputation: {},
    relationships: {},
    power: emptyPower(),
    influence: 10,
    legitimacy: 50,
    internalLoyalty: 50,
    publicPressure: 10,
    activeStrategy: "internal_stability",
    strategySinceTick: state.tick,
    successionCandidates: [],
    sourceCaseIds: [],
  };
  state.syndicates.push(syndicate);
  recruitMember(state, {
    type: "recruit_member",
    commandId: `${command.commandId}-leader`,
    tick: command.tick,
    syndicateId: command.syndicateId,
    npcId: command.leaderNpcId,
    roleId: "role-leader",
    salary: 120,
    loyalty: 75,
    ambition: 70,
    fear: 15,
    trust: 70,
    satisfaction: 70,
    ideologicalAlignment: 65,
    heart: 65,
    competence: 75,
  });
  appendEvent(state, command.commandId, "created", [syndicate.id], [command.leaderNpcId], `${syndicate.name} was created as a fictional gameplay faction.`);
}

function recruitMember(state: SyndicateWorldState, command: Extract<SyndicateCommand, { type: "recruit_member" }>): void {
  const syndicate = requireSyndicate(state, command.syndicateId);
  if (!syndicate.hierarchy.some(role => role.id === command.roleId)) throw new Error("Role does not exist in the syndicate hierarchy.");
  if (state.memberships.some(item => item.npcId === command.npcId && item.syndicateId === command.syndicateId)) throw new Error("NPC is already a member.");
  const membership: SyndicateMembership = {
    npcId: command.npcId,
    syndicateId: command.syndicateId,
    roleId: command.roleId,
    loyalty: command.loyalty,
    ambition: command.ambition,
    fear: command.fear,
    trust: command.trust,
    satisfaction: command.satisfaction,
    ideologicalAlignment: command.ideologicalAlignment,
    heart: command.heart,
    competence: command.competence,
    joinedAtTick: state.tick,
    salary: command.salary,
    sharedHistory: 0,
    promotionOpportunity: 50,
    grievances: [],
  };
  state.memberships.push(membership);
  syndicate.memberIds.push(command.npcId);
  appendEvent(state, command.commandId, "member_recruited", [syndicate.id], [command.npcId], `${command.npcId} joined ${syndicate.name} in an abstract gameplay role.`);
}

function assignRole(state: SyndicateWorldState, command: Extract<SyndicateCommand, { type: "assign_role" }>): void {
  const syndicate = requireSyndicate(state, command.syndicateId);
  const membership = requireMembership(state, command.syndicateId, command.npcId);
  const role = syndicate.hierarchy.find(item => item.id === command.roleId);
  if (!role) throw new Error("Target role does not exist.");
  if (membership.loyalty < role.loyaltyRequirement || membership.heart < role.heartRequirement || membership.competence < role.competenceRequirement) {
    throw new Error("Member does not meet the role requirements.");
  }
  const previous = membership.roleId;
  membership.roleId = role.id;
  membership.satisfaction = clamp(membership.satisfaction + (role.successionPriority > rolePriority(syndicate, previous) ? 8 : -6));
  membership.promotionOpportunity = clamp(membership.promotionOpportunity - 15);
  appendEvent(state, command.commandId, "role_changed", [syndicate.id], [membership.npcId], `${membership.npcId} changed role from ${previous} to ${role.id}: ${command.reason}`);
}

function influenceTerritory(state: SyndicateWorldState, command: Extract<SyndicateCommand, { type: "influence_territory" }>): void {
  const syndicate = requireSyndicate(state, command.syndicateId);
  const territory = requireTerritory(state, command.territoryId);
  spendResources(syndicate.resources, command.resourceSpend);
  const spendScore = command.resourceSpend.capital / 10_000
    + command.resourceSpend.supplies * 0.5
    + command.resourceSpend.workforce * 1.5
    + command.resourceSpend.intelligence * 1.3
    + command.resourceSpend.influence * 1.7;
  const approachModifier = {
    community_presence: 1.0,
    commerce: 1.1,
    diplomacy: 0.9,
    information: 0.8,
    defensive_presence: 0.75,
  }[command.approach];
  const stabilityModifier = 0.5 + territory.stability / 200;
  const change = clampRange(spendScore * approachModifier * stabilityModifier, 0.1, 25);
  territory.influenceByFaction[syndicate.id] = clamp((territory.influenceByFaction[syndicate.id] ?? 0) + change);
  territory.loyaltyByFaction[syndicate.id] = clamp((territory.loyaltyByFaction[syndicate.id] ?? 25) + change * 0.4);
  territory.visibility = visibilityAfterInfluence(territory.visibility, territory.influenceByFaction[syndicate.id]!);
  territory.lastChangedAtTick = state.tick;
  resolveTerritoryOwner(state, territory, command.commandId);
  appendEvent(state, command.commandId, "territory_influenced", [syndicate.id], territory.id ? [] : [], `${syndicate.name} increased influence in ${territory.name} through ${command.approach}.`, territory.id);
}

function establishBusiness(state: SyndicateWorldState, command: Extract<SyndicateCommand, { type: "establish_business" }>): void {
  const syndicate = requireSyndicate(state, command.syndicateId);
  const territory = requireTerritory(state, command.territoryId);
  if (state.businesses.some(item => item.id === command.businessId)) throw new Error("Business id already exists.");
  if ((territory.influenceByFaction[syndicate.id] ?? 0) < 15) throw new Error("At least 15 territory influence is required.");
  if (syndicate.resources.capital < 25_000 || syndicate.resources.workforce < 3) throw new Error("Insufficient generic resources.");
  syndicate.resources.capital -= 25_000;
  syndicate.resources.workforce -= 3;
  const template = businessTemplate(command.category);
  const business: SyndicateBusiness = {
    id: command.businessId,
    name: command.name,
    category: command.category,
    ownerSyndicateId: syndicate.id,
    territoryId: territory.id,
    ...(command.managerNpcId ? { managerNpcId: command.managerNpcId } : {}),
    level: 1,
    workforceRequired: 3,
    capitalUpkeep: 250,
    productionPerTick: template.production,
    legitimacyEffect: template.legitimacy,
    visibilityEffect: template.visibility,
    stabilityEffect: template.stability,
    enabled: true,
  };
  state.businesses.push(business);
  syndicate.businessIds.push(business.id);
  appendEvent(state, command.commandId, "business_created", [syndicate.id], command.managerNpcId ? [command.managerNpcId] : [], `${business.name} opened as a fictional ${business.category} business.`, territory.id);
}

function setRelationship(state: SyndicateWorldState, command: Extract<SyndicateCommand, { type: "set_relationship" }>): void {
  const syndicate = requireSyndicate(state, command.syndicateId);
  const current = syndicate.relationships[command.targetFactionId] ?? neutralRelationship();
  current.trust = clamp(current.trust + command.trustDelta);
  current.respect = clamp(current.respect + command.respectDelta);
  current.fear = clamp(current.fear + command.fearDelta);
  current.hostility = clamp(current.hostility + command.hostilityDelta);
  current.dependency = clamp(current.dependency + command.dependencyDelta);
  current.status = relationshipStatus(current);
  syndicate.relationships[command.targetFactionId] = current;
  appendEvent(state, command.commandId, "agreement_changed", [syndicate.id, command.targetFactionId], [], `${syndicate.name} relationship changed: ${command.reason}`);
}

function resolveInternalPolitics(state: SyndicateWorldState, syndicateId: string, commandId: string): void {
  const syndicate = requireSyndicate(state, syndicateId);
  const members = state.memberships.filter(item => item.syndicateId === syndicate.id);
  for (const member of members) {
    const grievancePenalty = member.grievances.filter(item => item.resolvedAtTick === undefined).reduce((sum, item) => sum + item.severity, 0) * 0.08;
    const salaryPressure = member.salary > syndicate.resources.capital / Math.max(1, members.length) ? 4 : 0;
    const fearPenalty = Math.max(0, member.fear - 60) * 0.08;
    const opportunitySignal = (member.promotionOpportunity - 50) * 0.03;
    member.loyalty = clamp(member.loyalty + member.trust * 0.02 + member.sharedHistory * 0.01 + opportunitySignal - grievancePenalty - salaryPressure - fearPenalty);
    member.satisfaction = clamp(member.satisfaction + member.loyalty * 0.015 - grievancePenalty - salaryPressure);
  }
  const crisisMembers = members.filter(member => member.loyalty < 25 || member.satisfaction < 20);
  if (crisisMembers.length > 0) {
    appendEvent(state, `${commandId}-crisis`, "loyalty_crisis", [syndicate.id], crisisMembers.map(item => item.npcId), `${crisisMembers.length} member(s) entered a loyalty crisis.`);
  }
  const defectors = crisisMembers.filter(member => deterministicFraction(state.seed, state.tick, member.npcId) > 0.82 && member.ambition > 60);
  for (const defector of defectors) {
    state.memberships = state.memberships.filter(item => !(item.npcId === defector.npcId && item.syndicateId === syndicate.id));
    syndicate.memberIds = syndicate.memberIds.filter(id => id !== defector.npcId);
    appendEvent(state, `${commandId}-defection-${defector.npcId}`, "defection", [syndicate.id], [defector.npcId], `${defector.npcId} defected after unresolved internal pressure.`);
  }
}

function chooseStrategy(state: SyndicateWorldState, syndicateId: string, strategy: SyndicateStrategy, reason: string, commandId: string): void {
  const syndicate = requireSyndicate(state, syndicateId);
  syndicate.activeStrategy = strategy;
  syndicate.strategySinceTick = state.tick;
  appendEvent(state, commandId, "strategy_changed", [syndicate.id], [], `${syndicate.name} selected ${strategy}: ${reason}`);
}

function advanceTicks(state: SyndicateWorldState, ticks: number, commandId: string): void {
  for (let index = 0; index < ticks; index += 1) {
    state.tick += 1;
    for (const business of state.businesses.filter(item => item.enabled)) {
      const syndicate = state.syndicates.find(item => item.id === business.ownerSyndicateId);
      const territory = state.territories.find(item => item.id === business.territoryId);
      if (!syndicate || !territory || syndicate.resources.capital < business.capitalUpkeep) {
        business.enabled = false;
        continue;
      }
      syndicate.resources.capital -= business.capitalUpkeep;
      for (const [key, raw] of Object.entries(business.productionPerTick)) {
        const resource = key as keyof SyndicateResources;
        const modifier = territory.resourceModifiers[resource] ?? 1;
        syndicate.resources[resource] = Math.max(0, syndicate.resources[resource] + (raw ?? 0) * modifier * business.level);
      }
      syndicate.legitimacy = clamp(syndicate.legitimacy + business.legitimacyEffect * 0.02);
      syndicate.publicPressure = clamp(syndicate.publicPressure + business.visibilityEffect * 0.02);
      territory.stability = clamp(territory.stability + business.stabilityEffect * 0.01);
    }
    if (state.tick % 24 === 0) {
      for (const syndicate of state.syndicates) resolveInternalPolitics(state, syndicate.id, `${commandId}-politics-${state.tick}`);
    }
  }
  appendEvent(state, commandId, "resources_produced", state.syndicates.map(item => item.id), [], `World advanced by ${ticks} tick(s); businesses produced and consumed generic resources.`);
}

function recalculateDerivedState(state: SyndicateWorldState): void {
  for (const syndicate of state.syndicates) {
    const memberships = state.memberships.filter(item => item.syndicateId === syndicate.id);
    syndicate.internalLoyalty = averageOr(memberships.map(item => item.loyalty), 50);
    syndicate.controlledTerritoryIds = state.territories.filter(item => item.ownerFactionId === syndicate.id).map(item => item.id);
    syndicate.businessIds = state.businesses.filter(item => item.ownerSyndicateId === syndicate.id).map(item => item.id);
    syndicate.power = calculatePower(state, syndicate, memberships);
    syndicate.influence = round1((syndicate.power.socialInfluence + syndicate.power.politicalInfluence + syndicate.resources.influence) / 3);
    syndicate.legitimacy = round1((syndicate.legitimacy * 0.5 + syndicate.power.publicLegitimacy * 0.5));
    syndicate.successionCandidates = memberships
      .map(member => ({ member, priority: rolePriority(syndicate, member.roleId) + member.competence * 0.3 + member.loyalty * 0.2 + member.ambition * 0.1 }))
      .filter(item => item.member.npcId !== syndicate.leaderNpcId)
      .sort((a, b) => b.priority - a.priority || a.member.npcId.localeCompare(b.member.npcId))
      .slice(0, 5)
      .map(item => item.member.npcId);
  }
}

function calculatePower(state: SyndicateWorldState, syndicate: Syndicate, memberships: SyndicateMembership[]): PowerProfile {
  const territories = state.territories.filter(item => item.ownerFactionId === syndicate.id);
  const businesses = state.businesses.filter(item => item.ownerSyndicateId === syndicate.id && item.enabled);
  const territoryShare = state.territories.length > 0 ? territories.length / state.territories.length * 100 : 0;
  const economic = clamp(Math.log10(Math.max(1, syndicate.resources.capital)) * 18 - 20 + businesses.length * 4);
  const social = clamp(syndicate.resources.influence * 0.5 + syndicate.legitimacy * 0.3 + averageOr(territories.map(item => item.loyaltyByFaction[syndicate.id] ?? 0), 0) * 0.2);
  const intelligence = clamp(syndicate.resources.intelligence * 0.65 + averageOr(memberships.map(item => item.competence), 0) * 0.35);
  const stability = clamp(syndicate.internalLoyalty * 0.6 + averageOr(memberships.map(item => item.satisfaction), 50) * 0.25 + averageOr(territories.map(item => item.stability), 50) * 0.15);
  const legitimacy = clamp(syndicate.legitimacy * 0.7 + averageOr(businesses.map(item => 50 + item.legitimacyEffect), 50) * 0.3 - syndicate.publicPressure * 0.2);
  const fear = clamp(averageOr(memberships.map(item => item.fear), 0) * 0.45 + hostileRelationshipCount(syndicate) * 8 + syndicate.publicPressure * 0.2);
  return {
    territorialControl: round1(territoryShare),
    economicPower: round1(economic),
    politicalInfluence: round1(clamp(syndicate.reputation.institutions ?? syndicate.legitimacy * 0.55)),
    socialInfluence: round1(social),
    intelligenceCapacity: round1(intelligence),
    organizationalStability: round1(stability),
    publicLegitimacy: round1(legitimacy),
    fear: round1(fear),
  };
}

function resolveTerritoryOwner(state: SyndicateWorldState, territory: Territory, commandId: string): void {
  const ordered = Object.entries(territory.influenceByFaction).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const winner = ordered[0];
  const runnerUp = ordered[1];
  if (!winner || winner[1] < 60 || (runnerUp && winner[1] - runnerUp[1] < 15)) return;
  if (territory.ownerFactionId === winner[0]) return;
  const previous = territory.ownerFactionId;
  territory.ownerFactionId = winner[0];
  territory.visibility = "controlled";
  territory.lastChangedAtTick = state.tick;
  appendEvent(state, `${commandId}-owner`, "territory_changed_owner", [winner[0], ...(previous ? [previous] : [])], [], `${territory.name} changed gameplay control through validated influence thresholds.`, territory.id);
}

function spendResources(resources: SyndicateResources, spend: SyndicateResources): void {
  for (const key of Object.keys(spend) as Array<keyof SyndicateResources>) {
    if (spend[key] > resources[key]) throw new Error(`Insufficient ${key}.`);
  }
  for (const key of Object.keys(spend) as Array<keyof SyndicateResources>) resources[key] -= spend[key];
}

function appendEvent(
  state: SyndicateWorldState,
  deterministicKey: string,
  type: SyndicateEvent["type"],
  factionIds: string[],
  npcIds: string[],
  summary: string,
  territoryId?: string,
): void {
  if (state.events.some(event => event.deterministicKey === deterministicKey)) return;
  state.events.push({
    id: `syndicate-event-${deterministicKey}`.slice(0, 240),
    tick: state.tick,
    type,
    factionIds: [...new Set(factionIds)],
    npcIds: [...new Set(npcIds)],
    ...(territoryId ? { territoryId } : {}),
    summary: summary.slice(0, 1_000),
    deterministicKey,
  });
}

function businessTemplate(category: SyndicateBusiness["category"]): {
  production: Partial<SyndicateResources>;
  legitimacy: number;
  visibility: number;
  stability: number;
} {
  const templates: Record<SyndicateBusiness["category"], ReturnType<typeof businessTemplate>> = {
    retail: { production: { capital: 700, influence: 0.2 }, legitimacy: 2, visibility: 2, stability: 1 },
    transport: { production: { capital: 550, supplies: 0.8 }, legitimacy: 1, visibility: 2, stability: 1 },
    security: { production: { capital: 450, influence: 0.4 }, legitimacy: 1, visibility: 3, stability: 3 },
    entertainment: { production: { capital: 800, influence: 0.5 }, legitimacy: 1, visibility: 4, stability: 0 },
    construction: { production: { capital: 650, supplies: 0.5 }, legitimacy: 2, visibility: 3, stability: 2 },
    logistics: { production: { capital: 600, supplies: 1.2 }, legitimacy: 1, visibility: 2, stability: 1 },
    hospitality: { production: { capital: 650, influence: 0.3 }, legitimacy: 3, visibility: 2, stability: 2 },
    technology: { production: { capital: 500, intelligence: 0.8 }, legitimacy: 2, visibility: 1, stability: 1 },
    real_estate: { production: { capital: 750, influence: 0.2 }, legitimacy: 2, visibility: 3, stability: 2 },
    media: { production: { capital: 400, influence: 0.9, intelligence: 0.2 }, legitimacy: 1, visibility: 4, stability: 0 },
  };
  return templates[category];
}

function neutralRelationship(): FactionRelationship {
  return { trust: 50, respect: 50, fear: 0, hostility: 0, dependency: 0, status: "neutral", activeAgreements: [], grievances: [] };
}

function relationshipStatus(relationship: FactionRelationship): FactionRelationship["status"] {
  if (relationship.hostility >= 70) return "hostile";
  if (relationship.hostility >= 45 || relationship.trust < 25) return "rival";
  if (relationship.trust >= 75 && relationship.respect >= 65) return "allied";
  if (relationship.trust >= 60 || relationship.dependency >= 55) return "cooperative";
  return "neutral";
}

function visibilityAfterInfluence(current: Territory["visibility"], influence: number): Territory["visibility"] {
  const order: Territory["visibility"][] = ["unknown", "rumored", "observed", "mapped", "controlled"];
  const target = influence >= 60 ? 4 : influence >= 35 ? 3 : influence >= 15 ? 2 : influence > 0 ? 1 : 0;
  return order[Math.max(order.indexOf(current), target)]!;
}

function requireSyndicate(state: SyndicateWorldState, id: string): Syndicate {
  const syndicate = state.syndicates.find(item => item.id === id);
  if (!syndicate) throw new Error(`Syndicate not found: ${id}`);
  return syndicate;
}

function requireMembership(state: SyndicateWorldState, syndicateId: string, npcId: string): SyndicateMembership {
  const membership = state.memberships.find(item => item.syndicateId === syndicateId && item.npcId === npcId);
  if (!membership) throw new Error(`Membership not found: ${syndicateId}/${npcId}`);
  return membership;
}

function requireTerritory(state: SyndicateWorldState, id: string): Territory {
  const territory = state.territories.find(item => item.id === id);
  if (!territory) throw new Error(`Territory not found: ${id}`);
  return territory;
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
  return { id, kind, title, responsibilities, workAreas, permissions, upkeep, loyaltyRequirement, heartRequirement, competenceRequirement, influence, accessLevel, factionRelationshipModifiers: {}, successionPriority };
}

function rolePriority(syndicate: Syndicate, roleId: string): number {
  return syndicate.hierarchy.find(role => role.id === roleId)?.successionPriority ?? 0;
}

function emptyPower(): PowerProfile {
  return { territorialControl: 0, economicPower: 0, politicalInfluence: 0, socialInfluence: 0, intelligenceCapacity: 0, organizationalStability: 0, publicLegitimacy: 0, fear: 0 };
}

function averageRelationshipHostility(syndicate: Syndicate): number {
  return averageOr(Object.values(syndicate.relationships).map(item => item.hostility), 0);
}

function hostileRelationshipCount(syndicate: Syndicate): number {
  return Object.values(syndicate.relationships).filter(item => item.status === "hostile").length;
}

function deterministicFraction(seed: number, tick: number, key: string): number {
  let hash = (seed ^ tick) >>> 0;
  for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619) >>> 0;
  return hash / 0xffffffff;
}

function averageOr(values: number[], fallback: number): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function clamp(value: number): number {
  return clampRange(value, 0, 100);
}

function clampRange(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
