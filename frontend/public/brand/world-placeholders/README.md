# Gallery fallback symbols

Six high-resolution GPT Image versions of the white line-art symbols on black,
using the user's `twojs.webp` reference (September 16, 2026).

`mark-1-gpt.webp` through `mark-6-gpt.webp` are the active fallback covers.
Each image is 1448 × 1086 pixels, retained at the built-in image tool's native
resolution and encoded as lossless WebP. No JPEG artifacts or resizing are added.
The complete generation prompts are in `prompts.json`.

`fallbackCover(id)` keeps the existing stable six-way selection, so each gallery
keeps its symbol across searches. Both the DOM image and WebGL card paths use
these files after ordinary preview sources are absent or fail. The legacy SVGs
are retained as original reference assets.
