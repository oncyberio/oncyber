# Lobby scaling

The networking sections below describe **protocol v1**. The new
[shared world with WebTransport (protocol v2)](lobby-world-v2.md) spans CPU workers
in one room and has its own runtime, limits and measurements. Renderer budgets
and the v1 measurements below remain separate from v2 capacity tests.

The lightweight lobby now has a dedicated multiplayer protocol and bounded
rendering/networking work. This remains a void with the existing native avatars,
animation clips, lighting, floor contact shadows and picker. Gallery/world
loading stays on its existing path.

## Rendering and fidelity

The modern WebGPU/modern WebGL crowd has 256 visitors per page, shared half-float
bone atlases, independent animation phases and a single interleaved instance
buffer per page. Repeated portrait URLs share atlas tiles; atlas allocation grows
with distinct portraits. Unchanged transforms no longer dirty GPU matrix buffers.
A 256-person Square page uses two avatar draw calls. A full WebGPU scene still
has six other draws; the prior instanced WebGL scene already used seven total.

Normal scene budgets are 256 detailed visitors, 16 distinct source models
(including the default body), 16 native animation fallbacks, three concurrent
remote model preparations and 24 name labels. Network v1 currently provides at
most 128 nearby remote visitors. Detail selection runs at 5 Hz with retention
hysteresis; model slots retain their source while admitted users still need it.
Near animations advance every frame, distant animations at 20 Hz. Labels update
at 10 Hz and only while near. Departures cancel queued work and release sources.

These limits have visible tradeoffs: when model/mixer limits are exceeded, a
shared default body keeps the visitor's name and portrait until a slot is free.
If the device cannot batch even that body, remote native animation stays capped
and additional visitors can retain labels. Custom model texture/geometry sizes
still matter: an asset-count budget is not a universal byte budget. The local
avatar keeps native animation independently of these remote budgets.

The scene consumes a mutable network timeline imperatively; packets do not send
a full moving-player list through React. React handles roster/profile/status
changes. The renderer and prediction model adopt one initial pose atomically,
including after renderer recovery, to avoid a welcome/spawn race.

## Movement and latency

`LobbyConnection` negotiates `lobbyProtocol:1` on `/join`. A server that does not
advertise v1 retains the existing CyberRoom compatibility path. Configuring
explicit regional v1 endpoints fails/retries those endpoints if unavailable
instead of silently splitting the user into an unrelated legacy room.

Local controls move immediately. Each outbound pose has an increasing sequence;
the server validates world bounds, finite values, movement speed/burst allowance,
height and animation fields. Acknowledgements compare against the corresponding
sent pose, correct the predicted pose and preserve movement after that packet.
Small visual corrections decay smoothly; authoritative initial spawn resets the
pose. This is pose prediction with delta replay for a collision-free void, **not**
a deterministic input-authoritative game simulation or general anti-cheat system.

Remote samples carry server time and quantized centimetre/milliradian poses.
Clock pings estimate RTT/offset. Per-player timelines interpolate about 100–220 ms
behind authoritative samples, adapting to jitter and update cadence. Gaps use
up to 150 ms bounded extrapolation, then freeze; stale/reordered sequences are
rejected. Catch-up is bounded to avoid a backlog causing a visible teleport.
Nearby, middle and outer interest bands update at 20/10/5 Hz respectively; idle
pose confirmation is 500 ms. A missing player in a changed-only packet does not
mean that player stopped moving.

Automatic reconnect uses bounded exponential backoff and jitter, pauses retries
while offline/hidden, and tears down the previous transport. Explicit leave or
unmount cancels retries. A reconnect releases capture; microphone publication
requires another explicit user action.

## Dedicated multiplayer server

`multiplayer/src/rooms/crowd/` is independent of the legacy CyberRoom. There is no
all-player Colyseus Schema and no all-to-all movement broadcast. A spatial grid
provides a bounded candidate set; each client receives at most 128 nearby players
within 48 m, with 52 m retention hysteresis. In a very dense cell, selection is
approximate nearest, deliberately bounded rather than scanning the whole room.
Metadata enter/change/leave messages are separate from pose deltas. Near 32
players update at 20 Hz, the next 32 at 10 Hz, and the outer 64 at 5 Hz, phased across
clients. Quantized pose encodings are reused across subscribers.

The configured room cap defaults to 512, with reservation-aware overflow rooms.
It is a configuration ceiling, not a demonstrated production guarantee. Movement,
profile, chat and signaling messages have separate rate/size limits. Slow clients
defer unsent pose/roster revisions; hard/persistent backlog closes the connection.
RTC offers/answers/candidates get a separate bounded reliable control queue
(16 messages/64KiB/5 seconds), avoiding silent negotiation failure when movement
traffic is congested.

Voice uses at most eight **mutual** nearby peers within 12 m; the server also
rejects signals outside that graph. Leaving proximity tears down peer connections.
This is bounded proximity WebRTC, not room-wide mesh audio and not an SFU. Chat
is nearby (32 m and mutual interest), not a room-wide megaphone. The UI reports
total room population separately from the nearby people list. Regional TURN
credentials follow the selected multiplayer endpoint and are cached per region.

## Worldwide and larger total populations

`NEXT_PUBLIC_LOBBY_REGIONS` accepts a deployment-owned JSON list of
`{id,httpUrl,wsUrl?}` endpoints. Two bounded health probes select the reachable
region with the lowest observed RTT; selection is cached for five minutes and
invalidated on connection failure. `NEXT_PUBLIC_LOBBY_REGION` can pin a deployment
to one configured region. Only HTTPS/WSS is accepted outside loopback development.
No user-controlled query parameter can redirect identity/matchmaking traffic.

