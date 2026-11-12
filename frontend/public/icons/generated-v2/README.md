# Shared visitor control icons · 8 October 2026

Generated with the built-in image generation tool, transparent background, one
call per icon. Six established lobby glyphs are reused without replacement;
these four complete the shared visitor toolbar family. All ten route through
`frontend/ui/components/ExperienceControlIcon.tsx` and render as 22 px
currentColor alpha masks. Utility arrows, close, send and builder-provided
content icons retain their existing dedicated assets.

## Saved assets

- `more.png`: three softly rounded diamond dots / More options.
- `permissions.png`: rounded tilted padlock / Content permissions.
- `reload.png`: rounded circular arrow / Reload experience.
- `info.png`: lowercase i inside a tilted orbit / About this space.

## Prompt set

The following shared prompt was used with each subject below:

> Create one production UI glyph matching the supplied existing Oncyber icon
> references. References are transparent black-alpha stencil assets; inspect
> their silhouette, open linework and playful rounded geometry. New subject:
> [subject]. Style: a minimal custom monochrome UI icon, subtly hand-shaped
> rounded line art, friendly precise geometry like the reference set, bold
> enough to read at 22px. Flat single solid white silhouette/strokes with
> transparent negative spaces and transparent background. No gray shadows,
> no gradients, no textures, no glossy 3D, no tile/button/background, no text
> labels, no watermark. Center the glyph and let its complete artwork occupy
> 82% of a square canvas with even safe padding. Match the reference stroke
> weight and rounded contours. This image will be used as an alpha mask in
> an app toolbar.

Subjects:

- More options: three playful rounded diamond-shaped dots arranged horizontally,
  with subtle offset/orbital personality, still unmistakably an ellipsis.
  No enclosing square.
- Content permissions: a friendly small rounded padlock with a broad soft arch
  shackle, softly rounded square body and one clear keyhole, slight 10-degree
  jaunty tilt. No enclosing badge.
- Reload: a single broad clean circular arrow sweeping around an open center,
  rounded ends and a generous rounded triangular arrowhead, slight dimensional
  playful curve. No enclosing badge.
- Information: a lowercase i made from a small circular dot and softly tapered
  rounded stem, enclosed in a gently tilted simple rounded orbit ring.
  Unmistakable information icon.

Style references: `../../lobby/icons/generated-v1/explore.png` and `people.png`.
Original generated files remain in the Codex generated-images directory;
production copies are retained here. No background removal or raster redraw
was applied after generation.
