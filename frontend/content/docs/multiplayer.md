---
title: Multiplayer
description: Seeing, chatting and talking with other people in Oncyber.
order: 4
---

# Multiplayer

In the lobby you see everyone else move, jump and emote. You can chat with
everyone or one person, join voice, and travel into a space together as a
group.

By default your local app joins the hosted lobby. To work on the server
itself, run your own:

```sh
npm --prefix multiplayer ci
npm --prefix multiplayer run lobby:dev
```

Then point the app at it in `frontend/.env.local` and restart
`pnpm dev:frontend`:

```sh
NEXT_PUBLIC_LOBBY_REGIONS='[{"id":"local","httpUrl":"http://127.0.0.1:2568","wsUrl":"ws://127.0.0.1:2568","protocol":1}]'
NEXT_PUBLIC_LOBBY_REGION=local
```

The quickest test is two browser windows, one signed in and one as a guest.

:::details How it works

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
listeners. The local server listens on `127.0.0.1:2568` only. If the same
account joins twice, the older window is told it joined somewhere else.

:::

:::details Shared-world server and load tests

```sh
npm --prefix multiplayer run build
npm --prefix multiplayer run lobby:world:serve
```

Use `"protocol":2` in the region config for it. `docs/lobby-world-v2.md` covers
its architecture and measured limits.

```sh
npm --prefix multiplayer run test:lobby
npm --prefix multiplayer run lobby:load -- --clients=256 --scenario=dense --seconds=10
```

The load tool only targets loopback endpoints. Never aim synthetic clients at a
public server.

:::
