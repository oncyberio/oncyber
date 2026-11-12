---
title: Avatars
description: Where avatars come from, how a choice is saved, and how they travel.
order: 5
---

# Avatars

Every visitor has a 3D avatar in the VRM format. The same avatar is used in the
lobby, in galleries, and during travel between them.

## Where avatars come from

-   **Built-in avatars.** The catalogue lives in
    `frontend/components/_3DExhibit-v2/three/factory/player/vrms.json`, with a
    name, model URL and preview image for each one. Guests start as "Square".
-   **Uploaded avatars.** Signed-in people can upload their own VRM models.
-   **Wallet avatars.** VRM NFTs found in a connected wallet on Ethereum or
    Polygon. Partner collections that store their model differently are mapped
    in `frontend/utils/vrmPartners`.

## Choosing and saving

The lobby's avatar picker (`frontend/features/lobby/AvatarCarousel.tsx`) shows
your own avatars first, then the catalogue. A choice applies right away, and once
the model has loaded it's saved as your avatar in account settings
(`settings.vrm`, with an optional `settings.default_vrm_scale`). That way
galleries and later visits use it too.

`resolveLobbyAvatar` in `frontend/features/lobby/avatarSelection.ts` turns
saved settings back into a model: a built-in id, an uploaded model looked up by
id, or the default.

Wallet avatars are identified by their model URL, so today they stay in the
lobby rather than being saved as your default.

## Rendering

Avatars render through the WebGPU runtime
(`frontend/features/lobby/webgpu/avatarAdapter.ts`). Nearby people are full
avatars, and large crowds are drawn as GPU instances, so a room with hundreds of
people stays fast. Animations, including the emotes in the dock, are shared
clips retargeted onto each model, so any VRM can wave, dance or sit.

When you travel into a space, your avatar crouches, the destination loads behind
it, and you stand up in the new world with the same model, position and camera
framing. Group travel keeps your friends around you on arrival.

## Adding to the catalogue

Add an entry to `vrms.json` with a stable `id`, a `name`, the model `url` and a
preview `image`. Keep models light, with one humanoid skeleton, so they load
quickly for everyone in the room.
Check it in the lobby picker, walking, jumping and running a few emotes, before
opening a pull request.
