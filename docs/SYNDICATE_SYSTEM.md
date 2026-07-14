# Fictional syndicate, power and territory system

## Scope

This module is a deterministic strategy-game simulation. It uses real documented cases and public institutions only as source references for broad historical and organizational patterns. All private people, leaders, members, conversations, covert labels and gameplay actions are fictional.

## OpenRA architectural reference

OpenRA is used as a design reference, not embedded as a runtime dependency and not copied into the TypeScript game.

Conceptual mappings:

| OpenRA concept | T1 implementation |
|---|---|
| actors composed from traits | Miniplex entities and focused components |
| faction definitions | `Syndicate` and role definitions |
| orders | schema-validated `SyndicateCommand` values |
| production queues | deterministic businesses, upkeep and resource production |
| technology prerequisites | role access levels and command validation |
| fog of war | authoritative territory visibility and faction knowledge |
| mission scripting | versioned command/event sequences |
| AI objectives | deterministic strategy utility evaluator |
| replay | append-only deterministic event log |

OpenRA code is GPL-licensed. This project transfers only architectural ideas; it does not copy source code or assets.

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

The default game hierarchy is a fictional Danish decentralized council model:

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

This uses the abstract organizational pattern of a central council, deputies and semi-autonomous local teams. It does not reproduce real initiation rules, rituals or operational procedures.

## Diverse fictional backgrounds

Background presets may include local trade workers, motorcycle-club social circles, Muslim family/community networks, multilingual new-Dane communities, mental-health support experience and recovery-peer experience.

These are narrative/context fields only. Religion, ethnicity, psychiatric diagnosis, disability, recovery and substance-use history have **no** direct modifier for criminality, aggression, honesty, competence, loyalty or risk. Support needs may influence accessibility, scheduling and voluntary services only.

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

Territories contain geometry, population, prosperity, stability, visibility, locations, resource modifiers and influence/loyalty by faction. All changes run through validated commands.

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

No detailed real-world financial-crime procedures are modeled.

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

## RAG world update

`Update the world` performs a full rebuild of the separate persistent RAG index without modifying source files. The new revision is sent through `update_world_from_rag`, records all current syndicate NPC IDs and becomes available for role-relevant retrieval on subsequent deterministic updates.

The system does not copy the full RAG corpus into every NPC. NPCs retrieve bounded, relevant context, which avoids context leakage and uncontrolled token growth.
