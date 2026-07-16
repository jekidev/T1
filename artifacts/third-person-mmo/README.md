# Third-Person MMO RPG Client

This is the scaffold for the future third-person MMO RPG HTML/browser game built on top of T1.

## What lives here

- `src/lib/api.ts` — fetch helpers for the T1 API.
- `src/App.tsx` — minimal example that loads the first scenario and displays `SimulationState`.
- `vite.config.ts` — Vite + React + Tailwind v4, with `/api` proxied to `localhost:8080`.

## How to run

From the repo root:

```bash
pnpm --filter @workspace/third-person-mmo dev
```

The dev server starts on `http://localhost:5174`.

Make sure the API server is running first (`pnpm dev` from root starts it on port 8080).

## Next steps for an AI creator

1. Replace `App.tsx` with a 3D scene (Three.js, `@react-three/fiber`, Babylon.js, etc.).
2. Map `board.world` to a real city map or procedurally generated district.
3. Render `board.entities` as NPCs and `board.zones` as territories.
4. Use `board.simulation` for faction reputation, shops, skills, and world state.
5. Drive quests from `board.timelineEvents` and `board.phases`.
6. Call `/api/advisor/chat` for NPC dialogue and `/api/knowledge/query` for world lore.
7. Add server-authoritative turn resolution by exposing `simulateTurn` in `artifacts/api-server/src/routes`.

See `docs/AI_GAME_CREATOR.md` and `docs/T1_SIMULATION_CONTRACT.md` for the full design contract.
