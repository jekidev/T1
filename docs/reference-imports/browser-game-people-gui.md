# Selective integration: `browser_game_people_gui.zip`

## Source

- Uploaded reference: `browser_game_people_gui.zip`
- SHA-256: `7c3d2571338d7bd8e0873d2a7b042414aa8bcf548af7199135f30da8218dce7b`
- Source type: standalone React + React Three Fiber demonstration
- Integration rule: adopt useful interaction and information architecture patterns; do not copy the standalone application, demo people or duplicate state architecture.

## Adopted patterns

| Reference capability | Integrated project implementation |
|---|---|
| Clickable people and selection highlight | `artifacts/command-sim/src/pages/board/entity-renderer.tsx` and `canvas.tsx` provide hover glow, tap/click selection, drag and accessible labels. |
| Profile/account panel | `person-profile-editor.tsx` stores role, username, presence, biography, personality, traits, experience, DKK wallet metadata and maximum recorded balance directly in board state. |
| Profile image upload | Person profiles upload through `/api/asset-generation/sources`; the resulting source asset ID and URL are stored on the entity profile. |
| Environment controls | `scene-environment-panel.tsx` stores scene name, weather, season, local time, temperature and local/Google/OSM map mode in board state. |
| ELI5 onboarding | `guided-tutorial.tsx` explains board geography, selection, profiles, environment, AI, copy/paste, mobile controls and New Game generation. |
| Android/mobile layout | `mobile-board-workspace.tsx` exposes Board, Add, Profile, Play, Score and AI as touch-oriented tabs using the same authoritative data as desktop. |
| Local fallback scene | Scene state retains a local fallback mode when external map services are unavailable. |
| Adapter-ready design | Existing asset, map, LLM, RAG and persistent simulation services remain the only adapters; no parallel demo adapters were introduced. |
| Styled depth and texture | Existing Shadcn/Tailwind panels use gradients, nuanced borders, inset shadows, glow states and textured map presentation. |

## Intentionally discarded

The following material from the ZIP is not imported:

- the separate Vite application shell and its build configuration
- the standalone Zustand demo store
- hard-coded demo people, balances, roles and account names
- duplicate React Three Fiber scene ownership
- inline assumptions that Google Maps, LLM, RAG and database integrations are only future placeholders
- standalone CSS that would override the project design system
- direct `npm` workflow; the repository remains a pnpm workspace

## Architectural decision

The reference is treated as a UX prototype, not as a subsystem. Person profiles remain `BoardEntity` metadata, faction economy remains authoritative simulation state, geographic state remains in the existing world layer, and uploaded media remains managed by the shared asset pipeline.

This avoids:

- two competing stores
- two board/scene renderers
- duplicate onboarding flows
- inconsistent mobile and desktop state
- fake adapter implementations
- loss of existing strategy, RAG, network-policy and audit behavior

## Preservation

No existing RAG, DeepSeek script, conversation, Red Team content or storyline source was modified, moved, renamed or deleted as part of this selective integration.
