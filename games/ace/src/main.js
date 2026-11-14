import * as THREE from "three";
import "./style.css";
import * as sound from "./audio.js";
import {
    createCharacter,
    PALETTES,
    portrait,
    poseCharacter,
    racketHead,
} from "./character.js";
import { COURT, DIFFICULTY, SHOTS } from "./config.js";
import {
    createEngine,
    serveGaugeAt,
    startMatch,
    update,
} from "./engine.js";
import {
    bounceMark,
    confetti,
    createFx,
    dustPuff,
    emitParticle,
    hitBurst,
    resetTrail,
    ring,
    setTrail,
    updateFx,
} from "./fx.js";
import { createHost } from "./host.js";
import { createHud } from "./hud.js";
import { buildLineup, partyFormats, sideLabel } from "./party.js";
import { clearInput, createInput, readInput } from "./input.js";
import { pointLabel } from "./rules.js";
import { rallyTarget } from "./shots.js";
import { cheer, createWorld, updateWorld } from "./world.js";
import { attachVRM, driveVRM, loadVRM } from "./vrm.js";

const $ = (s) => document.querySelector(s);
const host = createHost();
host.hello();

// --------------------------------------------------------------- renderer

const canvas = $("#stage");
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfeaff, 90, 320);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);

function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the whole court in frame on tall screens. The arrival view keeps
    // the lobby's own field of view instead.
    camera.fov =
        state?.camMode === "arrive" ? arrive.fov : camera.aspect < 1 ? 58 : 42;
    camera.updateProjectionMatrix();
    // Resizing clears the canvas; redraw now instead of showing an empty
    // frame until the next animation frame.
    if (world) renderer.render(scene, camera);
}
window.addEventListener("resize", resize);

const CPU_ROSTER = {
    rookie: {
        name: "Benny",
        blurb: "Just happy to be here. Loves a lob.",
        palette: PALETTES[2],
    },
    pro: {
        name: "Marta",
        blurb: "Steady from the baseline. Hates errors.",
        palette: PALETTES[1],
    },
    ace: {
        name: "Nova",
        blurb: "Hits it early, hits it hard.",
        palette: PALETTES[3],
    },
};

const settings = { difficulty: "pro", games: 2 };
// Saved settings arrive with the identity when embedded (see host.js).
function loadSettings() {
    try {
        const saved = JSON.parse(host.storage.get("settings") || "{}");
        if (DIFFICULTY[saved.difficulty]) settings.difficulty = saved.difficulty;
        if ([1, 2, 3].includes(saved.games)) settings.games = saved.games;
    } catch {
        /* malformed */
    }
    applySettingParams();
    audio.muted = host.storage.get("muted") === "1";
}

const params = new URLSearchParams(location.search);
function applySettingParams() {
    if (DIFFICULTY[params.get("difficulty")])
        settings.difficulty = params.get("difficulty");
    if ([1, 2, 3].includes(Number(params.get("games"))))
        settings.games = Number(params.get("games"));
}
applySettingParams();

const audio = sound.createAudio();

// --------------------------------------------------------------- scene

const boot = { progress: 0 };
function setBoot(value, text) {
    boot.progress = value;
    $("#boot-fill").style.width = `${Math.round(value * 100)}%`;
    if (text) $("#boot-text").textContent = text;
    host.progress(value);
}
setBoot(0.1);

let world, fx, players, umpire;
const state = {
    screen: "boot",
    engine: null,
    attract: true,
    identity: { name: "You", pfp: "" },
    shake: 0,
    cam: {
        pos: new THREE.Vector3(0, 12, 34),
        look: new THREE.Vector3(0, 0, 0),
    },
    camMode: "orbit",
    camT: 0,
    paused: false,
    hintPoints: 0,
    rally: 0,
    matchEndAt: 0,
    hops: [0, 0],
    lastCharge: false,
    chargeFull: false,
    orbit: 0,
    intro: 0,
};

// Arrival from the lobby: the visitor stands courtside in the lobby's own
// third-person framing, walks around, and starts a match when they like.
// Kept well inside the courtside walls so the camera behind the visitor
// stays on the court side of them.
const ARRIVE_SPOT = { x: 2.4, z: COURT.halfLength + 1.2 };
const ARRIVE_BOUNDS = {
    x: COURT.doublesHalfWidth + 2.4,
    zMin: 0.7, // the near half; the net is not a door
    zMax: COURT.halfLength + 2.6,
};
const ARRIVE_HEIGHT = 1.75;
const arrive = {
    came: false, // this visit started as a lobby trip
    offset: new THREE.Vector3(0, 2.3, 4.8),
    look: new THREE.Vector3(0, 1.25, 0),
    fov: 50,
    camYaw: 0,
    faceYaw: 0,
    drag: null,
    // The lobby hands the visitor over crouched; they stand up once revealed.
    sink: 0,
    rising: false,
};
const ARRIVE_SINK = 0.42;
const ARRIVE_RISE_S = 0.7;
resize();

function buildScene() {
    world = createWorld(scene);
    setBoot(0.5, "Seating the crowd…");
    fx = createFx(scene);
    const human = createCharacter(PALETTES[0]);
    const cpu = createCharacter(CPU_ROSTER[settings.difficulty].palette);
    scene.add(human.root, cpu.root);
    players = [human, cpu];
    umpire = createCharacter({
        shirt: 0x1d2b4f,
        shorts: 0x1d2b4f,
        band: 0xffffff,
        racket: 0xffffff,
        hair: 0x8b8b8b,
        skin: 0xf2c39b,
        shoe: 0x111111,
        sole: 0x111111,
    });
    umpire.racket.visible = false;
    umpire.root.position.set(world.umpireSeat.x, world.umpireSeat.y - 0.66, 0);
    umpire.root.rotation.y = -Math.PI / 2;
    scene.add(umpire.root);
    setBoot(0.75, "Stringing rackets…");
}

function setCpuLook(difficulty) {
    const fresh = createCharacter(CPU_ROSTER[difficulty].palette);
    scene.remove(players[1].root);
    players[1] = fresh;
    scene.add(fresh.root);
}

// --------------------------------------------------------------- screens

const screens = [
    "boot",
    "title",
    "arrive",
    "party",
    "setup",
    "howto",
    "hud",
    "vs",
    "pause",
    "results",
];
function show(...names) {
    for (const s of screens)
        $(`#${s}`).classList.toggle("show", names.includes(s));
    document.body.classList.toggle(
        "playing",
        names.includes("hud") && !names.includes("pause")
    );
}

