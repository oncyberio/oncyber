# Voice for larger events

Status: design proposal, 2026-10-20. The SFU, mixer, event admission service and
regional media fanout described here are **planned, not deployed**. The P2P
hardening below is implemented and locally tested. It does not certify a
participant capacity, mobile performance or speech quality.

Keep the existing WebRTC path for small conversations and retain the lobby's
conservative eight-remote-peer budget. Prepare an Oncyber-operated, self-hosted
mediasoup service for larger events. Add a shared stage mixer only when the
audience benefits from hearing the same program. Raising a numeric limit alone
does not establish a safe performance maximum.

## Existing system and history

The lobby already selects at most eight mutual nearby voice peers and bounds
signaling through
[`LobbyVoiceSignaling`](../frontend/features/lobby/LobbyVoiceSignaling.ts).
The [lobby scaling measurements](lobby-scale.md) and
[shared-world measurements](lobby-world-v2.md) explicitly exclude large-scale
voice media qualification. Those population figures must not become audio
capacity claims. Audio candidates still come from the visual interest roster;
although audio ranking is now independent of visual pins, a dense visual roster
can still omit otherwise nearby speakers. Decoupling those rosters requires
bounded audio-position metadata and is future work.

Native `CyberRoom` voice has a different boundary: its eight-speaker limit is a
UI policy, while RTC signaling still reaches the broader room. It is not an
authoritative eight-connection or publisher-admission limit. Screen sharing also
uses the shared WebRTC client, so a blanket eight-connection cap could break
otherwise permitted screen-share delivery. Keep these existing limits while
hardening lifecycle behavior; universal bounded admission remains separate
work. No generic core eight-peer maximum is claimed here.

Repository history records an Agora live-mode host/audience implementation,
followed by `8a12b155c` (2024-11-11, Agora-to-WebRTC migration work).
`53d6e3e24f` (2026-06-12) added an application speaker cap of eight;
`61d0257df` moved voice signaling from PartyKit to Colyseus and added TURN.
The surviving `AgoraVoiceChatProvider` and `AgoraChannel` names currently wrap
[`WebRTCClient`](../frontend/utils/voiceChat/WebRTCClient.ts); their names and
remaining SDK dependencies do not establish active Agora media usage.
The `78d817739` spatial-audio experiment on `origin/agora-3d-audio` is evidence of
an experiment, not proof that it shipped.

