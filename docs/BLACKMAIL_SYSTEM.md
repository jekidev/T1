# In-game blackmail subsystem

## Scope

This subsystem models blackmail as an abstract strategy-game mechanic between fictional factions. It does not provide real-world instructions, target discovery, communication templates, or operational guidance.

The implementation replaces the supplied global JavaScript/DOM pattern with a typed, headless and deterministic architecture.

## Architecture

```text
React panel / local bot / future AI advisor
                    ↓
             BlackmailService
                    ↓
        CommandEnvelopeSchema + queue
                    ↓
          command authority validation
                    ↓
              BlackmailSystem
                    ↓
       ECS components + deterministic events
```

The subsystem is not authoritative outside `@workspace/strategy-sim`. UI code may display target views and submit commands, but it may not directly edit evidence, reputation, cooldowns or outcomes.

## Components

Faction entities created with `createFactionEntity()` receive:

```ts
interface InfluenceComponent {
  reputation: number
  operationalSecurity: number
  suspicion: number
  points: number
}

interface BlackmailComponent {
  resistance: number
  dossiers: Record<string, BlackmailDossier>
  compromisedBy: Record<string, boolean>
  pendingActions: PendingBlackmailAction[]
  intimidatedUntilTick?: number
  isolatedUntilTick?: number
}
```

A dossier belongs to the acting faction and is keyed by target faction ID. This allows different factions to hold different evidence quality and cooldown state against the same target.

## Commands

### Gather evidence

```ts
{
  type: "gather_blackmail_evidence",
  targetFactionId: "faction-blue"
}
```

The fixed-tick system validates:

- actor and target exist
- actor and target support the subsystem
- actor is not targeting itself
- target-specific cooldown is zero
- actor has enough in-game reputation

The deterministic outcome updates evidence quality, reputation, operational security and possible target suspicion.

### Execute blackmail

```ts
{
  type: "execute_blackmail",
  targetFactionId: "faction-blue",
  approach: "fear" | "greed" | "isolation"
}
```

The system additionally validates minimum evidence quality. The success probability is derived from configured base probability, evidence quality, target resistance and target operational security.

## Effects

### Fear

- reduces target-unit morale
- clears active target combat intents
- applies `intimidatedUntilTick`
- awards strategy points

### Greed

- transfers only available in-game treasury
- never creates a negative target treasury
- modifies faction reputation
- awards strategy points

### Isolation

- lowers bilateral relation values
- lowers target reputation and operational security
- applies `isolatedUntilTick`
- awards strategy points

Failure increases acting-faction suspicion, reduces reputation, and damages the target's relation toward the actor.

## Determinism

The implementation uses `DeterministicRandom` from the strategy simulation. It does not use:

- `Math.random()`
- wall-clock timestamps for outcomes
- render frame rate
- DOM state
- network responses
- LLM output

Identical seed, initial snapshot, commands and tick count produce an identical canonical snapshot and event order.

## Service API

```ts
const service = simulation.blackmail

service.getTargets(actorFactionId)
service.canGatherEvidence(actorFactionId, targetFactionId)
service.canExecute(actorFactionId, targetFactionId)
service.canBlackmail(actorFactionId, targetFactionId)
service.gatherEvidence(actorFactionId, targetFactionId)
service.execute(actorFactionId, targetFactionId, "fear")
service.executeBlackmail(actorFactionId, targetFactionId, "isolation")
```

`gatherEvidence()` and `executeBlackmail()` return the command-queue validation result. A returned `accepted: true` means the command entered the queue; subsystem-specific resource, evidence and cooldown checks occur authoritatively on the scheduled tick and are recorded as events.

## Events

The subsystem emits:

- `command.queued`
- `command.executed`
- `command.rejected`
- `blackmail.evidence_gathered`
- `blackmail.resolved`

Event payloads contain IDs, numeric factors and simulation results. They do not contain secrets or provider credentials.

## React integration contract

A future React panel should:

1. call `getTargets(actorFactionId)` to produce its view model
2. call service methods rather than mutating faction objects
3. refresh from a new simulation snapshot after ticks resolve
4. render event-log outcomes
5. disable buttons using `canGatherEvidence()` and `canExecute()`
6. avoid inline HTML injection and global browser objects

The headless package deliberately contains no modal, inline style, `document` access or global `window.BlackmailModule` export.

## Configuration

Pass overrides when creating the simulation:

```ts
const simulation = new StrategySimulation({
  seed: 42,
  blackmail: {
    evidenceMinQuality: 25,
    cooldownTicks: 160,
    fearBaseSuccess: 0.75,
  },
})
```

Configuration is validated when the simulation starts. Probabilities must be between 0 and 1, percentage-like values between 0 and 100, and tick durations non-negative integers.

## Tests

The strategy test suite covers:

- deterministic evidence gathering
- deterministic resolution
- fear effects
- greed treasury conservation
- cooldown rejection
- target eligibility
- self-target rejection
- canonical snapshot equality
- blackmail state across save/load
