# Moving the 3D engine off GSAP: a recommendation

This is for the owner's decision. No code was migrated. It was written on
10 November 2026 from a read of `claude/ui-review-fixes`, the packages in
`node_modules`, and the npm registry's metadata for each candidate. Sizes
marked _measured_ were produced locally (method in section 5). Anything
marked _(inference)_ was deduced, not read or run.

## 1. Recommendation

Split the job in two, and use one MIT library for the tweens:

1. **A ticker of our own** (about 60 lines, `three/events/ticker.js`) drives
   the render loop. It replaces `gsap.ticker`. It owns `requestAnimationFrame`,
   the WebXR `setAnimationLoop` path, the `?fps=` cap and manual stepping for
   video recording. The render loop should not depend on an animation
   library.
2. **anime.js v4** (MIT, 4.5.0, published 2 November 2026) for tweens,
   timelines and delayed calls in the engine, driven by that ticker through
   `engine.useDefaultMainLoop = false` and `engine.update()`.
3. **React UI stays on Motion** (today `framer-motion` 8.5.5 in 33 files; its
   successor is the `motion` package, MIT, 14.12.0). It does not use GSAP, so
   it is not part of this migration. Upgrading it is a separate, optional
   task.

Why anime.js and not Motion for the engine: our hardest GSAP uses are a
seekable timeline whose children fire their own `onComplete` while the video
recorder scrubs it, and parallel groups inside timelines. anime.js v4's
`createTimeline()` has `add`, `call`, `sync`, `seek(time, muteCallbacks)`,
`duration`, per-child callbacks and promises, which map one to one. Motion's
sequences can be seeked through `controls.time`, but callbacks belong to the
whole sequence, so the cinematic and camera-transition code would have to be
restructured. Motion would win if we wanted a single library for React and
the engine. Section 4 compares them.

What we gain: an OSI open-source licence (MIT) in place of GSAP's own
licence; about 17 KB gzip less in the engine chunk (_measured_, 30.3 KB to
13.1 KB); a render loop we own; and anime.js's manual main loop, which fits
WebXR better than GSAP's ticker does today. What we would lose: nothing we
use. GSAP's extra plugins (ScrollTrigger, SplitText, MorphSVG, Draggable,
etc.) are not used anywhere in this repository.

## 2. What GSAP does in this repository today

GSAP 3.11.4 is pinned in `frontend/package.json`. Every use is in the 3D
engine (`frontend/components/_3DExhibit-v2/three/`). No React component,
page, lobby file or server file imports it. Counts exclude commented-out
lines.

| Kind                                           |  Count | Where                                                                                                                                                                             |
| ---------------------------------------------- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files importing `gsap`                         |     30 | engine only                                                                                                                                                                       |
| ...of which never call it                      |      5 | `abstract/pipelineskinnedmesh.js`, `camera/main.js`, `camera/mapcamera.js`, `factory/player/instanceavatarvrm/wrapper.js`, `factory/space/kits/cyber/components/terrain/index.js` |
| `gsap.to` tweens                               |     36 | camera transitions and controls, labels, cache fade, starfield, panorama, highlight, portal preview, player name/chat bubble, cinematic                                           |
| `gsap.timeline`                                |      8 | `camera/transition.js` (1), `factory/player/instance.js` (2), `modules/cinematic/index.js` (2), `modules/cinematic/composer/index.js` (3)                                         |
| Timeline `.to` / `.add([...])` calls           |      6 | sequencing and parallel groups in the files above                                                                                                                                 |
| `.seek()`                                      |      2 | `modules/recorder/index.js` (scrubs the cinematic timeline frame by frame for video export), `modules/cinematic/composer/index.js`                                                |
| `gsap.delayedCall`                             |     14 | recorder, mediator `nextFrame`, camera, root, lighting, font and text glitch timers, portal container, confetti, preview baker                                                    |
| `gsap.ticker` (`add`, `remove`, `tick`, `fps`) |      6 | `events/mediator.js` (4: the render loop, WebXR, `?fps=` cap), `external/confetti/index.js` (2)                                                                                   |
| `gsap.core.Tween` / `gsap.core.Animation`      |      5 | JSDoc type annotations in `modules/label/*` and `camera/transition.js`                                                                                                            |
| `CustomEase.create`                            |      2 | `modules/cinematic/index.js`, one curve: `M0,0,C0.366,0,0.379,0.382,0.674,0.676,1.026,1.026,1,1,1,1`                                                                              |
| `onComplete` / `onUpdate` callbacks            | 21 / 8 | across tweens                                                                                                                                                                     |
| Plugins                                        |      1 | `CustomEase` only                                                                                                                                                                 |