const menus = {
    title: { el: "#main-menu", index: 0 },
    pause: { el: "#pause-menu", index: 0 },
    results: { el: "#results-menu", index: 0 },
};
function focusMenu(name, index = menus[name].index) {
    const items = [...document.querySelectorAll(`${menus[name].el} .pill`)];
    menus[name].index = (index + items.length) % items.length;
    items.forEach((b, i) =>
        b.classList.toggle("focus", i === menus[name].index)
    );
}

function goTitle() {
    state.screen = "title";
    state.paused = false;
    show("title");
    focusMenu("title", 0);
    startAttract();
    sound.startMusic(audio, "title");
    sound.setCrowd(audio, 0.5);
}

/** Rotate a lobby offset (relative to the avatar's feet) into court space. */
function mapArrival(view) {
    // Turn the lobby's formation so its camera looks down the court at the
    // net: the lobby camera sits at angle r + PI around the avatar.
    const turn = Math.PI - view.avatarRotation;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const scale = ARRIVE_HEIGHT / view.avatarHeight;
    const map = (v, out) =>
        out.set(
            (v.x * cos + v.z * sin) * scale,
            v.y * scale,
            (-v.x * sin + v.z * cos) * scale
        );
    map(view.cameraOffset, arrive.offset);
    map(view.cameraTargetOffset, arrive.look);
    // A camera at the avatar's feet or inside it is not a usable view.
    if (arrive.offset.length() < 0.6) arrive.offset.set(0, 2.3, 4.8);
    arrive.fov = view.fov;
}

function goArrive(view) {
    if (view) mapArrival(view);
    arrive.came = true;
    arrive.camYaw = 0;
    // The lobby's travel camera sits in front of the avatar, so a visitor
    // arrives facing the camera with the court behind them, as they left.
    arrive.faceYaw = view ? Math.PI : 0;
    state.attract = false;
    state.paused = false;
    state.screen = "arrive";
    // An idle court: the opponent waits at the far baseline, no ball in play.
    state.engine = createEngine({
        difficulty: settings.difficulty,
        games: settings.games,
        seed: (Math.random() * 1e9) | 0,
    });
    const me = state.engine.athletes[0];
    me.x = ARRIVE_SPOT.x;
    me.z = ARRIVE_SPOT.z;
    players[0].yaw = arrive.faceYaw;
    // No racket in hand while walking around the club.
    players[0].racket.visible = false;
    arrive.sink = view ? ARRIVE_SINK : 0;
    arrive.rising = !view || host.entered;
    state.camMode = "arrive";
    resize();
    placeArrivalCamera();
    state.cam.pos.copy(camPos);
    state.cam.look.copy(camLook);
    resetTrail(fx);
    show("arrive");
    sound.startMusic(audio, "title");
    sound.setCrowd(audio, 0.3);
}

/** Back from a match, setup or the how-to: wherever this visit started. */
function goHome() {
    if (arrive.came) goArrive(null);
    else goTitle();
}

// Ease the stand-up: quick off the floor, gentle at the top.
function smoothSink() {
    const t = arrive.sink / ARRIVE_SINK;
    return ARRIVE_SINK * t * t * (3 - 2 * t);
}

function placeArrivalCamera() {
    const me = state.engine.athletes[0];
    const cos = Math.cos(arrive.camYaw);
    const sin = Math.sin(arrive.camYaw);
    const turn = (v, out) =>
        out.set(
            me.x + v.x * cos + v.z * sin,
            v.y,
            me.z - v.x * sin + v.z * cos
        );
    turn(arrive.offset, camPos);
    turn(arrive.look, camLook);
}

function updateArrive(raw, dt) {
    const me = state.engine.athletes[0];
    if (arrive.rising && arrive.sink > 0)
        arrive.sink = Math.max(0, arrive.sink - (ARRIVE_SINK / ARRIVE_RISE_S) * dt);
    // Stay put until standing.
    if (arrive.sink > 0) raw = { ...raw, x: 0, y: 0 };
    // Walk relative to where the camera looks.
    const dirX = camLook.x - camPos.x;
    const dirZ = camLook.z - camPos.z;
    const fl = Math.hypot(dirX, dirZ) || 1;
    const mx = (raw.x * -dirZ + raw.y * dirX) / fl;
    const mz = (raw.x * dirX + raw.y * dirZ) / fl;
    const len = Math.hypot(mx, mz);
    const speed = 4.4;
    const tx = len > 0.05 ? (mx / Math.max(1, len)) * speed : 0;
    const tz = len > 0.05 ? (mz / Math.max(1, len)) * speed : 0;
    const k = 1 - Math.exp(-10 * dt);
    me.vx += (tx - me.vx) * k;
    me.vz += (tz - me.vz) * k;
    me.x = Math.max(-ARRIVE_BOUNDS.x, Math.min(ARRIVE_BOUNDS.x, me.x + me.vx * dt));
    me.z = Math.max(ARRIVE_BOUNDS.zMin, Math.min(ARRIVE_BOUNDS.zMax, me.z + me.vz * dt));
    me.stateTime += dt;
    if (Math.hypot(me.vx, me.vz) > 0.4) {
        // Our forward is -z at yaw 0; take the short way round.
        const want = Math.atan2(-me.vx, -me.vz);
        const delta = Math.atan2(
            Math.sin(want - arrive.faceYaw),
            Math.cos(want - arrive.faceYaw)
        );
        arrive.faceYaw += delta;
    }
}

// Drag on the court to look around while standing in the arrival view.
canvas.addEventListener("pointerdown", (event) => {
    if (state.screen !== "arrive") return;
    arrive.drag = { id: event.pointerId, x: event.clientX };
});
window.addEventListener("pointermove", (event) => {
    if (!arrive.drag || arrive.drag.id !== event.pointerId) return;
    if (state.screen !== "arrive") return (arrive.drag = null);
    arrive.camYaw -= (event.clientX - arrive.drag.x) * 0.006;
    arrive.drag.x = event.clientX;
});
const endArriveDrag = () => (arrive.drag = null);
window.addEventListener("pointerup", endArriveDrag);
window.addEventListener("pointercancel", endArriveDrag);

