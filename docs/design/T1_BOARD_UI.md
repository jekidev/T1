# T1 Board UI — Figma Foundation

Figma file: https://www.figma.com/design/ME86azN78dbZ8zn33HFRNP

## Source of truth

The initial desktop frame is derived from the current React board implementation in:

- `artifacts/command-sim/src/pages/board/index.tsx`
- `artifacts/command-sim/src/index.css`

The implementation remains the runtime source of truth. Figma is the editable visual specification and handoff surface.

## Current frame

- Frame: `Board / Desktop 1440`
- Resolution: 1440 × 900
- Header: 48 px
- Left palette rail: 216 px
- Center workspace: 835 px
- Right properties/advisor rail: 389 px
- Center canvas: 545 px high
- Simulation/scoring area: 307 px high
- Heads-up dock: 520 × 56 px

## Visual tokens

The file follows the current dark tactical UI:

- Sans typeface: Outfit
- Mono typeface: Space Mono
- Background: near-black blue
- Card/surface: elevated blue-black
- Primary: tactical blue
- Destructive/faction criminal: red
- Neutral faction: amber
- Radius: compact, approximately 4 px

The canonical CSS variables remain in `artifacts/command-sim/src/index.css`.

## Next implementation pass

1. Add the header action group and its interactive states.
2. Model the palette/sidebar cards and draggable entities.
3. Add the tactical map grid and command nodes.
4. Populate simulation and scoring panels.
5. Populate properties and advisor panels.
6. Add Light, Balanced, and Uber mode states to the heads-up dock.
7. Create reusable components and connect them to React source components through Figma Code Connect.

## Design rules

- Preserve the current three-column resizable layout.
- Keep the center canvas visually dominant.
- Use compact information density rather than consumer-dashboard spacing.
- Reserve blue for primary actions, selected states, and system focus.
- Reserve red and amber for game-state semantics rather than decoration.
- Keep all new design work compatible with the existing Tailwind/shadcn component structure.
