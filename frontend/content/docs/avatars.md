---
title: Avatars
description: The 3D character you take everywhere in Oncyber: built-in avatars, avatars generated in code, your own VRM upload or a VRM you own as an NFT, and how the picker loads them.
order: 5
---

# Avatars

Everyone has a 3D avatar, and it comes with you everywhere: the lobby, every
gallery, and the trip between them. You can pick a built-in one, upload your
own, or wear one you own as an NFT. Your choice is saved to your account.

To add a built-in avatar, add an entry to
`frontend/components/_3DExhibit-v2/three/factory/player/vrms.json` and try it
in the lobby picker: walk, jump and run a few emotes.

:::details How avatars work

Avatars use the VRM format.

-   **Built-in avatars** live in `vrms.json`, with an `id`, `name`, model `url`
    and preview `image` each. Guests start as "Square". Keep models light, with
    one humanoid skeleton.
-   **Uploaded avatars.** Signed-in people can upload their own VRM models.
-   **Wallet avatars.** VRM NFTs found in a connected wallet on Ethereum or
    Polygon. Partner collections that store their model differently are mapped
    in `frontend/utils/vrmPartners`. They're identified by model URL, so today
    they stay in the lobby rather than being saved as your default.

The picker (`frontend/features/lobby/AvatarCarousel.tsx`) shows your own
avatars first, then the catalogue. A choice applies right away and is saved
once the model loads (`settings.vrm`, with an optional
`settings.default_vrm_scale`). `resolveLobbyAvatar` in
`frontend/features/lobby/avatarSelection.ts` turns saved settings back into a
model.

Avatars render through the WebGPU runtime
(`frontend/features/lobby/webgpu/avatarAdapter.ts`). Nearby people are full
avatars, and large crowds are drawn as GPU instances. Emotes are shared clips
retargeted onto each model, so any VRM can wave, dance or sit. When you travel,
your avatar crouches, the destination loads, and you stand up in the new world
with the same model and camera framing. Group travel keeps your friends around
you on arrival.

:::

## Avatars generated in code

Two lobby avatars, Runner and Stagehand, have no model file. Everything about
them is built in the browser when they are first worn: body, face, hair,
clothes and skeleton. They are in the lobby picker ahead of the catalogue, and
you can look at one alone at `/dev/procedural-avatar` when running locally
(`?who=stagehand`, `?speed=1.4` to walk, `?hide=Shirt,Skirt` to see the body
under the clothes).

To add a character, describe it in
`frontend/features/procedural-avatar/characters.ts` and list it in
`catalogue.ts`. A character is data: proportions, build, face, colours, a hair
style and an outfit. The parts it is made from are shared.

:::details How they are built

-   **Sculpted, not modelled.** Soft parts (head, body, hands, shirt,
    trousers, shoes) are described as distance fields: simple shapes blended
    together (`kernel/sdf.ts`) and turned into a mesh by `kernel/mesher.ts`.
    Crisp parts (pleated skirt, tie, collar, glasses) are swept surfaces.
-   **A body with clothes on it.** The body is complete on its own; every
    garment and accessory is a separate mesh over it, named
    `<id>_Shirt`, `<id>_Skirt` and so on.
-   **Hair is grown.** A groom (`parts/hair.ts`) traces hundreds of locks over
    the skull, in layers, with stray hairs on top. A ponytail swings on its
    own bones.
-   **Sculpted relaxed, bound in a T-pose.** Surfaces are shaped with the arms
    lowered, where shoulders and sleeves look right, then carried back to the
    T-pose that Oncyber's motion clips expect (`rig.ts`).
-   **It stands in for a VRM.** The skeleton uses the VRM humanoid bone names,
    so the lobby animates it like any other avatar. A procedural avatar is
    known by a path such as `/avatars/procedural/runner`; nothing is fetched
    from it. The lobby loader (`avatarAdapter.ts`) recognises the path and
    builds the avatar instead, in a web worker.