// A party that arrived together picks a format before anything else.
// Everyone in the party, the visitor first. Once the party's room has other
// members, its roster decides (ids every member sees the same way, so the
// draw matches on every screen); until then, the members the lobby named.
function partyPlayers() {
    const name = `${state.identity.name || "You"} (you)`;
    if (host.selfId && host.roster.length)
        return [{ id: host.selfId, name }, ...host.roster];
    return [{ id: "self", name }, ...host.party.members];
}

function goParty() {
    state.screen = "party";
    show("party");
    const everyone = partyPlayers();
    $("#party-title").textContent = `Party of ${everyone.length}`;
    $("#party-names").textContent = everyone.map((p) => p.name).join(" · ");
    const formats = partyFormats(everyone.length);
    const list = $("#party-formats");
    list.replaceChildren(
        ...formats.map((format, index) => {
            const button = document.createElement("button");
            button.className = `pill${index === 0 ? " big" : ""}`;
            button.dataset.format = format.id;
            const label = document.createElement("span");
            label.textContent = format.label;
            const blurb = document.createElement("small");
            blurb.textContent = format.blurb;
            button.append(label, blurb);
            return button;
        })
    );
    $("#party-lineup").hidden = true;
    $("#party-note").hidden = true;
    state.partyFormat = null;
}

function choosePartyFormat(format) {
    if (format === "cpu") return goSetup();
    const lineup = buildLineup(format, partyPlayers(), host.party.id);
    if (!lineup) return;
    state.partyFormat = format;
    const box = $("#party-lineup");
    box.replaceChildren(
        ...lineup.rounds.flatMap((round) => {
            const title = document.createElement("h3");
            title.textContent = round.name;
            return [
                title,
                ...round.matches.map(([a, b]) => {
                    const line = document.createElement("p");
                    const versus = document.createElement("i");
                    versus.textContent = "v";
                    line.append(
                        sideLabel(a, lineup.rounds),
                        versus,
                        sideLabel(b, lineup.rounds)
                    );
                    return line;
                }),
            ];
        })
    );
    box.hidden = false;
    $("#party-note").hidden = false;
    document
        .querySelectorAll("#party-formats .pill")
        .forEach((b) => b.classList.toggle("focus", b.dataset.format === format));
}

function goSetup() {
    state.screen = "setup";
    show("setup");
    state.setupField = 0;
    refreshSetup();
}

let howtoReturn = "title";
function goHowto(from) {
    howtoReturn = from;
    state.screen = "howto";
    show("howto", from === "pause" ? "hud" : "");
}

function refreshSetup() {
    for (const b of document.querySelectorAll("#opt-difficulty button"))
        b.setAttribute(
            "aria-pressed",
            String(b.dataset.value === settings.difficulty)
        );
    for (const b of document.querySelectorAll("#opt-games button"))
        b.setAttribute(
            "aria-pressed",
            String(Number(b.dataset.value) === settings.games)
        );
    const foe = CPU_ROSTER[settings.difficulty];
    $("#foe-name").textContent = `${foe.name} · ${
        DIFFICULTY[settings.difficulty].label
    }`;
    $("#foe-blurb").textContent = foe.blurb;
    $("#foe-face").style.backgroundImage = `url(${portrait(foe.palette)})`;
    document
        .querySelectorAll("#setup .field")
        .forEach((f, i) => f.classList.toggle("focus", i === state.setupField));
    host.storage.set("settings", JSON.stringify(settings));
}

function startAttract() {
    state.attract = true;
    if (players) players[0].racket.visible = true;
    state.engine = createEngine({
        difficulty: "pro",
        games: 99,
        seed: (Math.random() * 1e9) | 0,
        autoHuman: true,
    });
    startMatch(state.engine);
    state.camMode = "orbit";
    resize();
    resetTrail(fx);
}

function startGame() {
    setCpuLook(settings.difficulty);
    state.attract = false;
    players[0].racket.visible = true;
    state.engine = createEngine({
        difficulty: settings.difficulty,
        games: settings.games,
        seed: (Math.random() * 1e9) | 0,
    });
    startMatch(state.engine);
    state.engine.phase = "intro";
    state.rally = 0;
    state.hintPoints = 0;
    state.matchEndAt = 0;
    resetTrail(fx);
    clearInput(input);
    const foe = CPU_ROSTER[settings.difficulty];
    const me = state.identity;
    $("#sb-name-0").textContent = me.name;
    $("#sb-name-1").textContent = foe.name;
    const myFace = me.pfp || portrait(PALETTES[0]);
    for (const el of [$("#sb-face-0"), $("#vs-face-0")])
        el.style.backgroundImage = `url("${myFace}")`;
    for (const el of [$("#sb-face-1"), $("#vs-face-1")])
        el.style.backgroundImage = `url(${portrait(foe.palette)})`;
    $("#vs-name-0").textContent = me.name;
    $("#vs-name-1").textContent = foe.name;
    $("#vs-tag").textContent = DIFFICULTY[settings.difficulty].label;
    refreshScore(false);
    state.screen = "vs";
    show("vs");
    sound.startMusic(audio, "soft");
    sound.sfxUI(audio, "stamp");
    state.camMode = "intro";
    resize();
    state.camT = 0;
    setTimeout(() => {
        if (state.screen !== "vs") return;
        show("hud");
        state.screen = "intro";
        callout("READY?", "yellow");
        sound.sfxCall(audio, "ready");
        setTimeout(() => {
            if (state.screen !== "intro") return;
            callout("PLAY!", "green");
            sound.sfxCall(audio, "go");
            sound.startMusic(audio, "match");
            sound.setCrowd(audio, 0.35);
            cheer(world, 0.8);
            state.screen = "playing";
            state.engine.phase = "setup";
            state.engine.phaseTime = 0;
            state.camMode = "play";
        }, 1100);
    }, 1900);
}

function pauseGame() {
    if (state.screen !== "playing") return;
    state.paused = true;
    state.screen = "pause";
    sound.chargeStop(audio);
    show("hud", "pause");
    focusMenu("pause", 0);
    sound.sfxUI(audio, "back");
}

function resumeGame() {
    state.paused = false;
    state.screen = "playing";
    show("hud");
    clearInput(input);
    sound.sfxUI(audio, "ok");
}

function toggleSound() {
    sound.unlockAudio(audio);
    sound.setMuted(audio, !audio.muted);
    host.storage.set("muted", audio.muted ? "1" : "0");
    refreshSoundLabels();
    sound.sfxUI(audio, "ok");
}
function refreshSoundLabels() {
    $("#sound-label").textContent = audio.muted ? "Off" : "On";
    for (const el of document.querySelectorAll(".sound-label"))
        el.textContent = audio.muted ? "Off" : "On";
}
refreshSoundLabels();

