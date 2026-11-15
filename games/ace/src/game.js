import * as THREE from "three";
import * as sound from "./audio.js";
import {
    createCharacter,
    PALETTES,
    portrait,
    poseCharacter,
    racketHead,
} from "./character.js";
import { COURT, DIFFICULTY, SHOTS } from "./config.js";
import { createEngine, serveGaugeAt, startMatch, update } from "./engine.js";
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
import { tripPlayers } from "@oncyber/game-runtime";
import { readActions } from "./actions.js";
import {
    arrivalShot,
    createBlackout,
    fadeAt,
    FADE_S,
    visibleHeight,
} from "./departure.js";
import {
    buildLineup,
    partyFormats,
    sideLabel,
} from "@oncyber/game-runtime/party";
import { matchAuthority } from "@oncyber/game-runtime/roster";
import { createDuel } from "./duel.js";
import {
    cpuMatchReport,
    createMatchResults,
    versusMatchReport,
} from "./result.js";
import { pointLabel } from "./rules.js";
import { rallyTarget } from "./shots.js";
import { cheer, createWorld, updateWorld } from "./world.js";
import { attachVRM, avatarTextures, driveVRM } from "./vrm.js";
import { createAvatar, createAvatarKit, loadVRM } from "@oncyber/avatar-kit";
import {
    applyCameraPose,
    arrival,
    cameraPose,
    createFollowCamera,
    createJumpInput,
    createWalker,
    dragLook,
    exposeLocomotionProbe,
    updateCamera as easeFollowCamera,
} from "@oncyber/kit-locomotion";
import locomotionUrl from "@oncyber/avatar-kit/motion/locomotion.json?url";
import emotesUrl from "@oncyber/avatar-kit/motion/emotes.json?url";

// ACE! Tennis as a lifecycle game (docs/games.md): the host prepares it,
// enters it with how the visitor arrived and who came along, and owns the
// clock. Input is the actions declared in game.json; saved settings, the
// avatar's bytes and the way back to the lobby are host services. The HUD
// is plain DOM in the game's own document.

const $ = (s) => document.querySelector(s);
/** For playtests: the live game, set while one exists. */
export const debugHooks = {};
/**
 * The party's room, between the host and the game while a game exists
 * (docs/games/avatar-kit.md). The game sets `peers(players)` (the page's
 * `peers` list: poses, names, avatars, who is talking) and `entered()` (the
 * lobby let go: stand up). The host sets `pose(pose)`, which tells the room
 * where the visitor stands, and `link`: the party link (the room's roster,
 * read out of the trip, and the match channel: docs/games/party.md).
 */
export const pageRoom = {};
/**
 * Leaving for the lobby (docs/games/departure.md). The game sets
 * `stage(reason)`: it stands the visitor courtside, fades the court to black
 * around them and resolves with the shot on screen. The host runs it when
 * the page asks for the last frame.
 */
export const pageDeparture = {};
// Loading and pausing (docs/games/loading-and-pausing.md): the host redraws
// on a resize through `redraw()`, even while the game is suspended; asks
// `versus()` whether another person is playing (their match is never
// paused) and `soloMatch()` whether a match against the CPU is in play (it
// stands still while the visitor types; menus and the club don't); and
// passes on `away(hidden)` when the tab is hidden during a versus match.
export const pageFrame = {};

