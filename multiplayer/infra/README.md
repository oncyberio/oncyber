# oncyber realtime infra (GCP)

One always-on VM runs **Colyseus** (multiplayer state + voice/chat signaling),
**coturn** (TURN relay for the ~10–15% of WebRTC pairs that can't connect over
STUN), and **Caddy** (TLS termination → `wss://`). Voice/screenshare media stays
peer-to-peer; only signaling and the relay-fallback touch this box.

Cost: the e2-micro is GCP free tier (compute only — egress is **not** free,
budget ~$5±/mo steady-state plus per-event egress). Events run on a separate
ephemeral VM (see "Events", stage 4 — not built yet).

## Why not Cloud Run / Cloud Functions

Colyseus is **stateful** (rooms live in process memory, `LocalPresence`,
in-process matchmaking mutex) → it must run as a single long-lived instance.
Cloud Run would force `max-instances=1` (killing its scaling value) and hard-caps
WebSocket connections at 60 minutes (every player force-disconnected hourly, and
the client has no auto-reconnect). Cloud Functions can't host WebSockets at all.
A single pet VM is the right shape.

## 1. Provision (one-time) — scripted

Fill in `infra/.env` (copy `infra/env.deploy.example` — deploy CONFIG only, no
secrets), authenticate gcloud (`gcloud auth login`), then:

```bash
infra/provision.sh
```

This creates a static IP (prints it for your DNS record), the Artifact Registry
repo, firewall rules (tcp 80/443/3478, udp 3478 + 49152-65535), a free-tier
**e2-micro on Debian 12** with `pd-standard` (NOT pd-balanced — that's not free),
grants the VM's service account `artifactregistry.reader`, and installs Docker +
a 1GB swapfile + log rotation. It does NOT use Container-Optimized OS (no apt /
compose plugin) or the Cloud Ops agent (won't fit in 1GB).

Then:

1. **DNS**: create an A record `arena.oncyber.io → <the IP printed above>`, TTL 300,
   **before** first bring-up — Caddy's ACME HTTP-01 needs DNS + port 80 or it
   retry-loops.
2. **Config + secrets on the VM**: copy the three compose files flat into
   `/opt/mmo` and create `.env` there:
   ```bash
   gcloud compute scp --zone <zone> \
     infra/vm/docker-compose.yml infra/vm/Caddyfile infra/coturn/turnserver.conf \
     mmo:/opt/mmo/
   # then, on the VM, create /opt/mmo/.env from infra/vm/.env.example
   ```
   Fill `.env`: `COLYSEUS_IMAGE` (the AR path), `MAX_PLAYERS=200`,
   `MONITOR_PASSWORD` (strong — the monitor is on a public domain now),
   `TURN_SECRET` (`openssl rand -hex 32`), `TURN_HOST` (the domain),
   `TURN_EXTERNAL_IP` = `<public>/<private>` (private from `ip -4 addr`). The same
   `.env` is both compose's `${...}` interpolation source and the colyseus
   container's runtime env. **`TURN_SECRET` is the one secret that must match**
   between coturn and what the server signs credentials with (it's the same file,
   so they can't drift).
3. Edit the `Caddyfile`'s hostname to your domain.

## 2. Deploy (day-2) — build off-box, pull on-box — scripted

```bash
infra/deploy.sh           # cross-build linux/amd64, push to AR, restart colyseus
infra/deploy.sh config    # also resync Caddyfile/coturn and restart all
```

Never `docker compose build` on the e2-micro (npm ci ×2 + tsc on 0.25 vCPU/1GB
OOMs the live server; a Mac is ARM and must cross-build anyway). The VM pulls
using its own service-account metadata token, so no key material leaves your box.

First full bring-up (after step 1 above, on the VM): `cd /opt/mmo && docker
compose up -d`. Watch `docker compose logs -f caddy` for a successful cert, then
`docker compose logs -f colyseus`.

## 3. Verify

- `curl https://arena.oncyber.io/` → "Hello world from cyber!!"
- `curl https://arena.oncyber.io/turnCredentials` → JSON with `username`/`credential`
  (or 404 if TURN env unset — that's the fail-open-to-STUN state).
- TURN relay: open https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/,
  add `turn:arena.oncyber.io:3478?transport=udp` with creds from `/turnCredentials`,
  Gather candidates → expect a `relay` candidate. (No relay candidate = check
  `TURN_EXTERNAL_IP` and the udp 49152-65535 firewall rule.)
- Monitor: `https://arena.oncyber.io/cyber-h` (basic auth, user `admin`,
  `MONITOR_PASSWORD`). Optionally add a Caddy IP-allowlist on `/cyber-h*`.

## 4. Cutover from fly + decommission

The frontend points at this VM via `NEXT_PUBLIC_ARENA_HOST` (default flips in the
master merge). Until then the fly app keeps serving old bundles. After the merge
deploys: watch the fly app's `/getRooms` traffic drain to zero (open tabs / cached
immutable chunks keep hitting it), then `fly apps destroy wl--oncyber-v1-multiplayer`.
The two personal PartyKit servers (`webrtc-server.a-saq` voice signaling,
`chat-server.yelouafi` chat) can be shut once their traffic is zero too.

CORS: the server is `app.use(cors())` → `*`, so Vercel preview origins work for
`/join` / `/getRooms` / `/turnCredentials`. Don't tighten it without adding an
allowlist that includes the preview domains.

## Events (stage 4, not built)

Large clustered audiences exceed the P2P mesh. The plan: an ephemeral
`e2-standard-2` in the host's region running mediasoup (audio + screenshare SFU),
signaled through the same Colyseus room messages, billed only for the event
(~$0.15 compute + egress). Screenshare egress is the real cost (~$6–12 per 2h
event at ~1Mbps × 100 viewers) — cap screenshare bitrate and use Standard network
tier. Documented here when implemented.