function action(name) {
    sound.unlockAudio(audio);
    switch (name) {
        case "play":
            sound.sfxUI(audio, "ok");
            if (host.party) goParty();
            else goSetup();
            break;
        case "howto":
            sound.sfxUI(audio, "ok");
            goHowto(state.screen === "pause" ? "pause" : "title");
            break;
        case "sound":
            toggleSound();
            break;
        case "back":
            sound.sfxUI(audio, "back");
            if (state.screen === "howto" && howtoReturn === "pause") {
                state.screen = "pause";
                show("hud", "pause");
            } else goHome();
            break;
        case "start":
            sound.sfxUI(audio, "ok");
            startGame();
            break;
        case "resume":
            resumeGame();
            break;
        case "restart":
            sound.sfxUI(audio, "ok");
            startGame();
            break;
        case "quit":
        case "menu":
            sound.sfxUI(audio, "back");
            goHome();
            break;
        case "lobby":
            host.exit();
            break;
        case "rematch":
            sound.sfxUI(audio, "ok");
            startGame();
            break;
        default:
            break;
    }
}

document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (b) action(b.dataset.action);
    const format = e.target.closest("#party-formats [data-format]");
    if (format) {
        sound.unlockAudio(audio);
        sound.sfxUI(audio, "ok");
        choosePartyFormat(format.dataset.format);
    }
    const choice = e.target.closest(".choice button");
    if (choice) {
        sound.unlockAudio(audio);
        sound.sfxUI(audio, "move");
        if (choice.parentElement.id === "opt-difficulty")
            settings.difficulty = choice.dataset.value;
        else settings.games = Number(choice.dataset.value);
        refreshSetup();
    }
});
$("#pause-btn").addEventListener("click", () => {
    sound.unlockAudio(audio);
    pauseGame();
});
$("#lobby").hidden = !host.embedded;
$("#lobby").addEventListener("click", () => host.exit());
document.addEventListener("visibilitychange", () => {
    if (document.hidden && !AUTOPLAY) pauseGame();
});

function menuNav(name, dir) {
    if (dir === "up" || dir === "left") focusMenu(name, menus[name].index - 1);
    else focusMenu(name, menus[name].index + 1);
    sound.sfxUI(audio, "move");
}
function menuConfirm(name) {
    const items = [...document.querySelectorAll(`${menus[name].el} .pill`)];
    items[menus[name].index]?.click();
}

function handleMenuInput(events) {
    for (const e of events) {
        if (e.type === "mute") toggleSound();
        if (e.type === "confirm" || e.type === "shot" || e.type === "nav")
            sound.unlockAudio(audio);
        const s = state.screen;
        if (s === "title" || s === "pause" || s === "results") {
            if (e.type === "nav") menuNav(s, e.dir);
            if (e.type === "confirm") menuConfirm(s);
            if (s === "pause" && (e.type === "pause" || e.type === "back"))
                resumeGame();
        } else if (s === "setup") {
            if (e.type === "nav") {
                const fields = ["difficulty", "games"];
                if (e.dir === "up" || e.dir === "down")
                    state.setupField =
                        (state.setupField + (e.dir === "down" ? 1 : -1) + 3) %
                        3;
                else if (state.setupField < 2) {
                    const f = fields[state.setupField];
                    const values =
                        f === "difficulty"
                            ? ["rookie", "pro", "ace"]
                            : [1, 2, 3];
                    const i = values.indexOf(settings[f]);
                    settings[f] =
                        values[
                            Math.max(
                                0,
                                Math.min(2, i + (e.dir === "right" ? 1 : -1))
                            )
                        ];
                }
                sound.sfxUI(audio, "move");
                refreshSetup();
                document
                    .querySelector("#setup .go")
                    .classList.toggle("focus", state.setupField === 2);
            }
            if (e.type === "confirm") action("start");
            if (e.type === "back") action("back");
        } else if (s === "arrive") {
            // Arrows and WASD walk here, so only Enter acts.
            if (e.type === "confirm") action("play");
        } else if (s === "party") {
            if (e.type === "back") action("back");
        } else if (s === "howto") {
            if (e.type === "confirm" || e.type === "back") action("back");
        } else if (s === "playing") {
            if (e.type === "pause") pauseGame();
        }
    }
}

// --------------------------------------------------------------- HUD

function refreshScore(bump = true, who = null) {
    const m = state.engine.match;
    const label = pointLabel(m);
    for (const w of [0, 1]) {
        $(`#sb-games-${w}`).textContent = m.games[w];
        let p = ["0", "15", "30", "40"][Math.min(3, m.points[w])];
        if (m.points[0] >= 3 && m.points[1] >= 3) {
            p = m.points[w] > m.points[1 - w] ? "AD" : "40";
        }
        $(`#sb-points-${w}`).textContent = p;
        document
            .querySelector(`.sb-row[data-who="${w}"]`)
            .classList.toggle("serving", m.server === w);
    }
    if (bump && who !== null) {
        const el = $(`#sb-points-${who}`);
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
    }
    return label;
}

let calloutTimer = 0;
function callout(text, color = "", small = "") {
    const el = $("#callout");
    el.className = "callout";
    void el.offsetWidth;
    el.innerHTML = `${text}${small ? `<small>${small}</small>` : ""}`;
    el.className = `callout show ${color}`;
    clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => (el.className = "callout"), 1400);
    sound.sfxUI(audio, "stamp");
}

let bannerTimer = 0;
function banner(text, ms = 1400) {
    const el = $("#banner");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove("show"), ms);
}

const tmpV = new THREE.Vector3();
function gradePopup(gradeName, at) {
    const el = $("#grade");
    const text = {
        perfect: "PERFECT!",
        great: "GREAT!",
        nice: "NICE",
        miss: "MISS",
        weak: "OOPS",
    }[gradeName];
    if (!text) return;
    tmpV.copy(at).project(camera);
    el.className = "grade";
    void el.offsetWidth;
    el.textContent = text;
    el.style.left = `${(tmpV.x * 0.5 + 0.5) * window.innerWidth}px`;
    el.style.top = `${(-tmpV.y * 0.5 + 0.5) * window.innerHeight}px`;
    el.className = `grade show ${gradeName}`;
}

