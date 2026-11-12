# Studio avatar and YouTube artwork

-   Avatar: `frontend/public/studio-assets/avatar-cutout.png`. Built-in imagegen removed the scenery from the existing avatar icon; real alpha is preserved. The shared avatar glyph uses contain sizing and a transparent dock slot.
-   YouTube: `frontend/public/studio-assets/youtube-logo.svg`. Exact red mark and white play paths extracted from the repository's `frontend/public/v2/icons/youtube.svg`, without its wordmark. Centered at 88% of the tool width, with no enclosing tile. No image generation used for the YouTube logo.

Both use the shared Studio toolbar and preserve their existing picker actions, labels and focus behavior.

## Avatar generation prompt

Use case: background-extraction. Edit target: existing Studio avatar icon, a group of three colorful stylized avatars. Remove the scenery/background only, preserving all three characters, their clothing, sunglasses, colors, positions and poses. Keep the full trio together. Output a genuine transparent PNG cutout with alpha outside their silhouettes, including transparent gaps between the figures. No sky, trees, floor, rounded-square tile or backdrop. Do not invent different characters. Clean edges, no checkerboard pixels, no glow. This is a small toolbar icon.
