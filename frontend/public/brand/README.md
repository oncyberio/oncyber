# Oncyber brand assets

Derived from the Cyber brand material supplied for Oncyber.

-   `cyberloop-sprite.webp`: all 225 frames of `Cyberloop_PNG_Sequence.zip`, sorted numerically, resized to 64 × 64 and packed into a 15 × 15 grid. Transparent, lossless WebP. Played at 30 fps in the login modal and activity-driven contexts.
-   `cyberloop-still.webp`: frame 90, used for reduced motion and static illustrations.
-   `oncyber-wordmark-white.png`: the supplied ONCYBER wordmark from `Artboard_1_copy_51x.webp`, cropped to its lettering with the black background converted to transparency.

The landing UI uses locally hosted Aeonik for titles and interface copy, with
Space Mono for compact utilities and counters. Space Mono’s license is included
beside its font file. See the [working brand guide](../../../docs/brand/README.md)
for typography roles, token values, reference learnings, and current rollout scope.

## Landing activity animation

`CyberloopMark` uses the existing lossless sprite derived from the supplied
225-frame PNG sequence (`Cyberloop_PNG_Sequence 2/CYBERLOOP_00000.png` through
`CYBERLOOP_00224.png`). The 960 × 960 transparent sheet is 282,140 bytes (~276 KiB),
compared with the 8 MB reference loop video. It preserves the fine white linework
and avoids audio, video decoding, autoplay restrictions, and 225 separate requests.
At 34 CSS pixels (30 on mobile), its 64-pixel frames provide roughly 2× resolution.
The decoded sheet is bounded at approximately 3.52 MiB.

The still frame renders immediately. The sprite loads on first movement (or activity for non-scroll-linked marks) and uses
browser caching thereafter. Only the symbol’s background position changes, with
no React renders per animation frame or changes to header geometry. Failed sprite
loads retain the still image. Reduced motion never requests the sprite; enabling
reduced motion mid-playback returns to the still. Playback suspends in hidden tabs.

The landing header now uses the SVG identity morph below. The source sequence
continues to serve continuous login playback and activity-driven contexts.

For non-scroll-linked marks, independent activity signals cover
card transitions, feed/search/pagination, template loading/opening, dynamic grid
loading, visible preview textures, fallback images and Next.js route navigation.
Signals clear on completion, failure or teardown independently. Offscreen lazy
fallback images are excluded so they cannot keep playback alive indefinitely.


## Scroll-linked identity · 5 November 2026

The landing arrives on the original linked-circle Oncyber symbol from
`oncyber-original.svg`. The first rendered column of gallery scrolling unfolds
three SVG ribbons into the Cyberloop; further scrolling turns the orbital mark.
Returning to the first position restores the original symbol. The wordmark
remains stationary, with the existing 34px desktop / 30px mobile symbol box.

`ScrollLinkedCyberloopMark.tsx` subscribes to the carousel's actual column
position. Its compact `cyberloopMorphData.json` and `cyberloopMorph.ts` evaluate
the reviewed ribbon geometry without a sprite, external image request, React
render per frame or independent animation timer. Hidden tabs catch up on reveal.
Reduced motion uses static identities, switching at half of the first column.
The modal's supplied 225-frame continuous animation is preserved.