function flash(strength = 0.6) {
    const el = $("#flash");
    el.style.transition = "none";
    el.style.opacity = String(strength);
    requestAnimationFrame(() => {
        el.style.transition = "opacity 0.35s ease-out";
        el.style.opacity = "0";
    });
}

function setHint(html) {
    const el = $("#hint");
    if (el.innerHTML !== html) el.innerHTML = html;
}

function setRally(n) {
    const el = $("#rally");
    el.classList.toggle("show", n >= 3);
    $("#rally-count").textContent = n;
    if (n >= 3) {
        el.classList.add("pop");
        setTimeout(() => el.classList.remove("pop"), 120);
    }
}

// --------------------------------------------------------------- events

const VERDICT_CALLS = {
    out: ["OUT!", "red"],
    fault: ["FAULT", "red"],
    "fault-net": ["NET", "red"],
    net: ["NET!", "red"],
    ace: ["ACE!", "yellow"],
    let: ["LET", "blue"],
    "volley-serve": ["FOOT FAULT", "red"],
};

function handleEvents(events) {
    const e0 = state.engine;
    for (const e of events) {
        switch (e.type) {
            case "setup":
                resetTrail(fx);
                state.rally = 0;
                if (!state.attract) {
                    setRally(0);
                    refreshScore(false);
                    if (e.second) banner("Second serve");
                }
                break;
            case "toss":
                sound.sfxToss(audio);
                break;
            case "retoss":
                if (!state.attract && e.who === 0)
                    banner("Hit it near the top of the toss!", 1800);
                break;
            case "charge":
                if (!state.attract && !e.change)
                    sound.chargeStart(audio, e.shot);
                break;
            case "whiff":
                sound.chargeStop(audio);
                sound.sfxSwoosh(audio, 0.8);
                if (!state.attract)
                    gradePopup(
                        "miss",
                        tmpV.copy(players[0].root.position).setY(2.3)
                    );
                break;
            case "hit": {
                sound.chargeStop(audio);
                const shot = SHOTS[e.shot] || SHOTS.topspin;
                const big = e.grade === "perfect";
                sound.sfxHit(audio, e.power, e.grade, e.shot);
                sound.sfxSwoosh(audio, 0.5 + e.power * 0.5);
                const at = new THREE.Vector3(e.x, e.y, e.z);
                hitBurst(fx, at, shot.color, big);
                setTrail(
                    fx,
                    shot.color,
                    big ? 1.6 : 0.6 + e.power * 0.5,
                    big ? 0.16 : 0.07 + e.power * 0.05
                );
                if (big) {
                    state.shake = Math.max(state.shake, 0.35);
                    flash(0.55);
                    cheer(world, 0.3);
                } else if (e.power > 0.8)
                    state.shake = Math.max(state.shake, 0.12);
                if (!state.attract && (e.who === 0 || big))
                    gradePopup(
                        e.grade,
                        tmpV.copy(players[e.who].root.position).setY(2.4)
                    );
                // Opponent split-steps as the ball is struck.
                state.hops[1 - e.who] = 2.4;
                players[e.who].contactHeight = e.y;
                if (!e.serve) {
                    state.rally += 1;
                    if (!state.attract) setRally(state.rally);
                }
                break;
            }
            case "bounce": {
                sound.sfxBounce(audio, e.speed);
                dustPuff(
                    fx,
                    e.x,
                    e.z,
                    Math.min(1.2, e.speed / 18),
                    e.out ? 0xffb3bb : 0xd6e4ff
                );
                bounceMark(fx, e.x, e.z, e.out);
                if (e.index === 1)
                    ring(
                        fx,
                        new THREE.Vector3(e.x, 0.02, e.z),
                        e.out ? 0xff4d5e : 0xffffff,
                        0.9,
                        0.3,
                        true
                    );
                break;
            }
            case "net":
                sound.sfxNet(audio);
                if (!state.attract && e.cord) banner("Net cord!");
                break;
            case "verdict": {
                sound.chargeStop(audio);
                if (state.attract) break;
                const call = VERDICT_CALLS[e.reason];
                if (e.reason === "fault" && e.faults > 0)
                    callout("DOUBLE FAULT", "red");
                else if (call) callout(call[0], call[1]);
                else if (e.reason === "winner")
                    callout(
                        e.winner === 0 ? "WINNER!" : "POINT",
                        e.winner === 0 ? "green" : "blue"
                    );
                if (["out", "fault", "fault-net", "net"].includes(e.reason))
                    sound.sfxCall(audio, "out");
                break;
            }
            case "point": {
                if (state.attract) {
                    cheer(world, 0.6);
                    break;
                }
                const label = refreshScore(true, e.winner);
                const mine = e.winner === 0;
                sound.sfxCall(audio, mine ? "point" : "lost");
                if (mine)
                    sound.sfxCheer(audio, 0.6 + Math.min(1, state.rally / 10));
                else sound.sfxOoh(audio);
                cheer(world, mine ? 1 : 0.4);
                state.hintPoints += 1;
                if (e.match) break;
                setTimeout(() => {
                    if (state.screen !== "playing") return;
                    if (e.game) {
                        callout(
                            "GAME!",
                            e.gameWinner === 0 ? "red" : "blue",
                            `${e.games[0]} – ${e.games[1]}`
                        );
                        sound.sfxCall(audio, "game");
                        const el = $(`#sb-games-${e.gameWinner}`);
                        el.classList.remove("bump");
                        void el.offsetWidth;
                        el.classList.add("bump");
                        cheer(world, 1.2);
                    } else if (label.kind === "advantage") {
                        callout(
                            "ADVANTAGE",
                            label.leader === 0 ? "red" : "blue",
                            label.leader === 0
                                ? state.identity.name
                                : CPU_ROSTER[settings.difficulty].name
                        );
                    } else {
                        const m = e0.match;
                        const isMatchPoint = [0, 1].some(
                            (w) =>
                                m.games[w] === m.gamesToWin - 1 &&
                                m.points[w] >= 3 &&
                                m.points[w] > m.points[1 - w]
                        );
                        callout(
                            label.text,
                            "",
                            isMatchPoint ? "MATCH POINT" : ""
                        );
                    }
                }, 700);
                break;
            }
            case "match": {
                if (state.attract) {
                    startAttract();
                    break;
                }
                const won = e.winner === 0;
                setTimeout(() => {
                    callout(
                        won ? "GAME, SET & MATCH!" : "MATCH OVER",
                        won ? "yellow" : "blue"
                    );
                    sound.sfxCall(audio, won ? "win" : "lose");
                    if (won) {
                        sound.sfxCheer(audio, 1.6);
                        confetti(
                            fx,
                            new THREE.Vector3(
                                players[0].root.position.x,
                                3,
                                players[0].root.position.z
                            )
                        );
                    }
                    cheer(world, 1.4);
                    state.camMode = "winner";
                    state.camT = 0;
                }, 900);
                state.matchEndAt = performance.now() + 3600;
                setRally(0);
                break;
            }
            default:
                break;
        }
    }
}