Eases in use: `none` (6), `power1.easeOut` (4, the legacy name of
`power1.out`), `power3.out` (`ANIM_EASE` in `factory/player/constants.js`),
`power3.inOut`, `power2.easeOut`, `power1.out`, `power1.inOut` (1 each), the
custom curve above, and GSAP's default (`power1.out`) wherever no ease is
given. Tween targets are plain objects and three.js values: `Vector3`
components, uniform `.value`s, and custom properties with setters such as
`progression`, `alpha` and `opacity`. No tween targets the DOM or CSS.

Two details any replacement must keep:

-   **The render loop.** `events/mediator.js` calls
    `gsap.ticker.add(this.updateEvent)`. GSAP calls it with
    `(time, deltaTime, frame)`, but `update(force, deltaForce)` reads those as
    `force` and `deltaForce`. The engine computes its own delta from
    `Date.now()`, so this is harmless today, except that `deltaForce` is
    honoured while `IS_RECORDING` is true. Our own ticker should call
    `update()` with no arguments and keep `next()` as the only caller that
    passes a delta. The recorder calls `Mediator.pause()` before it starts
    (`modules/recorder/index.js:172`), which removes the ticker, and then steps
    frames with `Mediator.next()`, so the stray argument is never used while
    recording.
-   **WebXR.** In an immersive session, `window.requestAnimationFrame` does
    not fire on some headsets, so the mediator drives GSAP by hand through
    `renderer.setAnimationLoop(() => gsap.ticker.tick())`. Tweens must keep
    advancing from that loop.

## 3. Candidates

Versions, licences and last-publish dates come from the npm registry on
10 November 2026. "Installed" means present in `node_modules` today (as a
transitive dependency, never imported by our code).

| Library           | Latest  | Licence                                     | Last published | Installed here                 | Fit for our engine                                                                                                                                                 |
| ----------------- | ------- | ------------------------------------------- | -------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GSAP (today)      | 3.15.1  | GSAP Standard "no charge" licence (not OSI) | 5 Nov 2026     | 3.11.4                         | Everything we use. Its README now says it is "100% free" thanks to Webflow, including the former Club plugins.                                                     |
| **anime.js v4**   | 4.5.0   | MIT                                         | 2 Nov 2026     | no                             | Objects, timelines with `seek`/`call`/`sync`, per-child callbacks, cubic-bezier and `linear()` eases, manual main loop                                             |
| Motion (vanilla)  | 14.12.0 | MIT                                         | 10 Nov 2026    | `motion` 10.16.2 via web3modal | Objects, springs, sequences with `controls.time`; `processFrame()` and `useManualTiming` for WebXR; a three.js effect (`motion/three`); per-step callbacks missing |
| @tweenjs/tween.js | 25.0.0  | MIT                                         | 26 Jul 2024    | 23.1.3 via `@types/three`      | Small and explicit (`group.update(time)`); no timeline or seek, so cinematic and recording would need our own sequencer                                            |
| Theatre.js        | 0.7.2   | core Apache-2.0, studio AGPL-3.0            | 19 May 2024    | no                             | A keyframe editor, not a tween library; overkill; studio licence unsuitable to ship                                                                                |
| popmotion         | 11.0.5  | MIT                                         | 15 Aug 2022    | no                             | Unmaintained; folded into Motion                                                                                                                                   |

About GSAP's licence: the installed 3.11.4 `package.json` says "Standard 'no
charge' license ... Club GreenSock members get more". The current 3.15.1
package says "Standard 'no charge' license: https://gsap.com/standard-license"
and the README says GSAP is free for commercial use. It is free of charge,
but it is not an open-source licence. I did not read the licence text at that
URL; whether any of its terms affect a world builder like Oncyber is a
question for the owner, not something this plan decides.

## 4. Engine fit, feature by feature

