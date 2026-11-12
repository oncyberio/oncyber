---
title: Multiplayer
description: Presence, movement, chat and voice in the lobby, and how to run it.
order: 4
---

# Multiplayer

Everyone in the lobby shares one room. You see other people's avatars move,
jump and emote, chat with everyone or one person, join voice, and travel into a
space together as a group.

## What runs where

| Part                       | Where                                           | What it does                                                                           |
| -------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Lobby connection           | `frontend/features/lobby/LobbyConnection.ts`    | Joins the room, reconnects with backoff, and handles being signed in somewhere else    |
| Endpoint choice            | `frontend/features/lobby/lobbyEndpoints.ts`     | Picks a lobby region from config, with the hosted arena as the default                 |
| Crowd lobby room           | `multiplayer/` (`crowd-lobby`)                  | Authoritative presence and movement for the landing lobby                              |
| Shared world (protocol v2) | `multiplayer/`                                  | Multi-worker room over WebTransport with a WebSocket fallback                          |
| Gallery rooms              | `multiplayer/` (`CyberRoom`)                    | Presence inside classic galleries                                                      |
| Chat                       | `frontend/utils/chat/ColyseusChatProvider.ts`   | Chat rides the same room connection                                                    |
| Voice                      | `frontend/utils/voiceChat/ColyseusSignaling.ts` | WebRTC voice, with signalling relayed by the room and TURN credentials from the server |

The server owns positions. The browser predicts your own movement right away
and corrects it smoothly when the server answers, and it interpolates everyone
else. In crowded rooms each visitor gets detailed updates for the people nearest
to them, at a lower rate for people further away.

Large voice rooms use a stage: up to five speakers, heard by the 50 nearest
listeners.

## Run the lobby server locally

By default your local app joins the hosted lobby. To work on the server, run
your own from `multiplayer/` with Node 22:

```sh
npm --prefix multiplayer ci
npm --prefix multiplayer run lobby:dev
```

It listens on `127.0.0.1:2568` only. Point the frontend at it in
`frontend/.env.local`:

```sh
NEXT_PUBLIC_LOBBY_REGIONS='[{"id":"local","httpUrl":"http://127.0.0.1:2568","wsUrl":"ws://127.0.0.1:2568","protocol":1}]'
NEXT_PUBLIC_LOBBY_REGION=local
```

Restart `pnpm dev:frontend` after changing environment variables.

To try the shared-world service instead:

```sh
npm --prefix multiplayer run build
npm --prefix multiplayer run lobby:world:serve
```

Then use `"protocol":2` in the region config. The repository's
`docs/lobby-world-v2.md` covers its architecture and measured limits.

## Testing with many people

```sh
npm --prefix multiplayer run test:lobby
npm --prefix multiplayer run lobby:load -- --clients=256 --scenario=dense --seconds=10
```

The load tool only targets loopback endpoints. Never aim synthetic clients at a
public server.

A quick manual test is two browser windows, ideally one signed in and one as a
guest. If the same account joins twice, the older window is told it joined
somewhere else.
