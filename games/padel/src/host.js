import { GAME_MESSAGE_PREFIX, RuntimeSession } from "@oncyber/game-runtime";
import { postCheckReport, runCheck } from "@oncyber/game-runtime/check";
import { deviceAct } from "@oncyber/game-runtime/device-check";
import { bindSessionKeys } from "@oncyber/game-runtime/keys-browser";
import { connectGameAudio } from "@oncyber/game-runtime/audio-browser";
import { createDeparture } from "@oncyber/game-runtime/departure";
import { reportHealth } from "@oncyber/game-runtime/health";
import { createLoading, redrawOnResize } from "@oncyber/game-runtime/loading";
import { connectPage } from "@oncyber/game-runtime/page";
import {
    bindPausing,
    PAUSE_REASONS,
    sessionPausing,
} from "@oncyber/game-runtime/pausing";
import { createResults } from "@oncyber/game-runtime/results";
import { connectSavedData } from "@oncyber/game-runtime/saved";
import { connectVoice } from "@oncyber/game-runtime/voice";
import { answerInspect } from "@oncyber/avatar-kit/page";
import manifest from "../game.json";
import scenario from "../scenario.json";
import { CLUB_SPAWN } from "./club.js";
import { exposeInspect } from "@oncyber/game-runtime/bot";
import createGame, {
    debugHooks,
    pageDeparture,
    pageFrame,
    pageRoom,
} from "./game.js";
import { createHud } from "./hud.js";
import { bindDevices } from "./devices.js";
// Oncyber's UI kit first, so Padel's own styles can sit on top of it.
import "@oncyber/game-ui/fonts.css";
import "@oncyber/game-ui/oncyber-ui.css";
import "./style.css";

// The browser host for Glasshouse Padel: it runs the game through the
// lifecycle (WebGL 2 on the page's canvas), binds the keyboard and the
// devices to the declared actions (the page owns Escape, Enter and M, and
// pauses input while the visitor types: docs/games/keys-focus.md), and
// implements the services the game declares: saved settings, avatar bytes
// for the visitor and for the players the page announced in the room, match
// results, and travel back to the lobby (through the departure:
// docs/games/departure.md), all through the Oncyber game page when embedded.
// The room's players, their poses and who is talking go to the game's
// avatar kit (docs/games/avatar-kit.md). A finished match sends the page
// its one result (docs/games/results.md). While it prepares it tells the
// page how far along it is and when its first frame is drawn, it redraws on
// every resize, and it has one pause: the game is suspended while the tab
// is hidden or the page has a menu open, and a match also while the visitor
// types; every match is against NPCs, so nothing is ever left running for
// someone else (docs/games/loading-and-pausing.md). Sound goes through the
// runtime's one output (docs/games/sound.md): the page owns volume, mute
// and the first gesture. What the game saves is the one key game.json
// declares (docs/games/saved-data.md).
// Standalone (vite dev) nothing is saved; `?arrive` and `?party=4` stand in
// for a lobby trip.

const params = new URLSearchParams(location.search);
const canvas = document.querySelector("#court");
// The party, results, locomotion and saved-data checks are about who plays,
// how a match ends, how far a walk goes and what is kept, not pixels; and
// the process check's bot plays at keyboard speed unless its run is being
// recorded for a person to watch.
const draft =
    ["party", "results", "locomotion", "saved"].includes(params.get("check")) ||
    (params.get("check") === "process" && !params.has("video"));
