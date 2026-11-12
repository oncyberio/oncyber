# Multiplayer

Oncyber's realtime services, built on [Colyseus](https://docs.colyseus.io/):
the protocol-v1 crowd lobby, the protocol-v2 shared world over WebTransport,
gallery rooms (`CyberRoom`), voice signaling relay and TURN credentials.
This package is not part of the root pnpm workspace; install it on its own
with Node 22:

```sh
npm ci
npm test
```

## Shared world with WebTransport (protocol v2)

The new shared-world service uses CPU workers over shared authoritative state,
HTTP/3 WebTransport datagrams, reliable controls and WebSocket fallback. It is
a separate entry from the protocol-v1 Colyseus lobby described below.

```sh
npm run build
npm run lobby:world:serve
npm run test:lobby-world
npm run test:lobby-wire
```

Defaults: HTTP 2575, worker WebSockets starting at 2576, HTTP/3 UDP 2590, loopback
bind and up to eight workers. Use Node 22. Configure the frontend endpoint with
`protocol:2`. See [architecture, local setup and measured limits](../docs/lobby-world-v2.md).
The 10,000-slot admission ceiling is not a production capacity guarantee.

## Dedicated crowd lobby (protocol v1)

The lightweight landing-page lobby uses a separate `crowd-lobby` room. It never
sets a Colyseus all-player Schema and does not import the gallery engine,
Firebase, or moderator APIs. `CyberRoom` and its wire protocol are unchanged.

From this directory, with Node 22:

```sh
npm run lobby:dev
npm run test:lobby
npm run lobby:load -- --clients=256 --scenario=dense --seconds=10
```

The development entry binds **127.0.0.1:2568 only**; `LOBBY_DEV_PORT` can select
another local port. Its `/lobby-metrics` and `POST /lobby-metrics/reset` endpoints
are for local profiling, and `/join` deliberately bypasses the production IP
limit because hundreds of harness clients share loopback. The harness refuses
non-loopback endpoints. Run it against a separate process/port when inspecting
the browser lobby; do not aim synthetic clients at a public arena.

`npm run build && npm run lobby:serve` starts the dedicated production entry.
Use that entry behind a WebSocket-capable reverse proxy for the lobby: it has a
32 KiB incoming WebSocket payload limit. Registering the room on the existing
arena also works, but the arena's shared legacy transport retains its existing
payload settings. No infrastructure or regional deployments are created by
these changes. The local entry is not a production service.

### Capacity, regions, and overflow

-   `LOBBY_MAX_CLIENTS`: room capacity, default 512, accepted range 2–2048. This is
    an admission cap, **not a promise of measured realtime capacity**. Size it from
    measurements on the intended hardware, network, and population distribution.
-   `LOBBY_LABEL`: server-controlled namespace, default `oncyber-lobby-v1`. `/join`
    normalizes it; direct room creation rejects arbitrary labels.
-   `LOBBY_REGIONS`: comma-separated allowed region IDs, default `local`. A
    deployment should normally advertise one real region. The first is returned
    by `/lobby/health`. These values partition matchmaking; they do not move the
    process or create servers around the world.
-   `LOBBY_PROFILE_TICKS=1`: retain up to 2,400 per-tick stage timing samples. Enabled
    in the local dev entry. Production exposes no dev metrics endpoint.

`/join` with `lobbyProtocol:1` uses Colyseus `joinOrCreate` filtered by the
configured namespace and region, bypassing the legacy global mutex. Colyseus
locks full rooms using reserved seats, then creates another shard; the join
route retries a reservation race at most twice. People in different shards do
not see/chat/voice with each other. This implementation uses `LocalPresence`;
multi-process operation needs an appropriate shared presence/driver deployment.
Configure edge limits for HTTP matchmaking as well as `/join`. A client-chosen
`userId` is profile metadata, not proof of account authentication.

### Replication and authority

The server ticks at 20 Hz. Each client retains at most 128 spatial neighbors.
The 8m-cell index samples at most 384 candidates plus the previous 128 members;
dense hotspots therefore use **approximate nearest selection**, not a scan or
sort of everyone in the room. Enter/exit radii are 48m/52m with a 2m retained
member preference. AOI work is spread over four ticks. Metadata enters, profile
updates, and leaves are sent separately from motion.

The first 32 visible peers receive changed poses up to 20 Hz, the next 32 at
10 Hz, and the remaining 64 at 5 Hz. Stable per-client phases spread work across
ticks. Every visible stationary pose is confirmed at least every 500ms; omission
from a delta packet does not mean stopped. Position tuples use integer
centimetres and milliradian yaw. Identical quantized pose tuples are encoded
once and reused across viewers; tests compare complete packets byte-for-byte
with Colyseus's standard encoder.

