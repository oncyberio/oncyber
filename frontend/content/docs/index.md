---
title: Oncyber docs
description: Run, extend and contribute to the open-source Oncyber lobby.
order: 0
---

# Oncyber docs

Oncyber is a shared 3D lobby that connects many worlds. People arrive in one
social space, see who's around, chat, talk, emote, show art from their wallet,
and travel together into galleries and other experiences while keeping the same
identity and avatar.

This repository is the whole thing: the landing page, the lobby, the WebGPU
scene runtime, the gallery player and the multiplayer services. It's open
source so you can run it, read it and improve it.

## Start here

-   [Run Oncyber locally](/docs/run-locally): install, configure and open the
    app on your machine.
-   [Contribute](/docs/contributing): branches, checks and what makes a good pull
    request.
-   [Build a three.js experience](/docs/three-experiences): bring your own
    WebGPU or three.js page into Oncyber.
-   [Multiplayer](/docs/multiplayer): how presence, movement, chat and voice work,
    and how to run the lobby server.
-   [Avatars](/docs/avatars): where avatars come from, how a choice is saved, and
    how they travel between worlds.

## How the pieces fit

| Folder                               | What lives there                                                |
| ------------------------------------ | --------------------------------------------------------------- |
| `frontend/`                          | Next.js app: landing, lobby, gallery player, Studio, API routes |
| `frontend/features/lobby/`           | The shared lobby: scene, dock, chat, travel                     |
| `frontend/components/_3DExhibit-v2/` | Scene runtime on three.js `WebGPURenderer`                      |
| `frontend/features/content-host/`    | Hosts external experiences in a sandboxed frame                 |
| `multiplayer/`                       | Colyseus rooms, lobby services, voice signalling                |
| `cloud-functions/`                   | Firebase functions: 3D asset optimization, uploads              |

For coding agents there is a plain-text index at [/llms.txt](/llms.txt).
