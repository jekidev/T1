# Fictional syndicate, power and territory system

## Scope

This module is a deterministic strategy-game simulation. It uses real documented cases and public institutions only as source references for broad historical and organizational patterns. All private people, leaders, members, conversations, covert labels and gameplay actions are fictional.

It must not generate operational instructions for real-world crime, violence, financial abuse, coercion or evasion.

## OpenRA architectural reference

OpenRA is used as a design reference, not embedded as a runtime dependency and not copied into the TypeScript game.

| OpenRA concept | T1 implementation |
|---|---|
| actors composed from traits | focused syndicate, membership, business and territory records |
| faction definitions | versioned `Syndicate` and role definitions |
| orders | schema-validated `SyndicateCommand` values |
| production queues | deterministic business upkeep and generic resource production |
| technology prerequisites | role requirements, access levels and command validation |
| fog of war | authoritative territory visibility and faction knowledge |
| mission scripting | data-only `MissionRule` triggers and command templates |
| AI objectives | deterministic strategy utility evaluator |
| replay | stable command IDs and append-only deterministic events |
| synchronization | commands/events are the intended multiplayer boundary |

OpenRA code is GPL-licensed. This project transfers only architectural ideas; it does not copy source code, assets or implementation text.

## Authority model

```text
Player / local AI / future LLM advisor
              ↓
      SyndicateCommand schema
              ↓
permission + resource + rules validation
              ↓
 deterministic SyndicateSystem
              ↓
    events, replay and UI projection
```

An LLM may suggest strategy, dialogue or explanations. It cannot directly modify resources, loyalty, territory, relationships, ownership or health.

## Structure

The default game hierarchy is a fictional Danish decentralized council/cell model:

- Council Lead
- Deputy Coordinator
- Council Advisor
- District Coordinator
- Project Operator
- Associate
- Business Manager
- Mobility Coordinator
- Safety Coordinator
- Community Negotiator
- Resource Controller
- Information Contact

The persisted role kinds remain provider-neutral (`leader`, `underboss`, `advisor`, `captain`, and so on), while UI titles may be localized. This uses the abstract pattern of a central council, deputies and semi-autonomous local teams. It does not reproduce real initiation rules, rituals or operational procedures.

## Diverse fictional backgrounds

Background presets may include local trade workers, motorcycle-club social circles, Muslim family/community networks, multilingual new-Dane communities, mental-health support experience and recovery-peer experience.

These are narrative/context fields only. Religion, ethnicity, psychiatric diagnosis, disability, recovery and substance-use history have **no** direct modifier for criminality, aggression, honesty, competence, loyalty or risk. Support needs may influence accessibility, scheduling and voluntary services only.

## Source cases

`SyndicateSourceCase` stores source title, institution, jurisdiction, year, URL, verification state, pattern tags and an explicit fictionalization rule.

Rules:

- public institutions and public events may remain real when sourced
- private people and identifying details are replaced by fictional characters
- uncertain claims remain unverified or assessed
- source provenance is separate from balance values
- operational details that could enable misconduct are excluded

## Power profile

Power is decomposed into:

- territorial control
- economic power
- political influence
- social influence
- intelligence capacity
- organizational stability
- public legitimacy
- fear

Fear may increase short-term compliance but reduces long-term stability. Legitimacy, social influence and organizational stability support durable growth.

## Territory and economy

Territories contain geometry, population, prosperity, stability, visibility, locations, resource modifiers and influence/loyalty by faction. A client cannot directly set ownership. Control changes only after validated influence thresholds and a sufficient lead over competitors.

Fog states:

```text
unknown → rumored → observed → mapped → controlled
```

Businesses use generic fictional sectors:

- retail
- transport
- security
- entertainment
- construction
- logistics
- hospitality
- technology
- real estate
- media

Resources are limited to capital, supplies, workforce, intelligence and influence. No detailed real-world financial-crime procedures are modeled.

## Loyalty and internal politics

Membership tracks loyalty, ambition, fear, trust, satisfaction, ideological alignment, heart, competence, salary, shared history, promotion opportunity and grievances.

Deterministic politics considers treatment, payment pressure, unresolved grievances, excessive fear, trust, shared history and promotion opportunity. It can currently generate loyalty crises, succession rankings and defections.

Promotion/demotion, reconciliation, alliance blocs and full faction-split spawning use the same command/event boundary but require additional UI flows before they are complete.

## Strategy AI

The deterministic evaluator ranks:

```text
economic_expansion
territorial_consolidation
recruitment
diplomacy
public_legitimacy
intelligence_gathering
internal_stability
defensive_preparation
```

The intended layering is:

```text
LLM → proposals, dialogue and explanations
Yuka adapter → goals, utility and perception
Mistreevous adapter → tactical behaviour trees
Miniplex-compatible state → authoritative simulation
Validated commands → all state changes
```

The deterministic utility selector and command/event boundary are implemented. Yuka and Mistreevous runtime adapters are not yet claimed complete.

## UI

The integrated board dashboard provides:

- Hierarchy
- Territory
- Economy
- Members
- Relationships
- Intelligence
- Businesses
- Events
- Reputation
- Strategy

It supports faction creation, recruitment, role selection, territory influence, deterministic strategy choice and downloadable employee gameplay briefs.

The requested visualization stack is reserved behind adapters:

- XYFlow for hierarchy graphs
- Dnd-kit for role/unit organization
- D3 for economy, relationship and power graphs
- MapLibre for geographic territory rendering
- React Three Fiber for local 3D scenes

Those dependencies are not marked implemented on this branch because the workspace lockfile is stale and CI is not exposing usable logs. They require lockfile regeneration, license review, bundle analysis and green validation before integration.

## Employee brief

The shareable Markdown brief contains visible gameplay state, responsibilities, resources, strategy, members, legitimacy and stability. It excludes hidden fog data, private RAG documents, credentials, raw prompts and protected source details.

## RAG world update

`Update the world` performs a full rebuild of the separate persistent RAG index without modifying source files. The new revision is sent through `update_world_from_rag`, records current NPC IDs and becomes available for role-relevant retrieval on subsequent deterministic updates.

The system does not copy the full RAG corpus into every NPC. NPCs retrieve bounded, relevant context, avoiding context leakage and uncontrolled token growth.

## Definition-of-done status

Implemented foundation:

- create a fictional faction
- recruit NPCs and assign roles through commands
- influence territory and apply fog states
- produce and consume generic resources
- change faction relationships
- apply loyalty consequences and deterministic defections
- select long-term strategies deterministically
- save command/event-compatible syndicate state
- use a dashboard and employee brief

Still incomplete:

- full multiplayer replication and desync recovery
- complete promotion/demotion/reconciliation/split UI flows
- Yuka and Mistreevous runtime adapters
- XYFlow, Dnd-kit, D3, MapLibre and React Three Fiber adapters
- production-tested mission-rule executor
- regenerated lockfile and verified green typecheck/tests/build