This code does not deploy regional infrastructure. Current rooms use process-local
matchmaking/presence. Overflow rooms and regions have separate populations,
chat and voice: this is **not one globally replicated room**, and people on
separate shards do not see each other. Cross-process matchmaking/presence, party
region/room affinity, seamless cross-shard handoff, globally aggregated presence
and large broadcast audio via an SFU remain separate deployment/product work.
Those are required before claiming one continuous world shared by all regions.

[Dedicated server deployment](lobby-multiplayer-deployment.md) explains the
32KiB production transport, reverse proxy, origins and TURN configuration. No
production service or cloud resources were deployed during local development.
The existing legacy arena listener remains separate and keeps its transport limits.

## Repeatable local validation

Use Node 22. The standalone multiplayer package has its own npm install/lockfile.

```sh
cd multiplayer
npm run lobby:dev
npm run lobby:load -- --endpoint=http://127.0.0.1:2568 --clients=512 --seconds=20 --warmup=5 --scenario=dense
npm run lobby:load -- --endpoint=http://127.0.0.1:2568 --clients=512 --seconds=20 --warmup=15 --scenario=spread --jitter=80
npm run test:lobby
```

The load harness refuses non-loopback endpoints, runs real HTTP/WebSocket clients
in a separate process and reports actual MessagePack wire payload bytes, server
tick/event-loop percentiles, acknowledgement RTT, snapshot gaps, room populations,
AOI/voice maxima and failures. `--jitter` varies client sending cadence; it is not
a WAN delay emulator. The client timeline tests separately simulate 150–250 ms RTT,
variable delivery/missed frames, stale packets and mixed snapshot rates.

Local frontend configuration for the integration fixture:

```dotenv
NEXT_PUBLIC_LOBBY_REGIONS='[{"id":"local","httpUrl":"http://127.0.0.1:2568"}]'
```

- `/dev/lobby-network`: a real localhost observer, controls, network diagnostics,
  explicit leave/reconnect and renderer statistics. It refuses public endpoints.
- `/dev/lobby-crowd?count=10000&detailBudget=unbounded&renderer=webgpu`: actually
  creates 10,000 synthetic instances of one avatar; it makes no multiplayer connection.
- `detailBudget=256` on the same fixture evaluates admission cost for 10,000 entries
  while rendering at most 256; that result must not be called 10,000 rendered avatars.
- Native/modern WebGL/legacy WebGL comparisons remain explicit fixture controls.
  Production returns 404 for both development pages.

Renderer measurements exclude loading and a three-second warmup; they sample 300
settled frames and reset after pause/visibility changes. They are CPU submission
and rAF interval measurements, not GPU timer queries or mobile/cross-device claims.
Network and rendering measurements are separate experiments, not proof that the
combined system supports 10,000 real connected users in one room.


## Measured results · 6 October 2026

Hardware: Apple M5 Pro, 48 GiB RAM. These are local development measurements,
with server and synthetic WebSocket clients in separate processes on one machine.
[Raw report](benchmarks/lobby-2026-10-06.json).

| Experiment | Result |
| --- | --- |
| 512 moving WebSocket clients, dense crowd, 10-second measured interval | All connected; zero disconnects, corrections or backpressure drops |
| Server tick, p50 / p95 | 14.55 / 25.95 ms against a 50 ms tick budget |
| Movement acknowledgement RTT, p50 / p95 | 6.36 / 23.85 ms on loopback |
| Snapshot delivery gap, p50 / p95 | 50.53 / 59.17 ms |
| Server outgoing application payload | 17.02 MB/s total; approximately 33.2 kB/s per client |
| Nearby/voice maxima | 128 remote actors and eight admitted voice peers per client |
| Live browser plus 160 moving clients (162 total room sessions), 45 seconds | 128 remote actors received, up to 120 in view; eight scene draws; no browser errors or movement corrections beyond initial spawn |
| 10,000 visible Square instances, one source model | 80 avatar draws, 86 scene draws, 25,783,607 triangles |
| 10,000-avatar CPU submission, p50 / p95 | 10.4 / 12.0 ms |
| 10,000-avatar rAF interval, p50 / p95 | 8.4 / 16.9 ms |
| 10,000-avatar sampling viewport | 1115 × 934 CSS pixels; 1672 × 1401 drawing buffer; 300 settled frames |
| 256 Roller Pepes, WebGPU and modern WebGL | Eight scene draws, native face/glasses transparency retained, no shader errors |

All 233 focused tests passed: 154 scene/network/voice/landing tests, 56 modern
VRM/material/shader tests and 23 multiplayer tests. The multiplayer production
build passed. The full frontend typecheck still reports repository errors
(604 diagnostics, none in changed lobby/voice files); it is not a clean global
TypeScript build. The newly reported `snapbox.js` `SpaceItem` annotation is also
present unchanged in HEAD. The production entry smoke test checked local joins,
HTTP/WS origin handling, blocked built-in matchmaking, absence of dev metrics,
32 KiB WebSocket enforcement and nonzero exit on bind failure.

The WebSocket test enables the bounded voice graph, but does not create hundreds
of microphone streams or measure TURN/SFU throughput. The 10,000-avatar result
is a repeated-model rendering stress test; it does not establish 10,000 unique
VRMs or 10,000 networked players in one room. Run longer soak tests, WAN/media
load, mobile devices and deployed region measurements before raising capacities.
