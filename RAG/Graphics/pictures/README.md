# RAG Graphics Pictures

This folder contains repository-optimized copies of user-uploaded visual assets for backgrounds, widgets, bars, character cards, HUD material, splash screens, and brand overlays.

## Asset inventory

### Original batch

- `copenhagen-night-street.jpg`
- `nightlife-crowd-motion.jpg`
- `hurtig-levering-hud-poster.jpg`
- `kbx-monogram-logo.jpg`

### Batch 2

- `red-hud-nightlife-couple.svg`
- `concrete-hud-happy-couple.svg`
- `concrete-hud-sweaty-couple.svg`
- `sealed-packet-portrait.svg`
- `kbx-neon-nightlife-poster.svg`
- `kbx-neon-city-poster.svg`
- `kbx-roundel-nightlife-poster.svg`
- `copenhagen-crowded-night-street.svg`
- `copenhagen-fog-light-trails.svg`

There are **13 unique visual assets**. The repeated `1806.jpg` upload is an exact SHA-256 duplicate of `copenhagen-night-street.jpg`; it is recorded as a source alias in `settings.json` rather than stored twice.

The images were not regenerated or redesigned. Original conversation uploads remain unchanged. Repository copies are reduced for lightweight GUI/runtime use. Batch-2 assets use SVG wrappers containing optimized JPEG previews, allowing GitHub-native text commits while remaining directly usable as image sources in browsers.

## Transparency

Transparency is configured in `settings.json` rather than permanently baked into image pixels. Each asset has context-specific opacity values for:

- widget textures
- navigation and status bars
- panels and character cards
- full-screen backgrounds
- watermarks and logo marks

Recommended CSS pattern:

```css
.rag-graphic-layer {
  position: absolute;
  inset: 0;
  background-image: var(--rag-graphic-image);
  background-position: center;
  background-size: cover;
  opacity: var(--rag-graphic-widget-opacity, 0.1);
  mix-blend-mode: var(--rag-graphic-blend-mode, soft-light);
  pointer-events: none;
}
```

Use the per-asset `opacity`, `blendMode`, `position`, `fit`, and `role` fields as the source of truth. Do not apply transparency destructively to the stored asset.

## Provenance

`settings.json` records the original upload filename, original SHA-256, source dimensions, repository dimensions, storage format, intended roles, and transparency presets. Files originally named `1803.png`, `1804.png`, and `1805.png` contained JPEG image data; their repository SVG wrappers preserve the visual data without pretending that the source encoding was PNG.