-   **Two looks.** A character is either _painted_ or _studio_ (`look` in
    its description).
    -   Painted (Runner): shading is baked into vertex colours and two small
        generated textures, so the avatar uses the same plain materials as
        VRM avatars and can be drawn as a crowd.
    -   Studio (Stagehand): no textures at all. Meshes are much denser,
        colour and shading inputs (openness, thickness, strand direction) are
        stored on the vertices, and procedural shaders in `materials.ts`
        light the avatar themselves: scattering skin, strand-lit hair, cloth
        with tinted shadows and sheen, polished leather. Hair is sculpted as
        one mass from a few dozen broad locks (`parts/hairSculpt.ts`), with
        strands drawn in the shader. This look costs more: about 730,000
        triangles and several seconds to build, and other visitors see it
        as a full avatar, not a crowd instance.
-   **The traced reference.** A character can also be sculpted whole as
    distance fields (`sculpts/`): head, hair laid lock by lock as flat
    ribbons over a hair volume, clothes and accessories, each placed from
    measurements of its character sheet, in a T-pose. `raymarch.ts` turns
    those shapes into a shader that traces them per pixel, with soft
    shadows, occlusion and every painted feature drawn in the shader. It
    is the reference a wearable avatar is matched against, not something
    to put in a space: every pixel pays for the whole sculpt.
-   **A figure, and a style.** A _figure_ (`figure/`) is a ready-made bare
    humanoid that characters are made from: `public/models/figure_male.vrm`,
    built by `tasks/avatar-figure` from a public-domain base model. It
    keeps that model's skin, skeleton, weights and all 54 of its face
    expressions, and none of its images: about 11,000 triangles in three
    draw calls, 550 kB. Twelve of the expressions are exact sums of
    others (a blink is each eye's own); the file holds their parts, and
    what drives them is given those. What a texture would have held is stored on the
    vertices (how open each point is to the light, what stands between it
    and the light from above, how sharply the surface turns, how thin the
    flesh is), and the rest is drawn per pixel by `figure/shading.ts`:
    soft-lit skin whose shadows start warm, irises, lid lines, lips and
    underwear, sharp at any distance, and brows shaded as ridges of hair
    that cast their own soft shadow on the lid below. A _style_
    (`figure/style.ts`) is what makes a figure a character: its colours,
    how its eyes, lids and brows are drawn (in eye widths, so the numbers
    suit any figure), the outline of its eyes as measured off a character
    sheet, which expressions it wears at rest, how round and how hollow
    its ears are, how long its face is and what its outline is, and how
    its face is reshaped locally. Reshaping carries every expression along, so a restyled
    eye still blinks. The body's proportions stay the figure's
    own. It has no hair or clothes yet. `/dev/figure-avatar` shows it
    locally (`style=plain` for the bare figure).
-   **Two forms of a figure.** `styleFigure` makes a figure in one of two
    forms. The _full_ form keeps every expression, played as a VRM's
    are: for a figure seen close, such as a visitor's own. The _basic_
    form blinks and opens its mouth, each by one number (`figure.face`),
    and does nothing else with its face. It carries no morph targets,
    which saves about 1.1 MB of memory and 1.5 MB on the graphics card
    for each figure, and it is the form a world draws. At rest the two
    are the same character, vertex for vertex and pixel for pixel.
-   **Looks, and crowds.** A style has two halves. Its _shape_ is what is
    done to the mesh: worn expressions, features, head, ears, the
    outline of the eyes, where the brows lie. Its _look_ is everything
    drawn on the mesh: colours, how heavy the lines are, irises and
    catchlights, underwear. A look is one row of a small table the
    shaders read (`figure/looks.ts`), so figures that share a shape can
    be drawn as one mesh, each with a look of its own.
    `createFigureCrowd` (`figure/crowd.ts`) draws any number of one
    character in three draw calls; each figure has its own place, pose
    (a row of a table of poses taken from the figure itself), look, and
    moment to blink. `variedLook` gives a look that differs a little
    from a style's. A figure in a crowd is drawn by the same shaders
    from the same numbers as one by itself. The basic form's materials
    are also ones the lobby's own crowd takes
    (`lobby/webgpu/crowdMaterial.ts`). `/dev/figure-avatar` shows both (`form=basic`, `crowd=60`), and
    `tasks/avatar-figure`'s `compare` draws them (`--form basic`,
    `--crowd 60`, and `--as-crowd` to check a crowd of one against the
    figure alone).
