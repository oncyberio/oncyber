---
title: Oncyber docs
description: Run, extend and contribute to Oncyber, the open-source home for 3D spaces on the web.
order: 0
---

# Oncyber docs

Oncyber is where people make and visit 3D spaces on the web: galleries for
their art, worlds they build in the browser, and a shared lobby where everyone
meets and travels between them with the same identity and avatar.

All of it is open source. You can run it, read it and make it better.

## Start here

-   [Run Oncyber locally](/docs/run-locally): get the app running on your
    machine.
-   [Contribute](/docs/contributing): how to send a good change.
-   [Bring your own world](/docs/three-experiences): the idea of any 3D world,
    made with any engine, becoming a space in Oncyber.
-   [Multiplayer](/docs/multiplayer): seeing, chatting and talking with other
    people.
-   [Avatars](/docs/avatars): the 3D character you take everywhere.

:::details Where things live in the code

| Folder                               | What lives there                                                |
| ------------------------------------ | --------------------------------------------------------------- |
| `frontend/`                          | Next.js app: landing, lobby, gallery player, Studio, API routes |
| `frontend/features/lobby/`           | The shared lobby: scene, dock, chat, travel                     |
| `frontend/components/_3DExhibit-v2/` | Scene runtime on three.js `WebGPURenderer`                      |
| `frontend/features/content-host/`    | Hosts external experiences in a sandboxed frame                 |
| `multiplayer/`                       | Lobby world server, rooms for spaces, voice signalling          |
| `cloud-functions/`                   | Firebase functions: 3D asset optimization, uploads              |

Coding agents can read a plain-text index at [/llms.txt](/llms.txt).

:::
