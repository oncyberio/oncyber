# Packed travel animations

The 11 October 2026 travel update uses the four supplied FBX files below. The
existing `IDLE_CC0` ready idle is reused before the attack and after standing up.
There is no fifth source FBX.

| Runtime clip         | Supplied file                     | Duration | Playback                     |
| -------------------- | --------------------------------- | -------- | ---------------------------- |
| `TRAVEL_ATTACK`      | `Standing 2H Magic Attack 05.fbx` | 3.533 s  | Once                         |
| `TRAVEL_CROUCH_DOWN` | `Standing Idle To Crouch.fbx`     | 1 s      | Once                         |
| `TRAVEL_CROUCH_IDLE` | `Crouch Idle.fbx`                 | 1.367 s  | Loop while loading/revealing |
| `TRAVEL_STAND_UP`    | `Crouch To Standing Idle.fbx`     | 1 s      | Once                         |

The animation-only asset is
`frontend/public/lobby/travel/travel.f7d646d776ff.lcp`: **83,288 bytes**, about
83 KB, versus 1,940,992 bytes of source FBXs. Gzip is 67,335 bytes and Brotli is
61,966 bytes. These are measured encoded sizes, not a promise that every server
uses transport compression. The source FBXs and their meshes are not shipped.
The manifest records SHA-256 hashes, source names, durations and measured error.

From the repository root, with the four original files in the supplied directory:

```sh
fnm exec --using=22 -- node frontend/scripts/pack-travel-animations.mjs --input ~/Downloads
```

Use `--output /path/to/output` to inspect a fresh build separately. The converter
checks pinned source and reference-rig hashes, normalizes Mixamo bone names and
rest rotations, preserves authored vertical hip motion, removes horizontal
endpoint drift, and packs reduced animation keys into the existing LCP1 format.
It verifies the runtime decoder at source keys and 120 Hz. Current maximum
errors are 0.188 degrees per joint and 0.059 cm at the hips; the rest-basis
forward-kinematics check measures 0.0235 cm. No FBX loader runs in the browser.

Forward travel first settles into ready idle for 600 ms, then plays attack and
crouch-down in full. The 12 October timing update starts the 700 ms lobby
lights-out on the clap, frame 65 at 30 fps (2,166.667 ms into the attack, or
2,766.667 ms after departure starts). The room reaches black at 3,466.667 ms.
The avatar and approved companions remain lit and continue their authored
motions against black. The travel circle and its soft white highlight stay
invisible before the clap, then appear beneath the group and start the orbit
on that same cue, using the shared `TRAVEL_DISSOLVE_AT_MS` timing (2,766.667 ms
from departure). The dim white circle stays lit while travelling and loading.
Each one-second lap smoothly slows at the same point halfway around, then
accelerates again without stopping or reversing. The speed cycle completes
exactly one revolution, so the slow point never drifts. It stays lit through
the black hold; the sweep indicates activity, not a loading percentage. Reduced
motion skips the clap delay and shows the circle immediately with a stationary
highlight.

A solo animated trip mounts the hidden destination document only once the
departure has finished (5,133.333 ms, plus two painted frames), because booting
it costs the lobby's main thread. (A document prefetch hint used to run until
then; world pages are sent no-store, so it only cost a second server render,
and it was removed.) The engine's chunks may already be cached by the lobby's
idle prefetch (features/lobby/enginePrefetch.ts). Group and reduced-motion trips mount it at selection. Once
the document is prepared, native entry can proceed after at least 150 ms of
black and two animation-frame boundaries. Staging and reveal
still wait for both clips to finish: the minimum departure is 5,133.333 ms,
instead of the previous 5,983.333 ms with its
serial blackout. These are choreography timings, not measured loading gains.
Crouch idle loops for any further loading and world assembly. Stand-up plays
for 1 s and blends for 180 ms into ready idle before movement is enabled. Since
10 November it starts during the 1,800 ms tile reveal: at the later of the
moment that lets it end together with the reveal (34.4 % in) and the moment
every tile within 3 m of the travellers has assembled (`worldStandUpProgress`,
`completeWithin` on the cube reveal). On a wide floor that is about 44 % in,
saving about 1 s; input stays held until both have finished.
Clip times use elapsed time rather than accumulating independent per-frame
clocks. Reduced motion uses planted ready idle and skips the transition duration.

Both lobby renderers sample the same pack. Native arrival temporarily renders
the matching lobby avatar rig at the native player's anchored feet, then blends
to the native ready-idle phase and restores the normal renderer. The temporary
rig supports existing native baked atlases without changing their action set;
it does add a rig parse and the shared lobby motion-pack preparation to hidden
destination readiness. Companions have independent rigs and use the same poses.
Cancellation restores captured native state and disposes temporary resources.
Native Back-to-lobby retains its existing ready-idle/dissolve sequence.

Relevant code: `travelAnimationPack.ts` and `travelAnimationSequence.ts` under
`frontend/features/lobby/`, plus `nativeTravelAnimation.ts`, `lobbyWorldReveal.ts`
and `lobbyTravelPeers.ts` under the native renderer's `three/utils/` directory.
The pack has asset/continuity tests; adapters and native arrival have phase,
readiness and cancellation tests. Browser validation of the new clips is a
separate check and is not implied by those tests.
