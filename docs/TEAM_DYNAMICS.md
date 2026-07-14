# Realtime Blue / Red team dynamics

## Purpose

The game calculates a live estimate for both sides after every resolved turn or relevant event:

- estimated success percentage
- collective morale
- moral spectrum
- risk pressure
- alignment coherence
- model confidence
- explainable contributing factors

Blue and Red are not aliases for good and evil. Each side has its own 0–100 moral spectrum.

```text
0   = destructive / self-serving extreme
50  = morally mixed
100 = prosocial / altruistic extreme
```

A high moral score is not an automatic victory bonus. It can influence legitimacy, coherence and morale, while operational success still depends on resources, intelligence, cohesion, territory, exposure, evidence and momentum.

## Player onboarding

New Game asks the player to choose:

```text
Red Team
Blue Team
Observer
```

The user then selects an initial self-assessment from 0 to 100.

This value is stored as:

```ts
interface PlayerAlignmentProfile {
  side: "red" | "blue" | "observer"
  initialSpectrum: number
  currentSpectrum: number
  karma: number
  riskIndex: number
  lastChange: number
  history: AlignmentHistoryEvent[]
}
```

The initial value is only a starting belief. After game creation, actions and consequences move `currentSpectrum` through versioned history events.

## Deterministic moral movement

Moral movement uses explicit signals:

- prosocial impact
- integrity impact
- civilian impact
- proportionality
- risk change
- karma change

A single event is capped to a limited movement so that one choice cannot instantly change the entire character identity.

Event IDs are deterministic for turn-based actions. Replaying the same state and action produces the same:

- spectrum value
- karma
- risk
- team morale
- Blue/Red probabilities
- event history

Duplicate event IDs are idempotent.

## Action examples

Current board actions use deterministic base effects plus context from the resolved turn.

| Action | Typical consequence |
|---|---|
| `invest` | modest preparation, morale and positive alignment signal |
| `gather_intelligence` | better information with additional exposure and context-dependent ethics |
| `reduce_pressure` | de-escalation, lower risk, positive karma and spectrum movement |
| `expand_influence` | momentum with increased risk and possible negative legitimacy/civilian consequences |
| `train` | improved preparation and morale with limited direct moral movement |
| `wait` | no direct moral movement; world pressure continues |

Mission, blackmail, risk and karma systems can use `applyTeamDynamicsEvent` to add explicit side-specific events.

## Success model

The shared authority model lives in:

```text
lib/strategy-sim/src/assessment/TeamAssessment.ts
```

The board adapter lives in:

```text
artifacts/command-sim/src/lib/game/teamPulse.ts
```

The model calculates a raw strength for each side, then converts both strengths into a normalized probability pair.

```text
Blue success + Red success = 100%
```

The normalization is not two independent percentages. Increasing one side's relative strength lowers the other side's estimate.

## Blue factors

Blue currently considers:

- cohesion
- legitimacy
- intelligence
- operational security
- resources
- personnel coverage
- territory control
- collective morale
- public confidence
- evidence quality
- Blue Team coordination

## Red factors

Red currently considers:

- cohesion
- social legitimacy
- intelligence advantage
- operational security / low exposure
- resources
- personnel capacity
- territory control
- collective morale
- ability to operate under city tension
- economic resilience
- recent momentum

## Collective morale

Morale is distinct from moral alignment.

Collective morale combines:

- faction cohesion
- unit morale
- legitimacy
- recent momentum
- resource readiness
- moral coherence
- karma signal
- risk/exposure penalty

A morally dark but cohesive team may have high morale. A prosocial team under severe losses, division and resource pressure may have low morale.

## Confidence and uncertainty

The dashboard shows model confidence. Confidence is reduced by:

- risk exposure
- city tension
- media pressure
- unstable recent momentum
- insufficient intelligence/evidence maturity

The percentage is an estimated game probability, not a factual prediction.

## UI

The existing simulation panel displays:

- combined Red/Blue percentage bar
- separate team cards
- collective morale
- moral spectrum
- risk pressure
- alignment coherence
- model confidence
- top contributing factors
- player spectrum, karma, risk and last change

The panel updates whenever the persisted simulation state changes.

## Save compatibility

`teamDynamics` remains optional in stored `SimulationState` so older saves continue to load.

`ensureTeamDynamics` initializes a neutral observer profile at 50 only when an old save has no dynamics state. New games always persist the user's explicit onboarding selection.

## Tests

Tests cover:

- complementary Blue/Red percentages
- valid confidence and morale ranges
- positive movement from risk-reducing actions
- increased risk and possible negative movement from aggressive influence
- deterministic replay
- idempotent recalculation
- full spectrum labels

Run:

```bash
pnpm test:strategy
pnpm test:command-sim
```
