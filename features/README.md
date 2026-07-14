# Feature registry

This directory is the canonical feature map for the project. Each feature has its own folder with a short specification, ownership boundaries, integration points, and implementation references.

## Feature folders

- `game-core/` — turn loop, simulation rules, shared game state, balancing.
- `map-and-world/` — map rendering, locations, districts, world data.
- `missions-and-events/` — missions, narrative events, choices, consequences.
- `entities-and-factions/` — characters, organizations, factions, relationships.
- `ai-advisor/` — OpenRouter/LLM advisor behavior, prompts, model routing.
- `rag-and-knowledge/` — Google Drive RAG ingestion, indexing, retrieval contracts.
- `auth-and-connections/` — Google Drive OAuth/connection handling and secrets boundaries.
- `api-and-backend/` — Express API, routes, validation, server behavior.
- `ui-and-experience/` — React UI, navigation, panels, responsive behavior.
- `save-and-state/` — persistence, saves, import/export, state migrations.
- `deployment-and-runtime/` — Replit, Manus, Termux, setup and runtime scripts.
- `integrate/` — drop zone for scripts, documents, assets, prompts, and specifications that must be reviewed and integrated.

## Feature folder contract

Each feature folder should contain:

```text
README.md        feature purpose and current state
SPEC.md          requirements and acceptance criteria
INTEGRATION.md   files, APIs, dependencies, and migration notes
```

Implementation code can remain in the existing workspace folders. The feature directory documents ownership and provides a stable handoff layer for Replit, Manus, and other agents.
