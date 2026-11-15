import * as THREE from "three/webgpu";
import { uniform } from "three/tsl";
import { createArena, TEAM_COLORS } from "./arena.js";
import { attachVRM, createAvatar, driveAvatar, loadMotion, loadVRM } from "./avatar.js";
import { createBalls } from "./balls.js";
import { createCrowd } from "./crowd.js";
import { createFx } from "./fx.js";
import { bytesToText } from "./glb.js";
import { createPost } from "./post.js";
import { createRiders, setRiderClock } from "./riders.js";
import { createMatch, aimedHoop, dist, passTarget, playerRider, stepMatch, summary, swapPlayer, TEAMS, PITCH } from "./sim.js";
import { bakeEnvironment, createSky, HORIZON, SUN_COLOR, SUN_DIR } from "./sky.js";

// Skyhoop as an Oncyber lifecycle game: the simulation in sim.js, drawn
// with three.js WebGPU. No DOM and no browser services: input arrives as
// named actions, the HUD is drawn by the host from what we publish, and the
// host plays the sounds we cue and relays the lobby handoff.

/** Inspection hooks for scripted playtests. */
export const debugHooks = {};

const DIFFS = ["easy", "normal", "hard"];
const ROLE_NAMES = { runner: "Runner", keeper: "Keeper", striker: "Striker", finder: "Finder" };
const ARRIVE = { x: 0, z: 26 };
const AVATAR_HEIGHT = 1.62;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

