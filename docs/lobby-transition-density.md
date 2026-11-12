# Gallery transition tile density

The native arrival and departure adapters share `worldRevealDetail.ts`. Nearby
visible architecture targets 0.25 m cells; a bounded priority queue spends the
remaining subdivision budget on the largest cells in the camera's view. Distant
coverage remains coarse if a triangle, fragment, cell or clipping limit is hit.
The authored spawn heading supplies arrival direction; departure uses the current
camera. Giant sky shells do not determine interior tile resolution.

Compact dense sculptures and fixtures (at least 5,000 triangles, no world extent
above 5 m) use rigid proxy meshes in the same radial schedule. They reuse existing
geometry buffers and move as whole objects. This keeps decorative topology from
consuming the generated wall/floor tile budget. Rigid proxies are bounded to 64
sources and 400,000 rendered source triangles; generated cut geometry retains the
existing 120,000–160,000 triangle ceiling. Shader, skinned and custom instanced
objects retain their existing handling. Original visibility, transforms, buffers
and material ownership are restored on completion or cancellation.

Fit hints include the density and rigid-prop policy, but do not vary with every
camera movement. Canvas diagnostics expose the cell-size histogram in the camera
cone, rigid source/triangle counts, build time and fit attempts.

## Local verification, 2026-10-11

Actual native galleries entered through the lobby's Explore panel and exited with
Back, using the same local browser viewport:

| Gallery | Arrival cells | Departure cells | Arrival / departure preparation |
| --- | ---: | ---: | ---: |
| Meta Trap house (Spacepod) | 4,077 | 4,389 | 946 / 1,359 ms |
| 976 Madison | 8,844 | 8,995 | 976 / 962 ms |
| WANIMAL BLUE | 9,226 | 9,477 | 494 / 425 ms |

All used one fit attempt. Earlier same-session departure captures had 1,632 cells
for Spacepod and 262 for Madison. Madison's old preparation took 2,007 ms and
three fit attempts; the new run represented every source with zero skips. Its
seven dense props reused 268,170 original triangles. Spacepod's loaded decorative
content can vary between visits; these single development-browser samples are
not a controlled frame-time benchmark or total space-loading measurements.
Existing shader/skinned/material draw-bound skips remain visible in diagnostics.

An offline audit using the real low-resolution Spacepod and Madison GLBs verified
surface-area preservation, finite motion matrices, exact settled rigid transforms,
source visibility restoration and that source geometry is never disposed.

## Reusing arrival tiles for departure, 2026-10-12

`worldTransitionCache.ts` retains one parked room effect for the current native
scene. Successful arrival transfers ownership after the camera handoff. Back
validates source identity, geometry/attribute versions, transforms, instance data
and visibility, then restarts the same uploaded buffers inward from the player's
current feet. Reuse does not repeat clipping or rewrite every intact vertex.
Texture upgrades keep the cache valid; cloned materials refresh current map slots.

Artwork/video/model media uses a separate bounded layer (30,000 generated
triangles, 2,500 cells; up to 150,000 original triangles in compact rigid props).
Media can replace geometry after decoding without invalidating the room cache.
Animated room subtrees are resolved from public glTF clip metadata and also enter
the fresh layer: Wanimal animates two parent objects whose children inherit the
rotation. Their movement must not invalidate the static architecture.
Both layers share the same radial extent. The media layer preserves current scene
fog/background; empty media roots still hide children that arrive mid-transition.

The cache is not persisted across URLs or disposed iframes. `Root.dispose()` clears
it before disposing source materials/geometry. A cancelled departure can return
the parked room buffers to the cache. Construction-only scratch is released after
packing; no idle-time rebuild is scheduled while the player is walking. The
native departure JavaScript module is fetched alongside arrival.

Local cached Back preparation: Madison 23 ms (previous development sample 962 ms),
Spacepod 159 ms including 142 ms for current media (previous sample 1,359 ms),
and Wanimal 149–168 ms including 124–143 ms for current media and animated room props
(previous sample 425 ms). All three reported cache hits and zero fit attempts on
Back. These are single development-browser preparation samples, not animation
duration or total destination loading measurements. First arrival still builds
the room tiles; this cache avoids repeating that work when leaving the live room.

Focused verification: 218 tests across 23 transition suites cover buffer reuse,
current player anchors, animation subtrees, material-map upgrades, invalidation,
visibility restoration, cancellation, and disposal.

Wanimal arrival and Back diagnostics confirmed no animated-room or media budget
skips. The existing unsupported portal shader materials (two) and late custom
instanced source (one on departure) retain their prior handling.
