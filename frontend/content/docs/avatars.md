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
-   **A character from a VRoid base.** `vroid/restyle.ts` takes a loaded
    VRoid base model (the bare body in `public/models/fem_vroid.vrm`) and
    turns it into the character a recipe (`vroid/recipe.ts`) describes,
    keeping its triangles, skin weights and face morphs: proportions
    change through its own skeleton (each bone scales the part it carries
    and its children move with it), the chest can be flattened, the face
    lengthened below the eyes, an expression baked in as the resting face,
    and the materials replaced by soft-shaded ones tinted to the recipe's
    palette. About 19,000 triangles. It has no hair or clothes of its own
    yet. `/dev/vroid-avatar` shows it locally (`plain=1` for the base).
-   **A described humanoid.** A sculpted character is not hand-placed
    shapes but a description (`humanoid/spec.ts`): where its joints are,
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

Saved as your avatar, a generated character is used in the lobby. Gallery
spaces don't build them yet and show the default avatar there.

:::