| What we use                               | anime.js v4                                                                                 | Motion vanilla                                   | tween.js                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------- |
| Tween a plain object or three.js value    | `animate(target, { x, duration, ease })`                                                    | `animate(target, { x }, { duration, ease })`     | `new Tween(target).to(...)`        |
| `onUpdate`, `onComplete`, `kill`, promise | `onUpdate`, `onComplete`, `cancel()`/`revert()`, `.then()`                                  | `onUpdate`, `onComplete`, `stop()`, `.then()`    | `onUpdate`, `onComplete`, `stop()` |
| Timeline with parallel groups             | `createTimeline().add(...)`, `sync`, `'<'` positions                                        | `animate([...], { at })` sequences               | none (chain only)                  |
| Callbacks on timeline children            | yes                                                                                         | no (whole sequence only)                         | n/a                                |
| Seek for frame-exact video export         | `tl.seek(ms)`, fires callbacks unless muted                                                 | `controls.time = s`                              | `update(time)` per tween           |
| `delayedCall`                             | `createTimer({ duration, onComplete })`                                                     | `delay(fn, s)`                                   | `setTimeout` or our own            |
| WebXR / manual clock                      | `engine.useDefaultMainLoop = false; engine.update()`                                        | `processFrame(ts)`, `useManualTiming`            | `group.update(time)`               |
| Our eases                                 | `outQuad` (= `power1.out`), `outCubic`, `outQuart`, `inOutQuart`, `linear`, `cubicBezier()` | `easeOut`, `cubicBezier()`, custom fn            | `Easing.*`, custom fn              |
| The CustomEase curve                      | a 10-line function that evaluates the two cubic segments, or `linear()` with sampled points | same                                             | same                               |
| Size of what we would import (_measured_) | 13.1 KB gzip (`animate`, `createTimeline`, `eases`, `engine`)                               | 25.3 KB gzip (`animate`, `frame`, `cubicBezier`) | 3.5 KB gzip                        |

GSAP for comparison: 30.3 KB gzip for `gsap` plus `CustomEase` (3.15.1,
_measured_ the same way; 3.11.4's `gsap.min.js` alone is 27.6 KB gzip).

## 5. How the sizes were measured

Each package was fetched with `npm pack` into a scratch folder. A one-line
entry importing only the names listed above was bundled with webpack 5.107
(`mode: "production"`, the copy in the repo's `node_modules`), and the output
was gzipped at level 9. These are upper bounds for what the engine chunk would
carry; our own code that calls them is not included.

## 6. Migration plan

Each step is one pull request, keeps behaviour and visuals the same, and can
ship alone. GSAP stays installed until the last step.

1. **Our ticker.** Add `three/events/ticker.js`: `add(fn)`, `remove(fn)`,
   `fps(n)`, `tick(time)` (for WebXR and tests), driven by
   `requestAnimationFrame` outside WebXR. Point `events/mediator.js` and
   `external/confetti/index.js` at it, and call `gsap.ticker.tick()` from it
   while GSAP is still around, so tweens and rendering stay in one frame.
   GSAP's lag smoothing goes away with its ticker; the engine's loop computes
   its delta from `Date.now()`, so it does not depend on it. Test: a table-driven test
   of `fps()` throttling and add/remove during a tick; the hub start-up
   benchmark (`docs/benchmarks/hub-startup-2026-10-12.md`) before and after.
2. **An adapter, then the simple tweens.** Add `three/utils/tween.js` that
   exposes the few calls we use (`to`, `timeline`, `delayedCall`, `kill`) on
   top of anime.js, with our ease names mapped (GSAP's `power1` is quadratic,
   `power2` cubic and `power3` quartic, so `power1.out` becomes `outQuad`,
   `power2.easeOut` `outCubic`, `power3.out` `outQuart` and `power3.inOut`
   `inOutQuart`), and `engine.update()` called from our ticker. Move the 14
   `delayedCall`s and the single-tween files (cache, labels, starfield,
   panorama, highlight, portal preview, camera controls, exposition). Delete
   the five unused `gsap` imports.
3. **Timelines.** Move `camera/transition.js`, `factory/player/instance.js`
   (name and chat bubble), then the cinematic module and composer, with the
   CustomEase curve as a function. Record the same cinematic with GSAP and
   with the new code at 30 fps and compare frames; this is the one place a
   timing difference would show.
4. **The recorder.** Switch `modules/recorder/index.js` to `tl.seek()` on the
   anime.js timeline and `engine.update()` per exported frame. Verify that a
   recording's length and the frame where each curve changes match step 3.
5. **Remove GSAP.** Drop `gsap` from `frontend/package.json`, remove the
   `jest.mock("gsap")` lines in the cinematic tests, and run the engine test
   folder.

Risks: the cinematic and recording path has the least test coverage and the
most timing-sensitive code; GSAP's default ease (`power1.out`) applies to
every tween without an `ease`, so the adapter should set `outQuad`
explicitly (anime.js 4.5.0's default is `out(2)`, the same curve, but a
default can change between releases); WebXR must be tried on a headset after
step 1.

## 7. Not part of this plan

-   The React UI's framer-motion 8.5.5. Moving it to `motion` (`motion/react`)
    is an upgrade within the same project, with its own breaking changes, and
    can wait.
-   `motion` 10.16.2 and `@tweenjs/tween.js` 23.1.3 in `node_modules` come from
    `@web3modal` and `@types/three`. Nothing of ours imports them.
