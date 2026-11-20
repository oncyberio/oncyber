// Lantern Tag as a lifecycle game (docs/games/contract.md): the host
// prepares it, enters it with how the visitor arrived and who came along,
// and owns the clock. Input is the actions declared in game.json. The
// visitor walks with the locomotion kit, is drawn (with everyone else in
// the party's room) by the avatar kit, and the menus are the UI kit's.
import * as THREE from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import basisScript from "three/addons/libs/basis/basis_transcoder.js?url";
import basisWasm from "three/addons/libs/basis/basis_transcoder.wasm?url";
import { createAvatarKit, loadVRM } from "@oncyber/avatar-kit";
import {
    GAMEPAD,
    applyCameraPose,
    arrival,
    cameraPose,
    createFollowCamera,
    createJumpInput,
    createWalker,
    dragLook,
    exposeLocomotionProbe,
    turnLook,
    updateCamera,
} from "@oncyber/kit-locomotion";
import { describeArrival } from "@oncyber/game-runtime/arrival";
import { matchAuthority } from "@oncyber/game-runtime/roster";
import manifest from "../game.json";
import { createMatch } from "./match.js";
import { createMotion } from "./motion.js";
import {
    ROUND_SECONDS,
    autopilot,
    keepInYard,
    roundResult,
    seedFrom,
    standings,
} from "./round.js";
import { createSound } from "./sound.js";
import { createBearer, createWorld } from "./world.js";

/**
 * What the host and the game hand each other outside the lifecycle, as Ace
 * does: the host sets `link` (the party link), `pose` (send the visitor's
 * pose to the room) and `config` before the game is made; the game sets
 * the rest.
 */
export const bridge = { link: null, pose: null, config: {} };

const HEIGHT = 1.75;
// Where a visitor stands on arrival: beside the well, with the camera in
// front of them and inside the walls, and clear ground ahead (down -z).
const SPAWN = { x: -2.6, z: 3.4 };
const FACING = 0;
const FADE_SECONDS = 0.4;
const AVATAR_LAYER = 1;

const $ = (selector) => document.querySelector(selector);
const round2 = (value) => Math.round(value * 100) / 100;

