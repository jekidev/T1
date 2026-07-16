# MMO Roadmap — Vanilla Three.js Third-Person RPG

This is a concrete, step-by-step roadmap for an AI game creator to evolve the existing `artifacts/third-person-mmo` scaffold into a real third-person MMO RPG using vanilla Three.js and the T1 simulation API as the data layer.

## Why vanilla Three.js

- No React-version lock-in (`@react-three/fiber` compatibility with React 19 is still stabilising).
- The existing `Scene3D.tsx` already manages a renderer, camera, scene and animation loop with React refs.
- You can add wrapper components later if you prefer.

## Prerequisites

```bash
pnpm setup
pnpm --filter @workspace/third-person-mmo dev
```

The MMO dev server runs on `http://localhost:5174` and proxies `/api` to `http://localhost:8080`.

Read `docs/T1_SIMULATION_CONTRACT.md` and `docs/AI_GAME_CREATOR.md` before starting.

## Step 1 — Replace the placeholder cube

Current `Scene3D.tsx` renders a spinning cube. Replace it with:

1. A large ground plane (or a procedural city tile grid).
2. A simple player avatar (capsule or box) at `(0, 0, 0)`.
3. A `DirectionalLight` + `AmbientLight` setup that later follows the in-game hour.

Keep the resize handler and cleanup from the scaffold.

## Step 2 — Third-person camera

1. Create a `CameraRig` helper that:
   - Places the camera behind and above the player.
   - Smoothly interpolates to the player position each frame (`lerp`).
   - Optionally orbits with mouse drag.
2. Store target offset in a React ref so it does not trigger re-renders.

Example pattern:

```ts
const cameraOffset = new THREE.Vector3(0, 4, 8);
const currentPos = new THREE.Vector3();
// in animate(): currentPos.lerp(desiredPos, 0.1); camera.position.copy(currentPos); camera.lookAt(player.position);
```

## Step 3 — Load the world from `BoardState`

Use the `useScenario` hook (already in `src/hooks/useScenarios.ts`) and pass `board` into a new `WorldScene` component.

Map T1 data to 3D:

| T1 field | Three.js object |
|---|---|
| `board.world.latitude/longitude` | optional map center for real-world tile overlay |
| `board.zones` | colored ground tiles or district borders |
| `board.entities` | NPC meshes, prop meshes, objective markers |
| `board.simulation.factions` | faction-colored materials / territory control |
| `board.timelineEvents` | temporary quest markers and world announcements |

Coordinates: `entity.x` and `entity.y` are 0-1000 board units. Scale them to your world size (e.g., divide by 100 to get world meters).

## Step 4 — Click-to-move controls

1. Add a `PointerLockControls` or a simple raycaster on mousedown.
2. On ground click, cast a ray from the mouse into the ground plane.
3. Store the target position in a ref.
4. In `animate()`, move the player mesh toward the target each frame.
5. When the player reaches the target, call an action endpoint or update local state.

For a server-authoritative MMO, send the click target to the API and wait for the next `simulateTurn` result before committing position.

## Step 5 — Factions and NPCs

1. Create an `NPC` factory that takes a `BoardEntity` and returns a mesh + label sprite.
2. Color by `faction`:
   - `police` → blue
   - `criminal` → red
   - `neutral` → grey/green
3. Add a simple floating nameplate using a canvas texture or HTML overlay.
4. Add `category` shape hints:
   - `unit` → capsule
   - `location` → flat cylinder
   - `evidence` → small box
   - `shop` → stall icon

## Step 6 — Day-night cycle and atmosphere

Use `board.simulation.hour` and `board.simulation.day`:

- `hour` is 8, 12, 16, 20 then next day.
- Map `hour` to a sun angle: `angle = (hour - 8) / 12 * Math.PI`.
- Change light color from warm (day) to cool/blue (night).
- Update fog color and scene background.
- Add a simple sky gradient using CSS or a large inverted sphere.

## Step 7 — Quests and world events

1. Render `timelineEvents` as temporary 3D markers or as a HUD quest log.
2. Use `severity` to style markers: `info` = blue, `caution` = yellow, `critical` = red.
3. Call `/api/advisor/chat` with `role: "story_director"` when the player interacts with a quest marker.
4. Send the current `board` and the clicked event; render the reply as NPC dialogue.

## Step 8 — Shops, skills and faction UI

1. Add React UI panels that read `board.simulation.shops` and `board.simulation.skills`.
2. When the player walks near a `shop` entity, open a vendor panel.
3. Use `computeScores` from `artifacts/command-sim/src/lib/game/scoring.ts` (or expose it via API) to show world-health bars.

## Step 9 — Multiplayer / MMO server loop

For a real MMO, you need:

1. **WebSocket server** or **SSE** broadcasting `BoardState` updates.
2. **Turn tick** on the server: run `simulateTurn` at fixed intervals or when enough players submit actions.
3. **Player action queue**: collect `PlayerTurnAction` objects, resolve them in batch, broadcast new state.
4. **Client prediction**: move player locally while waiting for server confirmation.

The T1 `SimulationState` is deterministic, so the server can broadcast a `seed` and every client can replay turns locally.

## Step 10 — Performance and scaling

1. Use `THREE.InstancedMesh` for repeated NPC/building geometry.
2. Use frustum culling: only render objects inside the camera view.
3. Keep the `three` chunk lazy-loaded (already configured in `vite.config.ts`).
4. Compress textures and prefer `KTX2Loader` or `BasisTextureLoader` for production assets.
5. Use `LOD` (level of detail) for distant city tiles.

## Testing each step

```bash
pnpm typecheck
pnpm build
```

After a 3D change, verify:
- No TypeScript errors.
- `three` chunk size remains reasonable.
- `BoardState` fields you use are validated by `validateBoardMapping.ts`.
- The browser console shows no WebGL errors.

## Security reminders

- Do not call OpenRouter or any LLM provider from the browser.
- Do not expose `.env` secrets.
- Display RAG text only as attributed background lore (see `src/lib/safeRag.ts` and `docs/MMO_SECURITY_REVIEW.md`).
- All scenarios must remain fictional.

## Next docs to read

- `docs/T1_SIMULATION_CONTRACT.md` — full data contract.
- `docs/AI_GAME_CREATOR.md` — overall architecture and API usage.
- `docs/MMO_SECURITY_REVIEW.md` — security rules for the data flow.
- `artifacts/third-person-mmo/src/components/Scene3D.tsx` — current Three.js placeholder.
- `artifacts/command-sim/src/lib/game/simulationEngine.ts` — turn resolution logic.
- `artifacts/command-sim/src/lib/game/scoring.ts` — explainable scoring to power UI bars.