function showResults() {
    const e = state.engine;
    const m = e.match;
    const won = m.winner === 0;
    state.screen = "results";
    show("results");
    focusMenu("results", 0);
    sound.startMusic(audio, "title");
    $("#result-title").textContent = won
        ? "You win!"
        : `${CPU_ROSTER[settings.difficulty].name} wins!`;
    $("#result-title").style.color = won ? "var(--red)" : "var(--blue)";
    $("#result-score").textContent = `${m.games[0]} – ${m.games[1]}`;
    const s = m.stats;
    const rows = [
        ["Perfect shots", s[0].perfects, s[1].perfects],
        ["Aces", s[0].aces, s[1].aces],
        ["Winners", s[0].winners, s[1].winners],
        ["Faults", s[0].faults, s[1].faults],
    ];
    $("#stats").innerHTML =
        `<span class="h"></span><span class="h v">${state.identity.name.slice(
            0,
            8
        )}</span><span class="h v">${
            CPU_ROSTER[settings.difficulty].name
        }</span>` +
        rows
            .map(
                ([k, a, b]) =>
                    `<span>${k}</span><span class="v">${a}</span><span class="v">${b}</span>`
            )
            .join("") +
        `<span>Longest rally</span><span class="v" style="grid-column: span 2">${m.longestRally} shots</span>`;
}

// --------------------------------------------------------------- per frame

const input = createInput(canvas, document.querySelector(".touch-pad"));
if (window.matchMedia?.("(pointer: coarse)").matches)
    document.body.classList.add("is-touch");
const clock = new THREE.Clock();
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const reticle = { x: 0, z: 0 };
const freezeRng = () => 0.25;

// ?autoplay drives the human through the normal input path (visual QA).
const AUTOPLAY = new URLSearchParams(location.search).has("autoplay");
const bot = { pressed: -1 };
let TIME_SCALE = Number(new URLSearchParams(location.search).get("slow")) || 1;
function botInput() {
    const e = state.engine;
    const h = e.athletes[0];
    let press = null;
    let move = { x: 0, z: 0 };
    const release = false;
    if (e.phase === "serve" && e.match.server === 0 && e.phaseTime > 0.6)
        press = "flat";
    if (
        e.phase === "toss" &&
        e.match.server === 0 &&
        e.ball.v.y < 0.3 &&
        e.ball.v.y > -0.4
    )
        press = "flat";
    if (e.phase === "rally" && e.rally.lastHitter === 1 && e.ball.v.z > 0) {
        if (
            bot.pressed !== e.hitCount &&
            (h.z - e.ball.p.z) / Math.max(1, e.ball.v.z) < 0.85
        ) {
            press = ["flat", "topspin", "slice", "lob", "drop"][e.hitCount % 5];
            bot.pressed = e.hitCount;
            bot.aim = { x: Math.random() * 2 - 1, y: Math.random() - 0.3 };
        }
        if (e.plan) {
            const dx = e.plan.standX - h.x;
            const dz = e.plan.standZ - h.z;
            const d = Math.hypot(dx, dz);
            if (d > 0.3) move = { x: dx / d, z: dz / d };
        }
    }
    return { move, aim: bot.aim || { x: 0, y: 0 }, press, release };
}

function humanInput(raw) {
    if (AUTOPLAY) return botInput();
    // Camera sits behind the near baseline: screen up is -z, screen right is +x.
    const move = { x: raw.x, z: -raw.y };
    let press = null;
    let release = false;
    for (const e of raw.events) {
        if (e.type === "shot") press = e.shot;
        if (e.type === "release") release = true;
    }
    return { move, aim: { x: raw.x, y: raw.y }, press, release };
}

function updateCamera(dt) {
    const e = state.engine;
    const [h] = e.athletes;
    const ball = e.ball;
    state.camT += dt;
    if (state.camMode === "arrive") {
        placeArrivalCamera();
    } else if (state.camMode === "orbit") {
        state.orbit += dt * 0.08;
        camPos.set(
            Math.sin(state.orbit) * 27,
            9.5 + Math.sin(state.orbit * 0.7) * 2,
            Math.cos(state.orbit) * 27
        );
        camLook.set(0, 0.8, 0);
    } else if (state.camMode === "winner") {
        const w = e.athletes[e.match.winner ?? 0];
        const t = Math.min(1, state.camT / 1.4);
        const swing = Math.sin(state.camT * 0.35) * 1.4;
        camPos.set(
            w.x + 1.0 + swing,
            1.7 + (1 - t) * 2,
            w.z - w.side * (5.4 + (1 - t) * 3)
        );
        camLook.set(w.x, 1.35, w.z);
    } else {
        const hx = h.x;
        const hz = Math.max(4, h.z);
        // Tall screens pull back and up so both sidelines stay in view.
        const tall = Math.max(0, Math.min(1, (1 / camera.aspect - 0.8) / 1.2));
        camPos.set(
            hx * (0.55 - tall * 0.25),
            4.9 + tall * 3.2,
            hz + 8.4 + tall * 5.5
        );
        camLook.set(hx * 0.25 + (ball.held ? 0 : ball.p.x * 0.12), 0.3, -3.5);
        if (state.camMode === "intro") {
            // Swoop down from the sky behind the player.
            const t = Math.min(1, state.camT / 2.6);
            const k = 1 - Math.pow(1 - t, 3);
            const from = new THREE.Vector3(-18, 16, 30);
            camPos.lerpVectors(from, camPos, k);
            if (t >= 1) state.camMode = "play";
        }
    }
    const rate =
        state.camMode === "arrive"
            ? 14
            : state.camMode === "play"
              ? 5
              : state.camMode === "winner"
                ? 3
                : 2;
    const a = 1 - Math.exp(-rate * dt);
    state.cam.pos.lerp(camPos, a);
    state.cam.look.lerp(camLook, a);
    camera.position.copy(state.cam.pos);
    if (state.shake > 0) {
        const s = state.shake * state.shake;
        camera.position.x += (Math.random() - 0.5) * s;
        camera.position.y += (Math.random() - 0.5) * s;
        state.shake = Math.max(0, state.shake - dt * 1.6);
    }
    camera.lookAt(state.cam.look);
}