The client predicts its own free movement. The server assigns the initial spawn
and acknowledges each accepted monotonic sequence with its authoritative pose.
Horizontal displacement uses a 6.5m/s leaky distance budget with at most 1.5m
burst credit; elapsed refill is capped at 250ms. Vertical motion is bounded to
0–3m at 10m/s with 1.5m burst credit, x/z to ±200m. Ground contact is derived
from height. Invalid numbers, old sequences, and emote indices outside -1…127
are rejected. This limits pose-based movement abuse and supports correction;
it is **not deterministic input-authoritative physics or an anti-cheat system**.

Proximity voice is a mutual graph with at most eight peers per client within
12m. Signaling is rejected outside that graph. Chat is capped to mutual nearby
AOI members within 32m and accepts only normal text messages. There is no
all-to-all voice broadcast. Voice mesh fanout is bounded, but media still uses
the existing WebRTC/STUN/TURN path; capacity measurements do not simulate audio.

Move/chat/profile/signaling/request token buckets bound per-client rates.
Snapshots pause above 256 KiB of socket backlog; metadata revisions stay pending.
RTC control packets queue in order, capped at 16 packets/64 KiB for 5 seconds.
Overflow/expiry disconnects the slow client rather than silently losing an
initial offer or answer. A backlog above 1 MiB or sustained for 5 seconds also
disconnects. Slow-client recovery, queue expiry, sharding, movement validation,
dense AOI limits, and mutual voice admission are tested.

### Protocol v1

1. `POST /join` with `{lobbyProtocol:1,userId,username,avatar,VRM,region?}` returns
   `{success:true,lobbyProtocol:1,region,reservation}`. Consume the Colyseus seat.
2. Bind message handlers, then send `lobby-ready`. `lobby-welcome` provides
   `sessionId`, `roomId`, `region`, `position:[x,y,z,yaw]`, `tickRate:20`,
   `aoiLimit:128`, `voiceLimit:8`, `snapshotRates`, and `snapshotBands`.
3. `lobby-roster` is `{enter:[profile],leave:[sessionId],population}`; `enter`
   also upserts profile changes. It excludes self. Profiles contain sessionId,
   userId, username, avatar, VRM, and scale.
4. `lobby-snapshot` is `{tick,serverTime,poses:[[sessionId,xCM,yCM,zCM,yawMrad,emote,floor01]]}`.
   Send `lobby-move` as `[seq,x,y,z,yaw,emote,floorBoolean]`; `lobby-ack` is
   `{seq,serverTime,position:[x,y,z,yaw],animation,floor,corrected}`.
5. `lobby-ping` `{id,clientTime}` yields `lobby-pong` with `serverTime`.
   `lobby-profile` upserts username/avatar/VRM/scale.
6. `rtc-ready` starts eligibility; `{enabled:false}` ends it. `lobby-voice`
   replaces the authoritative `{peers:[sessionId]}` set; compatible `rtc-join`
   and `rtc-leave` events accompany changes. `rtc-signal` takes `{to,payload}`
   and is delivered as `{from,payload}`. `chat-channel` uses the existing
   `{from,server_ts,data}` envelope around `{type:"MESSAGE",text,acc_date}`.

The load harness opens actual local WebSockets, moves every client, resets the
measurement histogram after warmup, and reports p50/p95 tick, stage, event-loop,
ack RTT and snapshot gaps, actual MessagePack socket bytes, population, AOI and
voice caps, corrections and disconnects. `--scenario=spread --warmup=10
--jitter=80` exercises changing interest and irregular movement delivery. It
measures a local process pair, not Internet latency, media bandwidth, browser
rendering, or worldwide service capacity.

### Local validation on 2026-10-06

A 10-second measured dense run, after all 512 actual WebSocket clients joined
and a 2-second warmup, observed one room with 512 moving avatars. Every client
requested voice eligibility (media was not generated). The AOI maximum was 128
and both the delivered and server voice maximum was eight, with zero disconnects,
movement corrections, or snapshots skipped because of backpressure. Tick time
p50/p95 was 14.55/25.95ms, local ack RTT p50/p95 was 6.36/23.85ms, and snapshot
packet gap p50/p95 was 50.53/59.17ms. Server outbound MessagePack traffic was
17.02MB/s total; inbound was 0.408MB/s. The p95 event-loop histogram was 27.43ms
using a 10ms resolution. These are short local machine measurements, not
Internet latency, an audio capacity test, a soak test, or a production guarantee.
The admission cap remains configurable.

`npm test` passes 23 tests (including existing legacy chat/RTC tests), and
`npm run build` compiles the dedicated service. The local test servers use 2570
and 2571, so they do not replace the interactive 2568 lobby. The pure selection
benchmark is `node loadtest/crowd-core.cjs --ticks=200 --voice=100`.
