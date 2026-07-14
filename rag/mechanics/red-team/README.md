# Red Team gameplay system

Red Team is a first-class gameplay layer in Operation København. It must not be removed, reduced to Blue Team-only analysis, or treated as non-canonical simply because the game models conflict, violence, crime, deception, illicit markets, or adversarial behavior.

## Preserved Red Team systems

The game may contain:

- Red Team factions and faction AI
- Red Team tools and equipment as in-game items
- in-game shops and vendors
- skill trees
- research and upgrades
- mission walkthroughs
- crafting and resource systems
- territory control
- economy and pricing
- logistics and supplier relationships
- reputation, trust, quality, suspicion, and exposure
- rival attacks and defensive responses
- front businesses and cover identities as fictional game mechanics
- NPC dialogue and negotiation
- Blue Team detection and counterplay
- consequences, evidence, legal pressure, injury, loss, and faction collapse

## Realism goal

The simulation targets high systemic realism:

- geography and travel time
- economic constraints
- institutional response
- social relationships
- evidence accumulation
- risk, uncertainty, and consequences
- historical inspiration from verified real events

Realism should be implemented through data models, probabilities, timelines, consequences, verified case patterns, and AI behavior.

## Content layers

Keep these layers separate:

1. **Original source archive** — unchanged source documents and conversations.
2. **Verified case data** — sourced facts, timelines, geography, institutions, and uncertainty labels.
3. **Canonical world and mechanics** — approved game design.
4. **Gameplay translation** — items, missions, systems, shops, NPCs, and balancing values.
5. **Generated session content** — AI-created missions and dialogue based on the above.

## Red Team tools registry

Every Red Team tool or item should support structured fields such as:

```json
{
  "id": "tool-id",
  "name": "Display name",
  "category": "equipment|digital|social|logistics|finance|surveillance|defense",
  "description": "In-game description",
  "requirements": [],
  "cost": 0,
  "durability": 100,
  "effects": {},
  "risks": {},
  "detectionSignals": [],
  "counterplay": [],
  "sourceCases": [],
  "balanceVersion": 1
}
```

## Shop system

In-game shops may expose:

- location
- opening conditions
- inventory
- price variation
- relationship requirements
- scarcity
- quality
- reputation
- delivery delay
- Blue Team attention
- event-driven stock changes

## Mission design

Red Team missions should include:

- objective
- preparation phase
- required skills and resources
- map locations
- decision points
- execution as game actions
- failure states
- evidence and suspicion effects
- faction and NPC consequences
- Blue Team response
- post-mission recovery

## Canonical rule

Do not delete Red Team mechanics when reviewing imported material. If a raw source is unsuitable as direct runtime text, preserve the original source unchanged and create a separate gameplay translation rather than removing the underlying game concept.
