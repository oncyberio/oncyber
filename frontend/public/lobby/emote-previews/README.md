# Native emote previews

Generated from the existing `native-avatar-emotes.json`, `native-avatar-motion.json`
(Waving), and the native baker's `baserig.json`. Every pose and motion frame comes
from its actual animation, using the same normalized rest-bone axes and
quaternion/hip translation tracks as the native VRM adapter.

Run from the repository root:

```sh
node frontend/scripts/generate-emote-previews.mjs
node frontend/scripts/generate-emote-previews.mjs --check
```

The script also writes `features/lobby/emotePoseData.ts`: 15 representative poses
and content-versioned animation URLs. `EmotePosePreview.tsx` draws a shared shaded
SVG humanoid. The picker loads no rig, avatar mesh, source clip, texture, or
WebGL renderer. Only the hovered/focused card fetches its sampled motion JSON;
subsequent previews reuse it. Hidden tabs and reduced motion suspend playback.

Long clips have a six-second excerpt; short clips keep their original duration.
Frames are sampled at 16 fps, with one fixed projection and framing per clip.
Sitting and collapsed poses stay completely within their icon. Rest-frame times
are explicit in the generator so their characteristic pose can be reviewed.
