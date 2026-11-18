# Writing an avatar from a picture

Avatars in the lobby can be written as code instead of modelled: a module
that builds the character's skinned mesh at runtime. This note is the
working method for turning a reference picture into one, for a person or a
coding agent. Background on how made avatars work is in the in-app docs
(`frontend/content/docs/avatars.md`).

Only write avatars from pictures you have the right to use: your own
designs, commissioned work, or characters you hold a licence for.

## What you write

One file, `frontend/features/toon-avatar/authored/<id>.ts`, exporting an
`AuthoredAvatar` (`authored/types.ts`):

-   `recipe`: everything the standard parts already do. Proportions, head
    shape, eyes, mouth, colours, basic clothes. Start here; most of the
    likeness is proportion and colour. Fields are in `recipe.ts`.
-   `build(kit)`: the parts particular to this character, added to the same
    mesh. Turn a standard part off in the recipe (`hair: { style: "bald" }`,
    `nose: "none"`) when you replace it.
-   `face(params)`: optional last word on the painted face.

Then add the id and name to `authored/catalogue.ts`. That makes the avatar
loadable at `/studio/avatar?id=<id>`, lists it in the lobby's avatar picker
and covers it with `authored.test.ts`.

`tinker.ts`, `moth.ts` and `juno.ts` are worked examples: a quiff and
goggles, a quilted jacket and antennae, a braid and a slung bag.

## The kit

`build` receives an `AvatarKit` (`mesh/kit.ts`). Units are metres; the
avatar stands on y = 0 facing +z, with its left side on +x.

| For                         | Use                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| Limbs, straps, locks, horns | `tube(stations)`: a swept tube, each station with its own radius, colour and skinning           |
| Bags, buns, pads, beads     | `blob({ center, radii, deform })`: an ellipsoid you can square off or bend                      |
| Belts, collars, bracelets   | `ring(points, style)`: a closed band through points                                             |
| Hair, hoods, bands          | `cap({ edge, thickness, top })`: a layer hugging the skull above an edge line, with an ink edge |
| Where the skull is          | `head.at(latitude, longitude, lift)`, `head.front(x, y, lift)`, `head.frontNormal(x, y)`        |
| Where the body is           | `joint(bone)`, `torso(t)`, `torsoPoint(t, angle, grow)`, `layout`                               |
| What follows what           | `rigid(bone)`, `mix([bone, weight], ...)`, `torsoWeights(t)`, `chainWeights(...)`               |
| Colour                      | `colors` (from the recipe) and `hex("#rrggbb")`                                                 |

Three habits keep the drawn look:

-   Make every part a closed shape. The ink outline is the mesh drawn again,
    pushed out along its normals, so open sheets get no line.
-   Give small parts `outline: 0.5` or less, or their ink swallows them.
-   Weight hanging things partly to `hairTail` (off the head) or `coatTail`
    (off the hips). Those two bones trail behind movement on a spring.

## The loop

1.  Read the picture for proportions first: head to body, leg to torso,
    shoulder width, eye size and spacing. Set those in `recipe`.
2.  Run `pnpm dev` and open
    `/dev/avatar-lab?avatar=<id>&ref=<picture url>`. The lab draws the
    avatar from the front, three-quarter, side and back in one frame, with
    orthographic cameras so a flat drawing lines up. Drop a picture on the
    page to set the reference; `overlay=0.5` lays it over the front view.
3.  Compare, change the code, reload. Fix the silhouette before details.
4.  Check it moving: `pose=walk&t=0.3`, `pose=wave`, and in the lobby
    renderer at `/dev/lobby-crowd?mode=native&count=4&toon=<id>`.
5.  Run `pnpm -C frontend test features/toon-avatar`.

`node frontend/scripts/avatar-lab-shot.mjs <id> out.png` saves the lab's
frame as a PNG, for comparing without a browser window.

## When the kit can't do it

Add the missing shape to the kit rather than working around it in one
avatar: a helper in `mesh/` and an entry in `AvatarKit`. After a few
avatars, move what they share (a kind of jacket, a way of doing braids)
out of the avatar files into `mesh/`, so the next avatar is mostly recipe.
