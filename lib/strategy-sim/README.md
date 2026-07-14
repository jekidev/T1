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

The headless suite includes two factions, 100 units, resource production, territory capture, combat, command rejection, local AI fallback, and save/load determinism.

## Deferred systems

The following system slots are registered but disabled in Phase A:

- `tactical-intent` — future Mistreevous adapter
- `path-intent` — future Recast Navigation JS worker
- `collision-avoidance` — future Rapier/Recast movement bridge

The LLM strategy layer is intentionally not implemented until this command and simulation layer passes CI.