const charging = { aura: 0 };
function updateChargeFx(dt) {
    const e = state.engine;
    const h = e.athletes[0];
    const ch = players[0];
    if (state.attract || !h.pending) {
        fx.aim.visible = false;
        state.chargeFull = false;
        return;
    }
    const shot = SHOTS[h.pending.shot];
    const head = racketHead(ch, tmpV);
    charging.aura += dt;
    // Orbiting motes that tighten as the charge builds.
    const n = h.charge >= 1 ? 3 : 1;
    for (let i = 0; i < n; i++) {
        const a = charging.aura * 14 + i * 2.1;
        const r = 0.45 - h.charge * 0.25;
        emitParticle(fx, {
            x: head.x + Math.cos(a) * r,
            y: head.y + Math.sin(a * 0.7) * r * 0.6,
            z: head.z + Math.sin(a) * r,
            vy: 0.6,
            life: 0.35,
            size: 0.12 + h.charge * 0.1,
            color: i % 2 ? 0xffffff : shot.color,
            shape: 2,
            drag: 1,
        });
    }
    sound.chargeTick(audio, h.charge);
    if (h.charge >= 1 && !state.chargeFull) {
        state.chargeFull = true;
        ring(fx, head.clone(), shot.color, 1.2, 0.25, false);
    }
    // Aim reticle: where a clean hit would go right now.
    const t = rallyTarget(
        h,
        h.pending.shot,
        e.humanAim || { x: 0, y: 0 },
        0.2 + h.charge * 0.8,
        1,
        freezeRng
    );
    reticle.x += (t.x - reticle.x) * Math.min(1, dt * 12);
    reticle.z += (t.z - reticle.z) * Math.min(1, dt * 12);
    fx.aim.visible = true;
    fx.aim.position.set(reticle.x, 0.014, reticle.z);
    const s = 0.9 + Math.sin(performance.now() * 0.012) * 0.06;
    fx.aim.scale.set(s, s, 1);
    fx.aim.material.color.setHex(shot.color);
}

function updateMarker() {
    const e = state.engine;
    const l = e.landing;
    const ball = e.ball;
    const show =
        !state.attract &&
        e.phase === "rally" &&
        l &&
        ball.bounces === 0 &&
        e.rally.lastHitter === 1 &&
        ball.v.z > 0;
    fx.marker.visible = !!show;
    if (show) {
        fx.marker.position.set(l.x, 0.012, l.z);
        const left = Math.max(0, l.t - e.time);
        const s = 0.5 + Math.min(1.2, left * 1.1);
        fx.marker.scale.set(s, s, 1);
        fx.marker.material.opacity = 0.9;
        fx.marker.material.color.setHex(SHOTS[ball.shot]?.color ?? 0xffe14d);
    }
}

function poseAll(dt) {
    const e = state.engine;
    const ball = e.ball;
    for (let i = 0; i < 2; i++) {
        const ath = e.athletes[i];
        const ch = players[i];
        const lateral = (ball.p.x - ath.x) * ath.right;
        let view = ath;
        // The CPU visibly winds up as the ball approaches.
        if (i === 1 || state.attract) {
            const brain = i === 1 ? e.brain : e.autoBrain;
            const plan = brain?.plan;
            const coming =
                ball.v.z * ath.dir < 0 && e.phase === "rally" && !ball.held;
            if (plan && coming && !ath.swing) {
                const dist = Math.abs(ball.p.z - ath.z);
                if (dist < 12)
                    view = {
                        ...ath,
                        state: "charge",
                        charge: Math.min(1, (12 - dist) / 10),
                        stateTime: Math.max(0.2, (12 - dist) / 10),
                    };
            }
        }
        const swingSide =
            e.plan && i === 0 ? e.plan.hand : lateral >= 0 ? 1 : -1;
        const hop = state.hops[i];
        state.hops[i] = 0;
        const mood =
            e.phase === "between" && e.pendingVerdict === null ? null : null;
        poseCharacter(ch, view, {
            dt,
            yawBias:
                Math.max(-0.35, Math.min(0.35, (ball.p.x - ath.x) * 0.04)) *
                (ath.side > 0 ? -1 : -1),
            swingSide,
            contactHeight: ch.contactHeight || 1,
            hopNow: hop,
            headYaw: 0,
            mood,
            ...(i === 0 && state.camMode === "arrive"
                ? { faceYaw: arrive.faceYaw, sink: smoothSink() }
                : {}),
        });
        if (ch.rig) driveVRM(ch, dt);
    }
    // Umpire watches the ball.
    if (umpire) {
        const dx = ball.p.z;
        umpire.head.rotation.y = Math.max(-1, Math.min(1, dx * 0.08));
        umpire.time += dt;
        umpire.body.position.y = Math.sin(umpire.time * 2) * 0.01;
    }
}

// ------------------------------------------------------------ serve gauge
// One bar over the server's head: hold to toss, it fills as the ball rises,
// tops out at the top of the toss, drains as it falls. Release to hit.
const gauge = document.getElementById("serveGauge");
const gaugeFill = gauge.querySelector(".sg-fill");
const gaugeHead = new THREE.Vector3();
const gaugeState = { shown: false, hold: 0, level: 0 };
function updateServeGauge(dt) {
    const e = state.engine;
    const h = e.athletes[0];
    let show = false;
    if (!state.attract && state.screen === "playing" && e.match.server === 0) {
        if (e.phase === "toss") {
            show = true;
            gaugeState.hold = 0;
            gaugeState.level = serveGaugeAt(e.time - e.tossAt);
        } else if (e.phase === "rally" && e.hitCount === 1) {
            // Keep the struck level up for a beat.
            gaugeState.hold += dt;
            show = gaugeState.hold < 0.6;
            gaugeState.level = e.serveGauge ?? gaugeState.level;
        }
    }
    if (show !== gaugeState.shown) {
        gauge.classList.toggle("on", show);
        gaugeState.shown = show;
    }
    if (!show) return;
    gaugeHead.set(h.x, 2.55, h.z).project(camera);
    const x = (gaugeHead.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-gaugeHead.y * 0.5 + 0.5) * window.innerHeight;
    gauge.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    gaugeFill.style.transform = `scaleX(${gaugeState.level.toFixed(3)})`;
    gauge.classList.toggle("max", gaugeState.level >= 0.86);
}