// Field health (docs/games/field-health.md): uncaught errors, failed
// lifecycle stages and frame times, reported to the page from the start,
// so a failure while loading is reported too. Nothing of the game's content.
const health = reportHealth();
const page = connectPage({
    arrival: manifest.arrival,
    party: manifest.party,
    // Saved values go through the declared keys below, not the page's
    // older string storage.
    storageKeys: [],
    storageNamespace: "padel",
    identityTimeoutMs: 1500,
});
// Safe-area insets from the page, and where the HUD is for the checks
// (docs/games/safe-area.md). Listening before hello: the page answers it
// with the insets.
const hud = createHud(() => debugHooks.screen?.() ?? "boot");
debugHooks.inspect = hud.inspect;
// The room for the avatar kit: the page's `peers` (poses, names,
// avatars), with who is talking from the page's voice (docs/games/voice-chat.md).
// The game tells the room where the visitor stands.
const voice = connectVoice(GAME_MESSAGE_PREFIX.slice(0, -1));
// The game's one sound output, created before hello: the page answers it
// with the visitor's volume and mute. The same voice lowers the game while
// someone else in the room is talking.
const sound = connectGameAudio();
voice.onTalking((ids, self) => sound.setTalking(ids.length > (self ? 1 : 0)));
const vouched = new Set();
page.on("peers", (players) => {
    for (const p of players)
        for (const ref of [p.vrm, p.avatarUrl])
            if (typeof ref === "string" && ref && ref.length <= 2048)
                vouched.add(ref);
    pageRoom.peers?.(
        players.map((p) => ({
            ...p,
            talking: p.talking === true || voice.isTalking(p.id),
        }))
    );
});
pageRoom.pose = (pose) => page.pose(pose);
// Leaving (docs/games/departure.md): every way out asks the page to start
// the trip back; the page then asks for the last frame, which the game
// stages in the club (pageDeparture in game.js).
const departure = createDeparture({
    post: (kind, data) => page.post(kind, data),
    stage(reason) {
        if (!pageDeparture.stage) throw new Error("PADEL_NOT_READY");
        return pageDeparture.stage(reason);
    },
});
// The one pause, once the session exists (start()). Leaving wins over it:
// the last frame is drawn whatever was holding the game.
let pausing = null;
let departing = false;
page.on("departure", (reason) => {
    departing = true;
    for (const held of PAUSE_REASONS) pausing?.release(held);
    departure.receive("departure", { reason });
});
// Loading: progress while the club is built, then one first-frame signal
// before `ready`.
const loading = createLoading({ post: (kind, data) => page.post(kind, data) });
// Match results: the game opens a match and closes it with one report
// (the `results` service below); the page hears one `result` per match.
const results = createResults((result) => page.post("result", { result }));
// Saved data: the keys game.json declares, kept by the page. Listening
// before hello; under ?check it also answers the saved-data stage's probes.
const saved = connectSavedData({
    namespace: "padel",
    declared: manifest.saved,
    timeoutMs: 2500,
});
page.hello();

const AVATAR_MAX = 32 * 1024 * 1024;
let identity = null;

async function call(capability, operation, value) {
    if (capability === "storage") {
        if (operation === "config")
            return {
                difficulty: params.get("difficulty"),
                // A shorter match (first to this many), for the checks' bots.
                points: Number(params.get("points")) || null,
                // The game's own bot plays a match (the results check).
                autoplay: params.has("autoplay"),
                // A check that is not about pixels: draw small and plain.
                draft,
                lobby: page.embedded,
            };
        // A read is { value, revision, outcome }: value is null when
        // nothing usable is saved. A write to a shared key names the
        // revision it read (`ifRevision`) and can lose with "conflict".
        if (operation === "get") return saved.get(value?.key);
        if (operation === "set")
            return saved.set(
                value?.key,
                value?.value,
                Number.isInteger(value?.ifRevision)
                    ? { ifRevision: value.ifRevision }
                    : {}
            );
    }
    if (capability === "results") {
        if (operation === "begin") return results.begin();
        if (operation === "report") return results.report(value).match;
        if (operation === "abandon") {
            results.abandon();
            return true;
        }
    }
    if (capability === "travel" && operation === "lobby") {
        departure.leave();
        return true;
    }
    throw new Error("HOST_SERVICE_UNAVAILABLE");
}

// Only avatars the page vouches for: the visitor's own and those of the
// players it announced in the room. Size-capped here and by the runtime.
async function avatar(ref, signal) {
    if (ref !== identity.avatar && !vouched.has(ref))
        throw new Error("AVATAR_NOT_VOUCHED");
    const response = await fetch(ref, { signal });
    if (!response.ok) throw new Error(`AVATAR_HTTP_${response.status}`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > AVATAR_MAX) throw new Error("AVATAR_TOO_LARGE");
    return bytes;
}

