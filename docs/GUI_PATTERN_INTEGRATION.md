# Browser people GUI pattern integration

## Source

The integration was derived from the uploaded `browser_game_people_gui.zip` prototype. The archive was treated as a design/reference input, not as a replacement application.

## Adopted

The useful patterns were rewritten against the existing command-sim architecture:

- hover and click highlighting for people and units on the board
- profile avatars rendered directly on person entities
- online, busy and offline presence indicators
- modular person profile editor
- role, username, last-seen, personality, biography, traits and experience metadata
- optional in-game wallet and maximum-recorded wallet display in DKK
- scene name, weather, season, local time, temperature and map-mode state
- local fallback, Google and OpenStreetMap/MapLibre scene modes
- extended ELI5 onboarding for profiles, environment and mobile operation
- phone layout with Board, Add, Profile, Play, Score and AI tabs
- shaded, textured and layered UI surfaces using the existing design tokens

All adopted values are persisted inside the existing `BoardState`, asset service and Zustand board store.

## Deliberately discarded

The following prototype parts were not copied:

- standalone Vite application shell
- separate package manifest and build configuration
- duplicate Zustand store
- hardcoded demo people
- hardcoded balances and roles
- global parallel CSS theme
- separate local environment state
- claims that Google Maps, LLM or RAG adapters were connected when they were only placeholders
- capsule-based Three.js demo scene

The project already has authoritative board entities, Google/OSM world state, profile-image asset uploads, LLM/RAG services, simulation state and onboarding. Duplicating those layers would create conflicting state ownership.

## State ownership

```text
BoardState
├── entities[]
│   └── profile
│       ├── avatar
│       ├── identity and role
│       ├── presence
│       ├── personality and experience
│       └── optional game-wallet metadata
└── environment
    ├── scene name
    ├── weather and season
    ├── time and temperature
    └── local / Google / OSM mode
```

Faction treasury and the authoritative economy remain controlled by validated simulation commands. The optional person wallet in a profile is character metadata and cannot bypass faction-resource rules.

## Mobile

Desktop continues to use resizable panels. Below the large-screen breakpoint, the same components are exposed through tabs instead of maintaining a second mobile application or duplicate game state.

## Validation

`sceneEnvironment.test.ts` verifies:

- new boards receive a local fallback environment
- old boards without environment data migrate safely at read time
- persisted environment values override defaults without removing unspecified fields
