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