The product preference is to own the service and avoid managed-service expense.
No verified negotiated Agora price is recorded here, and self-hosting still
requires media bandwidth, operations and on-call coverage. Earlier engineering
experience included a Chrome speakerphone echo-cancellation regression when
remote sound passed through Web Audio spatial processing. The related
[Chromium issue 40504498](https://issues.chromium.org/issues/40504498), formerly
687574, is historical context, not a claim that current browsers remain broken.
Echo handling is a release gate below.

## Separate attendance, publishing and reception

| Budget | Meaning | Proposed policy |
| --- | --- | --- |
| Room occupants | People present in the world, including voice-off visitors | Set by the world service; does not allocate audio peers |
| Voice listeners | People currently receiving audio | Event admission and regional capacity govern this separately |
| Publishers | Authorized, active microphone sources | Explicit room/stage permission and a bounded publisher budget |
| Lobby P2P peers | Remote connections admitted by the nearby voice graph | Retain the enforced eight-peer budget |
| Native P2P peers | Connections serving microphone and screen-share delivery | No universal eight-connection admission bound currently established |
| Received tracks | Separate audio sources decoded by one browser | Bounded per listener, independent of room attendance |

Eight lobby P2P peers does not mean a room may contain only nine people. It limits
the local voice graph. An eight-speaker UI policy also does not make a large
speaker-to-audience P2P broadcast affordable: every additional listener costs
each publisher another connection and media copy.

For the SFU, **16 and 32 individually spatialized received tracks are future
test targets, not validated defaults or supported capacities**. Start pilots at
the existing bounded reception budget and raise it only on qualified device
classes. Account for stage audio and nearby voices within one total receive
budget; never add two independent maxima without measuring their combined cost.

Audience joins must receive without calling `getUserMedia`. Playback may still
need a user gesture for browser autoplay policy. Promotion grants permission to
speak but does not start capture; the visitor must explicitly enable the mic.
Demotion, revoked access, leaving and cancellation must stop publication, close
obsolete consumers and release capture as appropriate. A late permission result
after leaving must immediately stop its tracks.

## P2P hardening boundary

Keep enforcing the lobby peer budget before allocation on outbound negotiation,
inbound signaling and queued connection creation. A future native admission
policy must model microphone and screen-share eligibility separately, then bound
the union of required peer connections. A user excluded from the nearby mic
graph may still be authorized to receive a shared screen. A core connection cap
without those source-specific rules is not an acceptable substitute.

Reject stale or unauthorized signals, remove departed peers, bound ICE restarts
and retry queues, and avoid negotiation bursts. Peer selection needs retention
hysteresis so small movements do not continually recreate connections.

The accompanying P2P implementation includes:

- The same eight-peer lobby budget, with 12 m entry / 14 m retention and stable
  selection when visual pins or slightly nearer visitors change.
- Session/connection guards, bounded serialized signaling and early ICE queues,
  preservation of valid glare candidates, and a cancellable 150 ms initial yield
  on one side of each pair. This avoids the simultaneous-start Chromium gathering
  stall reproduced in the original client, while a lone publisher still starts.
  It reduces initial collisions; it does not prove every high-latency glare case.
- Safe microphone/device changes, failed-start retry, stale playback protection,
  and microphone plus screen-share cleanup when a peer leaves.
- Independent TURN usernames per issuance, preventing unrelated same-second
  arrivals from sharing a relay quota; the allocation allowance is below.

Real-device echo, degraded-network/TURN-only media and extended soak tests remain
release qualification work. Native room-wide admission and the future SFU are
separate from these fixes.

## Current P2P TURN allocation budget

The checked-in coturn configuration allows **32 concurrent allocations per
credential**, retaining the **1,200 global allocation limit**. The planning
allowance is eight peers times two advertised TURN transports (UDP and TCP), or
16 potential allocations, plus one overlapping generation during reconnect.
This is not a guaranteed browser maximum: additional network interfaces,
concurrent clients or broader native screen-share fanout can need more.

TURN candidates can allocate during gathering even when direct media later wins;
selected relay usage is not an allocation-capacity estimate. Credentials are
unique per issuance and cached per deployment within a page, so all peer
connections using that cached credential share its quota. Neither quota implies
an event attendance capacity; qualify concurrent allocations, bandwidth and
relay errors under realistic networks before deployment.
[Coturn quotas](https://github.com/coturn/coturn/wiki/turnserver),
[TURN allocation identity](https://www.rfc-editor.org/rfc/rfc8656.html#section-6).

## Current verification

Recorded on 2026-10-20:

- **148 frontend tests pass** across WebRTC, SDP, TURN caching, native facade,
  lobby signaling/network and lobby lifecycle tests.
- **36 server tests pass** across TURN issuance, crowd selection/voice,
  shared-world voice, admission and transport faults. The multiplayer TypeScript
  check passes. Scoped client checking passes; facade checking finds no new
  diagnostics compared with its existing dependency graph.
- A real Chromium 151 local integration check runs nine WebRTC clients with
  eight peers each: **72 connected peer connections**, advancing bytes/packets
  for every individual inbound audio source, checked 24 kbit/s sender limits and
  40 ms negotiated packetization. Shared audio survives mic gating; leaving
  releases capture; simultaneous rejoin restores media. No browser errors.

The browser check uses one browser process, generated audio, an in-memory
signaling bus and local ICE without TURN. It does not test actual room signaling,
multiple devices, loudspeaker echo, mobile limits, network degradation, or a
large audience. Server signaling is covered separately by the server tests.
The core regression suite also exercises collision handling beyond the initial
yield. None of this qualifies a particular event size.

The repeatable browser check is
[`voice-webrtc-smoke.cjs`](../frontend/scripts/voice-webrtc-smoke.cjs), with its
[fixture](../frontend/scripts/voice-webrtc-smoke.browser.js). It needs `esbuild`
and Playwright with Chromium available to Node; no physical microphone is used.
From the repository root:

```sh
node frontend/scripts/voice-webrtc-smoke.cjs
```

If those tools live outside the repository, set `NODE_PATH` to that installation's
`node_modules`. Set `VOICE_SMOKE_REPORT` to a writable JSON path to retain detailed
results. The check starts a temporary localhost server and closes it and the
browser on completion.

## Planned SFU service

mediasoup forwards individual RTP sources without decoding or mixing them. A
worker runs on one CPU core; a router belongs to a worker. Its documented
multi-router piping is useful for distributing consumers, but cross-host
coordination remains application work. The documentation's example capacities
are not Oncyber benchmarks.
[mediasoup scalability](https://mediasoup.org/documentation/v3/scalability/)

The proposed service has these responsibilities:

1. An admission API validates the existing authenticated room session and issues
   short-lived media grants scoped to room, session, role and permitted sources.
2. A media coordinator assigns ingress and receive routers, creates bounded
   transports/producers/consumers, and owns reconnect generations and cleanup.
3. A subscription controller selects authorized stage and nearby sources with
   hysteresis. It sends small subscription deltas and source metadata.
4. Regional media workers forward the selected sources. TURN remains available
   for clients whose networks need it; self-hosting an SFU does not remove that
   operational requirement.

Clients request subscriptions; the server decides them. Display names, profile
attributes, party labels, reported speaking state and client-supplied producer
IDs are metadata, not authority. Bind producer ownership to the admitted
session, enforce room isolation and publisher permissions server-side, and
revoke existing media when permission changes. Proximity must use the room's
validated state and explicit policy; a browser-supplied position alone cannot
grant access to restricted audio.

Do not send every listener the full room roster or every producer event.
Send aggregate occupancy, a bounded stage list, the listener's admitted source
set and nearby presentation metadata. Moderation tools can use a separate
authorized, paginated view. Media subscription cost must stay bounded as world
attendance grows.

## Stage mix versus individual spatial sources

Individual SFU tracks preserve per-speaker positioning: each browser can apply
its listener orientation, distance attenuation and per-source mute. This costs
one consumer, decoder and spatial-audio path per received source. An SFU upload
is one source sent to the server; downstream fanout is still real server work.

For a panel or concert-style speech event, the proposed optional mixer takes
only authorized stage sources and produces a shared program. Encode once per
required output profile, publish that output into the SFU, and fan it out to
audience listeners. Do not create a separate mixer session/encoder for every
audience member. A small mixer prototype could use
[Janus AudioBridge](https://janus.conf.meetecho.com/docs/audiobridge), which mixes
Opus and can forward its mixed output through RTP. That is an integration
candidate; its forwarding interface and media protection still need a tested
adapter.

A shared mono program can be positioned at the stage as one emitter. A shared
stereo program can carry a fixed stage panorama. Neither preserves independent
speaker positions relative to every moving listener. Exact listener-relative 3D
audio requires individual sources or separately computed listener mixes, whose
cost is outside the initial shared-mix design.

Prevent self-audio and duplicate playback explicitly:

- Audience listeners receive the shared mix once, with no duplicate individual
  stage tracks.
- Stage publishers receive the other speakers' individual tracks, excluding
  their own producer. This is the proposed first implementation.
- If speaker monitoring later uses mixing, supply a mix-minus output that
  excludes that speaker; the common audience mix contains their voice and is
  unsuitable for their monitor.
- On promotion, switch the monitor subscription before publishing. Never feed
  the mixed return back into the mixer as a source.
- When stage and proximity audio overlap, deduplicate by source identity.
  Ducking alone does not eliminate the delayed duplicate.

Decoding/mixing adds CPU, latency and another failure point. A failed stage
mixer must not trigger an unbounded fallback to all individual sources.

## Multiple routers and regions

Assign listeners to receive routers with measured consumer and packet-rate
budgets. Forward each required stage source or mix to a destination router once,
then fan out locally. Reuse those pipes and retire them when no consumer needs
them. Nearby voice sources cross regions only when an authorized subscription
requires them; do not replicate every publisher everywhere.

Same-host router piping is a starting point. Cross-host/region routing still
needs authenticated coordination, protected media links, source ownership,
deduplication, loop prevention, failover and subscription cleanup. Regions also
add latency and transfer charges. A multi-region audio path does not itself
create shared world state or globally consistent room permissions.

Measure worker CPU, packets per second, consumers and egress independently.
Shard a large event's receive side across workers/hosts before one router
saturates. Use admission headroom and drain procedures; do not equate a machine's
core count or a vendor example with certified event capacity.

## Speech quality and packetization

The current P2P implementation requests **24 kbit/s mono microphone Opus and
40 ms packetization**, with DTX and in-band FEC. Sender limits are reapplied after
negotiation so a microphone added while answering receives the cap too. The
local browser check verified sender caps and negotiated packetization. Shared
media keeps its existing settings. This is not evidence of audible speech/echo
quality, on-wire bandwidth or large-event capacity.

Proposed test profiles are mono Opus at **16–20 kbit/s for normal speech** and
**8–12 kbit/s for an explicitly lower-quality economy mode**. RFC 7587 associates
those ranges with wideband and narrowband speech respectively. They are speech
targets, not music/concert-quality guarantees. A codec bitrate does not include
transport overhead or guarantee that a browser applies every requested setting.
[RFC 7587, section 3.1.1](https://www.rfc-editor.org/rfc/rfc7587.html#section-3.1.1)

For the future SFU, compare an initial 20 ms interactive profile against 40 ms
with latency and loss tests. Longer packets reduce packet overhead, but add
packetization delay and lose more audio when a packet is lost. FEC can recover
some previous-packet content using the next packet; it consumes bandwidth and
depends on receiver buffering. DTX lowers silence traffic but needs speech-onset
quality tests. None replaces congestion control.
[RFC 7587, sections 3.1.3, 3.3 and 5](https://www.rfc-editor.org/rfc/rfc7587.html#section-5)

These are proposed profiles, not a statement that current production SDP or
sender settings already use them. Verify actual codec parameters, packet timing
and encoded rate from browser/server measurements before updating defaults.

## Bandwidth and cost arithmetic

Use measured on-wire rates for provisioning. For an illustrative steady stream:

```text
R_stream = R_payload + 8 × H_packet × packets_per_second
C = sum of individual listener subscriptions
SFU audience egress ≈ C × R_stream
GB per hour = Mbps × 0.45  (decimal GB, continuous traffic)
```

Assume a 20 kbit/s payload and a **hypothetical 60 bytes** of combined packet
overhead. At 20 ms, 50 packets/s yields 44 kbit/s; at 40 ms, 25 packets/s yields
32 kbit/s. This allowance is an arithmetic example, not a measured header size.
Actual accounting includes IP version, UDP/RTP, RTP extensions, SRTP tags,
RTCP, ICE/STUN keepalives, relay/tunnel framing, retransmissions and link overhead
as applicable. Provider billing may count different network layers.

| Arithmetic scenario, 20 ms | Audience subscriptions | Egress | Decimal GB/hour | At assumed $0.05/GB |
| --- | ---: | ---: | ---: | ---: |
| 1,000 listeners, one stage mix | 1,000 | 44 Mbit/s | 19.8 | $0.99/hour |
| 1,000 listeners, four individual sources | 4,000 | 176 Mbit/s | 79.2 | $3.96/hour |
| 10,000 listeners, one stage mix | 10,000 | 440 Mbit/s | 198 | $9.90/hour |

Every row is an assumption-based calculation, **not a benchmark, capacity
promise, provider quote or total operating cost**. The assumed price is only a
worked example. Add ingress/relay billing where applicable, inter-region pipes,
speaker monitoring, mixer output, compute, spare capacity, observability and
operations. DTX may reduce average use, but provision for simultaneous speech
and connection churn. Check live provider rates before any spending decision.

P2P similarly multiplies a publisher's stream by its connected listeners, with
additional TURN bandwidth when relayed. SFU ownership changes where fanout is
paid for; it does not eliminate it.

## Qualification and rollout

Require the following evidence before advertising larger-event support:

1. **Browser echo gate.** Test current supported Chrome, Safari and Firefox on
   desktop/mobile, using headphones and built-in speakerphones. Exercise
   far-end-only speech, near-end-only speech and double talk, comparing the
   actual spatial Web Audio path with ordinary playback. Check duplicate audio
   sinks, local monitoring, role switches and mixed-program exclusion. Test
   supported echo-cancellation constraints, but do not treat a requested
   constraint or the historical bug's status as proof of audible behavior.
2. **P2P reliability.** Exercise eight peers with real media, slow/mobile devices,
   proximity churn, permission denial, mic/device replacement, delayed permission
   completion, ICE failures, TURN-only paths, reconnection and repeated leave.
   Confirm bounded allocations, no leaked capture and no unintended self-audio.
3. **SFU load.** Sweep listener count, active publishers and received tracks
   independently. Include 8/16/32-track browser trials, shared-mix audiences,
   join/reconnect storms and long soaks with real RTP traffic. Mock signaling and
   world movement load alone are insufficient. Include real browser decoders;
   a packet-forwarding generator does not measure their CPU or audio quality.
4. **Network degradation.** Test latency, jitter, random and burst loss,
   constrained uplink/downlink, TURN UDP/TCP/TLS paths and regional handoff.
   Compare 20/40 ms, normal/economy, FEC and DTX without assuming a browser honors
   the intended settings.
5. **Recorded results.** Report browser/device versions, codec settings,
   publishers/listeners/consumers, worker layout, peak and sustained rates,
   CPU/memory, decode/render cost, loss/concealment, RTT/jitter, reconnect success
   and measured mouth-to-ear latency. Publish p50/p95/p99 where meaningful,
   listening results and failure thresholds; choose launch limits with headroom.

Land P2P hardening first. Build the SFU behind a server-selected room policy,
then run a private bounded pilot before an audience event. Add shared mixing
only after individual-source admission and lifecycle behavior are sound.
Validate failover and permission revocation before regional expansion. Rollback
must restore an explicitly bounded mode or stop event audio clearly; it must
never convert a large audience into an all-to-all P2P mesh.
