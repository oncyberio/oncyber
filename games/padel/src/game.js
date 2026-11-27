import * as THREE from "three";
import { describeArrival } from "@oncyber/game-runtime/arrival";
import { createAvatarKit } from "@oncyber/avatar-kit";
import {
    applyCameraPose,
    arrival,
    cameraPose,
    createJumpInput,
    createWalker,
    dragLook,
    exposeLocomotionProbe,
    updateCamera as easeFollowCamera,
} from "@oncyber/kit-locomotion";
import locomotionUrl from "@oncyber/avatar-kit/motion/locomotion.json?url";
import emotesUrl from "@oncyber/avatar-kit/motion/emotes.json?url";
import manifest from "../game.json";
import { build, createBall, createEffects } from "./world.js";
import { createPadelAvatar, loadClubAvatar } from "./avatars.js";
import {
    createMatch,
    getShotPreview,
    getShotTrajectory,
    MATCH_RULES,
    predictCourtLanding,
} from "./simulation.js";
import { createAudio } from "./audio.js";
import { readPadelInput } from "./input.js";
import { createCourtRenderer } from "./rendering.js";
import { createPadelCamera } from "./camera.js";
import {
    CLUB_SPAWN,
    createClubConstraint,
    padelPositionAllowed,
} from "./club.js";
import { arrivalShot, createBlackout, fadeAt, FADE_S } from "./departure.js";
import { createMatchResults, doublesReport } from "./result.js";
import { DEFAULT_SETTINGS, readSettings } from "./saved.js";

// Glasshouse Padel as a lifecycle game (docs/games/contract.md): the host
// prepares it, enters it with how the visitor arrived and who came along,
// and owns the clock. Input is the actions declared in game.json; saved
// settings, avatar bytes, match results and the way back to the lobby are
// host services. The HUD and menus are plain DOM in the game's own document.
//
// A visit has two places. The club is where a visitor arrives, walks (the
// locomotion kit) as their avatar (the avatar kit), meets whoever else is in
// the room, and chooses to play. The match is doubles on court 01 with three
// NPCs. Leaving a match or its result returns to the club; leaving for the
// lobby starts from the club too.

const $ = (id) => document.getElementById(id);
const HEIGHT = 1.78;
const NPC_NAMES = ["Leo", "Noa", "Mika"];
const CAMERA_VIEWS = [
    { id: "broadcast", label: "Broadcast" },
    { id: "courtside", label: "Low third person" },
    { id: "first-person", label: "First person" },
];
/** The doubles format's id, from the party statement in game.json. */
const FORMAT = manifest.party.solo;

/**
 * The room for the host: the game sets `peers(players)` (the page's list of
 * everyone else) and `entered()` (the page revealed the game: stand up); the
 * host sets `pose(pose)` (where the visitor stands, for the room).
 */
export const pageRoom = {};
/** Set by the game: `stage(reason)` draws the last frame before the lobby. */
export const pageDeparture = {};
/** Set by the game: `redraw()` after a resize, `soloMatch()` for the pause. */
export const pageFrame = {};
/** Read-only diagnostics for playtests. */
export const debugHooks = {};

