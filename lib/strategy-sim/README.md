# @workspace/strategy-sim

Headless deterministic strategy simulation for Operation København.

## Responsibilities

This package owns:

- Miniplex ECS entities and queries
- fixed simulation ticks
- validated command execution
- deterministic movement and combat
- economy and resource extraction
- production and construction
- territory capture
- in-game blackmail, evidence and influence state
- morale and entity cleanup
- local rule-based AI fallback
- event logs
- snapshots and deterministic save/load

It does not import React, Three.js, Rapier, OpenRouter, RAG, browser APIs, or the tactical board store.

## Authority model

```text
Player / local bot / future behavior tree / future LLM proposal
                          ↓
                  CommandEnvelopeSchema
                          ↓
                   CommandQueue
                          ↓
               authority and rule validation
                          ↓
                  fixed-tick systems
                          ↓
                 immutable snapshots
                          ↓
             React / board / Three presentation
```

No AI integration may mutate `StrategyWorld` directly.

## Commands

```ts
simulation.submitCommand({
  id: simulation.nextCommandId("player"),
  submittedTick: simulation.clock.tick + 1,
  actorFactionId: "faction-red",
  command: {
    type: "move_units",
    entityIds: ["red-unit-001"],
    target: { x: 10, y: 0, z: 4 },
  },
})
```

## In-game blackmail service

The old global DOM module is not used. The integrated service submits ordinary validated commands and can be consumed by a later React panel.

```ts
const targets = simulation.blackmail.getTargets("faction-red")

simulation.blackmail.gatherEvidence(
  "faction-red",
  "faction-blue",
)

simulation.blackmail.executeBlackmail(
  "faction-red",
  "faction-blue",
  "isolation",
)
```

Available approaches:

- `fear` — temporarily disrupts target combat intent and reduces morale
- `greed` — transfers available in-game treasury
- `isolation` — reduces diplomatic relations and applies a temporary isolation state

Evidence, reputation costs, operational-security loss, cooldowns, probability checks and effects are resolved during the fixed tick with `DeterministicRandom`. The subsystem never calls `Math.random()` and cannot mutate state outside the command pipeline.

See `docs/BLACKMAIL_SYSTEM.md` for the full integration contract.

## Fixed stepping

```ts
simulation.setPaused(true)
simulation.step(1) // deterministic debugger step
simulation.step(100)
```

`step()` is independent of render FPS. `runScheduledFrame()` applies the configured speed multiplier for UI schedulers.

## Tests

```bash
pnpm test:strategy
```

The headless suite includes two factions, 100 units, resource production, territory capture, combat, command rejection, local AI fallback, blackmail resolution, cooldown validation, and save/load determinism.

## Deferred systems

The following system slots are registered but disabled in Phase A:

- `tactical-intent` — future Mistreevous adapter
- `path-intent` — future Recast Navigation JS worker
- `collision-avoidance` — future Rapier/Recast movement bridge

The LLM strategy layer is intentionally not implemented until this command and simulation layer passes CI.
