# Avatar locomotion in spaces

Native Oncyber spaces use the same default motion clips, derived starts/stops/turns,
contact calibration and locomotion clock as the lobby. Live skeletons sample
those poses directly; instanced avatars interpolate baked frames using the
existing two-pose attribute layout. Native controls accept two separate jump
presses and reset on landing; holding Space does not retrigger. Authored jump
strength, gravity, collisions, editor/quidditch flight and multiplayer packets
stay unchanged. Local animation inputs include the physical launch count,
velocity and braking intent, so a faster authored single jump does not select a
roll or falsely restart as a double jump. Space avatars are normalized to about
2.85 units, so speed is converted by the avatar's height (1.8 m lobby
reference) before it drives the gait clock; cadence matches travel instead of
sliding. Ordinary space speeds therefore run, and Shift sprints. One-frame
floor dropouts (seams, steps) keep the gait grounded for 0.18 s unless the
player launched a jump.

Space controls (`physics/groundMotion.js`) keep each space's authored top
speed but move like the lobby: about half a second from rest to full pace,
release braking at 28/s to an exact rest, Shift at 1.5x, and a grounded player
that is not rising settles vertically onto floor up to 0.35 units below, so
seams and steps no longer drop contact. Air control scales with the space's
speed (the default 100 keeps the old 20) and cannot exceed the take-off or
ground top speed. Remote avatars smooth inferred speed over about 0.1 s.

Shared clips use private `@lobby/` names and append after the existing animation
entries. Space-authored player actions (including custom WALK/IDLE objects),
emotes, sitting and travel poses retain priority. Artwork/model animation
mixers and embedded world scripts are not modified. Missing optional packs or an
expanded pack that exceeds the existing single-page atlas budget retain the
complete legacy set, with its original indexes.

Avatar materials share dedicated lighting across lobby, travel and native
spaces, accounting for the native renderer's legacy light scale. Authored unlit
surfaces remain unlit; world lighting and custom shaders stay authored. This
also removes the old camera-dependent tint from instanced avatars.