export default function createGame(context) {
    const { graphics, services, signal } = context;
    const canvas = graphics.canvas;
    const on = (target, type, listener, options) =>
        target.addEventListener(type, listener, { ...options, signal });
    const show = (id, value) => {
        if ($(id).hidden === value) $(id).hidden = !value;
    };
    const text = (id, value) => {
        if ($(id).textContent !== String(value))
            $(id).textContent = String(value);
    };
    const storage = (operation, value) =>
        services.call("storage", operation, value, signal).catch(() => null);

    // Options from the host, read once in prepare().
    const config = {
        autoplay: false, // the game's own bot plays a match (the results check)
        points: null, // a shorter match: first to this many
        draft: false, // a check that is not about pixels: draw small and plain
        lobby: false, // inside the Oncyber page
    };
    let settings = { ...DEFAULT_SETTINGS };
    let trip = null;

    // --------------------------------------------------------------- state
    const match = createMatch({ difficulty: "practice", seed: 3107 });
    const sound = createAudio(context.audio);
    const output = context.audio ?? null;
    const pulse = { hit: false, lob: false, powerReleased: false };
    const aim = { aimX: 0, aimZ: -0.25 };
    const projected = new THREE.Vector3();
    let renderer, scene, camera, cameraRig, court, ballView, effects, rendering;
    let blackout;
    const looseBallViews = [];
    let avatars = [];
    let booted = false,
        disposed = false;
    // "club", "setup", "settings", "match" (with `paused` for its own time
    // out) or "results".
    let screen = "club";
    let playing = false,
        paused = false,
        tapPower = false,
        powerWasHeld = false,
        // The press that chose a menu item is not also a shot.
        freshInput = false,
        // A menu was open when this frame began.
        inMenu = false,
        inputHeld = false;
    let clock = 0,
        finishSettledAt = null,
        announceUntil = 0,
        feedbackUntil = 0,
        seed = 3107,
        pointsPlayed = 0,
        matchesStarted = 0,
        botAt = 0;
    let cameraNeedsSnap = true;
    const size = { w: 0, h: 0 };

    // ------------------------------------------------------------- avatars
    // The avatar kit shows the visitor in the club and everyone else in the
    // room as their Oncyber avatars, with the lobby's motion, and stages the
    // arrival pose. Bytes come only through the host's avatar service: the
    // visitor's own and the players the page announced. The visitor's bytes
    // are fetched once and shared with their match body.
    // A visitor with no avatar, or one that fails to load, wears the club's
    // house avatar (the NPCs' model, a file of this build), in the club and on
    // court alike.
    const HOUSE = "padel:house-avatar";
    const houseUrl = new URL("./avatars/square-catalogue.vrm", document.baseURI)
        .href;
    const houseBytes = () =>
        fetch(houseUrl, { signal }).then((response) => {
            if (!response.ok)
                throw new Error(`House avatar: ${response.status}`);
            return response.arrayBuffer();
        });
    const visitorRef = services.identity.avatar || HOUSE;
    let selfBytes = null;
    const visitorBytes = () =>
        (selfBytes ??= services.identity.avatar
            ? services
                  .avatar(services.identity.avatar, signal)
                  .catch((error) => {
                      console.warn(
                          "[Padel] Avatar unavailable:",
                          error?.message
                      );
                      return houseBytes();
                  })
            : houseBytes());
    const json = (url) => () => fetch(url, { signal }).then((r) => r.json());
    const kit = createAvatarKit({
        services: {
            identity: { ...services.identity, avatar: visitorRef },
            avatar: (ref, abort) =>
                ref === visitorRef
                    ? visitorBytes()
                    : services.avatar(ref, abort),
        },
        motion: json(locomotionUrl),
        emotes: json(emotesUrl),
        load: (bytes) => loadClubAvatar(bytes, renderer),
        height: HEIGHT,
        // The club's forward is -z (the lobby's convention); the kit's avatars
        // face +z.
        heading: Math.PI,
        signal,
    });
    pageRoom.peers = (players) => kit.setPeers(players);
    pageRoom.entered = () => kit.arrival.enter();

    // ---------------------------------------------------------------- club
    // Walking here is the lobby's: the locomotion kit owns pace, jump and
    // camera; the club only says where the glass, the net and the fence are.
    const constrain = createClubConstraint(() => club.walker);
    const club = {
        came: false, // this visit started as a lobby trip
        walker: createWalker(CLUB_SPAWN, { scale: HEIGHT / 1.8, constrain }),
        camera: null,
        jump: createJumpInput(),
        walked: 0,
        poseAt: 0,
    };
    // Leaving for the lobby: stood in the club while the world fades to black.
    const leaving = { active: false, from: 0, staged: null };

    function setScreen(next) {
        screen = next;
        const inMatch = next === "match" || next === "results";
        document.body.classList.toggle("is-club", next === "club");
        document.body.classList.toggle("is-match", next === "match");
        document.body.classList.toggle(
            "is-menu",
            next !== "club" && !(next === "match" && !paused)
        );
        show("club-card", next === "club");
        show("setup", next === "setup");
        show("visit-settings", next === "settings");
        show("results", next === "results");
        show("pause-screen", next === "match" && paused);
        show("score", inMatch);
        show("match-bar", next === "match");
        if (!inMatch) {
            for (const id of [
                "hud",
                "player-label",
                "feedback",
                "announcement",
            ])
                show(id, false);
            announceUntil = feedbackUntil = 0;
        }
        focusMenu();
    }

    /**
     * Stand the visitor in the club. `view` is the lobby's last camera on a
     * trip (crouched, facing it); null stands them up where they last stood
     * with the lobby's follow camera behind them.
     */
    function goClub(view = null, at = null) {
        // The club is not a match: one left for it reports nothing.
        matchResults.abandon();
        playing = paused = false;
        finishSettledAt = null;
        clearInput();
        sound.quiet();
        const here = club.walker.state;
        const spot =
            at && padelPositionAllowed(at.x, at.z)
                ? at
                : padelPositionAllowed(here.x, here.z)
                ? here
                : CLUB_SPAWN;
        // The one place the lobby's view becomes a camera here: the camera
        // looks down -z, at the court, past the visitor who faces it.
        const arrived = arrival(view, {
            at: spot,
            facing: view ? 0 : here.rotation,
            avatarHeight: HEIGHT,
        });
        // Back from a match the follow camera keeps looking where it did.
        if (view || !club.camera) club.camera = arrived.camera;
        club.jump.clear();
        club.walker.place({
            x: spot.x,
            z: spot.z,
            y: 0,
            rotation: view ? arrived.avatarRotation : here.rotation,
        });
        constrain.reset(spot);
        kit.arrival.stage(view);
        kit.emote("");
        kit.self.motion = {};
        for (const avatar of avatars) {
            avatar.setFirstPerson(false);
            avatar.root.visible = false;
        }
        kit.self.root.visible = true;
        placeVisitor(club.walker.state);
        match.reset({ ...rules(), seed });
        setScreen("club");
        placeClubCamera();
        canvas.setAttribute(
            "aria-label",
            "Padel club. W A S D walks, Shift runs, Space jumps, drag to look around. Press J or choose Play padel to start a match."
        );
    }

    /** The kit's avatars face +z; a walker at rotation 0 faces -z. */
    function placeVisitor(pose) {
        kit.self.root.position.set(pose.x, pose.y || 0, pose.z);
        kit.self.root.rotation.y = pose.rotation + Math.PI;
    }

    function placeClubCamera() {
        const me = club.walker.state;
        // The camera follows the ground under the visitor, not a jump.
        const pose = cameraPose(
            club.camera,
            { x: me.x, y: 0, z: me.z },
            size.w || 1280
        );
        applyCameraPose(camera, pose);
        // Keep the boom in front of the back windscreen and inside the fences.
        const x = THREE.MathUtils.clamp(camera.position.x, -11.75, 11.75);
        const z = THREE.MathUtils.clamp(camera.position.z, -19.4, 24);
        if (x !== camera.position.x || z !== camera.position.z) {
            camera.position.x = x;
            camera.position.z = z;
            camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
        }
        camera.updateMatrixWorld();
    }

    function updateClub(dt) {
        // While leaving the last frame holds still, camera included.
        if (leaving.active) return;
        const { input, pressed, deltas } = context;
        // Stay put until standing (the kit stands the avatar up on `entered`),
        // and while a menu is open over the club.
        const still = kit.arrival.crouch > 0 || screen !== "club" || inMenu;
        if (!still && (deltas.lookX || deltas.lookY))
            dragLook(
                club.camera,
                deltas.lookX * 100,
                (deltas.lookY || 0) * 100
            );
        if (!still && pressed.jump) club.jump.queue();
        // The declared directions lean 0 to 1 (a key is 1), relative to the
        // camera; the arrows walk too, as in the lobby. Forward is -1 ahead.
        const lean = (a, b) => Math.max(input[a] || 0, input[b] || 0);
        const strafe = still
            ? 0
            : lean("right", "aimRight") - lean("left", "aimLeft");
        const forward = still
            ? 0
            : lean("down", "aimDown") - lean("up", "aimUp");
        const moving = Math.abs(strafe) + Math.abs(forward) > 0.05;
        easeFollowCamera(club.camera, dt, moving);
        const from = { x: club.walker.state.x, z: club.walker.state.z };
        const shown = club.walker.advance(dt, {
            strafe,
            forward,
            yaw: club.camera.yaw,
            running: !still && input.run > 0,
            jump: !still && club.jump.read(dt),
        });
        club.walked += Math.hypot(
            club.walker.state.x - from.x,
            club.walker.state.z - from.z
        );
        placeVisitor(shown);
        // Emotes around the club (declared actions): wave while held, dance,
        // sit; walking ends them.
        if (!still) {
            if (pressed.wave) kit.self.motion = { wave: true };
            else if (pressed.dance) kit.emote("HIPHOP");
            else if (pressed.sit) kit.emote("SITTING");
            if (kit.self.motion.wave && !(input.wave > 0)) kit.self.motion = {};
        }
        // The lobby's motion: walk and run by speed (in the lobby's metres per
        // second), in the air during a jump; moving ends an emote.
        const pace = club.walker.speed();
        if (!shown.floor) kit.self.motion = { air: true, speed: pace };
        else if (moving || !(kit.self.motion.emote || kit.self.motion.wave))
            kit.self.motion = { speed: pace };
        placeClubCamera();
        // Tell the room where the visitor stands, ten times a second.
        const at = performance.now();
        if (at - club.poseAt > 100) {
            club.poseAt = at;
            pageRoom.pose?.(
                kit.pose({ x: shown.x, y: shown.y, z: shown.z }, shown.rotation)
            );
        }
        // Choosing to play: J, OK or the gamepad's A (Space is the jump here),
        // or the Play padel button.
        if (!still && pressed.confirm && !pressed.jump) openMenu("setup");
    }

    // `pnpm games:check` walks here and compares the pace with the lobby's
    // (docs/games/locomotion.md). Not on the way out, and only in the club.
    exposeLocomotionProbe(
        () => (screen === "club" && !leaving.active ? club.walker : null),
        () => {
            if (booted && !leaving.active && screen !== "club") goClub();
        }
    );

    // --------------------------------------------------------------- menus
    // Every menu is a card of the UI kit's buttons. The declared directions
    // move a focus mark, confirm presses the marked button and back closes
    // the menu; a click or a tap does the same.
    const menus = {
        setup: { id: "setup", first: "play", back: () => closeMenu() },
        settings: {
            id: "visit-settings",
            first: "settings-close",
            back: () => closeMenu(),
        },
        pause: {
            id: "pause-screen",
            first: "resume",
            back: () => setPaused(false),
        },
        results: { id: "results", first: "rematch", back: () => goClub() },
    };
    let focus = 0;
    const openMenuName = () =>
        screen === "match"
            ? paused
                ? "pause"
                : null
            : menus[screen]
            ? screen
            : null;
    const menuItems = (name) => [
        ...$(menus[name].id).querySelectorAll("button"),
    ];
    /** Mark item `index` of the open menu; with none given, its main button. */
    function focusMenu(index = null) {
        for (const marked of document.querySelectorAll("[data-oui-focus]"))
            marked.removeAttribute("data-oui-focus");
        const name = openMenuName();
        if (!name) return;
        const items = menuItems(name);
        focus =
            index === null
                ? Math.max(0, items.indexOf($(menus[name].first)))
                : (index + items.length) % items.length;
        items[focus]?.setAttribute("data-oui-focus", "");
    }
    function openMenu(name) {
        if (!booted || leaving.active || playing || kit.arrival.crouch > 0)
            return;
        clearInput();
        setScreen(name);
    }
    function closeMenu() {
        clearInput();
        setScreen("club");
    }
    /** How far a stick must lean to step through a menu (a key is 1). */
    const NAV_LEAN = 0.5;
    const leaning = {};
    function menuInput() {
        const name = openMenuName();
        const { input, pressed } = context;
        const step = (dirs) => {
            let stepped = false;
            for (const dir of dirs) {
                const far = (input[dir] || 0) >= NAV_LEAN;
                if (
                    (far && !leaning[dir]) ||
                    (pressed[dir] && !(input[dir] > 0))
                )
                    stepped = true;
                leaning[dir] = far;
            }
            return stepped;
        };
        const next = step(["down", "right", "aimDown", "aimRight"]);
        const previous = step(["up", "left", "aimUp", "aimLeft"]);
        if (!name) return;
        if (next) focusMenu(focus + 1);
        else if (previous) focusMenu(focus - 1);
        if (pressed.confirm) menuItems(name)[focus]?.click();
        else if (pressed.back || (name === "pause" && pressed.pause))
            menus[name].back();
    }

    // --------------------------------------------------------------- match
    const rules = () => ({
        difficulty: settings.difficulty,
        targetScore: config.points ?? MATCH_RULES.targetScore,
        maxScore: config.points ? config.points + 2 : MATCH_RULES.maxScore,
    });
    const livePlay = () =>
        playing && (match.phase === "serve" || match.phase === "rally");
    function clearInput() {
        tapPower = powerWasHeld = false;
        pulse.hit = pulse.lob = pulse.powerReleased = false;
        match.cancelInput?.();
    }
    // Exactly one result per finished match (docs/games/results.md).
    const matchResults = createMatchResults((operation, value) =>
        services.call("results", operation, value, signal)
    );
    function announce(title, detail, label = "GLASSHOUSE", seconds = 2) {
        text("announcement-label", label);
        text("announcement-title", title);
        text("announcement-detail", detail);
        announceUntil = clock + seconds;
        show("announcement", true);
    }
    function setPaused(value) {
        if (!playing || match.phase === "finished" || paused === value) return;
        paused = value;
        clearInput();
        freshInput = true;
        if (value) sound.quiet();
        setScreen("match");
    }
    function startMatch() {
        if (!booted || leaving.active || kit.arrival.crouch > 0) return;
        // A match restarted before it ended reports nothing.
        matchResults.abandon();
        match.reset({ ...rules(), seed: seed++ });
        match.start();
        matchResults.begin();
        matchesStarted++;
        pointsPlayed = 0;
        clearInput();
        freshInput = true;
        Object.assign(aim, { aimX: 0, aimZ: -0.25 });
        playing = true;
        paused = false;
        finishSettledAt = null;
        kit.emote("");
        // The racket is handed over on court, not in the club.
        kit.arrival.fillHands();
        kit.self.root.visible = false;
        cameraNeedsSnap = true;
        avatars.forEach((avatar, index) => {
            avatar.root.visible = true;
            avatar.reset(match.players[index]);
        });
        setScreen("match");
        show("hud", true);
        show("player-label", true);
        feedbackUntil = 0;
        announce(
            "YOUR SERVE",
            "Bounce, then serve underhand. J to place it. K lifts a lob.",
            "COURT 01",
            2.8
        );
        canvas.setAttribute(
            "aria-label",
            "Padel court. W A S D moves, including while charging. J for a control return, or hold F, aim with the arrow keys and release for power. The flight path previews your shot. C changes camera view."
        );
    }
    /** Out of a match or its result, back to where the visitor stands. */
    function leaveMatch() {
        const me = match.players[0];
        goClub(null, playing ? { x: me.x, z: me.z } : null);
    }
    function updateCameraControl() {
        const index = CAMERA_VIEWS.findIndex(
            (view) => view.id === settings.camera
        );
        const current = CAMERA_VIEWS[index];
        const next = CAMERA_VIEWS[(index + 1) % CAMERA_VIEWS.length];
        text("camera-value", current.label);
        const description = `Camera: ${current.label}. Switch to ${next.label}. Press C to change view.`;
        $("camera-view").setAttribute("aria-label", description);
        $("camera-view").title = description;
    }
    function cycleCamera() {
        const index = CAMERA_VIEWS.findIndex(
            (view) => view.id === settings.camera
        );
        settings.camera = CAMERA_VIEWS[(index + 1) % CAMERA_VIEWS.length].id;
        saveSettings();
        cameraNeedsSnap = paused || match.phase === "finished";
        updateCameraControl();
    }
    function updateGraphics() {
        const high = settings.graphics === "high";
        $("visit-graphics").setAttribute("aria-checked", String(high));
        if (!rendering) return;
        const profile = rendering.resize(
            size.w || 1,
            size.h || 1,
            config.draft ? "balanced" : settings.graphics,
            graphics.pixelRatio || 1,
            config.draft ? 0.3 : 1
        );
        court?.setQuality({
            shadowMapSize: profile.shadowMapSize,
            anisotropy: Math.min(
                profile.anisotropy,
                renderer.capabilities.getMaxAnisotropy()
            ),
        });
    }
    function updateSoundLabel() {
        $("visit-sound").setAttribute("aria-checked", String(!output?.muted));
    }
    function updateDifficulty() {
        for (const button of $("difficulty").querySelectorAll("button"))
            button.setAttribute(
                "aria-pressed",
                String(button.dataset.value === settings.difficulty)
            );
    }
    // Saved only when the visitor changes one (docs/games/saved-data.md).
    function saveSettings() {
        void storage("set", { key: "settings", value: { ...settings } });
    }

    // Buttons: the same things the declared actions do. Focus goes back to
    // the canvas so a key never presses a button a second time.
    const click = (id, run) =>
        on($(id), "click", () => {
            if (leaving.active) return;
            run();
            canvas.focus();
        });
    const leave = () => void services.call("travel", "lobby", null, signal);
    for (const id of ["exit", "pause-exit", "result-exit"]) click(id, leave);
    for (const id of ["play", "restart", "rematch"]) click(id, startMatch);
    for (const id of ["pause-club", "result-club"]) click(id, leaveMatch);
    click("visit-play", () => openMenu("setup"));
    click("visit-options", () => openMenu("settings"));
    for (const id of ["setup-close", "settings-close"]) click(id, closeMenu);
    click("pause", () => setPaused(true));
    click("resume", () => setPaused(false));
    click("camera-view", cycleCamera);
    // The page owns sound: the switch asks it, and shows its answer.
    click("visit-sound", () => output?.requestMuted(!output.muted));
    const stopSoundLabel = output?.onChange(updateSoundLabel);
    click("visit-graphics", () => {
        settings.graphics = settings.graphics === "high" ? "balanced" : "high";
        saveSettings();
        updateGraphics();
        draw();
    });
    for (const button of $("difficulty").querySelectorAll("button"))
        on(button, "click", () => {
            settings.difficulty = button.dataset.value;
            saveSettings();
            updateDifficulty();
            canvas.focus();
        });
    click("power-toggle", () => {
        if (!livePlay() || paused || match.players[0].swingPending) return;
        tapPower = !tapPower;
        if (!tapPower) pulse.powerReleased = true;
    });

    /** The declared actions, as the simulation's controls for this frame. */
    function matchInput(dt) {
        const { input, pressed } = context;
        const free =
            !freshInput &&
            livePlay() &&
            !paused &&
            !match.players[0].swingPending;
        if (free && pressed.hit) pulse.hit = true;
        if (free && pressed.lob) pulse.lob = true;
        const held = input.power > 0;
        if (powerWasHeld && !held && free) pulse.powerReleased = true;
        powerWasHeld = held && !freshInput;
        freshInput = false;
        const controls = readPadelInput(input, aim, dt, {
            powerHeld: tapPower,
            ...pulse,
            committed:
                !!match.players[0].swingPending || (playing && !livePlay()),
        });
        aim.aimX = controls.aimX;
        aim.aimZ = controls.aimZ;
        return controls;
    }
    /**
     * The results check's bot. A control shot on every ball is a rally that
     * never ends in Practice, so it serves, plays the first returns and then
     * lets one go.
     */
    function botInput(dt) {
        botAt += dt;
        if (botAt < 0.35) return;
        botAt = 0;
        const ownServe = match.phase === "serve" && match.server === 0;
        if (
            livePlay() &&
            !match.players[0].swingPending &&
            (ownServe || match.rallyHits < 3)
        )
            pulse.hit = true;
    }

    function handleEvents() {
        for (const event of match.consumeEvents()) {
            if (event.dead && (event.opacity ?? 1) <= 0) continue;
            if (event.type === "shot") {
                announceUntil = 0;
                show("announcement", false);
                effects.contact(event);
                if (event.stroke === "serve") sound.serve();
                else if (event.shotType === "smash") sound.smash(event.power);
                else sound.hit(event.power || 0.5);
                if (event.playerIndex === 0) {
                    tapPower = false;
                    const label =
                        event.qualityLabel ||
                        (typeof event.quality === "string"
                            ? event.quality
                            : event.quality > 0.85
                            ? "Perfect"
                            : "Good");
                    const contactLabel =
                        event.contactKind === "stretch"
                            ? "Stretch return"
                            : event.contactKind === "reach"
                            ? "Reach return"
                            : "Clean contact";
                    text(
                        "feedback-quality",
                        event.shotType === "smash"
                            ? `${label.toUpperCase()} SMASH`
                            : event.powered
                            ? `${label.toUpperCase()} POWER`
                            : event.shotType === "lob"
                            ? "LIFT OVER THE NET"
                            : contactLabel.toUpperCase()
                    );
                    text(
                        "feedback-detail",
                        `${Math.round((event.speed || 15) * 3.6)} km/h · ${
                            event.contactKind && event.contactKind !== "normal"
                                ? contactLabel.toLowerCase()
                                : event.stroke || "shot"
                        }`
                    );
                    $("feedback").dataset.quality = label.toLowerCase();
                    feedbackUntil = clock + 1.4;
                    show("feedback", true);
                }
            } else if (event.type === "miss") {
                tapPower = false;
                text("feedback-quality", "JUST OUT OF REACH");
                text(
                    "feedback-detail",
                    "Move closer before setting up your shot"
                );
                $("feedback").dataset.quality = "early";
                feedbackUntil = clock + 1.4;
                show("feedback", true);
            } else if (event.type === "wall") {
                sound.wall(
                    event.surface,
                    Math.min(1, (event.impactSpeed ?? event.speed ?? 10) / 24) *
                        (event.dead ? event.opacity ?? 1 : 1)
                );
                court.wallImpact(event);
            } else if (event.type === "net") sound.net();
            else if (event.type === "serve-let") {
                clearInput();
                announce(
                    "LET · SERVE AGAIN",
                    "Net cord. Same serve.",
                    "SERVICE",
                    1.2
                );
            } else if (event.type === "bounce") {
                sound.bounce(
                    event.dead
                        ? Math.min(0.65, (event.impactSpeed || 0) / 10) *
                              (event.opacity ?? 1)
                        : 0.5
                );
            } else if (event.type === "serve-fault") {
                clearInput();
                announce(
                    event.attempt === 1 ? "SECOND SERVE" : "DOUBLE FAULT",
                    event.reason || "Aim inside the diagonal service box.",
                    "SERVICE",
                    1.5
                );
                sound.fault();
            } else if (event.type === "point") {
                pointsPlayed++;
                clearInput();
                show("feedback", false);
                feedbackUntil = 0;
                announce(
                    event.outOfCourt && event.winner === 0
                        ? "OUT OF THE PARK"
                        : event.winner === 0 || event.playerIndex === 0
                        ? "YOUR POINT"
                        : "THEIR POINT",
                    event.reason || "",
                    "GLASSHOUSE",
                    1.7
                );
                sound.point(event.winner === 0);
            } else if (event.type === "match-end") {
                clearInput();
                show("hud", false);
                show("match-bar", false);
            } else if (event.type === "serve-ready") clearInput();
        }
    }
    function showSettledResults() {
        if (
            !playing ||
            match.phase !== "finished" ||
            !match.settled ||
            screen === "results"
        )
            return;
        // Let the last returning avatar finish turning back toward the net
        // before the card covers the court.
        if (finishSettledAt === null) finishSettledAt = clock;
        if (clock - finishSettledAt < 0.85) return;
        text(
            "result-title",
            match.winner === 0 ? "You own this court" : "One more match?"
        );
        text("result-score", match.score.join(" – "));
        text(
            "result-detail",
            match.winner === 0
                ? "Clean placement. Good timing. Well played."
                : "Use J to stay in the rally. Charge F when you have time to plant your feet."
        );
        setScreen("results");
        show("player-label", false);
    }
    function updateLooseBalls(dt) {
        const balls = playing ? match.looseBalls || [] : [];
        while (looseBallViews.length < Math.min(3, balls.length))
            looseBallViews.push({ view: createBall(scene), source: null });
        looseBallViews.forEach((slot, index) => {
            const ball = balls[index] || null;
            if (slot.source !== ball) {
                slot.view.update(null, 0);
                slot.source = ball;
            }
            slot.view.update(ball, dt);
        });
    }
    function updateHud(preview) {
        const committed = !!preview.committed;
        const smash = match.phase === "rally" && !!preview.smashOpportunity;
        text("human-score", match.score[0]);
        text("npc-score", match.score[1]);
        $("human-server").classList.toggle("serving", match.server % 2 === 0);
        $("npc-server").classList.toggle("serving", match.server % 2 === 1);
        text(
            "rally-count",
            match.phase === "rally"
                ? `${match.rallyHits} SHOTS`
                : `FIRST TO ${match.targetScore}`
        );
        text(
            "tip",
            committed
                ? preview.stroke === "smash"
                    ? "Smash ready · your player will meet the high ball"
                    : "Shot ready · your player will meet the ball"
                : smash
                ? "High ball · hold F, aim, release in blue to smash"
                : preview.charging
                ? "Keep moving · arrow keys aim along the flight path"
                : match.players[0].assistActive
                ? "Adjusting into position · WASD to take over"
                : preview.reachable && match.phase === "rally"
                ? "Ball in reach · tap J, or hold F for power"
                : match.message || "Move into position. Aim before you swing."
        );
        const charge = Math.max(0, preview.charge || 0),
            charging = !!preview.charging;
        text("movement-hint", committed ? "Shot locked" : "Move");
        const percent = Math.min(100, (charge / 1.4) * 100);
        $("charge-fill").style.width = `${percent}%`;
        $("charge-needle").style.left = `${percent}%`;
        text("power-value", `${Math.round((preview.power || 0) * 100)}%`);
        text(
            "shot-status",
            committed
                ? preview.stroke === "smash"
                    ? "SMASH READY"
                    : "SHOT READY"
                : charging
                ? charge > 0.98
                    ? "OVERCHARGED"
                    : preview.qualityLabel === "Perfect"
                    ? smash
                        ? "RELEASE · POWER SMASH"
                        : "RELEASE · SWEET SPOT"
                    : "BUILDING POWER"
                : smash
                ? "SMASH OPPORTUNITY"
                : "POWER SHOT"
        );
        text(
            "power-hint",
            committed
                ? "Tracking the ball · aim locked"
                : charging
                ? preview.qualityLabel === "Perfect"
                    ? smash
                        ? "Drive it down · send it over the glass"
                        : "Arrows aim · sweet spot"
                    : preview.safe === false
                    ? "Arrows aim · bring target in"
                    : "Arrows aim · release in blue"
                : smash
                ? "Hold F · release in blue"
                : "Hold to charge · release to hit"
        );
        $("power-toggle").setAttribute(
            "aria-label",
            committed
                ? "Shot ready"
                : charging
                ? "Release power shot"
                : "Charge power shot"
        );
        $("power-toggle").disabled = committed;
        $("power-toggle").setAttribute("aria-pressed", String(charging));
        const panel = document.querySelector(".shot-panel");
        panel.dataset.risk = String(charge > 0.98 || preview.safe === false);
        $("contact-ready").classList.toggle("ready", !!preview.ready);
        panel.dataset.committed = String(committed);
        panel.dataset.smash = String(smash);
    }
    function updateMatchCamera(dt) {
        const state = cameraRig.update(
            dt,
            {
                mode: settings.camera,
                playing,
                player: match.players[0],
                ball: match.ball,
                aspect: camera.aspect,
                avatarHeight: avatars[0]?.height,
            },
            cameraNeedsSnap
        );
        cameraNeedsSnap = false;
        const player = match.players[0];
        const cameraInsideAvatar =
            Math.hypot(
                camera.position.x - player.x,
                camera.position.z - player.z
            ) < 0.65 &&
            camera.position.y < player.y + (avatars[0]?.height || HEIGHT) + 0.2;
        const hideLocalBody = state.firstPerson || cameraInsideAvatar;
        avatars[0]?.setFirstPerson(hideLocalBody);
        show("player-label", screen === "match" && !hideLocalBody);
    }
    function placeLabel(id, player, avatar, visible = true) {
        projected
            .set(player.x, player.y + avatar.height + 0.35, player.z)
            .project(camera);
        const inView =
            Math.abs(projected.z) <= 1 &&
            Math.abs(projected.x) <= 1 &&
            Math.abs(projected.y) <= 1;
        if (!inView || !visible) show(id, false);
        else if (id !== "player-label") show(id, true);
        $(id).style.transform = `translate(${
            (projected.x * 0.5 + 0.5) * size.w
        }px,${(-projected.y * 0.5 + 0.5) * size.h}px) translate(-50%,-50%)`;
    }

    // --------------------------------------------------------------- frame
    function resize() {
        size.w = Math.max(1, Math.round(graphics.width || 1));
        size.h = Math.max(1, Math.round(graphics.height || 1));
        if (!camera) return;
        updateGraphics();
        camera.aspect = size.w / size.h;
        camera.updateProjectionMatrix();
        cameraNeedsSnap = true;
    }
    function draw() {
        if (!rendering || disposed) return;
        if (leaving.active) return renderLeaving();
        renderer.info.reset();
        rendering.render(scene, camera);
    }
    function update(seconds) {
        if (disposed || !booted) return;
        if (graphics.width !== size.w || graphics.height !== size.h) resize();
        // The host's step, capped as the runtime caps it: the simulation and
        // the walker run their own fixed steps inside it.
        const dt = Math.min(0.1, seconds);
        clock += dt;
        if (!leaving.active) {
            // A press belongs to the menu that was open when it was made: the
            // one that closes the pause menu does not open it again.
            inMenu = openMenuName() !== null;
            menuInput();
            if (!inMenu && screen === "match" && !paused) {
                if (context.pressed.pause) setPaused(true);
                if (context.pressed.view) cycleCamera();
            }
        }
        if (config.autoplay && playing && !paused) botInput(dt);
        const controls = matchInput(dt);
        if (!playing) updateClub(dt);
        if (playing && !paused && !leaving.active) {
            match.update(dt, controls);
            pulse.hit = pulse.lob = pulse.powerReleased = false;
            if (match.players[0].swingPending) {
                tapPower = false;
                feedbackUntil = 0;
                show("feedback", false);
            }
            handleEvents();
            const pace = Math.hypot(
                match.players[0].vx || 0,
                match.players[0].vz || 0
            );
            if (pace > 0.3) sound.step(Math.min(1, pace / 6.8));
            settleResult();
        }
        const preview = getShotPreview(match, controls);
        if (playing) {
            avatars.forEach((avatar, i) =>
                avatar.update(paused ? 0 : dt, match.players[i], match.ball)
            );
            updateMatchCamera(dt);
        }
        court.setView(
            {
                mode: settings.camera,
                playing,
                camera,
                player: match.players[0],
                travelLocked: false,
            },
            dt
        );
        // The rest of the room walks the club, not a live court.
        kit.group.visible = !playing;
        kit.update(dt, camera);
        court.tick(dt);
        ballView.update(playing ? match.ball : null, dt);
        updateLooseBalls(dt);
        const incoming =
            livePlay() && match.ball.active && match.ball.lastHit % 2 === 1
                ? predictCourtLanding(match.ball)
                : null;
        const previewActive =
            livePlay() &&
            !paused &&
            (match.phase !== "serve" || match.server === 0);
        const trajectory =
            previewActive && (preview.charging || preview.committed)
                ? getShotTrajectory(match, preview)
                : null;
        effects.update(dt, match, {
            ...preview,
            incoming,
            trajectory,
            active: previewActive,
        });
        if (playing) {
            show("hud", livePlay() && screen === "match");
            updateHud(preview);
            placeLabel("player-label", match.players[0], avatars[0]);
            const labels = screen === "match" && match.phase !== "finished";
            show("team-labels", labels);
            ["rival-noa", "partner-leo", "rival-mika"].forEach((id, offset) =>
                placeLabel(
                    id,
                    match.players[offset + 1],
                    avatars[offset + 1],
                    labels
                )
            );
        } else show("team-labels", false);
        if (clock > announceUntil) show("announcement", false);
        if (clock > feedbackUntil) show("feedback", false);
        draw();
        showSettledResults();
    }
    /** Once per frame: the finished match's one report. */
    function settleResult() {
        matchResults.settle(match, () =>
            doublesReport({
                format: FORMAT,
                score: match.score,
                winner: match.winner,
                name: services.identity.name,
                npcs: NPC_NAMES,
                difficulty: settings.difficulty,
            })
        );
    }

    // ----------------------------------------------------------- departure
    // The way back to the lobby always starts in the club, in the walkable
    // arrival state, whatever screen the visitor left from: the kit's arrival
    // is stood up with empty hands, and the view handed to the page is read
    // back from the camera and avatar on screen (docs/games/departure.md).
    function stageDeparture() {
        if (!booted) throw new Error("PADEL_NOT_READY");
        if (screen !== "club") leaveMatch();
        // Standing and still, even when leaving before the arrival crouch has
        // risen; no emote, on the ground.
        if (kit.arrival.crouch > 0) kit.arrival.stage(null);
        kit.emote("");
        kit.self.motion = {};
        club.walker.place({ y: 0 });
        club.jump.clear();
        placeVisitor(club.walker.state);
        placeClubCamera();
        leaving.active = true;
        // Wall-clock time: the fade must end on time on a slow device too.
        leaving.from =
            performance.now() -
            (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
                ? FADE_S * 1000
                : 0);
        document.body.classList.add("leaving");
        sound.quiet();
        return new Promise((resolve) => (leaving.staged = resolve));
    }
    function renderLeaving() {
        const fade = fadeAt((performance.now() - leaving.from) / 1000);
        renderer.setRenderTarget(null);
        blackout.render(camera, kit.self.root, fade);
        if (fade < 1 || !leaving.staged) return;
        const me = club.walker.state;
        // Where the visitor stands and faces: the pose the room gets.
        const pose = kit.pose({ x: me.x, y: 0, z: me.z }, me.rotation);
        leaving.staged(
            arrivalShot({
                cameraPosition: camera.position,
                cameraLook: cameraPose(
                    club.camera,
                    { x: me.x, y: 0, z: me.z },
                    size.w
                ).target,
                fov: camera.fov,
                feet: pose,
                faceYaw: me.rotation,
                height: kit.self.height,
            })
        );
        leaving.staged = null;
    }
    pageDeparture.stage = stageDeparture;
    pageFrame.redraw = () => {
        resize();
        draw();
    };
    // A match is always against NPCs: it stands still while the visitor
    // types in the page, like every other pause.
    pageFrame.soloMatch = () => screen === "match";

    // ----------------------------------------------------------- lifecycle
    async function prepare() {
        const { loading } = context;
        // Asked first, so the page answers while the court is built.
        const savedSettings = storage("get", { key: "settings" });
        Object.assign(config, (await storage("config", null)) || {});
        settings = readSettings((await savedSettings)?.value);
        if (config.difficulty) settings.difficulty = config.difficulty;
        loading.progress(0.1, "Preparing your court");
        await Promise.race([
            document.fonts?.ready,
            new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: false,
            alpha: false,
            powerPreference: "high-performance",
        });
        renderer.shadowMap.enabled = !config.draft;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.info.autoReset = false;
        rendering = createCourtRenderer(renderer);
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(46, 1, 0.1, 240);
        cameraRig = createPadelCamera(camera);
        blackout = createBlackout(renderer, scene);
        resize();
        court = build(scene);
        updateGraphics();
        ballView = createBall(scene);
        effects = createEffects(scene);
        scene.add(kit.self.root, kit.group);
        loading.progress(0.4, "Getting your racket ready");
        // The NPCs' model is a file of this build; the visitor's match body is
        // their own avatar, from the same bytes the kit draws in the club.
        const [bodies] = await Promise.all([
            Promise.all(
                match.players.map((_, index) =>
                    createPadelAvatar({
                        renderer,
                        bytes: index === 0 ? visitorBytes : null,
                        url: houseUrl,
                        pfp: index === 0 ? services.identity.pfp : null,
                        index,
                    })
                )
            ),
            Promise.race([
                kit.loadSelf(),
                new Promise((resolve) =>
                    setTimeout(() => resolve(false), 20000)
                ),
            ]),
        ]);
        if (signal.aborted) {
            bodies.forEach((avatar) => avatar.dispose());
            return;
        }
        avatars = bodies;
        avatars.forEach((avatar, index) => {
            scene.add(avatar.root);
            avatar.root.visible = false;
            avatar.reset(match.players[index]);
        });
        const name = services.identity.name;
        text("human-name", `${!name || name === "You" ? "YOU" : name} + LEO`);
        updateCameraControl();
        updateDifficulty();
        updateSoundLabel();
        loading.progress(0.85, "Opening court 01");
        booted = true;
        goClub();
        await renderer.compileAsync(scene, camera);
        loading.progress(1, "Ready");
        // The first frame: the club is on the canvas before the host says
        // `first-frame` and `ready`.
        draw();
    }

    /** The visitor arrives: in the club, crouched as the lobby left them. */
    function enter(continuity) {
        trip = continuity.trip ?? null;
        $("exit").hidden =
            $("pause-exit").hidden =
            $("result-exit").hidden =
                !config.lobby;
        const fromLobby = continuity.arrival?.from === "lobby";
        club.came = fromLobby;
        goClub(fromLobby ? continuity.arrival.view : null);
        if (config.autoplay) {
            kit.arrival.stage(null);
            startMatch();
        }
        draw();
    }
    /** Someone arrived in the room or left it. Every match is the visitor's own. */
    function party(next) {
        trip = next;
    }
    // The one pause (docs/games/loading-and-pausing.md): the host suspends
    // the game while the tab is hidden or the page has a menu open, and a
    // match also while the visitor types in the page. Nothing advances while
    // suspended; the same instance keeps its match in memory.
    function suspend() {
        clearInput();
        sound.quiet();
        return {
            screen,
            paused,
            settings: { ...settings },
            score: playing ? [...match.score] : null,
        };
    }
    function restore(snapshot) {
        if (snapshot?.settings) settings = readSettings(snapshot.settings);
    }
    // The visitor is typing in the page, or a page menu is open: nothing they
    // control moves. A walk stops dead instead of gliding to a halt.
    function inputPaused(value) {
        inputHeld = value;
        if (!value) return;
        clearInput();
        if (!playing) {
            club.walker.place({});
            club.jump.clear();
            constrain.reset(club.walker.state);
        }
    }
    function dispose() {
        if (disposed) return;
        disposed = true;
        stopSoundLabel?.();
        sound.dispose();
        kit.dispose();
        avatars.forEach((avatar) => avatar.dispose());
        effects?.dispose();
        ballView?.dispose();
        looseBallViews.forEach(({ view }) => view.dispose());
        looseBallViews.length = 0;
        court?.dispose();
        rendering?.dispose();
        renderer?.dispose();
        delete debugHooks.game;
        delete debugHooks.screen;
        delete pageRoom.peers;
        delete pageRoom.entered;
        delete pageDeparture.stage;
        delete pageFrame.redraw;
        delete pageFrame.soloMatch;
    }

    /** Facts the checks assert on (scenario.json, bot.json, BRIEF.md). */
    function inspect() {
        const me = club.walker.state;
        const player = match.players[0];
        const inClub = !playing && screen !== "results";
        const facts = kit.inspect();
        return {
            booted,
            // The standard facts (docs/games/good-game.md).
            screen:
                screen === "club"
                    ? "arrival"
                    : screen === "match" || screen === "results"
                    ? screen
                    : "menu",
            position: inClub ? [me.x, me.z] : [player.x, player.z],
            arrival:
                screen === "club" && camera
                    ? describeArrival({
                          camera: camera.position,
                          fov: camera.fov,
                          avatar: { x: me.x, y: 0, z: me.z },
                          // A walker faces -z at rotation 0.
                          avatarForward: {
                              x: -Math.sin(me.rotation),
                              z: -Math.cos(me.rotation),
                          },
                          avatarHeight: HEIGHT,
                          crouched: kit.arrival.crouch > 0,
                          handsEmpty: kit.arrival.handsEmpty,
                      })
                    : null,
            // Padel's own.
            menu: openMenuName() ?? "",
            cameFrom: club.came ? "lobby" : "direct",
            standing: kit.arrival.crouch === 0,
            walked: club.walked > 0.5,
            partySize: trip ? trip.size : 1,
            formats: manifest.party.formats
                .map((format) => format.id)
                .join(","),
            difficulty: settings.difficulty,
            graphics: settings.graphics,
            cameraView: settings.camera,
            phase: playing ? match.phase : "",
            paused,
            server: playing ? match.server : -1,
            score: playing ? match.score.join("-") : "",
            rally: playing ? match.rallyHits : 0,
            pointsPlayed,
            pointPlayed: pointsPlayed > 0,
            matchesStarted,
            winner: playing && match.winner !== null ? match.winner : -1,
            ...matchResults.inspect(),
            muted: output?.muted ?? false,
            inputHeld,
            // The avatar kit's facts (docs/games/avatar-kit.md).
            ...facts,
        };
    }

    debugHooks.game = { match, club, kit, leaving, config };
    debugHooks.screen = () => screen;

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