export default function createGame(context) {
    const { graphics, services } = context;
    const signal = context.signal;
    const on = (target, type, listener, options) =>
        target.addEventListener(type, listener, { ...options, signal });
    // Saved values and options from the host, read once in prepare().
    const saved = { settings: null };
    const config = {
        difficulty: null,
        games: null,
        autoplay: false,
        slow: 1,
        check: false,
        partyCheck: false,
    };
    const save = (key, value) =>
        void services
            .call("storage", "set", { key, value }, signal)
            .catch(() => {});
    // Who travelled here together (contract.ts); null alone.
    let trip = null;
    // The party's room: its roster (the trip's, with what changed) and the
    // real-time channel a 1 v 1 is played over.
    const link = pageRoom.link;
    // Game time in seconds: advances with update(), so a suspended or paused
    // match doesn't run its timers.
    let now = 0;
    const timers = [];
    const after = (seconds, run) => timers.push({ at: now + seconds, run });

    // --------------------------------------------------------------- renderer

    const canvas = graphics.canvas;
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance",
    });
    renderer.setPixelRatio(graphics.pixelRatio || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xcfeaff, 90, 320);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);

    // ---------------------------------------------------------------- avatars
    // The avatar kit shows the visitor and the rest of their party as their
    // Oncyber avatars, with the lobby's motion, and stages the arrival pose.
    // Avatar bytes come only through the host's avatar service: the
    // visitor's own and the players in the party's room.
    const ARRIVE_HEIGHT = 1.75;
    const json = (url) => () => fetch(url, { signal }).then((r) => r.json());
    let avatarKtx = null;
    const kit = createAvatarKit({
        services,
        motion: json(locomotionUrl),
        emotes: json(emotesUrl),
        load: (bytes) =>
            loadVRM(bytes, { ktx2: (avatarKtx ??= avatarTextures(renderer)) }),
        height: ARRIVE_HEIGHT,
        // Ace's forward is -z; the kit's avatars face +z.
        heading: Math.PI,
        // The toy player is the visitor's body until their avatar loads.
        standIn: false,
        signal,
    });
    scene.add(kit.group);
    pageRoom.peers = (players) => kit.setPeers(players);
    pageRoom.entered = () => kit.arrival.enter();
    pageFrame.redraw = () => resize();
    pageFrame.versus = () => versusLive();
    pageFrame.soloMatch = () => state.screen === "playing" && !versusLive();
    pageFrame.away = (hidden) => duel.hidden(hidden);

    const size = { w: 0, h: 0 };
    const courtFov = () => (camera.aspect < 1 ? 58 : 42);
    function resize() {
        const w = (size.w = graphics.width || 1);
        const h = (size.h = graphics.height || 1);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // Keep the whole court in frame on tall screens. The arrival view keeps
        // the lobby's own field of view instead (set in placeArrivalCamera).
        if (state?.camMode !== "arrive") camera.fov = courtFov();
        camera.updateProjectionMatrix();
        // Resizing clears the canvas; redraw now instead of showing an empty
        // frame until the next animation frame.
        if (!world) return;
        // The lobby's field of view depends on the width.
        if (state?.camMode === "arrive" && state.engine) placeArrivalCamera();
        if (leaving.active) renderLeaving();
        else renderer.render(scene, camera);
    }

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
    function applySettings(value) {
        if (DIFFICULTY[value?.difficulty])
            settings.difficulty = value.difficulty;
        if ([1, 2, 3].includes(value?.games)) settings.games = value.games;
    }
    // Saved settings come from the host's storage; its options win.
    function loadSettings() {
        try {
            applySettings(JSON.parse(saved.settings || "{}"));
        } catch {
            /* malformed */
        }
        applySettings({ difficulty: config.difficulty });
        applySettings({ games: config.games });
    }

    // Sound goes through the runtime's output (docs/games/sound.md): the
    // page owns volume, mute and the first gesture; the session silences it
    // on suspend.
    const output = context.audio;
    const audio = sound.createAudio(output);

    // --------------------------------------------------------------- scene

    const boot = { progress: 0 };
    function setBoot(value, text) {
        boot.progress = value;
        $("#boot-fill").style.width = `${Math.round(value * 100)}%`;
        if (text) $("#boot-text").textContent = text;
        // The page shows the same steps until the first frame.
        context.loading?.progress(value, $("#boot-text").textContent);
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
        inputPaused: false,
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
    // The camera looks down the court at the net (the kit's yaw 0 looks
    // down -z).
    const ARRIVE_FACING = 0;
    // Walking here is the lobby's: the locomotion kit owns pace, jump and
    // camera; the court only says where the walls are. Its input is the
    // declared actions (up/down/left/right, run, jump, lookX/lookY), so the
    // keyboard, the touch stick and buttons and a gamepad all walk the same.
    const arrive = {
        came: false, // this visit started as a lobby trip
        walker: createWalker(ARRIVE_SPOT, {
            scale: ARRIVE_HEIGHT / 1.8,
            constrain(s) {
                s.x = Math.max(
                    -ARRIVE_BOUNDS.x,
                    Math.min(ARRIVE_BOUNDS.x, s.x)
                );
                s.z = Math.max(
                    ARRIVE_BOUNDS.zMin,
                    Math.min(ARRIVE_BOUNDS.zMax, s.z)
                );
            },
        }),
        // The follow camera `arrival` hands back: the lobby's last frame,
        // easing into its follow camera once the visitor moves or looks.
        camera: createFollowCamera({ scale: ARRIVE_HEIGHT / 1.8 }),
        jump: createJumpInput(),
        faceYaw: 0,
        lift: 0, // height of a jump
        walked: 0,
        poseAt: 0,
    };
    // How far the toy player (no avatar) sinks in the kit's arrival crouch.
    const ARRIVE_SINK = 0.42;
    // Leaving for the lobby: stood courtside while the world fades to black.
    const leaving = { active: false, from: 0, staged: null };
    const blackout = createBlackout(renderer, scene);
    resize();

    function buildScene() {
        world = createWorld(scene);
        setBoot(0.5, "Seating the crowd…");
        fx = createFx(scene);
        const human = createCharacter(PALETTES[0]);
        const cpu = createCharacter(CPU_ROSTER[settings.difficulty].palette);
        scene.add(human.root, cpu.root);
        // The kit's avatar faces +z; the character's forward is -z.
        kit.self.root.rotation.y = Math.PI;
        human.root.add(kit.self.root);
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
        umpire.root.position.set(
            world.umpireSeat.x,
            world.umpireSeat.y - 0.66,
            0
        );
        umpire.root.rotation.y = -Math.PI / 2;
        scene.add(umpire.root);
        setBoot(0.75, "Stringing rackets…");
    }

    // The far player's body: the CPU's toy player, or in a 1 v 1 the other
    // member's avatar when it loads.
    let foeLook = 0;
    let foeAvatar = null;
    function swapFoe(palette) {
        foeLook++;
        foeAvatar?.dispose();
        foeAvatar = null;
        const fresh = createCharacter(palette);
        scene.remove(players[1].root);
        players[1] = fresh;
        scene.add(fresh.root);
        return fresh;
    }

    function setCpuLook(difficulty) {
        swapFoe(CPU_ROSTER[difficulty].palette);
    }

    /** The other player's body: their avatar when it loads, else the toy one. */
    function setFoeLook(member) {
        const fresh = swapFoe(PALETTES[1]);
        const mine = foeLook;
        if (!member?.avatarUrl) return;
        // Bytes only through the host's avatar service, as the kit's are.
        services
            .avatar(member.avatarUrl, signal)
            .then((bytes) =>
                loadVRM(bytes, {
                    ktx2: (avatarKtx ??= avatarTextures(renderer)),
                })
            )
            .then((vrm) => {
                if (mine !== foeLook || players[1] !== fresh)
                    return vrm.dispose?.();
                foeAvatar = createAvatar({
                    height: ARRIVE_HEIGHT,
                    standIn: false,
                });
                foeAvatar.attach(vrm);
                foeAvatar.manual = true;
                attachVRM(fresh, foeAvatar);
            })
            .catch(() => {});
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

    function goArrive(view) {
        // The one place the lobby's view becomes a camera here: the
        // locomotion kit's arrival helper turns the lobby's last frame to
        // look down the court. Its travel camera sits in front of the
        // avatar, so a visitor arrives facing the camera with the court
        // behind them, as they left. With no view (back from a match, or
        // on the way out) it is the lobby's follow camera behind the
        // visitor. The avatar kit stages the pose around it (below), and
        // the departure reads this same camera back.
        const arrived = arrival(view, {
            at: ARRIVE_SPOT,
            facing: ARRIVE_FACING,
            avatarHeight: ARRIVE_HEIGHT,
        });
        // Courtside is not a match: a 1 v 1 left this way goes to the CPU.
        if (duel.state === "playing") duel.leave();
        // Nor is it a finished one: a match left for it reports nothing.
        matchResults.abandon();
        state.versus = null;
        arrive.came = true;
        arrive.camera = arrived.camera;
        arrive.jump.clear();
        arrive.walker.place({
            ...ARRIVE_SPOT,
            y: 0,
            rotation: arrived.avatarRotation,
        });
        arrive.faceYaw = arrived.avatarRotation;
        arrive.lift = 0;
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
        // The arrival pose: crouched as the lobby left them (when it sent
        // its view), facing its camera, and no racket in hand around the
        // club. They stand up when the lobby lets go (pageRoom.entered).
        players[0].racket.visible = false;
        kit.arrival.stage(view);
        kit.emote("");
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

    function placeArrivalCamera() {
        const me = state.engine.athletes[0];
        // The camera follows the ground under the visitor, not a jump.
        const pose = cameraPose(
            arrive.camera,
            { x: me.x, y: 0, z: me.z },
            size.w || 1280
        );
        // The court keeps its own near plane; the rest is the lobby's camera.
        applyCameraPose(camera, pose, { near: false });
        camPos.copy(pose.position);
        camLook.copy(pose.target);
    }

    function updateArrive(raw, dt) {
        const me = state.engine.athletes[0];
        // While leaving the last frame holds still, camera included.
        if (leaving.active) return;
        // Stay put until standing (the kit stands the avatar up on `entered`).
        const still = kit.arrival.crouch > 0;
        // Dragging on the court looks around as in the lobby (the declared
        // `lookX` / `lookY`, in hundreds of pixels).
        const { lookX, lookY = 0 } = context.deltas;
        if (!still && (lookX || lookY))
            dragLook(arrive.camera, lookX * 100, lookY * 100);
        if (!still && context.pressed.jump) arrive.jump.queue();
        // The declared directions lean 0 to 1 (a key is 1), relative to
        // the camera; the kit's forward is -1 ahead.
        const strafe = still ? 0 : raw.x;
        const forward = still ? 0 : -raw.y;
        const moving = Math.abs(strafe) + Math.abs(forward) > 0.05;
        easeFollowCamera(arrive.camera, dt, moving);
        const controls = {
            strafe,
            forward,
            yaw: arrive.camera.yaw,
            running: !still && context.input.run > 0,
            jump: !still && arrive.jump.read(dt),
        };
        const from = { x: me.x, z: me.z };
        const shown = arrive.walker.advance(dt, controls);
        const velocity = arrive.walker.velocity(controls.yaw);
        me.x = shown.x;
        me.z = shown.z;
        me.vx = velocity.x;
        me.vz = velocity.z;
        arrive.walked += Math.hypot(me.x - from.x, me.z - from.z);
        me.stateTime += dt;
        arrive.lift = shown.y;
        arrive.faceYaw = shown.rotation;
        // The walker already eases the turn; don't ease it twice.
        players[0].yaw = shown.rotation;
        // Emotes around the club (declared actions): wave while held, dance,
        // sit; walking ends them.
        if (!still) {
            if (context.pressed.wave) kit.self.motion = { wave: true };
            else if (context.pressed.dance) kit.emote("HIPHOP");
            else if (context.pressed.sit) kit.emote("SITTING");
            if (kit.self.motion.wave && !(context.input.wave > 0))
                kit.self.motion = {};
        }
        // The lobby's motion: walk and run by speed (in the lobby's metres
        // per second), in the air during a jump; moving ends an emote.
        const pace = arrive.walker.speed();
        if (!shown.floor) kit.self.motion = { air: true, speed: pace };
        else if (moving || !(kit.self.motion.emote || kit.self.motion.wave))
            kit.self.motion = { speed: pace };
        // Tell the party's room where the visitor stands, ten times a second.
        const at = performance.now();
        if (at - arrive.poseAt > 100) {
            arrive.poseAt = at;
            pageRoom.pose?.(
                kit.pose({ x: me.x, y: arrive.lift, z: me.z }, players[0].yaw)
            );
        }
    }

    // `pnpm games:check` walks here and compares the pace with the lobby's
    // (docs/games/locomotion.md). Not on the way out, and only courtside.
    exposeLocomotionProbe(
        () =>
            state?.screen === "arrive" && !leaving.active
                ? arrive.walker
                : null,
        () => {
            if (booted && !leaving.active && state.screen !== "arrive")
                goArrive(null);
        }
    );

    // A party that arrived together picks a format before anything else.
    // Everyone in the party, the visitor first. Once the party's room has other
    // members, its roster decides (ids every member sees the same way, so the
    // draw matches on every screen); until then, the members the lobby named.
    function partyPlayers() {
        return tripPlayers(trip, {
            name: `${state.identity.name || "You"} (you)`,
        });
    }

    const memberName = (id) =>
        link.roster.members.find((m) => m.id === id)?.name ?? "Player";

    /** What this visitor can pick right now, best first; solo is always last. */
    function partyOptions() {
        const roster = link.roster;
        // Past the eighth arrival a member watches or plays the house.
        const watching =
            roster.members.find((m) => m.id === roster.self)?.seat ===
            "spectator";
        const count = trip ? (watching ? 1 : partyPlayers().length) : 1;
        const formats = partyFormats(count, {
            label: trip ? "Solo vs CPU" : "Play match",
            blurb: "A match against the house.",
        });
        if (duel.mine)
            formats.unshift({
                id: "rejoin",
                label: "Rejoin your match",
                blurb: `Take your side back against ${memberName(
                    duel.mine.from
                )}.`,
                solo: false,
            });
        if (duel.live)
            formats.unshift({
                id: "watch",
                label: `Watch ${duel.live.players.map(memberName).join(" v ")}`,
                blurb: "Sit courtside for the match being played.",
                solo: false,
            });
        return formats;
    }

    /** The offers that come and go with other members' matches. */
    const partyOffers = () => `${!!duel.live}${!!duel.mine}`;

    function goParty() {
        state.screen = "party";
        show("party");
        const everyone = partyPlayers();
        $("#party-title").textContent = `Party of ${everyone.length}`;
        $("#party-names").textContent = everyone.map((p) => p.name).join(" · ");
        const formats = partyOptions();
        state.partyOffers = partyOffers();
        const list = $("#party-formats");
        list.replaceChildren(
            ...formats.map((format) => {
                const button = document.createElement("button");
                button.className = "oui-list__item";
                button.dataset.format = format.id;
                button.setAttribute("aria-pressed", "false");
                const body = document.createElement("span");
                body.className = "oui-list__body";
                const blurb = document.createElement("span");
                blurb.className = "oui-list__meta";
                blurb.textContent = format.blurb;
                body.append(format.label, blurb);
                button.append(body);
                return button;
            })
        );
        $("#party-lineup").hidden = true;
        $("#party-note").hidden = true;
        state.partyFormat = null;
        state.partyIndex = 0;
        focusPartyFormat(0);
    }

    // The formats are a keyboard menu too: arrows move, Space picks. The
    // kit draws its focus ring on data-oui-focus.
    const partyItems = () => [
        ...document.querySelectorAll("#party-formats [data-format]"),
    ];
    function focusPartyFormat(index) {
        const items = partyItems();
        if (!items.length) return;
        state.partyIndex = (index + items.length) % items.length;
        items.forEach((b, i) =>
            b.toggleAttribute("data-oui-focus", i === state.partyIndex)
        );
    }

    const PARTY_NOTE =
        "The draw is ready. Playing it through is the next step; 1 v 1 between two is live.";
    function partyNote(text) {
        $("#party-note").textContent = text;
        $("#party-note").hidden = !text;
    }

    function choosePartyFormat(format) {
        if (format !== "singles") duel.cancel();
        if (format === "solo") return goSetup();
        if (format === "watch" || format === "rejoin") {
            if (!(format === "watch" ? duel.watch() : duel.rejoin())) goParty();
            return;
        }
        const everyone = partyPlayers();
        const lineup = buildLineup(format, everyone, trip.id);
        if (!lineup) return;
        state.partyFormat = format;
        const box = $("#party-lineup");
        box.replaceChildren(
            ...lineup.rounds.flatMap((round) => {
                const title = document.createElement("h3");
                title.className = "oui-label";
                title.textContent = round.name;
                return [
                    title,
                    ...round.matches.map(([a, b]) => {
                        const line = document.createElement("p");
                        const left = sideLabel(a, lineup.rounds);
                        const right = sideLabel(b, lineup.rounds);
                        line.className = "oui-text";
                        line.textContent = `${left} v ${right}`;
                        return line;
                    }),
                ];
            })
        );
        box.hidden = false;
        if (format === "singles") {
            // Both pick it, then the match starts on both screens.
            const other = everyone[1];
            const here = link.roster.members.length > 1;
            partyNote(
                here
                    ? `Waiting for ${
                          other?.name ?? "the other player"
                      } to pick 1 v 1…`
                    : `${
                          other?.name ?? "The other player"
                      } hasn't arrived yet. The match starts when they pick 1 v 1.`
            );
            duel.want(settings.games);
        } else partyNote(PARTY_NOTE);
        const items = partyItems();
        items.forEach((b) =>
            b.setAttribute("aria-pressed", String(b.dataset.format === format))
        );
        focusPartyFormat(items.findIndex((b) => b.dataset.format === format));
    }

    // ------------------------------------------------ results (result.js)
    // Every finished match reports exactly one result
    // (docs/games/results.md): a match opens when it starts, closes with
    // one report when it has a winner, and reports nothing when it is left
    // first. The host's `results` service holds the reporter. Format ids
    // are the shared party formats'.
    const FORMAT = {
        solo: partyFormats(1).find((f) => f.solo).id,
        singles: partyFormats(2)[0].id,
    };
    const matchResults = createMatchResults((operation, value) =>
        services.call("results", operation, value, signal)
    );
    /** Once per frame: the open match has a winner, so send its one result. */
    const settleResult = () =>
        !state.attract &&
        matchResults.settle(state.engine?.match, () =>
            // Room ids from the roster, so every member's page sees the
            // same players.
            state.versus
                ? versusMatchReport({
                      format: FORMAT.singles,
                      match: state.engine.match,
                      players: duel.players,
                      // This side's seat in the match, even while offline.
                      selfId: duel.players.find((id) => id !== duel.foe),
                      nameOf: memberName,
                  })
                : cpuMatchReport({
                      format: FORMAT.solo,
                      match: state.engine.match,
                      name: state.identity.name,
                      selfId: link.roster.self,
                      foe: CPU_ROSTER[settings.difficulty].name,
                      difficulty: settings.difficulty,
                  })
        );

    // --------------------------------------------------- 1 v 1 (duel.js)

    const duel = createDuel({
        link,
        pick: matchAuthority,
        settings: () => settings,
        hooks: {
            start: (info) => startVersus(info),
            note: (text) => versusNote(text),
            over: () => {
                // The match being watched ended or its players left.
                state.versus = null;
                if (leaving.active) return;
                if (trip) goParty();
                else goHome();
            },
        },
    });

    /** True while another person is on the far side (no pausing them). */
    const versusLive = () =>
        duel.state === "playing" &&
        !(duel.role === "authority" && duel.standIn);
    // Another member's name reaches the HUD through innerHTML in two places.
    const escapeHTML = (text) =>
        String(text).replace(
            /[&<>"']/g,
            (c) =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                }[c])
        );
    const foeName = () =>
        state.versus
            ? state.versus.names[1]
            : CPU_ROSTER[settings.difficulty].name;

    function versusNote(text) {
        if (!text || leaving.active) return;
        if (["playing", "pause", "intro"].includes(state.screen))
            banner(text, 2400);
        else if (state.screen === "party") partyNote(text);
        else if (state.screen === "results")
            $("#result-note").textContent = text;
    }

    function startVersus({ role, players: ids, resume }) {
        // Leaving for the lobby: the last frame holds, no match starts.
        if (leaving.active) return duel.leave();
        const roster = link.roster;
        const member = (id) => roster.members.find((m) => m.id === id);
        // Athlete 0 is this player; a spectator sees the authority's court.
        const near = role === "watch" ? duel.authority() : roster.self;
        const far = ids.find((id) => id !== near);
        const me = state.identity;
        const face = (id) =>
            member(id)?.pfp || portrait(PALETTES[id === near ? 0 : 1]);
        state.versus = {
            role,
            names: [
                role === "watch" ? memberName(near) : me.name,
                memberName(far),
            ],
            faces: [
                role === "watch" ? face(near) : me.pfp || face(near),
                face(far),
            ],
        };
        state.attract = false;
        state.paused = false;
        state.engine = duel.engine;
        // A player's match opens under the id both sides share.
        matchResults.versus({ role, resume }, duel.match);
        players[0].racket.visible = true;
        kit.arrival.fillHands();
        actions.shotHeld = false;
        for (const w of [0, 1]) {
            $(`#sb-name-${w}`).textContent = state.versus.names[w];
            $(`#vs-name-${w}`).textContent = state.versus.names[w];
            for (const el of [$(`#sb-face-${w}`), $(`#vs-face-${w}`)])
                el.style.backgroundImage = `url("${state.versus.faces[w]}")`;
        }
        $("#vs-tag").textContent = role === "watch" ? "Watching" : "1 v 1";
        $("#result-note").textContent = "";
        refreshScore(false);
        if (resume) {
            // A change of hands mid-match: no intro, straight back to the court.
            if (state.screen !== "pause") {
                state.screen = "playing";
                show("hud");
            }
            state.camMode = "play";
            return;
        }
        setFoeLook(member(far));
        state.rally = 0;
        state.hintPoints = 0;
        state.matchEndAt = 0;
        resetTrail(fx);
        if (role === "authority") state.engine.phase = "intro";
        state.screen = "vs";
        show("vs");
        sound.startMusic(audio, "soft");
        sound.sfxUI(audio, "stamp");
        state.camMode = "intro";
        resize();
        state.camT = 0;
        const engine = state.engine;
        after(1.9, () => {
            if (state.screen !== "vs" || state.engine !== engine) return;
            show("hud");
            state.screen = "intro";
            callout("READY?", "yellow");
            sound.sfxCall(audio, "ready");
            after(1.1, () => {
                if (state.screen !== "intro" || state.engine !== engine) return;
                callout("PLAY!", "green");
                sound.sfxCall(audio, "go");
                sound.startMusic(audio, "match");
                sound.setCrowd(audio, 0.35);
                cheer(world, 0.8);
                state.screen = "playing";
                if (duel.role === "authority" && engine.phase === "intro") {
                    engine.phase = "setup";
                    engine.phaseTime = 0;
                }
                state.camMode = "play";
            });
        });
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
        // Arrow-key focus: the kit draws its ring on data-oui-focus.
        [
            ...document.querySelectorAll("#setup .choice"),
            document.querySelector("#setup .go"),
        ].forEach((el, i) =>
            el.toggleAttribute("data-oui-focus", i === state.setupField)
        );
        save("settings", JSON.stringify(settings));
    }

    function startAttract() {
        if (duel.state === "playing") duel.leave();
        // Back at the title: a match left unfinished reports nothing.
        matchResults.abandon();
        state.versus = null;
        state.attract = true;
        if (players) players[0].racket.visible = true;
        kit.arrival.fillHands();
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
        if (duel.state !== "idle") duel.leave();
        state.versus = null;
        setCpuLook(settings.difficulty);
        state.attract = false;
        players[0].racket.visible = true;
        kit.arrival.fillHands();
        state.engine = createEngine({
            difficulty: settings.difficulty,
            games: settings.games,
            seed: (Math.random() * 1e9) | 0,
        });
        startMatch(state.engine);
        matchResults.begin();
        state.engine.phase = "intro";
        state.rally = 0;
        state.hintPoints = 0;
        state.matchEndAt = 0;
        resetTrail(fx);
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
        after(1.9, () => {
            if (state.screen !== "vs") return;
            show("hud");
            state.screen = "intro";
            callout("READY?", "yellow");
            sound.sfxCall(audio, "ready");
            after(1.1, () => {
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
            });
        });
    }

    function pauseGame() {
        if (state.screen !== "playing") return;
        // Another person is playing: the menu opens over a match that goes on.
        state.paused = !versusLive();
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
        sound.sfxUI(audio, "ok");
    }

    // The Sound buttons ask the page; its answer updates the labels.
    function toggleSound() {
        output.requestMuted(!output.muted);
        sound.sfxUI(audio, "ok");
    }
    function refreshSoundLabels() {
        $("#sound-label").textContent = output.muted ? "Off" : "On";
        for (const el of document.querySelectorAll(".sound-label"))
            el.textContent = output.muted ? "Off" : "On";
    }
    const stopSoundLabels = output.onChange(refreshSoundLabels);
    refreshSoundLabels();

    function action(name) {
        void output.unlock();
        switch (name) {
            case "play":
                sound.sfxUI(audio, "ok");
                if (trip) goParty();
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
                } else {
                    duel.cancel();
                    goHome();
                }
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
                if (duel.state !== "idle") duel.leave();
                state.versus = null;
                goHome();
                break;
            case "lobby":
                leave();
                break;
            case "rematch":
                sound.sfxUI(audio, "ok");
                // Against a person who is still here, both ask again.
                if (
                    state.versus &&
                    state.versus.role !== "watch" &&
                    !duel.standIn
                ) {
                    duel.want(settings.games);
                    $("#result-note").textContent = `Waiting for ${foeName()}…`;
                } else startGame();
                break;
            default:
                break;
        }
    }

    const leave = () =>
        void services.call("travel", "lobby", null, signal).catch(() => {});

    on(document, "click", (e) => {
        const b = e.target.closest("[data-action]");
        if (b) action(b.dataset.action);
        const format = e.target.closest("#party-formats [data-format]");
        if (format) {
            void output.unlock();
            sound.sfxUI(audio, "ok");
            choosePartyFormat(format.dataset.format);
        }
        const choice = e.target.closest(".choice button");
        if (choice) {
            void output.unlock();
            sound.sfxUI(audio, "move");
            if (choice.parentElement.id === "opt-difficulty")
                settings.difficulty = choice.dataset.value;
            else settings.games = Number(choice.dataset.value);
            refreshSetup();
        }
    });
    on($("#pause-btn"), "click", () => {
        void output.unlock();
        pauseGame();
    });
    on($("#lobby"), "click", leave);

    function menuNav(name, dir) {
        if (dir === "up" || dir === "left")
            focusMenu(name, menus[name].index - 1);
        else focusMenu(name, menus[name].index + 1);
        sound.sfxUI(audio, "move");
    }
    function menuConfirm(name) {
        const items = [...document.querySelectorAll(`${menus[name].el} .pill`)];
        items[menus[name].index]?.click();
    }

    function handleMenuInput(events) {
        for (const e of events) {
            if (e.type === "confirm" || e.type === "shot" || e.type === "nav")
                void output.unlock();
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
                            (state.setupField +
                                (e.dir === "down" ? 1 : -1) +
                                3) %
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
                                    Math.min(
                                        2,
                                        i + (e.dir === "right" ? 1 : -1)
                                    )
                                )
                            ];
                    }
                    sound.sfxUI(audio, "move");
                    refreshSetup();
                }
                if (e.type === "confirm") action("start");
                if (e.type === "back") action("back");
            } else if (s === "arrive") {
                // Arrows and WASD walk and Space jumps here, as in the
                // lobby, so confirm acts only when it is not that jump
                // (J, the OK button, a gamepad's A).
                if (e.type === "confirm" && !context.pressed.jump)
                    action("play");
            } else if (s === "party") {
                if (e.type === "nav")
                    focusPartyFormat(
                        state.partyIndex +
                            (e.dir === "up" || e.dir === "left" ? -1 : 1)
                    );
                if (e.type === "confirm")
                    partyItems()[state.partyIndex]?.click();
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
        el.style.left = `${(tmpV.x * 0.5 + 0.5) * size.w}px`;
        el.style.top = `${(-tmpV.y * 0.5 + 0.5) * size.h}px`;
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
                        sound.sfxCheer(
                            audio,
                            0.6 + Math.min(1, state.rally / 10)
                        );
                    else sound.sfxOoh(audio);
                    cheer(world, mine ? 1 : 0.4);
                    state.hintPoints += 1;
                    if (e.match) break;
                    after(0.7, () => {
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
                                    : escapeHTML(foeName())
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
                    });
                    break;
                }
                case "match": {
                    if (state.attract) {
                        startAttract();
                        break;
                    }
                    const won = e.winner === 0;
                    after(0.9, () => {
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
                    });
                    state.matchEndAt = now + 3.6;
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
        $("#result-note").textContent = "";
        state.screen = "results";
        show("results");
        focusMenu("results", 0);
        sound.startMusic(audio, "title");
        const watching = state.versus?.role === "watch";
        $("#result-title").textContent = watching
            ? `${state.versus.names[m.winner ?? 0]} wins!`
            : won
            ? "You win!"
            : `${foeName()} wins!`;
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
            )}</span><span class="h v">${escapeHTML(
                foeName().slice(0, 8)
            )}</span>` +
            rows
                .map(
                    ([k, a, b]) =>
                        `<span>${k}</span><span class="v">${a}</span><span class="v">${b}</span>`
                )
                .join("") +
            `<span>Longest rally</span><span class="v" style="grid-column: span 2">${m.longestRally} shots</span>`;
    }

    // --------------------------------------------------------------- per frame

    const actions = { shotHeld: false };
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();
    const reticle = { x: 0, z: 0 };
    const freezeRng = () => 0.25;

    // The host's autoplay option drives the human through the normal input
    // path (visual QA).
    const bot = { pressed: -1 };
    const IDLE_INPUT = {
        move: { x: 0, z: 0 },
        aim: { x: 0, y: 0 },
        press: null,
        release: false,
    };
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
        // Against another bot (a check's 1 v 1) it lets every sixth ball go,
        // or the rally would never end.
        const tired = duel.state === "playing" && e.hitCount % 6 === 5;
        if (
            e.phase === "rally" &&
            e.rally.lastHitter === 1 &&
            e.ball.v.z > 0 &&
            !tired
        ) {
            if (
                bot.pressed !== e.hitCount &&
                (h.z - e.ball.p.z) / Math.max(1, e.ball.v.z) < 0.85
            ) {
                press = ["flat", "topspin", "slice", "lob", "drop"][
                    e.hitCount % 5
                ];
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
        if (state.versus?.role === "watch") return IDLE_INPUT;
        // Under pnpm games:check nobody is at the keyboard: a 1 v 1 plays
        // itself.
        if (config.autoplay || (config.check && duel.state === "playing"))
            return botInput();
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
            // The lobby's camera is rigid to the avatar: no extra easing.
            placeArrivalCamera();
            state.cam.pos.copy(camPos);
            state.cam.look.copy(camLook);
            return;
        }
        if (camera.fov !== courtFov()) {
            camera.fov = courtFov();
            camera.updateProjectionMatrix();
        }
        if (state.camMode === "orbit") {
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
            const tall = Math.max(
                0,
                Math.min(1, (1 / camera.aspect - 0.8) / 1.2)
            );
            camPos.set(
                hx * (0.55 - tall * 0.25),
                4.9 + tall * 3.2,
                hz + 8.4 + tall * 5.5
            );
            camLook.set(
                hx * 0.25 + (ball.held ? 0 : ball.p.x * 0.12),
                0.3,
                -3.5
            );
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
            state.camMode === "play" ? 5 : state.camMode === "winner" ? 3 : 2;
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
            fx.marker.material.color.setHex(
                SHOTS[ball.shot]?.color ?? 0xffe14d
            );
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
                // A person on the far side poses from what they are doing.
                const brain =
                    i === 1
                        ? e.rival || e.remote
                            ? null
                            : e.brain
                        : e.autoBrain;
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
                e.phase === "between" && e.pendingVerdict === null
                    ? null
                    : null;
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
                    ? {
                          faceYaw: arrive.faceYaw,
                          sink: kit.arrival.crouch * ARRIVE_SINK,
                          lift: arrive.lift,
                      }
                    : {}),
            });
            // Around the club the kit animates the visitor's avatar with the
            // lobby's clips; in a match the tennis pose drives it.
            const clubWalk = i === 0 && state.camMode === "arrive";
            if (i === 0 && ch.rig && kit.self.manual !== !clubWalk) {
                kit.self.manual = !clubWalk;
                kit.self.rest();
            }
            if (ch.rig && !clubWalk) driveVRM(ch, dt);
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
        if (
            !state.attract &&
            state.screen === "playing" &&
            e.match.server === 0
        ) {
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
        const x = (gaugeHead.x * 0.5 + 0.5) * size.w;
        const y = (-gaugeHead.y * 0.5 + 0.5) * size.h;
        gauge.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(
            1
        )}px)`;
        gaugeFill.style.transform = `scaleX(${gaugeState.level.toFixed(3)})`;
        gauge.classList.toggle("max", gaugeState.level >= 0.86);
    }

    function hints() {
        if (state.attract || state.screen !== "playing") return;
        if (state.versus?.role === "watch") return setHint("");
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

    function frame(seconds) {
        let dt = Math.min(0.05, seconds) * config.slow;
        if (graphics.width !== size.w || graphics.height !== size.h) resize();
        const raw = readActions(context, actions);
        if (!leaving.active) handleMenuInput(raw.events);
        const e = state.engine;
        if (!e || !world) return;
        // A 1 v 1 runs through the duel, whatever menu is open over it.
        const versus = duel.state === "playing" && e === duel.engine;
        // While the visitor types in the page during a match against the
        // CPU, or the page's menu is open or the tab is hidden with nobody
        // else playing, the host has suspended the game and no frame runs
        // (one pause: suspend() below). A match another person is playing
        // goes on, and this side's player stands idle.
        // Timers run on game time and stop with the pause menu (which
        // opens over a match another person is playing, without stopping it).
        const held = state.screen === "pause" && state.paused;
        if (!held) now += dt;
        for (const timer of timers.filter((t) => t.at <= now)) {
            timers.splice(timers.indexOf(timer), 1);
            timer.run();
        }
        const live = state.screen === "playing" || state.attract;
        if (state.screen === "party" && state.partyOffers !== partyOffers()) {
            const format = state.partyFormat;
            goParty();
            if (format && partyOptions().some((f) => f.id === format))
                choosePartyFormat(format);
        }
        if (versus) {
            const playing = state.screen === "playing" && !state.inputPaused;
            handleEvents(
                duel.frame(playing ? humanInput(raw) : IDLE_INPUT, dt, held)
            );
        } else {
            // In menus this only keeps the channel alive (a pick, a watch
            // offer).
            duel.frame(IDLE_INPUT, dt);
        }
        if (versus) {
            // The duel moved it.
        } else if (state.screen === "playing" && !state.paused) {
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
        if (held) dt = 0.0001;
        settleResult();
        if (
            state.matchEndAt &&
            now > state.matchEndAt &&
            state.screen === "playing"
        ) {
            state.matchEndAt = 0;
            showResults();
        }
        if (state.screen === "results" && !versus) {
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
        // The rest of the party stands around the club, not on a live court.
        kit.group.visible =
            state.screen === "arrive" || state.screen === "party";
        kit.update(dt, camera);
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
        if (leaving.active) renderLeaving();
        else renderer.render(scene, camera);
    }

    // -------------------------------------------------------------- departure
    // The way back to the lobby always starts courtside, in the walkable
    // arrival state, whatever screen the visitor left from: the mirror of
    // goArrive, on the same kit state. The kit's arrival is stood up with
    // empty hands, the camera is the kit's arrival framing around the
    // visitor, and the view handed to the page is read back from them.

    function stageDeparture() {
        if (!booted) throw new Error("ACE_NOT_READY");
        // A 1 v 1 or the wait for one ends here: the other player gets the
        // CPU, and nothing starts while the last frame holds.
        if (duel.state !== "idle") duel.leave();
        state.versus = null;
        if (state.screen !== "arrive") goArrive(null);
        // Standing and still, even when leaving before the arrival crouch
        // has risen; no emote either.
        if (kit.arrival.crouch > 0) kit.arrival.stage(null);
        kit.emote("");
        // On the ground and at rest: a jump or a walk ends here.
        const me = state.engine.athletes[0];
        arrive.walker.place({ y: 0 });
        arrive.jump.clear();
        arrive.lift = 0;
        me.vx = me.vz = 0;
        state.shake = 0;
        leaving.active = true;
        // Wall-clock time: the fade must end on time on a slow device too.
        leaving.from =
            performance.now() -
            (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
                ? FADE_S * 1000
                : 0);
        show();
        document.body.classList.add("leaving");
        sound.setCrowd(audio, 0);
        return new Promise((resolve) => (leaving.staged = resolve));
    }

    /** What is on screen in the arrival state, for the lobby to open on. */
    function departureShot() {
        const me = state.engine.athletes[0];
        // Where the visitor stands and faces: the pose the party's room gets.
        const pose = kit.pose({ x: me.x, y: 0, z: me.z }, players[0].yaw);
        return arrivalShot({
            cameraPosition: state.cam.pos,
            cameraLook: state.cam.look,
            fov: camera.fov,
            feet: pose,
            faceYaw: pose.h,
            // The kit scales an avatar to its height; the toy player that
            // stands in for one is measured.
            height:
                kit.self.kind === "vrm"
                    ? kit.self.height
                    : visibleHeight(players[0].root, kit.self.height),
        });
    }

    function renderLeaving() {
        const fade = fadeAt((performance.now() - leaving.from) / 1000);
        blackout.render(camera, players[0].root, fade);
        if (fade < 1 || !leaving.staged) return;
        leaving.staged(departureShot());
        leaving.staged = null;
    }
    pageDeparture.stage = stageDeparture;

    // --------------------------------------------------------------- lifecycle

    async function prepare() {
        const fonts = document.fonts
            ? Promise.race([
                  document.fonts.load('900 40px "Arial Black"'),
                  new Promise((r) => setTimeout(r, 1500)),
              ])
            : null;
        await fonts;
        const call = (operation, value) =>
            services
                .call("storage", operation, value, signal)
                .catch(() => null);
        Object.assign(config, (await call("config", null)) || {});
        saved.settings =
            (await call("get", { key: "settings" }))?.value ?? null;
        loadSettings();
        refreshSoundLabels();
        // The party check runs two copies side by side on a software
        // renderer and is about who plays whom, not pixels: no shadows.
        if (config.partyCheck) renderer.shadowMap.enabled = false;
        setBoot(0.25, "Painting the lines…");
        buildScene();
        startAttract();
        renderer.compile(scene, camera);
        setBoot(0.9, "Warming up…");
        state.identity = {
            name: services.identity.name || "You",
            pfp: services.identity.pfp || "",
        };
        // Play as the visitor's own avatar; the toy body is the fallback.
        if (services.identity.avatar) {
            setBoot(0.93, "Suiting up…");
            const loaded = await Promise.race([
                kit.loadSelf(),
                new Promise((r) => setTimeout(() => r(false), 20000)),
            ]);
            if (loaded) {
                attachVRM(players[0], kit.self);
                renderer.compile(scene, camera);
            } else
                console.warn(
                    "ACE: avatar unavailable, using the default player"
                );
        }
        setBoot(1, "Ready!");
        // The first frame: the court is on the canvas before the host says
        // `first-frame` and `ready`.
        resize();
        booted = true;
    }

    /** The visitor arrives: courtside from the lobby, the title screen otherwise. */
    function enter(continuity) {
        trip = continuity.trip ?? null;
        $("#lobby").hidden = !config.lobby;
        if (config.autoplay) startGame();
        else if (continuity.arrival?.from === "lobby")
            goArrive(continuity.arrival.view);
        else goTitle();
    }

    /** A member arrived in the party's room or left it. */
    function party(next) {
        trip = next;
        if (state.screen !== "party") return;
        if (!trip) return goHome();
        const format = state.partyFormat;
        goParty();
        if (format && partyOptions().some((f) => f.id === format))
            choosePartyFormat(format);
    }

    // What `pnpm games:check` asks about party play (docs/games/party.md).
    link.report(() => {
        const e = state.engine;
        const inMatch = ["vs", "intro", "playing", "pause"].includes(
            state.screen
        );
        const self = link.roster.self || "self";
        return {
            options: partyOptions().map((f) => ({ id: f.id, solo: f.solo })),
            phase: inMatch
                ? "match"
                : state.screen === "results"
                ? "results"
                : "menu",
            match:
                duel.describe() ??
                (inMatch && e && !state.attract
                    ? {
                          format: "solo",
                          players: [self],
                          authority: self,
                          role: "solo",
                          progress: Math.round(e.time * 10),
                          standIns: [],
                      }
                    : null),
        };
    });
    // Only ever fires under ?check: the check picks for the visitor.
    link.on("choose", (option) => {
        if (!booted || leaving.active) return;
        if (option === "solo" || !trip) return startGame();
        goParty();
        if (partyOptions().some((f) => f.id === option))
            choosePartyFormat(option);
    });

    // The one pause (docs/games/loading-and-pausing.md): the host suspends
    // the game while the tab is hidden or the page has a menu open, and a
    // match against the CPU also while the visitor types in the page;
    // never a match another person is playing. Sound off; after a hidden tab the visitor finds the pause
    // menu and restarts play themselves.
    function suspend() {
        // A hidden tab draws no frames: tell the other player before it stops.
        if (document.hidden) duel.hidden(true);
        if (document.hidden && !config.autoplay) pauseGame();
        sound.chargeStop(audio);
        const m = state.engine?.match;
        return {
            screen: state.screen,
            settings: { ...settings },
            muted: output.muted,
            score:
                m && !state.attract
                    ? { games: [...m.games], points: [...m.points] }
                    : null,
        };
    }

    // The same instance keeps its match in memory; a fresh one takes the
    // settings and starts from where the visitor would be standing.
    function restore(snapshot) {
        applySettings(snapshot?.settings);
        duel.hidden(false);
    }

    function dispose() {
        stopSoundLabels();
        sound.stopAudio(audio);
        timers.length = 0;
        clearTimeout(calloutTimer);
        clearTimeout(bannerTimer);
        if (duel.state !== "idle") duel.leave();
        foeAvatar?.dispose();
        kit.dispose();
        avatarKtx?.dispose();
        renderer.dispose();
        delete debugHooks.game;
        delete pageRoom.peers;
        delete pageRoom.entered;
        delete pageDeparture.stage;
        delete pageFrame.redraw;
        delete pageFrame.versus;
        delete pageFrame.soloMatch;
        delete pageFrame.away;
    }

    // The page owns Escape, Enter and M (docs/games/keys-focus.md). While
    // the visitor types in the page or its menu is open, the game takes no
    // input, and the host holds a match against the CPU still (suspend()).
    function inputPaused(paused) {
        state.inputPaused = paused;
        if (paused) sound.chargeStop(audio);
    }

    /** Facts the checks assert on (scenario.json). */
    function inspect() {
        const e = state.engine;
        const m = e?.match;
        const playing = !!m && !state.attract;
        const facts = kit.inspect();
        return {
            booted,
            screen: state.screen,
            // For the avatar check (docs/games/avatar-kit.md). The toy player
            // stands in until (or unless) the avatar loads.
            ...facts,
            avatarSelf:
                facts.avatarSelf === "none" ? "stand-in" : facts.avatarSelf,
            avatarSelfInFrame:
                facts.avatarSelf === "none"
                    ? state.camMode === "arrive"
                    : facts.avatarSelfInFrame,
            avatarHandsEmpty:
                facts.avatarHandsEmpty && !players?.[0].racket.visible,
            arrival: arrive.came ? "lobby" : "direct",
            standing: kit.arrival.crouch === 0,
            walked: arrive.walked > 0.5,
            partySize: trip ? partyPlayers().length : 1,
            partyFormats: partyOptions()
                .map((f) => f.id)
                .join(","),
            partyFormat: state.partyFormat || "",
            difficulty: settings.difficulty,
            length: settings.games,
            phase: e?.phase ?? "",
            server: playing ? m.server : -1,
            points: playing ? `${m.points[0]}-${m.points[1]}` : "",
            games: playing ? `${m.games[0]}-${m.games[1]}` : "",
            rally: state.rally,
            // For the results check: `results.inspect()` as the game sees it.
            ...matchResults.inspect(),
            muted: output.muted,
            // For the keys check: the visitor's player, and the freeze.
            position: e?.athletes[0]
                ? [e.athletes[0].x, 0, e.athletes[0].z]
                : null,
            frozen: state.inputPaused,
        };
    }

    let booted = false;
    // Read-only diagnostics for playtests.
    debugHooks.game = {
        state,
        get engine() {
            return state.engine;
        },
        action,
        leaving,
        duel,
        link,
        set timeScale(v) {
            config.slow = v;
        },
    };

    return {
        prepare,
        enter,
        update: frame,
        suspend,
        restore,
        dispose,
        inspect,
        party,
        inputPaused,
    };
}