/** Standalone only: a lobby trip without a lobby. */
function standInEnter() {
    const size = Number(params.get("party"));
    // The lobby's travel camera: in front of the avatar, which faces it.
    const view = {
        cameraOffset: { x: 0, y: 2, z: -5.04 },
        cameraTargetOffset: { x: 0, y: 1.05, z: 0 },
        avatarRotation: 0,
        avatarHeight: 1.8,
        fov: 58,
        cameraMode: "third-person",
    };
    return {
        arrival: params.has("arrive")
            ? { from: "lobby", view }
            : { from: "direct", view: null },
        trip:
            Number.isInteger(size) && size >= 2 && size <= 8
                ? {
                      id: `dev-party-${size}-preview`,
                      room: "",
                      size,
                      self: "",
                      arrived: [],
                      roster: null,
                      members: Array.from({ length: size - 1 }, (_, i) => ({
                          id: `dev-${i + 2}`,
                          name: `Player ${i + 2}`,
                          pfp: "",
                          avatarUrl: "",
                      })),
                  }
                : null,
    };
}

async function start() {
    const bootStart = performance.now();
    const who = await page.identity();
    identity = {
        id: "local-visitor",
        name: who.name || "You",
        pfp: who.pfp,
        avatar: who.avatarUrl || params.get("vrm") || "",
    };
    const graphics = {
        canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio || 1,
    };
    const session = new RuntimeSession(createGame, {
        manifest: manifest.runtime,
        graphics,
        services: {
            identity,
            asset: () => Promise.reject(new Error("NO_ASSETS")),
            call,
            avatar,
        },
        sendUI() {},
        onProgress: (value, label) => loading.progress(value, label),
        // Silenced on suspend, back on restore, its facts in inspect().
        audio: sound,
        now: () => performance.now(),
    });
    // The host owns the clock. It stops while a check plays its scenario
    // (`checking`) and between staging a lobby arrival and the lobby
    // letting go (`hidden`).
    let alive = true;
    let checking = false;
    let hidden = false;
    let last = performance.now();
    // One pause for the three things that can hold the game: a hidden tab
    // and the page's menu (bindPausing), and the page's input pause while the
    // visitor types during a match (the keys binder, below). The session is
    // suspended and restored; nobody else is ever playing.
    pausing = sessionPausing(session, {
        // Every match is against NPCs. Leaving is never held.
        mode: () => (departing ? "multiplayer" : "solo"),
        onChange: () => {
            last = performance.now();
        },
        onError: (error) => console.error("[padel]", error),
    });
    const stopPausing = bindPausing(pausing, { document, window });
    // The keyboard, as the declared actions. The binder hands the page its
    // keys, and stops and resumes the session's input on the page's word.
    const keys = bindSessionKeys(session, {
        game: "padel",
        prefix: GAME_MESSAGE_PREFIX,
        input: manifest.runtime.input,
        // A match stands still while the visitor types; the club and its
        // menus go on without input.
        paused: () => pageFrame.soloMatch?.() && pausing.hold("input"),
        resumed: () => pausing.release("input"),
    });
    // The mouse, and the on-screen controls and gamepad the bindings declare.
    const devices = bindDevices(session, canvas, manifest.runtime.input);
    if (
        params.has("qa") ||
        /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ) {
        window.__padel = debugHooks;
        window.__session = session;
    }

    const tick = (now) => {
        if (!alive) return;
        requestAnimationFrame(tick);
        graphics.width = window.innerWidth;
        graphics.height = window.innerHeight;
        if (!checking && !hidden)
            try {
                session.tick(Math.max(0, now - last) / 1000);
            } catch (error) {
                console.error("[padel]", error);
                health.stageFailed("update", error);
            }
        last = now;
    };
    requestAnimationFrame(tick);
    const frame = () =>
        new Promise((resolve) => requestAnimationFrame(resolve));

    // A resize draws at once, paused or not, instead of leaving an empty
    // canvas until the next animation frame (the game draws its leaving
    // frame when it is on the way out).
    const stopRedraw = redrawOnResize(
        loading,
        () => {
            graphics.width = window.innerWidth;
            graphics.height = window.innerHeight;
            pageFrame.redraw?.();
        },
        window
    );

    await health.stage("prepare", () => session.prepare());
    // The avatar stage of pnpm games:check asks what the game sees.
    answerInspect(() => session.inspect());
    // The standard facts, for the game's bot (bot.json) and the process
    // checks that read them (docs/games/good-game.md).
    exposeInspect(() => session.inspect());
    // prepare() ends on a drawn frame: once it is on screen say so, then
    // that the game can be entered. The lobby's reveal (enter, the arrival
    // frame, `entered`) comes after both. (A tab opened in the background
    // gets no animation frame: don't wait for one for ever.)
    await Promise.race([
        frame(),
        new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    loading.firstFrame({
        width: window.innerWidth,
        height: window.innerHeight,
    });
    page.ready();
    const visit = page.embedded ? await page.enterData() : standInEnter();
    await health.stage("enter", () =>
        session.enter({
            avatar: {
                id: identity.id,
                position: [CLUB_SPAWN.x, 0, CLUB_SPAWN.z],
                rotation: [0, 0, 0, 1],
            },
            camera: {
                position: [CLUB_SPAWN.x, 2, CLUB_SPAWN.z + 5],
                target: [CLUB_SPAWN.x, 1.05, CLUB_SPAWN.z],
                fov: visit.arrival.view?.fov ?? 58,
                mode: "third-person",
            },
            party: [],
            arrival: visit.arrival,
            trip: visit.trip,
        })
    );
    // The trip may have changed while the game was entering.
    if (
        page.embedded &&
        JSON.stringify(page.trip) !== JSON.stringify(visit.trip)
    )
        session.party(page.trip);
    page.on("party", (trip) => session.party(trip));
    // Two frames in the arrival framing, then stand still until the lobby
    // has revealed the game: the visitor stands up in view, not behind it
    // (the kit holds the arrival crouch until `entered`).
    await frame();
    await frame();
    if (visit.arrival.from === "lobby" && !page.revealed) {
        hidden = true;
        page.on("revealed", () => {
            hidden = false;
            last = performance.now();
            pageRoom.entered?.();
        });
    } else pageRoom.entered?.();
    page.arrivalReady();

    // pnpm games:check opens the game with ?check: play the scenario,
    // measure frames and report to the check page (its avatar and party
    // stages ask their own questions instead, its results stage has the
    // game's bot play a match to the end, its locomotion stage walks
    // the visitor itself, its saved-data stage saves and reads, and its
    // process stage plays bot.json through the keyboard).
    if (
        params.has("check") &&
        ![
            "avatars",
            "party",
            "results",
            "locomotion",
            "saved",
            "process",
        ].includes(params.get("check"))
    )
        postCheckReport(
            await runCheck({
                session,
                scenario,
                backend: "webgl2",
                bootMs: performance.now() - bootStart,
                frame,
                pauseHostClock: (paused) => {
                    checking = paused;
                    last = performance.now();
                },
                // ?check=phone and ?check=gamepad press the real controls
                // (docs/games/devices.md).
                act: deviceAct(session),
            })
        );

    const dispose = () => {
        if (!alive) return;
        alive = false;
        stopPausing();
        stopRedraw();
        keys.dispose();
        devices.dispose();
        hud.dispose();
        voice.dispose();
        saved.dispose();
        delete pageRoom.pose;
        page.dispose();
        void session.dispose();
    };
    page.on("dispose", dispose);
    window.addEventListener("pagehide", dispose, { once: true });
}

start().catch((error) => {
    console.error(error);
    page.fail(error?.message || "boot failed");
    // Standalone there is no page to say so.
    if (!page.embedded)
        document.body.insertAdjacentHTML(
            "beforeend",
            '<p class="oui oui-text" style="position:fixed;inset:auto 0 24px;text-align:center">The court could not finish loading. Please reload.</p>'
        );
});
