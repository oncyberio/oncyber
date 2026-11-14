import * as THREE from "three/webgpu";
import { describeArrival, mapArrivalView } from "@oncyber/game-runtime/arrival";
import { createSound, play } from "./sound.js";
import { CARRY_OFFSET, attachVRM, createAvatar, driveAvatar, loadMotion, loadVRM } from "./avatar.js";
import { ambient, createFx, dust, hearts, splash, updateFx } from "./fx.js";
import {
    createGarden,
    dropHeld,
    findTarget,
    grab,
    looks,
    petStroke,
    receiveKindness,
    save,
    saveData,
    shake,
    snapshot,
    throwHeld,
    updateGarden,
    useHeld,
    whistle,
} from "./garden.js";
import {
    cheer,
    createMinigames,
    joinOffer,
    leaveMatch,
    matchCamera,
    matchEvent,
    matchHud,
    matchPacket,
    matchSnapshot,
    openMatch,
    updateMinigames,
} from "./minigames.js";
import { RING } from "./arenas.js";
import { resolveCamera, spring } from "./camera.js";
import { createPeers, peerBloomlings, receivePacket, receivePeers, updatePeers } from "./peers.js";
import { CRITTERS, FRUITS, GROW_AT } from "./sim.js";
import { CAVE, FALLS, RACE_GATE, SPAWN, WATER, heightAt, ISLAND_RADIUS } from "./terrain.js";
import { createWorld, isNight, updateWorld } from "./world.js";
import { createPost } from "./post.js";
import { bytesToText } from "./glb.js";
import { detailsModel, matchModel, menuModel, rosterModel } from "./uimodel.js";

// Bloom Garden as a portable-v1 game: simulation and three.js WebGPU only.
// No DOM, no browser services. Input arrives as named actions (ctx.input),
// the UI is drawn by a separate page from what we publish (ctx.ui), and the
// host provides storage, audio, avatars and the multiplayer relay
// (ctx.services.call). The same module runs in the browser host and in
// native WebGPU hosts.

/** Inspection hooks for scripted playtests (set while a game is alive). */
export const debugHooks = {};

const dayLength = 16 * 60;

