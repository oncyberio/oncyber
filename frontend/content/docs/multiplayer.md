---
title: Multiplayer
description: Seeing, chatting and talking with other people in Oncyber.
order: 4
---

# Multiplayer

In the lobby you see everyone else move, jump and emote. You can chat with
everyone or one person, join voice, and travel into a space together as a
group.

The lobby is moving to a new multiplayer server, the shared world, which is
being built now. One lobby room spreads over several CPU cores, so many more
people fit in the same place. In voice, people ask to speak and an admin lets
them on, and you hear the speakers near you.

To work on it, run the server and point the app at it:

```sh
npm --prefix multiplayer ci
npm --prefix multiplayer run build
npm --prefix multiplayer run lobby:world:serve
```

```sh
# frontend/.env.local, then restart pnpm dev:frontend
NEXT_PUBLIC_LOBBY_REGIONS='[{"id":"local","httpUrl":"http://127.0.0.1:2575","protocol":2}]'
NEXT_PUBLIC_LOBBY_REGION=local
```

The quickest test is two browser windows, one signed in and one as a guest.
`pnpm dev:local` still starts the older crowd lobby for now (see below).

:::details How it works

| Part             | Where                                            | What it does                                                                        |
| ---------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Shared world     | `multiplayer/src/world/`                         | One room over several workers, WebTransport with a WebSocket fallback               |
| Voice stage      | `multiplayer/src/world/stage.ts`                 | Requests to speak, admin approval, mutes and removals, shared by every worker       |
| Lobby connection | `frontend/features/lobby/LobbyConnection.ts`     | Joins the room, reconnects with backoff, and handles being signed in somewhere else |
| World transport  | `frontend/features/lobby/WorldLobbyTransport.ts` | The browser side of the shared world protocol                                       |
| Endpoint choice  | `frontend/features/lobby/lobbyEndpoints.ts`      | Picks a lobby region from config; `"protocol":2` selects the shared world           |
| Chat             | `frontend/utils/chat/ColyseusChatProvider.ts`    | Chat rides the same connection                                                      |
| Voice            | `frontend/utils/voiceChat/ColyseusSignaling.ts`  | Peer-to-peer WebRTC voice, signalling relayed by the server, TURN credentials       |
| Gallery rooms    | `multiplayer/` (`CyberRoom`)                     | Presence inside spaces                                                              |

The server owns positions. The browser predicts your own movement right away
and corrects it smoothly when the server answers, and it interpolates everyone
else. Each visitor gets detailed updates for the people nearest to them, and
less often for people further away.

Up to eight people can speak at once. A speaker is heard within 120 m by up to
200 listeners. `docs/lobby-world-v2.md` covers the design and measured limits.

:::

:::details The older crowd lobby and tests

The crowd lobby (`crowd-lobby` room, protocol 1) is what the lobby used before
the shared world. `pnpm dev:local` starts it on `127.0.0.1:2568`. To run it by
hand:

```sh
npm --prefix multiplayer run lobby:dev
```

```sh
NEXT_PUBLIC_LOBBY_REGIONS='[{"id":"local","httpUrl":"http://127.0.0.1:2568","wsUrl":"ws://127.0.0.1:2568","protocol":1}]'
```

Tests and load tests:

```sh
npm --prefix multiplayer run test:lobby-world   # shared world
npm --prefix multiplayer run lobby:world:load   # shared world load
npm --prefix multiplayer run test:lobby         # crowd lobby
npm --prefix multiplayer run lobby:load -- --clients=256 --scenario=dense --seconds=10
```

The load tools only target loopback endpoints. Never aim synthetic clients at a
public server.

:::
