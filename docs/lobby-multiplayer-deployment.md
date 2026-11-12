# Dedicated lobby multiplayer service

`multiplayer/src/lobby-server.ts` is the production entry for the v1 landing lobby. It starts only the crowd room, its join/health routes and optional regional TURN credentials. It does not load Firebase, legacy Cyber/Game rooms or development metrics. The protocol and capacity measurements are documented in [lobby-scale.md](lobby-scale.md).

Build and run from `multiplayer/`:

```sh
npm run build
NODE_ENV=production LOBBY_PORT=2568 npm run lobby:serve
```

The existing image can run this entry by overriding its command with `node build/lobby-server.js`. For a container, set `LOBBY_BIND=0.0.0.0` and publish the selected port only to the trusted ingress network. The image's existing `EXPOSE 2567` declaration does not select the application's listen port. No image or infrastructure changes are required to choose this entry.

## Configuration

The entry reads `arena.env` in production and `development.env` otherwise, matching the existing multiplayer bootstrap. Environment variables already present take precedence.

| Variable                   | Default                                     | Purpose                                                                                                                                                                           |
| -------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LOBBY_BIND`               | `127.0.0.1`                                 | Listen address; keep loopback with a host reverse proxy.                                                                                                                          |
| `LOBBY_PORT`               | `2568`                                      | HTTP and WebSocket listener.                                                                                                                                                      |
| `LOBBY_ORIGINS`            | `https://oncyber.io,https://www.oncyber.io` | Comma-separated exact browser origins, shared by HTTP CORS and WebSocket upgrade checks. Add any other embedding origin explicitly.                                   |
| `LOBBY_TRUST_PROXY`        | disabled                                    | Express trusted proxy definition, such as `loopback` for a local ingress. Only trust known ingress hops so per-IP join limits cannot be bypassed with a forged forwarded address. |
| `LOBBY_REGIONS`            | `local`                                     | Region identifiers accepted by the room. Set one deployment region per service in the usual regional setup.                                                                       |
| `LOBBY_LABEL`              | `oncyber-lobby-v1`                          | Server-owned matchmaking label; arbitrary client labels cannot create shards.                                                                                                     |
| `LOBBY_MAX_CLIENTS`        | `512`                                       | Maximum clients per room; tune against the measured host capacity.                                                                                                                |
| `TURN_HOST`, `TURN_SECRET` | unset                                       | Optional regional coturn host and static authentication secret. The service returns 404 when these are absent, leaving clients on STUN.                                           |
| `TURN_TTL`                 | `3600`                                      | Credential lifetime in seconds, constrained to 60–3600.                                                                                                                           |

Join rate limits are configured in `rooms/crowd/join.ts`; use its documented environment settings when accommodating visitors behind shared NAT addresses. TURN credentials are limited to 60 requests per IP per minute. Do not set `LOBBY_PROFILE_TICKS` for ordinary production service; detailed development tick profiling is opt-in and no `/lobby-metrics` route is exposed here.

## Reverse proxy

Terminate HTTPS/WSS at the ingress. Forward `/join`, `/lobby/health`, `/turnCredentials` and the Colyseus reservation WebSocket paths to this one service, including the WebSocket `Upgrade` and `Connection` headers. Configure an idle timeout long enough for the transport heartbeat. Restrict access to the service listener so the ingress is the only public route.

Block `/matchmake` and its descendants at the reverse proxy. The dedicated entry also disables Colyseus 0.14's built-in matchmaking HTTP handler: `/join` is the only reservation route, ensuring region/label validation and join rate limits apply. Blocking `/matchmake` at ingress protects this invariant if another entry is accidentally selected. Reject development `/lobby-metrics` paths and avoid exposing a generic catch-all HTTP backend route.

`GET /lobby/health` returns `{ "lobbyProtocol":1, "region":"<configured region>" }`. Health requests without an Origin header are accepted; supplied browser origins must be allowlisted. CORS/origin checks constrain browsers, not authenticated identity: guest profile fields are client claims, and any verified identity policy must be implemented at the custom join boundary before treating names as verified.

WebSocket messages are limited to 32 KiB and HTTP JSON bodies to 16 KiB. Colyseus handles SIGINT/SIGTERM by gracefully leaving rooms and closing the listener; clients reconnect with bounded backoff and obtain a fresh authoritative spawn.

## Frontend region selection

Configure only deployment-controlled origins in `NEXT_PUBLIC_LOBBY_REGIONS`, for example:

```json
[
    {
        "id": "eu",
        "httpUrl": "https://lobby-eu.example.com",
        "wsUrl": "wss://lobby-eu.example.com"
    }
]
```

Each `id` must match the backend's `LOBBY_REGIONS`/health region. `NEXT_PUBLIC_LOBBY_REGION` optionally pins a configured identifier. Otherwise the client uses bounded health probes and caches the lowest-latency reachable region. Matchmaking, WebSockets and TURN credential fetches use that chosen regional deployment. Without regional configuration, the frontend retains the existing Arena endpoint and legacy protocol fallback.

A process uses local presence and a local matchmaking driver. Keep a reservation's WebSocket traffic on that same process; adding replicas requires an explicit shared presence/matchmaking or sticky routing strategy. Do not assume a generic round-robin proxy makes this entry a multi-node room service. Room sharding within one process and separate region services are supported by this entry.