export default function createGame(ctx) {
    const services = ctx.services;
    const call = (capability, operation, value = null) =>
        services.call(capability, operation, value, ctx.signal);

    // ----------------------------------------------------------- renderer
    const g = ctx.graphics;
    const renderer = new THREE.WebGPURenderer({
        canvas: g.canvas,
        // Only pass what the host provides: an explicit null would replace
        // the renderer's own context lookup.
        ...(g.context ? { context: g.context } : {}),
        ...(g.device ? { device: g.device } : {}),
        antialias: true,
        // Hosts without WebGPU (an older browser) hand us no device: the
        // web host's fallback, never a portable target.
        forceWebGL: !g.device,
    });
    let disposed = false;
    const baseLost = renderer.onDeviceLost.bind(renderer);
    renderer.onDeviceLost = (info) => {
        if (disposed && info.reason === "destroyed") return;
        state.error = "The graphics device was lost. Reload to continue.";
        baseLost(info);
    };
    renderer.setPixelRatio(g.pixelRatio);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xbfe8ff, 120, 520);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    let post = null;
    let sizeKey = "";
    // A lobby trip: the lobby's last view, matched on our first frame
    // (docs/games/good-game.md, "Match the handoff").
    const trip = { view: null, fov: 0, sink: 0, rising: false, stage: 0 };
    const TRIP_SINK = 0.4;
    const TRIP_RISE_S = 0.7;
    const AVATAR_HEIGHT = 1.62;
    function resize() {
        const w = Math.max(1, Math.floor(g.width));
        const h = Math.max(1, Math.floor(g.height));
        const key = `${w}x${h}`;
        if (key === sizeKey) return;
        sizeKey = key;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.fov = trip.fov || (camera.aspect < 0.8 ? 62 : 50);
        camera.updateProjectionMatrix();
    }

    // ----------------------------------------------------------- state
    const sound = createSound();
    const player = {
        x: SPAWN.x,
        y: heightAt(SPAWN.x, SPAWN.z),
        z: SPAWN.z,
        vx: 0,
        vy: 0,
        vz: 0,
        heading: SPAWN.heading,
        speed: 0,
        grounded: true,
        act: "",
        actT: 0,
        locked: false,
    };
    const cam = { shot: {}, aim: {}, yaw: SPAWN.heading + Math.PI, pitch: 0.32, dist: 7.5, target: new THREE.Vector3(), shake: 0, eff: null };
    const state = {
        booted: false,
        boot: { p: 0, text: "Planting the island…" },
        toasts: [],
        toastId: 0,
        detail: null,
        menu: null,
        help: false,
        offers: [],
        countdown: null,
        error: "",
        renderer: "",
    };
    const net = { self: "", online: false, inflight: false, timer: 0, lookTimer: 0, lastPeers: 0, pose: null };
    let world, fx, garden, peers, mg, avatar;
    let config = { time: 0.36, grow: GROW_AT, fast: 1 };
    let elapsed = 0;

    const toast = (text, kind = "") => {
        state.toasts.push({ id: ++state.toastId, text: String(text).slice(0, 160), kind });
        if (state.toasts.length > 4) state.toasts.shift();
    };
    // Minigames report to the UI through these.
    const uiBridge = {
        matchChanged() {},
        offer(id, from, kind) {
            if (state.offers.some((o) => o.id === id)) return;
            state.offers.push({ id, from, kind });
            if (state.offers.length > 3) state.offers.shift();
        },
        offerGone(id) {
            state.offers = state.offers.filter((o) => o.id !== id);
        },
        countdown(text) {
            state.countdown = { text, at: elapsed };
        },
    };

    function buildScene() {
        world = createWorld(scene);
        world.timeOfDay = config.time;
        fx = createFx(scene, renderer);
        avatar = createAvatar(0x2f7bff);
        scene.add(avatar.root);
        const gctx = {
            scene,
            fx,
            audio: sound,
            world,
            player,
            renderer,
            toast,
            growAt: config.grow,
            fast: config.fast,
            saved: config.saved,
            storage: (data) => void call("storage", "save", { data }).catch(() => {}),
            selfId: () => net.self,
            online: () => net.online,
            send: (ev) => garden.events.push(ev),
            enterArena,
            leaveArena,
            shake: (s) => (cam.shake = Math.max(cam.shake, s)),
            ui: uiBridge,
        };
        garden = createGarden(gctx);
        peers = createPeers({ ...gctx, renderer, loadAvatar: loadPeerAvatar });
        mg = createMinigames(gctx);
        post = createPost(renderer, scene, camera);
    }

    // ----------------------------------------------------------- avatars

    async function loadAvatarFor(av, ref) {
        // The host hands over bytes only for avatars it vouches for.
        if (!ref || typeof services.avatar !== "function" || typeof g.decodeImage !== "function") return false;
        const bytes = await services.avatar(ref, ctx.signal);
        const vrm = await loadVRM(bytes, (b, mime) => g.decodeImage(b, mime));
        // Build its pipelines off to the side: rendering must never meet a
        // pipeline that an async compile is still creating.
        if (!disposed) await renderer.compileAsync(vrm.scene, camera, scene);
        if (disposed) {
            vrm.dispose();
            return false;
        }
        await attachVRM(av, vrm);
        return true;
    }

    // Peers load one or two at a time.
    async function loadPeerAvatar(av, ref) {
        return loadAvatarFor(av, ref);
    }

    // ----------------------------------------------------------- network
    function heldCode() {
        const h = garden.held;
        if (!h || h.b) return null;
        return `${h.item.type}:${h.item.kind}`;
    }
    function poseCode() {
        let a = 0;
        if (!player.grounded) a = 3;
        else if (player.act === "pet" || player.act === "wave" || player.act === "cheer") a = 4;
        else if (player.speed > 2.8) a = 2;
        else if (player.speed > 0.3) a = 1;
        if (garden.held) a += 8;
        return a;
    }
    function network(dt) {
        net.timer -= dt;
        net.lookTimer -= dt;
        if (net.inflight || net.timer > 0) return;
        net.timer = 0.1;
        const value = {
            pose: { x: player.x, y: player.y, z: player.z, h: player.heading, a: poseCode() },
        };
        // The room relays at most ~5 messages/s per sender; send ~3/s.
        net.packetTimer = (net.packetTimer || 0) - 0.1;
        if (net.online && net.packetTimer <= 0) {
            net.packetTimer = 0.3;
            const packet = { g: snapshot(garden), h: heldCode(), ev: garden.events.splice(0, 12) };
            if (net.lookTimer < 0) {
                net.lookTimer = 5;
                packet.L = looks(garden);
            }
            const m = matchPacket(mg);
            if (m) packet.m = m;
            // As a string: the bridge caps JSON depth at 8, garden packets nest deeper.
            value.packet = JSON.stringify(packet);
        } else if (!net.online) garden.events.length = 0;
        net.inflight = true;
        call("network", "exchange", value)
            .then((r) => receive(r))
            .catch(() => {
                net.online = false;
            })
            .finally(() => {
                net.inflight = false;
            });
    }
    function receive(r) {
        if (!r || typeof r !== "object" || disposed) return;
        net.self = typeof r.self === "string" ? r.self : "";
        net.online = !!r.online && !!net.self;
        if (Array.isArray(r.peers)) {
            receivePeers(peers, r.peers);
            if (peers.players.size > net.lastPeers) net.lookTimer = 0;
            net.lastPeers = peers.players.size;
        }
        for (const item of Array.isArray(r.inbox) ? r.inbox : []) {
            if (!item || typeof item.from !== "string" || typeof item.json !== "string") continue;
            let packet = null;
            try {
                packet = JSON.parse(item.json);
            } catch {
                continue;
            }
            if (!packet || typeof packet !== "object") continue;
            for (const ev of Array.isArray(packet.ev) ? packet.ev : [])
                if (typeof ev?.k === "string" && ev.k.startsWith("m-")) matchEvent(mg, ev, item.from);
            if (packet.m) matchSnapshot(mg, packet.m, item.from);
            receivePacket(peers, item.from, packet, (ev, from) => {
                if (ev.k === "pet-other" || ev.k === "gift-other") receiveKindness(garden, ev, from);
            });
        }
    }

    // ----------------------------------------------------------- arenas
    function enterArena(kind) {
        cam.shot = {};
        cam.eff = null;
        state.wipe = elapsed;
        if (garden.held) dropHeld(garden, false);
        if (kind === "race") {
            const c = mg.course.center;
            const a = Math.random() * Math.PI * 2;
            teleport(c.x + Math.cos(a) * 3, c.z + Math.sin(a) * 3, mg.course.standY);
        } else {
            const a = Math.PI / 2 + (Math.random() - 0.5) * 1.2;
            const x = RING.x + Math.cos(a) * 7;
            const z = RING.z + Math.sin(a) * 7;
            teleport(x, z, heightAt(x, z));
            player.heading = Math.atan2(RING.x - x, RING.z - z);
        }
        player.locked = true;
    }
    function leaveArena(kind) {
        cam.shot = {};
        cam.eff = null;
        state.wipe = elapsed;
        const back = kind === "race" ? { x: RACE_GATE.x - 3, z: RACE_GATE.z } : { x: CAVE.x, z: CAVE.z + 3.5 };
        teleport(back.x, back.z, heightAt(back.x, back.z));
        // Face the gate or cave, so the camera starts on the open side.
        player.heading = kind === "race" ? Math.PI / 2 : Math.PI;
        cam.yaw = player.heading + Math.PI;
        player.locked = false;
    }
    function teleport(x, z, y) {
        player.x = x;
        player.z = z;
        player.y = y;
        player.vx = player.vy = player.vz = 0;
        dust(fx, { x, y, z }, 10);
    }

    // ----------------------------------------------------------- input
    const carryWorld = new THREE.Vector3();
    let target = null;
    let petCool = 0;
    const pressed = (a) => !!ctx.pressed[a];
    const held = (a) => (ctx.input[a] || 0) > 0;
    const pick = (a, max) => Math.round((ctx.input[a] || 0) * 16) - 1; // value i/16 -> index

    function doCheer() {
        const q = cheer(mg);
        if (!q) return;
        player.act = "cheer";
        player.actT = 0.8;
        if (q === "perfect") toast("PERFECT! Super bump ready!", "big");
        else if (q === "miss") toast("Missed the beat!");
    }

    function nearGate() {
        if (Math.hypot(player.x - RACE_GATE.x, player.z - RACE_GATE.z) < 3.6) return "race";
        if (Math.hypot(player.x - CAVE.x, player.z - (CAVE.z + 0.8)) < 3.4) return "bout";
        return null;
    }

    function interact() {
        if (garden.held) {
            useHeld(garden, target, player);
            return;
        }
        const gate = nearGate();
        if (gate && (!target || target.d > 1.2)) {
            const eligible = garden.bloomlings.filter((b) => b.data.stage === "child" || b.data.stage === "adult");
            state.menu = { kind: gate, who: eligible.length ? 0 : -1, tier: 0 };
            play(sound, "ui");
            return;
        }
        if (!target) return;
        if (target.kind === "tree") {
            const n = shake(garden, target.ref);
            if (!n) toast("No ripe fruit yet. It grows back in a little while.");
        } else if (target.kind === "peer-bloomling") {
            toast(`${target.ref.name} belongs to ${peers.players.get(target.ref.owner)?.name || "someone"}. Hold F to pet it!`);
        } else grab(garden, target);
    }

    const raycaster = new THREE.Raycaster();
    function tapPick(nx, ny) {
        raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
        const roots = garden.bloomlings.map((b) => b.view.root);
        const hit = raycaster.intersectObjects(roots, true).find((h) => h.object.name !== "outline");
        if (!hit) return;
        let o = hit.object;
        while (o && !roots.includes(o)) o = o.parent;
        const b = garden.bloomlings.find((x) => x.view.root === o);
        if (b) state.detail = state.detail === b.data.id ? null : b.data.id;
    }

    function handleActions() {
        if (pressed("audioUnlock")) play(sound, "ui");
        if (pressed("mute")) {
            sound.muted = !sound.muted;
            void call("audio", "mute", { muted: sound.muted }).catch(() => {});
        }
        if (pressed("help")) state.help = !state.help;
        if (pressed("back")) {
            if (state.menu) state.menu = null;
            else if (state.help) state.help = false;
            else state.detail = null;
        }
        if (pressed("panel")) state.detail = state.detail ? null : garden.bloomlings[0]?.data.id || null;
        if (pressed("details")) {
            const b = garden.bloomlings[pick("details")];
            state.detail = b && state.detail !== b.data.id ? b.data.id : null;
        }
        if (pressed("callOne")) whistle(garden);
        if (pressed("tap")) tapPick(ctx.input.tapX || 0, ctx.input.tapY || 0);
        if (pressed("exit")) void call("travel", "lobby").catch(() => {});

        // Mini game menu.
        if (state.menu) {
            const eligible = garden.bloomlings.filter((b) => b.data.stage === "child" || b.data.stage === "adult");
            if (pressed("menuWho")) state.menu.who = Math.min(eligible.length - 1, Math.max(0, pick("menuWho")));
            if (pressed("menuTier")) state.menu.tier = Math.min(2, Math.max(0, pick("menuTier")));
            if (pressed("menuClose")) state.menu = null;
            else if (pressed("menuGo") && eligible[state.menu.who]) {
                const b = eligible[state.menu.who];
                const { kind, tier } = state.menu;
                state.menu = null;
                if (garden.held?.b === b) dropHeld(garden, false);
                openMatch(mg, kind, tier, b);
            }
            return;
        }
        // Offers from other players.
        if (pressed("join") || pressed("watch")) {
            const watching = pressed("watch");
            const v = pick(watching ? "watch" : "join");
            const offer = state.offers[watching ? v : Math.floor(v / 4)];
            const eligible = garden.bloomlings.filter((b) => (b.data.stage === "child" || b.data.stage === "adult") && !b.away);
            const b = watching ? null : eligible[v % 4];
            if (offer) {
                if (b && garden.held?.b === b) dropHeld(garden, false);
                joinOffer(mg, offer.id, b || null);
                state.offers = [];
            }
        }
        if (mg.match) {
            if (pressed("matchLeave")) leaveMatch(mg);
            if (pressed("matchNow") && mg.match?.host && mg.match.phase === "lobby") mg.match.lobbyT = 0;
            if (pressed("cheer") || pressed("jump") || pressed("interact")) doCheer();
            return;
        }
        if (player.locked) return;
        if (pressed("jump") && player.grounded) {
            player.vy = 6.8;
            player.grounded = false;
            play(sound, "bounce", { pitch: 1.6 });
        }
        if (pressed("interact")) interact();
        if (pressed("throw")) throwHeld(garden);
        if (pressed("whistle")) {
            whistle(garden);
            player.act = "wave";
            player.actT = 1;
        }
        if (pressed("wave")) {
            player.act = "wave";
            player.actT = 1.5;
        }
    }

    function readMove() {
        let x = (ctx.input.right || 0) - (ctx.input.left || 0) + (ctx.input.moveX || 0);
        let y = (ctx.input.forward || 0) - (ctx.input.backward || 0) + (ctx.input.moveY || 0);
        const len = Math.hypot(x, y);
        if (len > 1) {
            x /= len;
            y /= len;
        }
        return { x, y, walk: held("walk"), petting: held("pet") };
    }

    function updatePlayer(dt) {
        player.actT -= dt;
        if (player.actT < 0) player.act = "";
        const mv = readMove();
        // Crouched from the trip: stay put until standing.
        if (trip.rising && trip.sink > 0) trip.sink = Math.max(0, trip.sink - (TRIP_SINK / TRIP_RISE_S) * dt);
        if (player.locked || trip.sink > 0) {
            player.speed = 0;
            player.vx = player.vz = 0;
            if (mg.match) {
                const mc = matchCamera(mg);
                if (mc) player.heading = Math.atan2(mc.look.x - player.x, mc.look.z - player.z);
            }
            return;
        }
        const fwdX = -Math.sin(cam.yaw);
        const fwdZ = -Math.cos(cam.yaw);
        let wx = fwdX * mv.y - fwdZ * mv.x;
        let wz = fwdZ * mv.y + fwdX * mv.x;
        const len = Math.hypot(wx, wz);
        const top = mv.walk ? 2.0 : 5.2;
        const petting = mv.petting && target && (target.kind === "bloomling" || target.kind === "peer-bloomling") && !garden.held;
        if (len > 0.05 && !petting) {
            wx /= Math.max(1, len);
            wz /= Math.max(1, len);
            const want = Math.atan2(wx, wz);
            let dh = want - player.heading;
            dh = Math.atan2(Math.sin(dh), Math.cos(dh));
            player.heading += dh * Math.min(1, dt * 12);
        }
        const k = Math.min(1, dt * (len > 0.05 ? 10 : 12));
        player.vx += ((petting ? 0 : wx * top) - player.vx) * k;
        player.vz += ((petting ? 0 : wz * top) - player.vz) * k;
        let nx = player.x + player.vx * dt;
        let nz = player.z + player.vz * dt;
        const here = heightAt(player.x, player.z);
        const there = heightAt(nx, nz);
        // No climbing cliffs, no wading into deep water.
        if (there - here > 0.7 * Math.max(1, Math.hypot(nx - player.x, nz - player.z) * 4) || there < -0.75) {
            if (heightAt(nx, player.z) - here < 0.5 && heightAt(nx, player.z) > -0.75) nz = player.z;
            else if (heightAt(player.x, nz) - here < 0.5 && heightAt(player.x, nz) > -0.75) nx = player.x;
            else {
                nx = player.x;
                nz = player.z;
            }
        }
        for (const c of world.colliders) {
            const dx = nx - c.x;
            const dz = nz - c.z;
            const d = Math.hypot(dx, dz);
            const r = c.r + 0.35;
            if (d < r && d > 1e-4) {
                nx = c.x + (dx / d) * r;
                nz = c.z + (dz / d) * r;
            }
        }
        const r = Math.hypot(nx, nz);
        if (r > ISLAND_RADIUS + 3) {
            nx *= (ISLAND_RADIUS + 3) / r;
            nz *= (ISLAND_RADIUS + 3) / r;
        }
        player.speed = Math.hypot(nx - player.x, nz - player.z) / Math.max(dt, 1e-4);
        player.x = nx;
        player.z = nz;
        const ground = Math.max(heightAt(nx, nz), WATER - 0.45);
        if (!player.grounded || player.vy > 0) {
            player.vy -= 20 * dt;
            player.y += player.vy * dt;
            if (player.y <= ground) {
                player.y = ground;
                player.vy = 0;
                if (!player.grounded) dust(fx, player, 5);
                player.grounded = true;
            }
        } else if (player.y - ground > 0.4) player.grounded = false;
        else player.y = ground;
        if (player.y < WATER - 0.2 && Math.random() < dt * player.speed) splash(fx, { x: player.x, y: WATER, z: player.z }, 3);

        petCool -= dt;
        if (petting) {
            player.heading = Math.atan2(target.ref.x - player.x, target.ref.z - player.z);
            player.act = "pet";
            player.actT = 0.2;
            if (target.kind === "bloomling") petStroke(garden, target.ref);
            else if (petCool < 0) {
                petCool = 0.8;
                garden.events.push({ k: "pet-other", to: target.ref.owner, c: target.ref.id });
                hearts(fx, new THREE.Vector3(target.ref.x, target.ref.y + 0.7, target.ref.z), 2);
                play(sound, "heart");
            }
        }
    }

    function prompt() {
        if (mg.match) return mg.match.phase === "live" ? [["C", "Cheer"]] : [];
        const list = [];
        const t = target;
        const name = (x) => x?.data?.name || x?.name || "it";
        if (garden.held) {
            const it = garden.held.item;
            if (it && t?.kind === "bloomling" && t.ref.data.stage !== "egg")
                list.push(["E", it.type === "fruit" ? `Feed ${name(t.ref)}` : `Give ${name(t.ref)} the ${CRITTERS[it.kind].label}`]);
            else if (it && t?.kind === "peer-bloomling") list.push(["E", `Share with ${name(t.ref)}`]);
            else list.push(["E", "Put down"]);
            list.push(["Q", "Throw"]);
        } else {
            const gate = nearGate();
            if (gate && (!t || t.d > 1.2)) list.push(["E", gate === "race" ? "Bloom Dash" : "Bump Dojo"]);
            else if (t) {
                if (t.kind === "bloomling") {
                    list.push(["E", t.ref.data.stage === "egg" ? "Pick up the egg" : `Pick up ${name(t.ref)}`]);
                    list.push(["F", t.ref.data.stage === "egg" ? "Warm it" : "Pet"]);
                } else if (t.kind === "peer-bloomling") list.push(["F", `Pet ${name(t.ref)}`]);
                else if (t.kind === "fruit") list.push(["E", `Pick up ${FRUITS[t.ref.kind].label}`]);
                else if (t.kind === "critter") list.push(["E", `Catch the ${CRITTERS[t.ref.kind].label}`]);
                else if (t.kind === "tree") list.push(["E", "Shake the tree"]);
            }
        }
        return list;
    }

    // ----------------------------------------------------------- arrival
    // The page answers when a lobby trip hands over its last view, and
    // again when the visitor is revealed. On a direct visit it never does.
    function followTrip() {
        call("travel", "arrival")
            .then((view) => {
                if (disposed || !view || !view.cameraOffset) return;
                // Face the lobby's camera with the garden behind, as the
                // visitor left; the camera keeps looking into the garden.
                player.heading += Math.PI;
                const mapped = mapArrivalView(view, { cameraYaw: player.heading, avatarHeight: AVATAR_HEIGHT });
                const away = Math.hypot(mapped.cameraOffset.x, mapped.cameraOffset.z);
                const rise = mapped.cameraOffset.y - 1.35; // above the camera's target
                cam.yaw = player.heading;
                cam.pitch = Math.atan2(rise, away);
                cam.dist = Math.hypot(away, rise);
                cam.eff = null;
                trip.view = view;
                trip.fov = mapped.fov;
                trip.sink = TRIP_SINK;
                trip.stage = 2;
                sizeKey = "";
                return call("travel", "entered").then(() => (trip.rising = true));
            })
            .catch(() => {});
    }
    function screenName() {
        if (mg?.match) return mg.match.phase === "results" ? "results" : "match";
        return state.menu ? "menu" : "arrival";
    }

    // ----------------------------------------------------------- camera
    function placeCamera(dt) {
        const ph = debugHooks.photo;
        if (ph) {
            camera.position.set(ph.x, ph.y, ph.z);
            camera.lookAt(ph.tx, ph.ty, ph.tz);
            return;
        }
        const mc = mg?.match && matchCamera(mg);
        if (mc) {
            if (mc.snap || !cam.shot.p) {
                cam.shot = {};
                cam.aim = {};
            }
            spring(cam.shot, mc.pos, dt, mc.k || 4);
            spring(cam.aim, mc.look, dt, (mc.k || 4) * 1.4);
            cam.target.copy(cam.aim.p);
            camera.position.copy(cam.shot.p);
            resolveCamera(cam.target, camera.position, mg.match.kind === "race" ? mg.course.occluders : []);
        } else {
            cam.shot = {};
            const goal = new THREE.Vector3(player.x, player.y + 1.35, player.z);
            if (dt >= 1) cam.target.copy(goal);
            else cam.target.lerp(goal, Math.min(1, dt * 10));
            const cp = Math.cos(cam.pitch);
            const want = new THREE.Vector3(
                cam.target.x + Math.sin(cam.yaw) * cp * cam.dist,
                cam.target.y + Math.sin(cam.pitch) * cam.dist,
                cam.target.z + Math.cos(cam.yaw) * cp * cam.dist
            );
            resolveCamera(cam.target, want, world.cameraBlockers);
            const d = want.distanceTo(cam.target);
            cam.eff = cam.eff ?? d;
            cam.eff += (d - cam.eff) * Math.min(1, dt * (d < cam.eff ? 18 : 3));
            camera.position.copy(want).sub(cam.target).setLength(cam.eff).add(cam.target);
        }
        if (cam.shake > 0) {
            cam.shake = Math.max(0, cam.shake - dt * 1.5);
            camera.position.x += (Math.random() - 0.5) * cam.shake * 0.3;
            camera.position.y += (Math.random() - 0.5) * cam.shake * 0.3;
        }
        camera.lookAt(cam.target);
    }
    function updateCamera(dt) {
        const lookX = ctx.deltas.lookX || 0;
        const lookY = ctx.deltas.lookY || 0;
        const zoom = ctx.deltas.zoom || 0;
        // Deltas arrive in UI pixels / 1000 and wheel notches / 10.
        cam.yaw -= lookX * 6;
        cam.pitch = Math.max(-0.1, Math.min(1.25, cam.pitch + lookY * 4));
        cam.dist = Math.max(3.2, Math.min(16, cam.dist * (1 + zoom)));
        const looking = held("looking");
        if (player.speed > 1 && !looking) {
            let dy = player.heading + Math.PI - cam.yaw;
            dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            cam.yaw += dy * Math.min(1, dt * 0.6);
        }
        placeCamera(dt);
    }

    // ----------------------------------------------------------- UI state
    let publishT = 0;
    let saveT = 0;
    function publish(dt, force = false) {
        publishT -= dt;
        if (publishT > 0 && !force) return;
        publishT = 0.1;
        const tod = (world?.timeOfDay || 0) * 24;
        const hh = Math.floor(tod);
        const mm = Math.floor(((tod - hh) * 60) / 10) * 10;
        const hud = mg?.match ? matchModel(matchHud(mg)) : null;
        const eligibleNames = garden
            ? garden.bloomlings.filter((b) => (b.data.stage === "child" || b.data.stage === "adult") && !b.away).map((b) => b.data.name)
            : [];
        ctx.ui.publish({
            booted: state.booted,
            boot: state.boot,
            error: state.error,
            renderer: state.renderer,
            clock: world ? `${isNight(world) ? "night" : "day"} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` : "",
            roster: garden ? rosterModel(garden) : [],
            details: garden && state.detail ? detailsModel(garden, state.detail, config.grow) : null,
            prompt: garden && state.booted ? prompt() : [],
            toasts: state.toasts,
            menu: garden ? menuModel(garden, state.menu) : null,
            offers: state.offers.map((o) => ({ id: o.id, name: peers.players.get(o.from)?.name || "Someone", kind: o.kind, join: eligibleNames.slice(0, 3) })),
            match: hud,
            countdown: state.countdown,
            help: state.help,
            muted: sound.muted,
            wipe: state.wipe ?? null,
            players: peers ? peers.players.size + 1 : 1,
            online: net.online,
        });
        // Toasts are delivered once (the UI also ignores ids it has seen).
        state.toasts = [];
    }

    function flushSound(dt) {
        const env = {
            fallsDist: Math.round(Math.hypot(player.x - FALLS.x, player.z - FALLS.z)),
            night: world ? isNight(world) : false,
            mode: mg?.match && mg.match.phase !== "lobby" ? mg.match.kind : "garden",
        };
        sound.envT = (sound.envT || 0) - dt;
        if (!sound.queue.length && sound.envT > 0) return;
        sound.envT = 0.25;
        const cues = sound.queue.splice(0, 24);
        void call("audio", "update", { cues, env }).catch(() => {});
    }

    function exposeDebug() {
        Object.assign(debugHooks, {
            get garden() {
                return garden;
            },
            get player() {
                return player;
            },
            get mg() {
                return mg;
            },
            get world() {
                return world;
            },
            get peers() {
                return peers;
            },
            cam,
            photo: null,
            teleport: (x, z) => teleport(x, z, heightAt(x, z)),
            setTime: (t) => (world.timeOfDay = t),
            spawn: async (patch = {}) => {
                const { addBloomling } = await import("./garden.js");
                const { newEgg } = await import("./sim.js");
                const c = Object.assign(newEgg(Math.random, { x: player.x + 1, z: player.z + 1 }), { stage: "child" }, patch);
                return addBloomling(garden, c);
            },
        });
    }

    // ----------------------------------------------------------- lifecycle
    return {
        async prepare() {
            const setBoot = (p, text) => {
                state.boot = { p, text };
                publish(0, true);
            };
            setBoot(0.05, "Planting the island…");
            const conf = await call("storage", "config").catch(() => null);
            if (conf && typeof conf === "object") {
                if (Number.isFinite(conf.time)) config.time = conf.time;
                if (Number.isFinite(conf.grow) && conf.grow > 0) config.grow = conf.grow;
                if (Number.isFinite(conf.fast) && conf.fast > 0) config.fast = conf.fast;
            }
            const stored = await call("storage", "load").catch(() => null);
            config.saved = stored?.data || null;
            await renderer.init();
            state.renderer = renderer.backend.isWebGPUBackend ? "webgpu" : "webgl2";
            resize();
            setBoot(0.2, "Planting the island…");
            buildScene();
            exposeDebug();
            setBoot(0.45, "Filling the pond…");
            placeCamera(1);
            await renderer.compileAsync(scene, camera);
            await renderer.computeAsync(fx.particles.step);
            setBoot(0.7, "Waking the bloomlings…");
            loadMotion(async () => JSON.parse(bytesToText(await services.asset("public/motion.json", ctx.signal))));
            // One real frame before we call ourselves ready.
            updateCamera(0);
            post.render();
            setBoot(1, "Welcome!");
        },
        enter() {
            state.booted = true;
            // The avatar streams in after arrival; the toy body stands in.
            Promise.race([
                loadAvatarFor(avatar, services.identity.avatar),
                new Promise((_, reject) => setTimeout(() => reject(new Error("AVATAR_TIMEOUT")), 30000)),
            ])
                .catch((err) => console.warn("Bloom Garden: avatar unavailable, using the toy body", err?.message || err));
            if (garden.firstVisit) {
                toast("Welcome to Bloom Garden! There's an egg just ahead.", "big");
                toast("Walk up and press E to pick it up. Eggs hatch quicker when held.");
            } else toast(`Welcome back! ${garden.bloomlings.filter((b) => b.data.stage !== "egg").length} bloomlings missed you.`, "big");
            publish(0, true);
            followTrip();
        },
        update(seconds) {
            if (disposed || !garden) return;
            const dt = Math.min(0.05, Math.max(0, seconds));
            elapsed += dt;
            resize();
            world.timeOfDay = (world.timeOfDay + dt / dayLength) % 1;
            handleActions();
            target = mg.match ? null : findTarget(garden, player, { bloomlings: () => peerBloomlings(peers) });
            updatePlayer(dt);
            avatar.root.position.set(player.x, player.y - trip.sink, player.z);
            avatar.root.rotation.y = player.heading;
            driveAvatar(avatar, dt, { speed: player.speed, air: !player.grounded, act: player.act, holding: !!garden.held });
            avatar.root.updateMatrixWorld(true);
            carryWorld.copy(CARRY_OFFSET).applyMatrix4(avatar.root.matrixWorld);
            updateGarden(garden, dt, carryWorld);
            updatePeers(peers, dt);
            updateMinigames(mg, dt);
            network(dt);
            updateCamera(dt);
            // Two frames in the lobby's framing, then the page may reveal us.
            if (trip.stage > 0 && --trip.stage === 0) void call("travel", "staged").catch(() => {});
            const focus = mg.match ? cam.target : player;
            updateWorld(world, dt, focus);
            ambient(fx, dt, { falls: FALLS, night: isNight(world), focus: { x: focus.x, y: focus.y, z: focus.z } });
            updateFx(fx, dt);
            flushSound(dt);
            publish(dt);
            saveT -= dt;
            if (saveT < 0) {
                saveT = 6;
                save(garden);
            }
            post.render();
        },
        suspend() {
            if (garden) save(garden);
            return { garden: garden ? saveData(garden) : null, time: world?.timeOfDay ?? config.time };
        },
        restore(snapshot) {
            if (world && Number.isFinite(snapshot?.time)) world.timeOfDay = snapshot.time;
        },
        async dispose() {
            if (garden) save(garden);
            disposed = true;
            for (const k of Object.keys(debugHooks)) delete debugHooks[k];
            scene.traverse((o) => {
                if (o.isMesh || o.isSprite) {
                    o.geometry?.dispose?.();
                    for (const m of [].concat(o.material || [])) m.dispose?.();
                }
            });
            renderer.dispose();
        },
        inspect() {
            return {
                booted: state.booted,
                renderer: state.renderer,
                bloomlings: garden ? garden.bloomlings.length : 0,
                stage0: garden?.bloomlings[0]?.data.stage || "",
                held: garden?.held ? (garden.held.b ? "bloomling" : garden.held.item.type) : "",
                match: mg?.match ? mg.match.kind : "",
                matchPhase: mg?.match ? mg.match.phase : "",
                menu: state.menu ? state.menu.kind : "",
                avatar: avatar?.rig ? "vrm" : "toy",
                online: net.online,
                peers: peers ? peers.players.size : 0,
                offers: state.offers.length,
                playerX: Math.round(player.x * 10) / 10,
                playerZ: Math.round(player.z * 10) / 10,
                // The standard facts (docs/games/good-game.md).
                screen: screenName(),
                position: [Math.round(player.x * 100) / 100, Math.round(player.z * 100) / 100],
                arrival: trip.view
                    ? describeArrival({
                          camera: camera.position,
                          fov: camera.fov,
                          avatar: player,
                          avatarForward: { x: Math.sin(player.heading), z: Math.cos(player.heading) },
                          avatarHeight: AVATAR_HEIGHT,
                          crouched: trip.sink > 0,
                          handsEmpty: !garden?.held,
                      })
                    : null,
            };
        },
    };
}
