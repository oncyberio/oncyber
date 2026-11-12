# Fonts

Oncyber's brand typefaces are commercial and licensed to Oncyber, so they are
not in this repository:

| Family           | Foundry         | Used for               |
| ---------------- | --------------- | ---------------------- |
| Aeonik           | CoType Foundry  | Interface and headings |
| PP Editorial New | Pangram Pangram | Editorial headings     |
| PP Neue Bit      | Pangram Pangram | Pixel accents          |

The open families in `frontend/public/fonts/` ship with their licenses:

- Space Grotesk (`SpaceGrotesk/OFL.txt`), Space Mono (`SpaceMono/OFL.txt`)
  and IBM Plex Sans (`body/OFL.txt`): SIL Open Font License 1.1.

Keep each family's own notice beside its files when adding or moving fonts.

## How it works

The CSS and font tokens point the licensed families at
`/fonts/licensed/<file>`, and every font stack falls back to an open family
(Space Grotesk for Aeonik, a monospace for PP Neue Bit, a serif for PP
Editorial New). `frontend/public/fonts/licensed/` is gitignored.

Before `pnpm dev` and `pnpm build`, `frontend/scripts/fetch-licensed-fonts.mjs`
runs:

-   With `LICENSED_FONTS_URL` set, it downloads that `.tar.gz` (sending
    `LICENSED_FONTS_TOKEN` as a bearer token when set) and unpacks it into
    `public/fonts/licensed/`.
-   Without it, it does nothing and the site renders with the open fallbacks.
    Forks build and run unchanged.

`next.config.js` only preloads the licensed files when they are present.

## Oncyber's own deployments

Keep the font files in a private location (a private bucket, or a release
asset on a private repository) as one `.tar.gz` with the files at its root:

```
Aeonik-Air.otf  Aeonik-AirItalic.otf  Aeonik-Black.otf  Aeonik-BlackItalic.otf
Aeonik-Bold.otf  Aeonik-BoldItalic.otf  Aeonik-bold.ttf  Aeonik-Light.otf
Aeonik-LightItalic.otf  Aeonik-Medium.otf  Aeonik-MediumItalic.otf
Aeonik-Regular.otf  Aeonik-RegularItalic.otf  Aeonik-Thin.otf
Aeonik-ThinItalic.otf  PPEditorialNew-Bold.ttf  PPEditorialNew-Heavy.ttf
PPEditorialNew-Regular.ttf  PPNeueBit-Bold.ttf  PPNeueBit-Regular.ttf
```

Then set `LICENSED_FONTS_URL` (and `LICENSED_FONTS_TOKEN` if the location
needs one) in the Vercel project. Browsers still download the fonts from the
deployed site, which is what a web font license covers; what the license does
not allow is redistributing the files in source, which this avoids.

If you fork Oncyber and want the same look, buy your own license from the
foundries or swap in an open family.
