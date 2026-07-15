# Strategy ECS analysis and migration plan

## Scope

This document applies only to the new headless strategy layer. It does not replace the existing tactical board, React UI, map integration, storyline RAG, turn dashboard, or graphics work.

## 1. Existing ECS status

The repository does not currently contain an Entity Component System. `BoardEntity` objects are stored in a Zustand-backed `BoardState`, and the current deterministic turn function updates arrays of faction records directly.

Miniplex will therefore be introduced as a new authoritative simulation library under `lib/strategy-sim` rather than inserted into React components.

## 2. Current game-state ownership

Current editor and scenario state is primarily owned by:

- `BoardState` JSON persisted by the API
- `useBoardStore` in the frontend
- `simulateTurn()` for the current lightweight turn model

State is not currently owned by Three.js. The graphics-lab work is isolated from `main`, so no Three.js scene is authoritative for gameplay.

Migration rule:

- Miniplex owns high-volume strategy entities and fixed-tick simulation state.
- `BoardState` remains the persisted scenario/editor representation during migration.
- Adapters will translate snapshots between ECS and board state.
- React and future Three.js renderers consume immutable snapshots and interpolation data.

## 3. Expected entity volume

The current board UI is designed for tens to low hundreds of manually placed entities. The strategy layer is designed initially for:

- baseline test: 100 units
- normal scenarios: 500–2,000 active strategy entities
- future performance target: 10,000 lightweight ECS entities with AI/navigation LOD

The initial Phase A implementation validates 100 units headlessly without rendering.

## 4. Strategy timing model

The project is hybrid:

- existing player-facing scenarios use turns and phases
- the strategy layer uses a deterministic fixed tick
- UI may pause, single-step, run at normal speed, or accelerate
- future boardgame.io support remains an optional adapter for explicit turn-based modes

The fixed tick is authoritative. Render FPS does not affect simulation results.

## 5. Current navigation

The existing project has A*/Dijkstra-related concepts and map overlays, but no shared navmesh/crowd authority for high-volume strategy units. Phase A implements only deterministic direct movement toward validated targets.

Recast Navigation JS is reserved for Phase B and will own path intent, not authoritative transforms.

## 6. Existing AI systems

The repository currently contains:

- OpenRouter-backed advisor roles
- story and Red Team/Blue Team generation
- persistent RAG context
- deterministic local turn calculations
- developer AI proposal/approval concepts

There is no ECS tactical AI or behavior-tree runtime on `main`.

Mistreevous and LLM strategy agents are intentionally deferred until commands, validation, fixed ticks, replay, and deterministic tests are stable.

## 7. LLM connection point

The existing backend route `artifacts/api-server/src/routes/advisor.ts` is the current OpenRouter integration point.

Future strategic LLM integration must connect through a server-side strategy-agent adapter that returns proposed intentions. It must not mutate the ECS world directly. Every proposal must pass through the same command schemas and validators used by players and local bots.

## 8. Worker candidates

Phase A runs headlessly on the main Node thread for deterministic testing.

Future worker candidates:

- navmesh generation
- path request batching
- crowd updates
- large visibility/fog calculations
- replay compression
- expensive strategic evaluation

Command validation, event ordering, authoritative reducers, and save serialization remain deterministic and centrally controlled.

## 9. Deterministic systems

The following must be deterministic for identical initial state, seed, commands, and tick count:

- command ordering and rejection
- evidence gathering and blackmail resolution
- movement integration
- combat resolution
- economy and production
- territory capture
- morale changes
- event ordering
- snapshot serialization
- replay

Wall-clock timestamps, random UUIDs, render FPS, network latency, and LLM text must not influence authoritative results.

## 10. Concrete Miniplex migration plan

### Phase A1 — headless core

1. Add `@workspace/strategy-sim` as an independent workspace library.
2. Define small composable components and `StrategyEntity`.
3. Create a Miniplex world and typed queries.
4. Add deterministic IDs, seeded random service, fixed clock, command queue, validators, and event log.
5. Implement movement, combat, economy, production, territory, in-game blackmail, morale, and cleanup systems.
6. Add save/load snapshots and replay from commands.
7. Add headless tests with two factions and 100 units.

### Phase A2 — bridge to the existing game

1. Create a `BoardState -> StrategySnapshot` importer.
2. Create a `StrategySnapshot -> BoardState` presentation adapter.
3. Add an opt-in strategy mode flag per scenario.
4. Keep the current `simulateTurn()` path as fallback until parity tests pass.
5. Add inspection and blackmail panels without making React authoritative.

### Phase B and later

- Recast Navigation JS worker and formation movement
- Mistreevous behavior contexts and blackboards
- server-side provider-agnostic strategy advisor
- optional boardgame.io adapter

## Fixed system order

Phase A uses this stable order:

1. command execution
2. local strategic policy
3. tactical intent
4. in-game blackmail resolution
5. path intent extension point
6. movement
7. collision/avoidance extension point
8. combat
9. economy
10. production and construction
11. territory and visibility
12. morale and cleanup
13. event finalization and snapshot publication

Extension points that are not implemented in Phase A remain disabled and do not mutate state.