export default function createGame(context) {
    const { graphics, services, signal } = context;
    const config = bridge.config;
    const link = bridge.link;

    const renderer = new THREE.WebGLRenderer({
        canvas: graphics.canvas,
        antialias: graphics.pixelRatio >= 1,
        powerPreference: "high-performance",
    });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b18);
    scene.fog = new THREE.Fog(0x070b18, 26, 92);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
    const size = { w: 0, h: 0 };

    let world = null,
        bearer = null,
        kit = null,
        sound = null,
        ktx = null,
        booted = false,
        trip = null,
        follow = createFollowCamera({ yaw: FACING, scale: HEIGHT / 1.8 });
    const player = new THREE.Group();
    const walker = createWalker(
        { ...SPAWN, rotation: FACING },
        { scale: HEIGHT / 1.8, constrain: keepInYard }
    );
    const jump = createJumpInput();
    const state = {
        screen: "boot",
        came: "direct",
        walked: 0,
        lift: 0,
        focus: 0,
        options: [],
        autopilot: false,
        inputPaused: false,
        noticeUntil: 0,
        clock: 0,
        poseAt: 0,
        lastSecond: -1,
    };
    const leaving = { active: false, t: 0, done: null, marked: false };

    // ------------------------------------------------------------- the round

    const selfId = () => link?.roster.self || trip?.self || "self";
    const nameOf = (id) =>
        id === selfId()
            ? services.identity.name || "You"
            : link?.roster.members.find((m) => m.id === id)?.name ||
              kit?.others.get(id)?.name ||
              "Player";
    const results = (operation, value = null) =>
        services.call("results", operation, value, signal).catch((error) => {
            console.warn("[lantern-tag] result", error?.message ?? error);
            return null;
        });
    const match = createMatch({
        link: link ?? {
            roster: { self: "", host: "", members: [] },
            channel: { state() {}, event() {}, pump() {}, flush() {} },
            on: () => () => {},
        },
        authorityOf: matchAuthority,
        self: selfId,
        onEvent(event) {
            if (event.type === "lit") sound?.lit();
            else if (event.type === "faded") sound?.faded();
            else if (event.type === "caught" && event.mine) sound?.caught();
            else if (event.type === "joined")
                notice(`${nameOf(event.id)} joined the round`);
            else if (event.type === "merged") {
                // Two rounds started at once: this one follows the other.
                void results("abandon");
                void results("begin", { match: event.id });
            } else if (event.type === "over") finishRound();
        },
    });

    /** The formats game.json offers a party of this size, in its order. */
    function options() {
        const count = trip ? Math.max(1, Math.min(8, trip.size)) : 1;
        return manifest.party.formats.filter((f) => f.sizes.includes(count));
    }

    function start(format, auto = false) {
        if (leaving.active || !booted) return;
        if (state.screen === "match") leaveRound();
        if (state.screen === "results") match.clear();
        const duration = config.round || ROUND_SECONDS;
        const seed = seedFrom(`${trip?.id ?? ""}${Date.now()}${Math.random()}`);
        const id =
            format === manifest.party.solo
                ? match.startSolo({ seed, duration })
                : match.startParty({ format, seed, duration });
        void results("begin", { match: id });
        state.autopilot = auto;
        state.lastSecond = -1;
        kit.arrival.enter();
        setScreen("match");
        sound.start();
    }

    function finishRound() {
        const round = match.round;
        if (!round || state.screen !== "match") return;
        const report = roundResult(round, {
            format: match.format,
            self: selfId(),
            name: nameOf,
        });
        // Exactly one result for a finished round (docs/games/results.md).
        void results(report ? "report" : "abandon", report);
        showResults(round, report);
        walker.place({});
        setScreen("results");
        sound.end();
    }

    /** Out of a round before it ends: nothing is reported. */
    function leaveRound() {
        match.leave();
        void results("abandon");
        setScreen("arrival");
    }

    // ----------------------------------------------------------- the screens

    function setScreen(next) {
        state.screen = next;
        document.body.dataset.screen = next;
        document.body.classList.toggle(
            "party",
            next === "match" && match.format !== manifest.party.solo
        );
        for (const id of ["boot", "title", "menu", "results"])
            $(`#${id}`).classList.toggle("show", id === next);
        $("#hud").classList.toggle(
            "show",
            next === "arrival" || next === "match"
        );
        if (next === "arrival")
            $("#hint").textContent = "Walk around, then start a round";
        if (next === "match")
            $("#hint").textContent = "Walk up to a lit lantern to catch it";
    }

    function notice(text) {
        const element = $("#notice");
        element.textContent = text;
        element.classList.add("show");
        state.noticeUntil = state.clock + 4;
    }

    /** The walkable arrival: from the lobby's view, or the follow camera. */
    function goArrival(view) {
        const arrived = arrival(view, {
            at: SPAWN,
            facing: FACING,
            avatarHeight: HEIGHT,
        });
        follow = arrived.camera;
        walker.scale = arrived.scale;
        walker.place({
            ...SPAWN,
            y: 0,
            rotation: arrived.avatarRotation,
        });
        jump.clear();
        state.lift = 0;
        // Crouched as the lobby left them (when it sent its view), facing
        // its camera, hands empty; they stand up on `entered`.
        kit.arrival.stage(view);
        kit.self.motion = {};
        setScreen("arrival");
        placeCamera();
    }

    function openMenu() {
        state.options = options();
        state.focus = 0;
        const open = match.joinable();
        const list = $("#options");
        list.replaceChildren(
            ...state.options.map((format, index) => {
                const item = document.createElement("button");
                item.className = "oui-list__item";
                item.dataset.option = format.id;
                const body = document.createElement("span");
                body.className = "oui-list__body";
                body.textContent = format.label;
                const meta = document.createElement("span");
                meta.className = "oui-list__meta";
                meta.textContent =
                    format.id === manifest.party.solo
                        ? "You against the night"
                        : open
                        ? "Join the round in progress"
                        : "Your party, the same lanterns";
                item.append(body, meta);
                item.addEventListener("click", () => {
                    state.focus = index;
                    start(format.id);
                });
                return item;
            })
        );
        $("#menu-text").textContent = `A round lasts ${
            config.round || ROUND_SECONDS
        } seconds. Lanterns caught is your score.`;
        focusOption();
        walker.place({});
        setScreen("menu");
    }

    function focusOption() {
        [...$("#options").children].forEach((item, index) =>
            index === state.focus
                ? item.setAttribute("data-oui-focus", "")
                : item.removeAttribute("data-oui-focus")
        );
    }

    function row(rank, name, value, current, gone) {
        const line = document.createElement("div");
        line.className = "oui-score";
        if (current) line.setAttribute("aria-current", "true");
        for (const [part, text] of [
            ["rank", rank],
            ["name", gone ? `${name} (left)` : name],
            ["value", value],
        ]) {
            const span = document.createElement("span");
            span.className = `oui-score__${part}`;
            span.textContent = String(text);
            line.append(span);
        }
        return line;
    }

    function board(round, withNight) {
        const rows = standings(round).map((entry, index) =>
            row(
                index + 1,
                nameOf(entry.id),
                entry.score,
                entry.id === selfId(),
                entry.gone
            )
        );
        if (withNight)
            rows.push(row("", "The night", round.missed, false, false));
        return rows;
    }

    function showResults(round, report) {
        const mine = round.scores[selfId()] ?? 0;
        const won =
            report &&
            report.winner !== null &&
            report.teams[report.winner].players[0].kind === "self";
        $("#results-title").textContent = !report
            ? "The round is over"
            : won
            ? `You won with ${mine} lantern${mine === 1 ? "" : "s"}`
            : report.winner === null
            ? `A tie on ${mine}`
            : `You caught ${mine} lantern${mine === 1 ? "" : "s"}`;
        $("#results-board").replaceChildren(
            ...board(round, Object.keys(round.scores).length < 2)
        );
    }

    let hudText = "";
    function drawHud() {
        const round = match.round;
        if (state.screen === "match" && round) {
            const left = Math.max(0, Math.ceil(round.duration - round.elapsed));
            const text = `${
                round.scores[selfId()] ?? 0
            }|${left}|${JSON.stringify(round.scores)}|${round.gone.length}`;
            if (text !== hudText) {
                hudText = text;
                $("#score-value").textContent = String(
                    round.scores[selfId()] ?? 0
                );
                $("#time-value").textContent = `${Math.floor(
                    left / 60
                )}:${String(left % 60).padStart(2, "0")}`;
                if (match.format !== manifest.party.solo)
                    $("#board").replaceChildren(...board(round, false));
            }
            if (left <= 5 && left !== state.lastSecond && left > 0) {
                state.lastSecond = left;
                sound.tick();
            }
        }
        if (state.noticeUntil && state.clock > state.noticeUntil) {
            state.noticeUntil = 0;
            $("#notice").classList.remove("show");
        }
    }

    // -------------------------------------------------------------- the frame

    function resize() {
        const w = Math.max(1, Math.round(graphics.width));
        const h = Math.max(1, Math.round(graphics.height));
        if (w === size.w && h === size.h) return false;
        size.w = w;
        size.h = h;
        renderer.setPixelRatio(graphics.pixelRatio);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        return true;
    }

    function placeCamera() {
        const feet = walker.state;
        // The camera follows the ground under the visitor, not a jump.
        applyCameraPose(
            camera,
            cameraPose(follow, { x: feet.x, y: 0, z: feet.z }, size.w || 1280)
        );
    }

    function placePlayer(pose) {
        player.position.set(pose.x, pose.y, pose.z);
        // The walker's heading has 0 facing -z; the bodies face +z.
        player.rotation.y = pose.rotation + Math.PI;
    }

    /** The scene; while leaving, the world under a black veil and the avatar alone on top. */
    function render() {
        if (!leaving.active) return renderer.render(scene, camera);
        const t = Math.max(0, Math.min(1, leaving.t / FADE_SECONDS));
        const fade = t * t * (3 - 2 * t);
        if (!leaving.marked) {
            leaving.marked = true;
            player.traverse((o) => o.layers.enable(AVATAR_LAYER));
            // Lights only reach objects on a layer they share.
            scene.traverse((o) => o.isLight && o.layers.enable(AVATAR_LAYER));
        }
        const { background } = scene;
        renderer.autoClear = true;
        if (fade < 1) {
            renderer.render(scene, camera);
            renderer.autoClear = false;
            veil.material.opacity = fade;
            renderer.render(veilScene, veilCamera);
            renderer.clearDepth();
        } else renderer.setClearColor(0x000000, 1);
        scene.background = null;
        camera.layers.set(AVATAR_LAYER);
        renderer.render(scene, camera);
        camera.layers.set(0);
        scene.background = background;
        renderer.autoClear = true;
        if (fade >= 1 && leaving.done) {
            const done = leaving.done;
            leaving.done = null;
            done(departureShot());
        }
    }
    const veil = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            fog: false,
        })
    );
    veil.frustumCulled = false;
    const veilScene = new THREE.Scene();
    veilScene.add(veil);
    const veilCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    /** Feet to the top of what is drawn of the visitor, in metres. */
    function visibleHeight() {
        if (kit.self.kind !== "vrm") return HEIGHT;
        const box = new THREE.Box3().setFromObject(kit.self.root);
        const height = box.max.y - player.position.y;
        return height >= 0.5 && height <= 4 ? height : HEIGHT;
    }

    /** What is on screen in the arrival state, for the page (docs/games/departure.md). */
    function departureShot() {
        const target = new THREE.Vector3();
        camera.getWorldDirection(target).multiplyScalar(5).add(camera.position);
        const p = (v) => ({ x: v.x, y: v.y, z: v.z });
        return {
            camera: {
                position: p(camera.position),
                target: p(target),
                fov: camera.fov,
            },
            avatar: {
                feet: { x: player.position.x, y: 0, z: player.position.z },
                yaw: walker.state.rotation,
                height: visibleHeight(),
            },
        };
    }

    /**
     * Leaving: back to the arrival state wherever the visitor was (a round
     * left this way reports nothing), standing still in third person with
     * the lobby's follow camera, the interface hidden, the world fading to
     * black around the avatar.
     */
    function stageDeparture() {
        if (leaving.active)
            return new Promise((resolve) => resolve(departureShot()));
        if (state.screen === "match") {
            match.leave();
            void results("abandon");
        } else match.clear();
        setScreen("arrival");
        document.body.classList.add("leaving");
        walker.place({ y: 0 });
        jump.clear();
        state.lift = 0;
        if (kit.arrival.phase !== "standing") kit.arrival.stage(null);
        kit.self.motion = {};
        follow = createFollowCamera({ yaw: follow.yaw, scale: walker.scale });
        resize();
        placePlayer(walker.state);
        placeCamera();
        // One step of the body so it stands at rest, then it holds still.
        kit.update(0.3, camera);
        bearer.crouch(0);
        leaving.active = true;
        leaving.t = 0;
        return new Promise((resolve) => {
            leaving.done = resolve;
            render();
        });
    }

    function update(seconds) {
        state.clock += seconds;
        resize();
        if (leaving.active) {
            leaving.t += seconds;
            return render();
        }
        const { input, pressed, deltas } = context;
        const screen = state.screen;
        // Stay put until standing (the kit stands the avatar up on `entered`).
        const still = kit.arrival.crouch > 0 || state.inputPaused;
        const walking = (screen === "arrival" || screen === "match") && !still;

        if (screen === "title") {
            if (pressed.interact) goArrival(null);
        } else if (screen === "arrival") {
            if (pressed.interact && !still) openMenu();
        } else if (screen === "menu") {
            const count = state.options.length;
            if (pressed.down) state.focus = (state.focus + 1) % count;
            if (pressed.up) state.focus = (state.focus + count - 1) % count;
            if (pressed.up || pressed.down) focusOption();
            if (pressed.back) setScreen("arrival");
            else if (pressed.interact && count)
                start(state.options[state.focus].id);
        } else if (screen === "results") {
            if (pressed.interact) {
                match.clear();
                setScreen("arrival");
            }
        }

        // Walk, run, jump and look, as in the lobby (docs/games/locomotion.md).
        let strafe = 0,
            forward = 0,
            running = false;
        // Nobody at the controls (a check): head for the nearest lantern.
        const auto =
            walking && screen === "match" && state.autopilot && match.round;
        if (auto) {
            const way = autopilot(match.round, [
                walker.state.x,
                walker.state.z,
            ]);
            strafe = way.strafe;
            forward = way.forward;
            running = true;
        } else if (walking) {
            if (deltas.lookX || deltas.lookY)
                dragLook(follow, deltas.lookX * 100, deltas.lookY * 100);
            if (input.lookX || input.lookY)
                turnLook(
                    follow,
                    -input.lookX * GAMEPAD.lookYawRate * seconds,
                    input.lookY * GAMEPAD.lookPitchRate * seconds
                );
            if (pressed.jump) jump.queue();
            strafe = input.right - input.left;
            forward = input.down - input.up;
            running = input.run > 0;
        }
        const moving = Math.abs(strafe) + Math.abs(forward) > 0.05;
        updateCamera(follow, seconds, moving);
        // The autopilot steers in the yard's own axes: a camera at yaw 0.
        const yaw = auto ? 0 : follow.yaw;
        const from = { x: walker.state.x, z: walker.state.z };
        const pose = walker.advance(seconds, {
            strafe,
            forward,
            yaw,
            running,
            jump: walking && jump.read(seconds),
        });
        if (screen === "arrival")
            state.walked += Math.hypot(
                walker.state.x - from.x,
                walker.state.z - from.z
            );
        state.lift = pose.y;
        placePlayer(pose);
        const pace = walker.speed();
        kit.self.motion = pose.floor
            ? { speed: pace }
            : { air: true, speed: pace };

        if (state.screen === "match")
            match.update(seconds, [walker.state.x, walker.state.z]);
        drawHud();

        placeCamera();
        kit.update(seconds, camera);
        bearer.root.visible = kit.self.kind !== "vrm";
        bearer.crouch(kit.arrival.crouch);
        const round = state.screen === "match" ? match.round : null;
        world.update(seconds, round?.lit ?? null, round?.elapsed ?? 0);

        // Tell the room where the visitor stands, ten times a second.
        const at = performance.now();
        if (bridge.pose && at - state.poseAt > 100) {
            state.poseAt = at;
            bridge.pose(
                kit.pose({ x: pose.x, y: pose.y, z: pose.z }, pose.rotation)
            );
        }
        render();
    }

    // `pnpm games:check` walks here and compares the pace with the lobby's.
    exposeLocomotionProbe(
        () =>
            state.screen === "arrival" && !leaving.active && booted
                ? walker
                : null,
        () => {
            if (!booted || leaving.active || state.screen === "arrival") return;
            if (state.screen === "match") leaveRound();
            goArrival(null);
        }
    );

    // -------------------------------------------------------------- lifecycle

    async function prepare() {
        const progress = (value, label) => {
            context.loading.progress(value, label);
            $("#boot-text").textContent = label;
        };
        progress(0.1, "Laying the flagstones…");
        world = createWorld();
        scene.add(world.group);
        bearer = createBearer(HEIGHT);
        kit = createAvatarKit({
            services,
            // Idle, walk, run and jump made in code (motion.js), not files.
            motion: async () => createMotion(),
            // Oncyber avatars may carry compressed textures.
            load: (bytes) => {
                if (!ktx) {
                    const manager = new THREE.LoadingManager();
                    manager.setURLModifier((resource) =>
                        resource.endsWith("basis_transcoder.js")
                            ? basisScript
                            : resource.endsWith("basis_transcoder.wasm")
                            ? basisWasm
                            : resource
                    );
                    ktx = new KTX2Loader(manager)
                        .setTranscoderPath("/")
                        .setWorkerLimit(1);
                    ktx.detectSupport(renderer);
                }
                return loadVRM(bytes, { ktx2: ktx });
            },
            height: HEIGHT,
            // This game's forward is -z; the kit's avatars face +z.
            heading: Math.PI,
            // A visitor with no avatar is the cloaked bearer, not the kit's stand-in.
            standIn: false,
            signal,
        });
        player.add(kit.self.root, bearer.root);
        scene.add(player, kit.group);
        sound = createSound(context.audio);
        progress(0.4, "Lighting the lanterns…");
        setScreen("boot");
        resize();
        placePlayer(walker.state);
        placeCamera();
        renderer.compile(scene, camera);
        progress(0.7, "Finding your avatar…");
        // The visitor's own avatar; the bearer is the fallback.
        await Promise.race([
            kit.loadSelf(),
            new Promise((r) => setTimeout(() => r(false), 15000)),
        ]);
        progress(1, "Ready");
        booted = true;
        // The first frame: the courtyard is on the canvas before the host
        // says `first-frame` and `ready`.
        bearer.root.visible = kit.self.kind !== "vrm";
        world.update(0, null, 0);
        render();
    }

    function enter(continuity) {
        trip = continuity.trip ?? null;
        state.came = continuity.arrival?.from === "lobby" ? "lobby" : "direct";
        $("#title-lobby").hidden = !config.embedded;
        $("#title-go").addEventListener("click", () => goArrival(null));
        $("#start").addEventListener("click", () => {
            if (state.screen === "arrival") openMenu();
        });
        $("#menu-back").addEventListener("click", () => setScreen("arrival"));
        $("#menu-go").addEventListener("click", () => {
            if (state.options.length) start(state.options[state.focus].id);
        });
        $("#leave-round").addEventListener("click", () => {
            if (state.screen === "match") leaveRound();
        });
        $("#results-done").addEventListener("click", () => {
            match.clear();
            setScreen("arrival");
        });
        const lobby = () =>
            services.call("travel", "lobby", null, signal).catch(() => {});
        for (const id of ["lobby", "title-lobby", "results-lobby"])
            $(`#${id}`).addEventListener("click", lobby);

        if (state.came === "lobby") goArrival(continuity.arrival.view);
        else if (config.autoplay) {
            // A check's own match (game.json "results"): straight in.
            goArrival(null);
            start(manifest.party.solo, true);
        } else {
            // A direct visit: the title card over the courtyard.
            goArrival(null);
            setScreen("title");
        }
        resize();
        render();
    }

    /** A member arrived in the party's room or left it. */
    function party(next) {
        trip = next;
        if (state.screen === "menu") openMenu();
    }

    // The party stage of the check asks what is offered and what is being
    // played, and picks an option with nobody at the keyboard.
    link?.report(() => ({
        options: options().map((format) => ({
            id: format.id,
            solo: format.id === manifest.party.solo,
        })),
        phase:
            state.screen === "match"
                ? "match"
                : state.screen === "results"
                ? "results"
                : "menu",
        match: state.screen === "match" ? match.report() : null,
    }));
    link?.on("choose", (option) => {
        if (options().some((format) => format.id === option))
            start(option, true);
    });
    link?.on("arrived", ({ member, late }) => {
        if (late && match.versus)
            notice(`${member.name} arrived: they can join this round`);
    });

    bridge.peers = (players) => kit?.setPeers(players);
    bridge.entered = () => kit?.arrival.enter();
    bridge.stageDeparture = stageDeparture;
    bridge.redraw = () => {
        if (!booted) return;
        resize();
        placeCamera();
        render();
    };
    bridge.versus = () => match.versus;
    bridge.soloMatch = () => state.screen === "match" && !match.versus;
    bridge.away = (hidden) => match.away(hidden);

    function suspend() {
        return { screen: state.screen };
    }
    function restore() {
        // Nothing moved while suspended: the round, the walker and the
        // camera are all still in memory.
    }

    function inputPaused(paused) {
        state.inputPaused = paused;
        // A walker keeps gliding after its keys are let go: stop it dead.
        if (paused) walker.place({});
    }

    function inspect() {
        const facts = kit ? kit.inspect() : {};
        const round = match.round;
        const feet = walker.state;
        const middle = new THREE.Vector3(feet.x, HEIGHT * 0.5, feet.z).project(
            camera
        );
        return {
            booted,
            screen: state.screen,
            position: [round2(feet.x), round2(feet.z)],
            // While arriving: the handoff as it is drawn this frame.
            arrival:
                state.screen === "arrival" && kit
                    ? describeArrival({
                          camera: camera.position,
                          fov: camera.fov,
                          avatar: { x: feet.x, y: 0, z: feet.z },
                          avatarForward: {
                              x: -Math.sin(feet.rotation),
                              z: -Math.cos(feet.rotation),
                          },
                          avatarHeight: HEIGHT,
                          crouched: kit.arrival.crouch > 0,
                          handsEmpty: kit.arrival.handsEmpty,
                      })
                    : null,
            came: state.came,
            standing: kit ? kit.arrival.crouch === 0 : false,
            walked: state.walked > 0.5,
            partySize: trip ? trip.size : 1,
            options: options()
                .map((format) => format.id)
                .join(","),
            format: match.format,
            role: match.role,
            phase: round ? (round.over ? "over" : "playing") : "idle",
            score: round ? round.scores[selfId()] ?? 0 : 0,
            missed: round ? round.missed : 0,
            left: round ? Math.ceil(round.duration - round.elapsed) : 0,
            lanterns: round ? Object.keys(round.lit).length : 0,
            lanternsLit: round ? Object.keys(round.lit).length > 0 : false,
            players: round ? Object.keys(round.scores).length : 0,
            leaving: leaving.active,
            ...facts,
            // The bearer stands in until (or unless) the avatar loads.
            avatarSelf:
                facts.avatarSelf === "none" ? "stand-in" : facts.avatarSelf,
            avatarSelfInFrame:
                facts.avatarSelf === "none"
                    ? Math.abs(middle.x) <= 1 &&
                      Math.abs(middle.y) <= 1 &&
                      middle.z < 1
                    : facts.avatarSelfInFrame,
        };
    }

    function dispose() {
        match.dispose();
        sound?.dispose();
        kit?.dispose();
        bearer?.dispose();
        world?.dispose();
        ktx?.dispose();
        veil.geometry.dispose();
        veil.material.dispose();
        renderer.dispose();
        for (const key of [
            "peers",
            "entered",
            "stageDeparture",
            "redraw",
            "versus",
            "soloMatch",
            "away",
        ])
            delete bridge[key];
    }

    return {
        prepare,
        enter,
        update,
        suspend,
        restore,
        dispose,
        inspect,
        party,
        inputPaused,
    };
}