function hints() {
    if (state.attract || state.screen !== "playing") return;
    const e = state.engine;
    if (e.phase === "serve" || e.phase === "toss") {
        if (e.match.server === 0)
            setHint(
                e.phase === "serve"
                    ? `<span>Hold <span class="key">J</span>to toss</span><span><span class="key">A</span><span class="key">D</span>Move</span>`
                    : `<span>Let go when the gauge is full!</span><span><span class="key">←</span><span class="key">→</span>Aim</span>`
            );
        else setHint("");
    } else if (e.phase === "rally" && state.hintPoints < 4) {
        setHint(
            `<span><span class="key">J</span>Hit</span><span><span class="key">K</span>Topspin</span><span><span class="key">H</span>Cut</span><span><span class="key">U</span>Lob</span><span><span class="key">H</span><span class="key">K</span>Drop</span><span>Press early to charge · hold a direction to aim</span>`
        );
    } else setHint("");
}

function frame() {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, clock.getDelta()) * TIME_SCALE;
    const raw = readInput(input);
    handleMenuInput(raw.events);
    const e = state.engine;
    if (!e || !world) return;
    const live = state.screen === "playing" || state.attract;
    if (state.screen === "playing" && !state.paused) {
        const events = update(e, humanInput(raw), dt);
        handleEvents(events);
    } else if (state.attract) {
        handleEvents(
            update(
                e,
                { move: { x: 0, z: 0 }, aim: { x: 0, y: 0 }, press: null },
                dt
            )
        );
    } else if (state.screen === "arrive") {
        updateArrive(raw, dt);
    } else if (state.screen === "intro" || state.screen === "vs") {
        // Players warm up in place.
        for (const a of e.athletes) a.stateTime += dt;
    }
    if (state.screen === "pause") dt = 0.0001;
    if (
        state.matchEndAt &&
        performance.now() > state.matchEndAt &&
        state.screen === "playing"
    ) {
        state.matchEndAt = 0;
        showResults();
    }
    if (state.screen === "results") {
        // Keep the celebration going behind the card.
        update(
            e,
            { move: { x: 0, z: 0 }, aim: { x: 0, y: 0 }, press: null },
            dt
        );
    }
    if (e.freeze <= 0 || !live) poseAll(dt);
    updateChargeFx(dt);
    updateMarker();
    updateServeGauge(dt);
    hints();
    updateCamera(dt);
    updateWorld(world, dt, e.ball.p);
    if (e.phase === "toss" || e.phase === "serve" || e.phase === "setup")
        resetTrail(fx);
    updateFx(
        fx,
        dt,
        camera,
        e.ball.p,
        e.ballVisible && e.phase !== "idle" && e.phase !== "intro"
    );
    renderer.render(scene, camera);
}

// --------------------------------------------------------------- boot

async function bootGame() {
    try {
        const fonts = document.fonts
            ? Promise.race([
                  document.fonts.load("900 40px \"Arial Black\""),
                  new Promise((r) => setTimeout(r, 1500)),
              ])
            : null;
        await fonts;
        setBoot(0.25, "Painting the lines…");
        buildScene();
        startAttract();
        renderer.compile(scene, camera);
        setBoot(0.9, "Warming up…");
        const identity = await host.resolveIdentity();
        loadSettings();
        state.identity = {
            name: identity.name || "You",
            pfp: identity.pfp || "",
        };
        // Play as the visitor's own avatar; the toy body is the fallback.
        const avatarUrl = identity.avatarUrl || params.get("vrm");
        if (avatarUrl) {
            setBoot(0.93, "Suiting up…");
            try {
                const vrm = await Promise.race([
                    loadVRM(avatarUrl, renderer),
                    new Promise((_, reject) =>
                        setTimeout(
                            () => reject(new Error("avatar timeout")),
                            20000
                        )
                    ),
                ]);
                attachVRM(players[0], vrm);
                renderer.compile(scene, camera);
            } catch (err) {
                console.warn(
                    "ACE: avatar unavailable, using the default player",
                    err
                );
            }
        }
        clock.getDelta();
        requestAnimationFrame(frame);
        // Two rendered frames before telling the host we're ready.
        await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r))
        );
        setBoot(1, "Ready!");
        host.ready();
        booted = true;
        setTimeout(() => {
            // A lobby trip may already have staged the arrival view.
            if (state.screen !== "boot") return;
            if (AUTOPLAY) startGame();
            else if (pendingArrival !== undefined) stageArrival(pendingArrival);
            else goTitle();
        }, 250);
    } catch (err) {
        console.error(err);
        host.fail(err && err.message ? err.message : "boot failed");
        $("#boot-text").textContent = "Something went wrong. Please reload.";
    }
}

// The lobby sends its final third-person view just before it reveals us.
let booted = false;
let pendingArrival;
function stageArrival(view) {
    pendingArrival = undefined;
    goArrive(view);
    // Two rendered frames in the new framing before the lobby lets go.
    requestAnimationFrame(() =>
        requestAnimationFrame(() => host.arrivalReady())
    );
}
host.on("entered", () => (arrive.rising = true));
// Someone joined or left the party's room while the formats are open.
host.on("party", () => {
    if (state.screen !== "party") return;
    if (!host.party) return goHome();
    const format = state.partyFormat;
    goParty();
    if (format && partyFormats(partyPlayers().length).some((f) => f.id === format))
        choosePartyFormat(format);
});
host.on("arrival", (view) => {
    if (booted) stageArrival(view);
    else pendingArrival = view;
});

host.on("dispose", () => {
    sound.stopAudio(audio);
    input.dispose();
    renderer.dispose();
    hud.dispose();
    host.dispose();
});

// First interaction anywhere unlocks audio (browsers require a gesture).
const unlock = () => {
    sound.unlockAudio(audio);
    if (state.screen === "title" || state.screen === "results")
        sound.startMusic(audio, "title");
};
window.addEventListener("pointerdown", unlock, { once: true });
window.addEventListener("keydown", unlock, { once: true });

// Safe-area insets from the page, and where the HUD is for the checks.
const hud = createHud(state);

// Read-only diagnostics for automated checks.
window.__ace = {
    state,
    inspect: hud.inspect,
    get engine() {
        return state.engine;
    },
    action,
    set timeScale(v) {
        TIME_SCALE = v;
    },
};

bootGame();
