# Graphics and Browser Runtime Integration Plan

## Existing architecture

- Frontend: React 19, Vite 7, TypeScript, Tailwind CSS.
- State: Zustand board store plus React Query for API state.
- Current rendering: DOM/SVG/canvas tactical board over a Google Maps/OpenStreetMap iframe.
- Backend: Express TypeScript API with OpenRouter, RAG, MCP and scenario persistence.
- Build: pnpm workspace with catalog versions and TypeScript project builds.

## Integration constraints

1. The existing tactical board remains available and is not replaced until the 3D runtime passes build and smoke tests.
2. Three.js + React Three Fiber is the only production scene graph.
3. Babylon, PlayCanvas and Galacean are isolated lazy adapters and cannot share an active scene graph or rendering context with Three.js.
4. Browser code execution is isolated from authentication, secrets, raw DOM and unrestricted network access.
5. WebGPU is progressive. WebGL2 is the required production fallback.
6. Large runtime packages are route-level lazy chunks.
7. Mobile starts on reduced quality and no expensive post-processing.

## Phases

### Phase 1 — foundation

- Engine interfaces and capability detection.
- Graphics quality store and adaptive recommendation.
- Three runtime route isolated from the tactical board.
- Asset manifest and typed runtime configuration.
- Architecture and security documentation.

### Phase 2 — primary 3D runtime

- React Three Fiber Canvas.
- Environment, lighting, camera and performance adaptation.
- Rapier physics provider and character-controller foundation.
- Optional post-processing controlled by quality settings.

### Phase 3 — asset and gameplay integration

- glTF/GLB, Draco, Meshopt and KTX2 pipeline.
- Entity adapters between persisted BoardEntity data and 3D scene entities.
- Animation state machine and spatial audio.

### Phase 4 — browser editor and runtimes

- Monaco workspace.
- WebContainer capability-gated runtime.
- Pyodide worker.
- QuickJS allowlisted mod API.
- Diff, validation, preview and rollback workflow.

### Phase 5 — alternative engine laboratory

- Lazy Babylon, PlayCanvas and Galacean adapters.
- Separate containers and benchmark scenes.
- No production bundle inclusion unless explicitly activated.

### Phase 6 — stabilization

- Unit, component and browser smoke tests.
- Performance budgets.
- Mobile controls and responsive HUD.
- Production headers for WebContainers.
- Documentation and deployment verification.

## Main risks

- The current lockfile must be regenerated after adding graphics dependencies.
- WebContainers require cross-origin isolation headers and compatible deployment.
- WebGPU support differs substantially between browsers and devices.
- 3D assets can dominate loading time without compression and explicit budgets.
- React state must not receive per-frame transforms.
- Existing map coordinates and 3D world coordinates need an explicit projection adapter.

## Definition of safe integration

The tactical board route remains functional, the 3D route is lazy, unsupported browsers receive a diagnostic fallback, and no alternative engine or browser runtime is loaded until selected by the user.
