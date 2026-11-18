---
title: Avatars
description: The 3D character you take everywhere in Oncyber.
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

## Make your own

The avatar maker at [/studio/avatar](/studio/avatar) builds a cartoon avatar
from sliders, choices and colours: body, head, eyes, mouth, hair, outfit and
extras. Pick a starter or shuffle one, preview it walking, waving or dancing,
then choose **Use this avatar** to wear it in the lobby. It is saved in your
browser, and to your account when you are signed in. The lobby's avatar picker
lists it first and links to the maker.

Made avatars appear in the lobby. Gallery spaces load model files only, so
there you appear as the default avatar for now.

:::details How made avatars work

A made avatar has no model file. It is a **recipe**: about seventy sliders,
choices and colours (`frontend/features/toon-avatar/recipe.ts`). Everything
else is built from the recipe in the browser when the avatar is shown.

-   **Code.** A recipe packs into a short text code such as `toon1.gIBmZmZz…`
    (`codec.ts`). The avatar's address is the maker link carrying that code,
    `/studio/avatar?a=<code>` (`url.ts`). That address is what is saved as
    `settings.vrm` and sent to other visitors, so nothing is uploaded.
-   **Mesh.** `mesh/` turns the recipe into one skinned, vertex-coloured
    mesh: a skull function that the eyes, nose, ears, hair and glasses sit on,
    limbs as soft tubes, and clothes as coloured spans with ink hems. It is
    plain TypeScript with no three.js, so it runs in tests and workers.
-   **Look.** `three/material.ts` draws the mesh twice with TSL materials:
    flat colour with one cel shadow, then the ink outline (the mesh pushed out
    along its normals, back faces only). The mouth, brows, eyelids and marks
    are painted in the shader from numbers, so every avatar shares the same
    two shaders and a face can blink, glance and talk without new geometry.
-   **Skeleton.** Bones use the VRM humanoid names and rest in a T-pose
    (`skeleton.ts`), so the lobby's locomotion and emotes play on a made
    avatar unchanged. `three/vrm.ts` presents it as the object the VRM loader
    returns, and `features/lobby/webgpu/avatarAdapter.ts` builds one whenever
    an avatar address is a maker link.
-   **Motion as code.** The maker's own previews (`three/motion.ts`) are
    functions of time that turn bones; hair tails and coat tails trail on a
    spring.

-   **Avatars written as code.** A character the sliders can't reach is
    its own module in `features/toon-avatar/authored/`: a recipe plus a
    `build` function that adds bespoke geometry with the same kit. Tinker,
    Moth and Juno in the lobby picker are made this way.
    `docs/avatar-authoring.md` in the repository is the method for writing
    one from a reference picture, with `/dev/avatar-lab` to compare against
    it.

To add an option, append it to its list in `recipe.ts` (never insert: codes
store the position), build its shape in `mesh/`, and run
`pnpm -C frontend test features/toon-avatar`. To try a made avatar in the
lobby renderer without an account, open
`/dev/lobby-crowd?mode=native&count=8&toon=<code>`.

:::
