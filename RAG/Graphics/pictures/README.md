# RAG Graphics Pictures

This folder contains repository-optimized copies of the four user-uploaded graphics.

## Files

- `copenhagen-night-street.jpg`
- `nightlife-crowd-motion.jpg`
- `hurtig-levering-hud-poster.jpg`
- `kbx-monogram-logo.jpg`
- `settings.json`

The images were not regenerated or redesigned. The local source uploads remain unchanged; the GitHub copies were resized and JPEG-compressed for lightweight runtime use.

## Transparency

Transparency is configured in `settings.json` rather than permanently baked into the JPEG files. This preserves one reusable asset for several contexts:

- widget texture
- navigation or status bar texture
- panel background
- full-screen graphic material
- watermark or logo mark

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

Use the per-asset `opacity`, `blendMode`, `position`, and `fit` fields as the source of truth. Do not apply transparency destructively to the stored source asset.