-   **Detail by size on screen.** A figure is about 10,900 triangles,
    all of which show when it fills the screen. Smaller, most of them are
    under a pixel. The figure's file says for every vertex what a view
    would lose by drawing the figure without it, in metres
    (`figure/detail.ts`; worked out when the file is built, from how far
    the surface, its shading, every expression and every bent joint would
    end up from where the whole mesh puts them). `figure.setDetail`
    draws a figure with only what a view can show, and a crowd does it
    for each of its figures from who is looking (`crowd.update(time,
view)`): anything costing under a quarter of a pixel is left out, so a
    figure half the screen high keeps nearly all of its mesh and one a
    tenth as high about a third. The coarser meshes are other lists of
    triangles over the same vertices, so nothing else is stored or
    loaded for them.
-   **From a picture to a character.** A style is fitted to a picture of
    the character with `tasks/avatar-figure`'s `compare` command. It
    draws the styled figure from fixed views and sets it beside the
    picture, framed alike, and it shows each eye of the picture under a
    grid in eye widths, the unit a style is written in, and both faces
    under one for the head's own shape. The numbers are read off the
    grids into the style, the command is run again, and what still
    differs shows side by side. The picture needs a front view
    with the eyes open; what it cannot show (how far the nose or the
    ears stand out) wants a side view too. `--hair` tries another
    model's hair on the figure, fitted to its head, to judge a
    hairstyle by.
-   **A described humanoid.** A sculpted character is not hand-placed
    shapes but a description (`humanoid/description.ts`): where its joints are,
    how thick its torso and limbs are, what underwear it wears, its
    palette, and its own head, hair and outfit. `buildHumanoid` makes the
    body from those numbers, complete under the clothes, in the T-pose
    avatars are animated from; dressed, only the parts that show are
    kept. The body is data today; the head, hair and outfit are still
    builders per character (`sculpts/stagehand.ts`) and are to move into
    the description too.
-   **The sculpt as meshes.** `meshSculpt.ts` cuts the same sculpt into
    ordinary triangles, once, when the avatar is built, at whatever
    density is asked for. What the tracer finds per pixel by sampling the
    sculpt (how open a point is to the light, which lock of hair it lies
    on) is stored on the vertices, and the tracer's own shading
    (`shading.ts`) runs on the mesh: still no textures, and no tracing.
    This is the route to an avatar that can be worn; it is not rigged or
    offered in the picker yet. `/dev/raymarched-avatar` shows either when
    running locally: `mode=mesh` (default, with `coarse`) or `mode=trace`
    (with `scale`), plus `naked=1`, `zoom=face` and `yaw`.

The lobby offers a figure as the avatar "Figure" (the Stagehand's face, no
hair or clothes yet), built in its basic form so the lobby can draw many as a
crowd. Its URL names a variation of its look, `/avatars/procedural/figure?look=7`
(`figureAvatarUrl` in `catalogue.ts`), so everyone who sees it builds the same
one. To see many at once when running locally, open the lobby with
`?crowd=40`: a staged crowd, seen by you only, wearing a dozen variations.
`?wear=figure` wears it for that visit without saving it.

Saved as your avatar, a generated character is used in the lobby. Gallery
spaces don't build them yet and show the default avatar there.

:::