export default function createGame(ctx) {
    const services = ctx.services;
    const call = (capability, operation, value = null) => services.call(capability, operation, value, ctx.signal);
    const g = ctx.graphics;

    // ----------------------------------------------------------- renderer
    const renderer = new THREE.WebGPURenderer({
        canvas: g.canvas,
        ...(g.context ? { context: g.context } : {}),
        ...(g.device ? { device: g.device } : {}),
        antialias: true,
        forceWebGL: !g.device,
    });
    let disposed = false;
    renderer.setPixelRatio(g.pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(HORIZON.clone().multiplyScalar(0.95), 260, 2300);
    const camera = new THREE.PerspectiveCamera(66, 1, 0.12, 5000);
    const T = uniform(0);
    let post = null;
    let sizeKey = "";
    function resize() {
        const w = Math.max(1, Math.floor(g.width));
        const h = Math.max(1, Math.floor(g.height));
        const key = `${w}x${h}`;
        if (key === sizeKey) return false;
        sizeKey = key;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        return true;
    }

    // ----------------------------------------------------------- world
    let arena, crowd, riders, balls, fx, sun, avatar;
    const markers = {};
    const state = {
        booted: false,
        screen: "loading",
        boot: 0,
        paused: false,
        difficulty: "normal",
        toasts: [],
        toastId: 0,
        banner: null,
        bannerId: 0,
        renderer: "",
        error: "",
        result: null,
        avatar: "none",
        arrival: { view: null, entered: false, rising: 1, readySent: false, frames: 0 },
        help: false,
    };
    let match = null;
    // The player's eye: aim yaw/pitch for flight, orbit for walking.
    const eye = { yaw: Math.PI, pitch: 0.12, orbitYaw: 0, orbitPitch: 0.25, orbitDist: 5, fov: 66, shake: 0, roll: 0, timeScale: 1, slow: 0 };
    const walker = { x: ARRIVE.x, z: ARRIVE.z, heading: 0, speed: 0, crouch: 0 };
    const camPos = new THREE.Vector3(0, 6, 40);
    const camLook = new THREE.Vector3(0, 4, 0);
    const cues = [];
    let roar = [0, 0];
    let elapsed = 0;
    let lastUI = 0;

    const cue = (n, v = 1, extra = {}) => cues.length < 24 && cues.push({ n, v, ...extra });
    const toast = (text, kind = "") => {
        state.toasts.push({ id: ++state.toastId, text, kind, t: elapsed });
        if (state.toasts.length > 4) state.toasts.shift();
    };
    const banner = (text, sub = "", kind = "") => (state.banner = { id: ++state.bannerId, text, sub, kind, t: elapsed });

    function newMatch(opts = {}) {
        match = createMatch({ seed: (Math.random() * 1e9) | 0, difficulty: state.difficulty, ...opts });
        riders?.paint(match.riders);
        return match;
    }

    /** An idle bowl for the arrival: everyone hovering in formation. */
    function idleMatch() {
        newMatch({ playerTeam: 0 });
        match.phaseT = Infinity;
        const me = playerRider(match);
        me.pos.x = ARRIVE.x + 1.1;
        me.pos.y = 0.95;
        me.pos.z = ARRIVE.z;
        me.fwd = { x: 0, y: 0, z: -1 };
        me.vel = { x: 0, y: 0, z: 0 };
    }

    function goArrive() {
        state.screen = "arrive";
        state.result = null;
        state.paused = false;
        idleMatch();
        walker.x = ARRIVE.x;
        walker.z = ARRIVE.z;
        walker.heading = 0;
        walker.speed = 0;
        const view = state.arrival.view;
        // The lobby's camera sits in front of the avatar; keep that framing,
        // turned so we look across the pitch toward the far stands.
        if (view) {
            const s = AVATAR_HEIGHT / view.avatarHeight;
            const rot = -view.avatarRotation;
            const turn = (v) => ({ x: (v.x * Math.cos(rot) + v.z * Math.sin(rot)) * s, y: v.y * s, z: (-v.x * Math.sin(rot) + v.z * Math.cos(rot)) * s });
            const o = turn(view.cameraOffset);
            const t = turn(view.cameraTargetOffset);
            eye.orbitDist = Math.hypot(o.x - t.x, o.z - t.z);
            eye.orbitYaw = Math.atan2(o.x - t.x, o.z - t.z);
            eye.orbitPitch = Math.atan2(o.y - t.y, eye.orbitDist);
            eye.orbitDist = Math.hypot(eye.orbitDist, o.y - t.y);
            eye.lookH = t.y;
            eye.fov = view.fov;
            walker.crouch = state.arrival.entered ? 0 : 1;
        } else {
            eye.orbitYaw = 0;
            eye.orbitPitch = 0.22;
            eye.orbitDist = 5.2;
            eye.lookH = 1.05;
            eye.fov = 58;
            walker.crouch = 0;
        }
        placeWalkCamera(1);
        cue("music", 0.5, { track: "arrive" });
    }

    function mount() {
        if (state.screen !== "arrive") return;
        const at = { x: walker.x, z: walker.z };
        newMatch({ playerTeam: 0 });
        const me = playerRider(match);
        me.pos = { x: at.x, y: 1.4, z: at.z };
        me.vel = { x: 0, y: 6, z: 0 };
        me.fwd = { x: -Math.sin(walker.heading) * 0 + 1, y: 0, z: 0 };
        // Face the hoops we attack.
        eye.yaw = Math.PI / 2;
        eye.pitch = 0.18;
        match.phaseT = 4.5;
        state.screen = "match";
        banner("Kick-off", `${TEAMS[0].name} vs ${TEAMS[1].name} · ${state.difficulty}`, "info");
        cue("whistle", 0.8);
        cue("music", 0.5, { track: "match" });
        toast("Fly to the Comet: grab it, then aim at a hoop and hold to throw");
    }

    function endScreen(e) {
        const me = playerRider(match);
        const mine = me ? me.team : 0;
        const won = match.winner === mine;
        const tie = match.winner < 0;
        const by = e.catcher >= 0 ? match.riders[e.catcher] : null;
        state.result = {
            title: tie ? "A draw" : won ? "Victory!" : "Defeat",
            sub: by ? `${by.bot ? by.name : "You"} caught the Wisp for ${TEAMS[by.team].name}` : "Time ran out",
            score: [...match.score],
            won,
            stats: {
                shots: match.stats.shots[mine],
                goals: match.stats.goals[mine],
                saves: match.stats.saves[mine],
                steals: match.stats.steals[mine],
            },
        };
        state.screen = "end";
        cue(won ? "fanfare" : "horn", 0.9);
    }

    // ----------------------------------------------------------- avatar

    async function loadAvatar() {
        const ref = services.identity.avatar;
        if (!ref || typeof services.avatar !== "function" || typeof g.decodeImage !== "function") return;
        try {
            const bytes = await services.avatar(ref, ctx.signal);
            const vrm = await loadVRM(bytes, (b, mime) => g.decodeImage(b, mime));
            if (disposed) return;
            await attachVRM(avatar, vrm);
            await renderer.compileAsync(vrm.scene, camera, scene);
            state.avatar = "vrm";
        } catch (err) {
            console.warn("[skyhoop] avatar unavailable, flying the team figure", err?.message || err);
            state.avatar = "figure";
        }
    }

    // ----------------------------------------------------------- input

    function readInput(dt) {
        const I = ctx.input;
        const D = ctx.deltas;
        const P = ctx.pressed;
        const sens = 0.0022 * 100;
        const lx = (D.lookX || 0) * sens + (I.lookStickX || 0) * 2.6 * dt;
        const ly = (D.lookY || 0) * sens + (I.lookStickY || 0) * 2.0 * dt;
        return { I, P, lx, ly };
    }

    // ----------------------------------------------------------- camera

    const tmp = new THREE.Vector3();
    const aim = new THREE.Vector3();
    function aimVector(out = aim) {
        return out.set(Math.sin(eye.yaw) * Math.cos(eye.pitch), Math.sin(eye.pitch), Math.cos(eye.yaw) * Math.cos(eye.pitch));
    }

    function placeWalkCamera(k) {
        const h = eye.lookH ?? 1.05;
        const target = tmp.set(walker.x, h * (1 - walker.crouch * 0.35), walker.z);
        const cp = Math.cos(eye.orbitPitch);
        const want = new THREE.Vector3(
            target.x + Math.sin(eye.orbitYaw) * cp * eye.orbitDist,
            target.y + Math.sin(eye.orbitPitch) * eye.orbitDist,
            target.z + Math.cos(eye.orbitYaw) * cp * eye.orbitDist
        );
        want.y = Math.max(0.4, want.y);
        camPos.lerp(want, k);
        camLook.lerp(target, k);
    }

    function flyCamera(dt, me) {
        aimVector();
        const speed = Math.hypot(me.vel.x, me.vel.y, me.vel.z);
        const dist = 4.6 + Math.min(2.4, speed * 0.06) + (me.charging ? -0.6 : 0);
        const p = me.pos;
        const want = tmp.set(p.x - aim.x * dist, p.y - aim.y * dist + 1.9, p.z - aim.z * dist);
        want.y = Math.max(0.6, want.y);
        camPos.lerp(want, damp(me.stun > 0 ? 4 : 11, dt));
        const look = new THREE.Vector3(p.x + aim.x * 12, p.y + aim.y * 12 + 1.6, p.z + aim.z * 12);
        camLook.lerp(look, damp(16, dt));
        const fovWant = 66 + Math.max(0, speed - 18) * 0.7 + (me.boosting ? 6 : 0) - (me.charging ? me.charge * 6 : 0);
        eye.fov += (clamp(fovWant, 60, 92) - eye.fov) * damp(4, dt);
        eye.roll += (-me.bank * 0.22 - eye.roll) * damp(5, dt);
        if (post) post.speed.value += (clamp((speed - 20) / 18, 0, 1) * (me.boosting ? 1.25 : 0.8) - post.speed.value) * damp(5, dt);
    }

    function applyCamera(dt) {
        camera.position.copy(camPos);
        if (eye.shake > 0) {
            const s = eye.shake * eye.shake * 0.5;
            camera.position.x += (Math.random() - 0.5) * s;
            camera.position.y += (Math.random() - 0.5) * s;
            camera.position.z += (Math.random() - 0.5) * s;
            eye.shake = Math.max(0, eye.shake - dt * 2.2);
        }
        camera.lookAt(camLook);
        camera.rotateZ(eye.roll);
        if (Math.abs(camera.fov - eye.fov) > 0.01) {
            camera.fov = eye.fov;
            camera.updateProjectionMatrix();
        }
    }

    // ----------------------------------------------------------- events

    function onEvents() {
        const me = playerRider(match);
        const mine = me ? me.team : 0;
        for (const e of match.events) {
            const r = e.rider !== undefined ? match.riders[e.rider] : null;
            const isMe = r && me && r.id === me.id;
            const who = isMe ? "You" : r ? r.name : "";
            switch (e.type) {
                case "throw-up":
                    cue("whistle", 1);
                    banner("Play!", "", "info");
                    break;
                case "goal": {
                    const scorer = e.by >= 0 ? match.riders[e.by] : null;
                    fx.goal(e.pos.x, e.pos.y, e.pos.z, e.team, e.side);
                    roar[e.team] = 1;
                    const ours = e.team === mine;
                    banner(ours ? "GOAL!" : `${TEAMS[e.team].name} score`, `${scorer ? (scorer.id === me?.id ? "You" : scorer.name) : ""} · +10`, ours ? "goal" : "against");
                    cue("goal", 1, { team: e.team, ours });
                    eye.shake = Math.max(eye.shake, ours ? 0.8 : 0.4);
                    if (scorer && scorer.id === me?.id) eye.slow = 1.1;
                    if (post) {
                        post.flash.value = ours ? 0.55 : 0.25;
                        post.flashColor.value.copy(TEAM_COLORS[e.team]);
                    }
                    arena.hoops.pulse = { index: (e.side < 0 ? 0 : 3) + e.hoop, t: 2.5 };
                    break;
                }
                case "save":
                    toast(`${who} saved it!`, r.team === mine ? "good" : "bad");
                    cue("save", 0.9);
                    roar[r.team] = Math.max(roar[r.team], 0.6);
                    break;
                case "shot":
                    cue("whoosh", 0.5 + e.power * 0.5, { near: isMe });
                    break;
                case "pass":
                    if (isMe) cue("whoosh", 0.4, { near: true });
                    break;
                case "catch":
                    if (isMe) {
                        toast("You have the Comet", "good");
                        cue("catch", 1, { near: true });
                    } else if (me && match.riders[e.rider].team === mine && me.role === "runner") cue("catch", 0.35);
                    break;
                case "intercept":
                case "steal":
                    cue("steal", isMe ? 1 : 0.5);
                    if (isMe) toast(e.type === "steal" ? "Stolen!" : "Intercepted!", "good");
                    else if (me && e.from === me.id) toast(`${who} took it`, "bad");
                    else if (r.team === mine) toast(`${who} ${e.type === "steal" ? "steals" : "intercepts"}`, "good");
                    break;
                case "fumble":
                    cue("thud", 0.6);
                    break;
                case "lunge":
                    if (isMe) cue("dash", 0.7);
                    break;
                case "roll":
                    if (isMe) cue("roll", 0.8);
                    break;
                case "hit": {
                    fx.sparks(e.pos.x, e.pos.y, e.pos.z, 50);
                    fx.smoke(e.pos.x, e.pos.y, e.pos.z, 12);
                    fx.straw(r.pos.x, r.pos.y, r.pos.z, 10);
                    cue("clang", isMe ? 1 : Math.max(0.15, 1 - camPos.distanceTo(tmp.set(e.pos.x, e.pos.y, e.pos.z)) / 60));
                    if (isMe) {
                        eye.shake = 1;
                        toast("Bolted!", "bad");
                        if (post) {
                            post.flash.value = 0.6;
                            post.flashColor.value.setRGB(1, 0.15, 0.05);
                        }
                    }
                    break;
                }
                case "swat":
                    fx.sparks(e.pos.x, e.pos.y, e.pos.z, 18, [3, 2.2, 1], 9);
                    cue("bat", Math.max(0.15, 1 - camPos.distanceTo(tmp.set(e.pos.x, e.pos.y, e.pos.z)) / 70));
                    break;
                case "wisp":
                    banner("The Wisp is out!", me?.role === "finder" ? "Catch it: +30 and the match" : "Tab: fly your Finder", "wisp");
                    cue("chime", 1);
                    break;
                case "wisp-catch":
                    fx.catchBurst(e.pos.x, e.pos.y, e.pos.z);
                    roar[e.team] = 1;
                    cue("chime", 1);
                    break;
                case "swap":
                    toast(`You fly the ${ROLE_NAMES[e.role]}: ${match.riders[e.rider].name}`);
                    break;
                case "keeper-ball":
                    break;
                case "end":
                    endScreen(e);
                    break;
                case "rim":
                    cue("rim", 0.7);
                    break;
            }
        }
        match.events.length = 0;
    }

    // ----------------------------------------------------------- frame

    const trailPos = new THREE.Vector3();
    const tail = new THREE.Vector3(0, 0, -1.75);
    let trailAcc = 0;
    let audioAcc = 0;

    function updateMatch(dt, input) {
        const { I, P, lx, ly } = input;
        const me = playerRider(match);
        if (state.screen === "match" && !state.paused && me) {
            eye.yaw -= lx;
            eye.pitch = clamp(eye.pitch - ly, -1.25, 1.25);
            const throttle = clamp((I.forward || 0) - (I.backward || 0) + (I.moveY || 0), -1, 1);
            const strafe = clamp((I.right || 0) - (I.left || 0) + (I.moveX || 0), -1, 1);
            const lift = clamp((I.up || 0) - (I.down || 0), -1, 1);
            aimVector();
            const intent = {
                aim: { x: aim.x, y: aim.y, z: aim.z },
                throttle,
                strafe,
                lift,
                boost: (I.boost || 0) > 0,
                shoot: (I.shoot || 0) > 0,
                lunge: !!P.shoot && match.comet.holder !== me.id,
                pass: !!P.pass,
                roll: !!P.roll,
            };
            if (P.swap) {
                const next = me.role === "finder" ? "runner" : "finder";
                const pick = swapPlayer(match, next);
                if (pick) riders.hideBody(me.id, false);
            }
            stepMatch(match, dt, intent);
        } else if (!state.paused) stepMatch(match, dt, null);
        onEvents();
    }

    function updateArrival(dt, input) {
        const { I, P, lx, ly } = input;
        const a = state.arrival;
        // Standing up after the lobby handoff.
        if (a.entered || !a.view) walker.crouch = Math.max(0, walker.crouch - dt / 0.7);
        const canMove = walker.crouch <= 0.01;
        eye.orbitYaw -= lx;
        eye.orbitPitch = clamp(eye.orbitPitch + ly * 0.8, -0.1, 1.1);
        if (canMove) {
            const fx_ = clamp((I.right || 0) - (I.left || 0) + (I.moveX || 0), -1, 1);
            const fz = clamp((I.forward || 0) - (I.backward || 0) + (I.moveY || 0), -1, 1);
            const mag = Math.min(1, Math.hypot(fx_, fz));
            const run = (I.boost || 0) > 0;
            const target = mag * (run ? 6.2 : 3.4);
            walker.speed += (target - walker.speed) * damp(10, dt);
            if (mag > 0.05) {
                // Camera-relative: forward is away from the camera.
                const f = { x: -Math.sin(eye.orbitYaw), z: -Math.cos(eye.orbitYaw) };
                const want = Math.atan2(f.x * fz - f.z * fx_, f.z * fz + f.x * fx_);
                let d = want - walker.heading;
                d = Math.atan2(Math.sin(d), Math.cos(d));
                walker.heading += d * damp(12, dt);
            }
            walker.x += Math.sin(walker.heading) * walker.speed * dt;
            walker.z += Math.cos(walker.heading) * walker.speed * dt;
            const e = (walker.x / (PITCH.a - 2)) ** 2 + (walker.z / (PITCH.b - 2)) ** 2;
            if (e > 1) {
                walker.x /= Math.sqrt(e);
                walker.z /= Math.sqrt(e);
            }
        }
        // The broom waits beside you, bobbing.
        const me = playerRider(match);
        const side = walker.heading + Math.PI / 2;
        me.pos.x += (walker.x + Math.sin(side) * 0.9 - me.pos.x) * damp(4, dt);
        me.pos.z += (walker.z + Math.cos(side) * 0.9 - me.pos.z) * damp(4, dt);
        me.pos.y = 0.95 + Math.sin(elapsed * 2.2) * 0.05;
        me.fwd = { x: Math.sin(walker.heading), y: 0, z: Math.cos(walker.heading) };
        me.vel = { x: 0, y: 0, z: 0 };
        // Everyone else hovers in formation.
        stepMatch(match, dt, null);
        me.pos.y = 0.95 + Math.sin(elapsed * 2.2) * 0.05;
        match.events.length = 0;
        placeWalkCamera(damp(a.view && !a.entered ? 30 : 8, dt));
        eye.roll *= 1 - damp(6, dt);
        if (P.interact && canMove) mount();
    }

    function updateVisuals(dt, realDt) {
        const me = playerRider(match);
        setRiderClock(elapsed);
        riders.update(match.riders, elapsed);
        // The player's VRM sits on the broom (or walks, in the arrival).
        const showVRM = state.avatar === "vrm" && me;
        if (me) riders.hideBody(me.id, !!showVRM);
        for (const r of match.riders) if (r !== me) riders.hideBody(r.id, false);
        if (showVRM) {
            if (state.screen === "arrive") {
                avatar.root.position.set(walker.x, 0, walker.z);
                avatar.root.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, walker.heading);
                // Face the lobby camera during the handoff.
                if (walker.crouch > 0.01) avatar.root.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, eye.orbitYaw);
                driveAvatar(avatar, realDt, { speed: walker.speed, riding: false, crouch: walker.crouch });
                if (walker.crouch > 0.01) walker.heading = eye.orbitYaw;
            } else {
                riders.matrices[me.id].decompose(avatar.root.position, avatar.root.quaternion, avatar.root.scale);
                const sp = Math.hypot(me.vel.x, me.vel.y, me.vel.z);
                driveAvatar(avatar, realDt, { speed: 0, riding: true, lean: clamp(sp / 30, 0, 1), bank: me.bank });
            }
            avatar.root.visible = true;
        } else if (avatar) avatar.root.visible = false;
        balls.update(match, dt, elapsed, camera.position);
        // Trails, embers, smoke.
        trailAcc += dt;
        while (trailAcc > 1 / 50) {
            trailAcc -= 1 / 50;
            for (const r of match.riders) {
                const sp = Math.hypot(r.vel.x, r.vel.y, r.vel.z);
                if (sp < 4 && !r.boosting) continue;
                trailPos.copy(tail).applyMatrix4(riders.matrices[r.id]);
                fx.trail(trailPos.x, trailPos.y, trailPos.z, r.vel.x, r.vel.y, r.vel.z, r.team, r.boosting, me && r.id === me.id);
            }
            const c = match.comet;
            const heat = c.holder >= 0 ? 0 : Math.min(1, Math.hypot(c.vel.x, c.vel.y, c.vel.z) / 30);
            fx.comet(c.pos.x, c.pos.y, c.pos.z, heat);
            for (const b of match.bolts) fx.boltSmoke(b.pos.x, b.pos.y, b.pos.z);
            if (match.wisp.active) fx.wisp(match.wisp.pos.x, match.wisp.pos.y, match.wisp.pos.z);
        }
        fx.update(dt);
        // Crowd noise and the wave when nothing much is happening.
        roar = roar.map((v) => Math.max(0, v - realDt * 0.25));
        const c = match.comet;
        const near = c.holder >= 0 ? Math.abs(c.pos.x) / 66 : 0;
        const home = c.holder >= 0 ? (match.riders[c.holder].team === 0 ? 0 : 1) : -1;
        const buzz = [home === 0 ? near * 0.35 : 0.05, home === 1 ? near * 0.35 : 0.05];
        crowd.update(realDt, { roar: [Math.max(roar[0], buzz[0]), Math.max(roar[1], buzz[1])], wave: state.screen === "arrive" || (match.phase === "play" && roar[0] + roar[1] < 0.1) });
        // Hoop glow: the hoop you're aiming at brightens; a goal flares.
        for (let i = 0; i < 6; i++) arena.hoops.setGlow(i, 0);
        if (me && state.screen === "match" && match.comet.holder === me.id) {
            const h = aimedHoop(match, me, aimVector(new THREE.Vector3()));
            if (h) arena.hoops.setGlow((TEAMS[me.team].sign < 0 ? 0 : 3) + h.index, 0.6 + Math.sin(elapsed * 10) * 0.2);
        }
        if (arena.hoops.pulse) {
            const p = arena.hoops.pulse;
            p.t -= realDt;
            arena.hoops.setGlow(p.index, Math.max(0, p.t) * 1.5);
            if (p.t <= 0) arena.hoops.pulse = null;
        }
        updateMarkers(me);
        if (post) post.flash.value = Math.max(0, post.flash.value - realDt * 1.6);
        sun.position.set(SUN_DIR.x * 260, SUN_DIR.y * 260, SUN_DIR.z * 260);
    }

    // A ring over the pass target, and a chevron at the screen edge toward an off-screen Comet.
    function buildMarkers() {
        const ringMat = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(0.6, 2.2, 1.4), transparent: true, opacity: 0.9, depthTest: false, fog: false });
        markers.pass = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 32), ringMat);
        markers.pass.renderOrder = 20;
        scene.add(markers.pass);
        const chevMat = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(1.0, 0.42, 0.12), transparent: true, opacity: 0.95, toneMapped: false, depthTest: false, fog: false });
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.026);
        shape.lineTo(-0.016, 0);
        shape.lineTo(0.016, 0);
        shape.closePath();
        markers.chev = new THREE.Mesh(new THREE.ShapeGeometry(shape), chevMat);
        markers.chev.renderOrder = 21;
        camera.add(markers.chev);
        const wispMat = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(1.0, 0.85, 0.4), transparent: true, opacity: 0.95, toneMapped: false, depthTest: false, fog: false });
        markers.chevWisp = new THREE.Mesh(new THREE.ShapeGeometry(shape), wispMat);
        markers.chevWisp.renderOrder = 21;
        camera.add(markers.chevWisp);
        scene.add(camera);
    }

    const proj = new THREE.Vector3();
    function edgeArrow(mesh, p, show) {
        mesh.visible = false;
        if (!show) return;
        proj.set(p.x, p.y, p.z).applyMatrix4(camera.matrixWorldInverse);
        const behind = proj.z > 0;
        const ndc = new THREE.Vector3(p.x, p.y, p.z).project(camera);
        if (!behind && Math.abs(ndc.x) < 0.92 && Math.abs(ndc.y) < 0.88) return;
        let ang = Math.atan2(proj.y, proj.x);
        if (behind && Math.abs(proj.x) < 0.01 && Math.abs(proj.y) < 0.01) ang = -Math.PI / 2;
        const h = Math.tan((camera.fov * Math.PI) / 360) * 0.5;
        const w = h * camera.aspect;
        mesh.position.set(Math.cos(ang) * w * 0.78, Math.sin(ang) * h * 0.72, -0.5);
        mesh.rotation.set(0, 0, ang - Math.PI / 2);
        mesh.visible = true;
    }

    function updateMarkers(me) {
        const flying = state.screen === "match" && me;
        markers.pass.visible = false;
        if (flying && match.comet.holder === me.id) {
            const mate = passTarget(match, me);
            if (mate) {
                markers.pass.visible = true;
                markers.pass.position.set(mate.pos.x, mate.pos.y + 1.6, mate.pos.z);
                markers.pass.quaternion.copy(camera.quaternion);
                const d = camera.position.distanceTo(markers.pass.position);
                markers.pass.scale.setScalar(Math.max(1, d * 0.05));
                state.passName = mate.name;
            }
        }
        camera.updateMatrixWorld();
        edgeArrow(markers.chev, match.comet.pos, flying && match.comet.holder !== me.id && me.role !== "finder");
        edgeArrow(markers.chevWisp, match.wisp.pos, flying && match.wisp.active);
    }

    // ----------------------------------------------------------- UI

    function publishUI(force) {
        if (!force && elapsed - lastUI < 1 / 20) return;
        lastUI = elapsed;
        const me = match && playerRider(match);
        state.toasts = state.toasts.filter((t) => elapsed - t.t < 3);
        if (state.banner && elapsed - state.banner.t > 2.6) state.banner = null;
        const clock = match ? Math.ceil(match.clock) : 0;
        const radar = [];
        if (match && state.screen === "match")
            for (const r of match.riders) radar.push([+(r.pos.x / PITCH.a).toFixed(3), +(r.pos.z / PITCH.b).toFixed(3), r.team, r.id === me?.id ? 1 : 0]);
        const ui = {
            screen: state.screen,
            paused: state.paused,
            boot: state.boot,
            error: state.error,
            difficulty: state.difficulty,
            score: match ? [...match.score] : [0, 0],
            teams: TEAMS.map((t) => t.name),
            clock: `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, "0")}`,
            phase: match ? match.phase : "",
            kickoff: match && match.phase === "kickoff" && state.screen === "match" ? Math.ceil(match.phaseT) : 0,
            role: me ? ROLE_NAMES[me.role] : "",
            name: me ? me.name : "",
            stamina: me ? +me.stamina.toFixed(2) : 1,
            charge: me ? +me.charge.toFixed(2) : 0,
            holding: !!(me && match.comet.holder === me.id),
            stunned: !!(me && me.stun > 0),
            aimHoop: !!(me && match.comet.holder === me.id && aimedHoop(match, me, aimVector(new THREE.Vector3()))),
            passName: me && match.comet.holder === me.id ? state.passName || "" : "",
            wisp: !!(match && match.wisp.active),
            canMount: state.screen === "arrive" && walker.crouch <= 0.01,
            toasts: state.toasts.map((t) => ({ id: t.id, text: t.text, kind: t.kind })),
            banner: state.banner ? { id: state.banner.id, text: state.banner.text, sub: state.banner.sub, kind: state.banner.kind } : null,
            result: state.result,
            radar,
            comet: match && state.screen === "match" ? [+(match.comet.pos.x / PITCH.a).toFixed(3), +(match.comet.pos.z / PITCH.b).toFixed(3)] : null,
            help: state.help,
        };
        ctx.ui.publish(ui);
    }

    function sendAudio(dt, force) {
        audioAcc += dt;
        if (!force && audioAcc < 1 / 20 && !cues.length) return;
        audioAcc = 0;
        const me = match && playerRider(match);
        const speed = me && state.screen === "match" ? Math.hypot(me.vel.x, me.vel.y, me.vel.z) : 0;
        const env = {
            wind: clamp(speed / 36, 0, 1.2),
            boost: !!me?.boosting && state.screen === "match",
            crowd: clamp(0.3 + Math.max(roar[0], roar[1]) * 0.7, 0, 1),
            charge: me?.charging ? me.charge : 0,
            screen: state.screen,
        };
        const batch = cues.splice(0);
        call("audio", "update", { cues: batch, env }).catch(() => {});
    }

    // ----------------------------------------------------------- travel

    let travelBusy = false;
    function pollTravel() {
        if (travelBusy) return;
        travelBusy = true;
        call("travel", "status")
            .then((s) => {
                const a = state.arrival;
                if (s?.view && !a.view) {
                    a.view = s.view;
                    if (state.screen === "arrive") goArrive();
                    a.frames = 0;
                }
                if (s?.entered && !a.entered) a.entered = true;
            })
            .catch(() => {})
            .finally(() => (travelBusy = false));
    }

    // ----------------------------------------------------------- lifecycle

    function render() {
        if (post) post.post.render();
        else renderer.render(scene, camera);
    }

    return {
        async prepare() {
            await renderer.init();
            state.renderer = renderer.backend.isWebGPUBackend ? "webgpu" : "webgl2";
            resize();
            state.boot = 0.1;
            loadMotion(async () => JSON.parse(bytesToText(await services.asset("public/motion.json", ctx.signal))));
            // Light: a low warm sun with soft shadows over the whole bowl, sky fill.
            sun = new THREE.DirectionalLight(SUN_COLOR, 3.1);
            sun.castShadow = true;
            sun.shadow.mapSize.set(4096, 4096);
            const sc = sun.shadow.camera;
            sc.left = -115;
            sc.right = 115;
            sc.top = 115;
            sc.bottom = -115;
            sc.near = 20;
            sc.far = 620;
            sun.shadow.bias = -0.0004;
            sun.shadow.normalBias = 0.05;
            sun.target.position.set(0, 0, 0);
            scene.add(sun, sun.target);
            scene.add(new THREE.HemisphereLight(0xa9c8ff, 0x4f5a34, 0.85));
            scene.add(createSky(T));
            arena = createArena(T);
            scene.add(arena.group);
            state.boot = 0.4;
            crowd = createCrowd(T);
            scene.add(crowd.mesh);
            riders = createRiders(14);
            scene.add(riders.group);
            balls = createBalls(T);
            scene.add(balls.group);
            fx = createFx();
            scene.add(fx.group);
            avatar = createAvatar();
            avatar.root.visible = false;
            scene.add(avatar.root);
            buildMarkers();
            const env = await bakeEnvironment(renderer);
            if (env) {
                scene.environment = env;
                scene.environmentIntensity = 0.55;
            }
            state.boot = 0.7;
            try {
                post = createPost(renderer, scene, camera);
            } catch (err) {
                console.warn("[skyhoop] post-processing unavailable", err?.message || err);
                post = null;
            }
            idleMatch();
            goArrive();
            updateVisuals(0, 0);
            applyCamera(0);
            await renderer.compileAsync(scene, camera);
            state.boot = 1;
            state.booted = true;
            debugHooks.state = state;
            debugHooks.match = () => match;
            debugHooks.eye = eye;
            debugHooks.walker = walker;
        },
        enter() {
            // The avatar streams in after arrival; the team figure stands in.
            void loadAvatar();
            render();
        },
        update(dt) {
            if (disposed) return;
            const resized = resize();
            const input = readInput(dt);
            if (input.P.mute) cue("mute-toggle", 1);
            if (input.P.help) state.help = !state.help;
            if (input.P.difficulty && state.screen === "arrive") {
                state.difficulty = DIFFS[(DIFFS.indexOf(state.difficulty) + 1) % DIFFS.length];
                toast(`Difficulty: ${state.difficulty}`);
            }
            if (input.P.back) {
                if (state.screen === "match") state.paused = !state.paused;
                else if (state.screen === "end") goArrive();
            }
            if (input.P.resume) state.paused = false;
            if (input.P.leave && (state.screen === "match" || state.screen === "end")) goArrive();
            if (input.P.again && state.screen === "end") {
                state.screen = "arrive";
                mount();
            }
            if (input.P.exit) call("travel", "lobby").catch(() => {});
            // Slow motion after your own goal.
            if (eye.slow > 0) eye.slow = Math.max(0, eye.slow - dt);
            const scale = eye.slow > 0 ? 0.3 + 0.7 * (1 - eye.slow / 1.1) ** 2 : 1;
            const world = dt * scale;
            elapsed += dt;
            T.value += world;
            if (state.screen === "arrive") updateArrival(world, input);
            else updateMatch(world, input);
            const me = playerRider(match);
            if (state.screen === "match" && me) flyCamera(dt, me);
            else if (state.screen === "end" && me) {
                // Drift around the winner.
                eye.yaw += dt * 0.15;
                flyCamera(dt, me);
            }
            if (post && state.screen !== "match") post.speed.value *= 1 - damp(4, dt);
            updateVisuals(world, dt);
            applyCamera(dt);
            pollTravel();
            render();
            const a = state.arrival;
            if (a.view && !a.readySent && ++a.frames >= 2) {
                a.readySent = true;
                call("travel", "arrival-ready").catch(() => {});
            }
            publishUI(resized);
            sendAudio(dt, false);
        },
        suspend() {
            return { screen: state.screen, score: match ? [...match.score] : [0, 0], clock: match ? match.clock : 0 };
        },
        restore() {
            sizeKey = "";
        },
        dispose() {
            disposed = true;
            renderer.dispose();
        },
        inspect() {
            const me = match && playerRider(match);
            return {
                booted: state.booted,
                screen: state.screen,
                renderer: state.renderer,
                avatar: state.avatar,
                crowd: crowd ? crowd.count : 0,
                riders: match ? match.riders.length : 0,
                role: me ? me.role : "",
                playerY: me ? +me.pos.y.toFixed(1) : 0,
                holding: !!(me && match.comet.holder === me.id),
                ...(match ? summary(match) : {}),
                distanceToComet: me ? +dist(me.pos, match.comet.pos).toFixed(1) : 0,
            };
        },
    };
}

