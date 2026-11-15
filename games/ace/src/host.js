import { GAME_MESSAGE_PREFIX, RuntimeSession } from "@oncyber/game-runtime";
import { postCheckReport, runCheck } from "@oncyber/game-runtime/check";
import { deviceAct } from "@oncyber/game-runtime/device-check";
import { bindSessionKeys } from "@oncyber/game-runtime/keys-browser";
import { connectGameAudio } from "@oncyber/game-runtime/audio-browser";
import { createDeparture } from "@oncyber/game-runtime/departure";
import { createLoading, redrawOnResize } from "@oncyber/game-runtime/loading";
import { connectPage } from "@oncyber/game-runtime/page";
import {
    bindPausing,
    PAUSE_REASONS,
    sessionPausing,
} from "@oncyber/game-runtime/pausing";
import { createPartyLink } from "@oncyber/game-runtime/partyLink";
import { createResults } from "@oncyber/game-runtime/results";
import { connectSavedData } from "@oncyber/game-runtime/saved";
import { connectVoice } from "@oncyber/game-runtime/voice";
import { answerInspect } from "@oncyber/avatar-kit/page";
import manifest from "../game.json";
import scenario from "../scenario.json";
import { COURT } from "./config.js";
import createGame, {
    debugHooks,
    pageDeparture,
    pageFrame,
    pageRoom,
} from "./game.js";
import { exposeFacts } from "./facts.js";
import { createHud } from "./hud.js";
import { bindDevices } from "./input.js";
import { MIGRATE } from "./saved.js";
// Oncyber's UI kit first, so Ace's own styles can sit on top of it.
import "@oncyber/game-ui/fonts.css";
import "@oncyber/game-ui/oncyber-ui.css";
import "./style.css";

// The browser host for ACE! Tennis: it runs the game through the lifecycle
// (WebGL 2 on the page's canvas), binds the keyboard and the devices to the
// declared actions (the page owns Escape, Enter and M, and pauses input
// while the visitor types: docs/games/keys-focus.md),
// and implements the services the game declares: saved settings, the
// avatar bytes of the visitor and of the players in their party's room, and
// travel back to the lobby (through the departure: docs/games/departure.md),
// all through the Oncyber game page when embedded.
// The room's players, their poses and who is talking go to the game's
// avatar kit (docs/games/avatar-kit.md). The party link reads the room's
// roster out of the trip and carries the match channel a 1 v 1 is played
// over (docs/games/party.md). A finished match sends the page its one
// result (docs/games/results.md). While it prepares it tells the page how
// far along it is and when its first frame is drawn, it redraws on every
// resize, and it has one pause: the game is suspended while the tab is
// hidden or the page has a menu open, and a match against the CPU while
// the visitor types; a match another person is playing never is
// (docs/games/loading-and-pausing.md).
// Sound goes through the runtime's one output (docs/games/sound.md): the
// page owns volume, mute and the first gesture, the game is lowered while
// someone in the room talks, and it is silent while the session is
// suspended (so a match another person is playing keeps its sound).
// What the game saves are the keys game.json declares (`saved`): the page
// keeps them, per visitor, per party for the trip or for everyone, and the
// game reads and writes them through the `storage` service
// (docs/games/saved-data.md).
// Standalone (vite dev) it plays on localStorage; `?arrive` and `?party=4`
// stand in for a lobby trip.

const params = new URLSearchParams(location.search);
const canvas = document.querySelector("#stage");
// The party's room, for the game (pageRoom.link): who is really there, the
// host, who dropped, and the real-time channel between members. Listening
// before the page client, so the roster is read before the game hears
// `party(trip)` for the same message.
const link = createPartyLink();
pageRoom.link = link;
const page = connectPage({
    arrival: manifest.arrival,
    party: manifest.party,
    // Saved values go through the declared keys below, not the page's
    // older string storage.
    storageKeys: [],
    storageNamespace: "ace",
    identityTimeoutMs: 1500,
});
// Safe-area insets from the page, and where the HUD is for the checks
// (docs/games/safe-area.md). Listening before hello: the page answers it
// with the insets.
const hud = createHud(() => debugHooks.game?.state.screen ?? "boot");
debugHooks.inspect = hud.inspect;
// The party's room for the avatar kit: the page's `peers` (poses, names,
// avatars), with who is talking from the page's voice (docs/games/voice-chat.md).
// The game tells the room where the visitor stands.
const voice = connectVoice(GAME_MESSAGE_PREFIX.slice(0, -1));
// The game's one sound output, created before hello: the page answers it
// with the visitor's volume and mute. The same voice lowers the game while
// someone else in the room is talking.
const sound = connectGameAudio();
voice.onTalking((ids, self) =>
    sound.setTalking(ids.length > (self ? 1 : 0))
);
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
// A 1 v 1 draws the other player as their avatar: the room named it.
link.on("roster", (roster) => {
    for (const member of roster.members)
        if (member.avatarUrl) vouched.add(member.avatarUrl);
});
// Leaving (docs/games/departure.md): every way out asks the page to start
// the trip back; the page then asks for the last frame, which the game
// stages courtside (pageDeparture in game.js).
const departure = createDeparture({
    post: (kind, data) => page.post(kind, data),
    stage(reason) {
        if (!pageDeparture.stage) throw new Error("ACE_NOT_READY");
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
// Loading: progress while the court is built, then one first-frame signal
// before `ready`.
const loading = createLoading({ post: (kind, data) => page.post(kind, data) });
// Match results: the game opens a match and closes it with one report
// (the `results` service below); the page hears one `result` per match.
const results = createResults((result) => page.post("result", { result }));
// Saved data: the keys game.json declares, kept by the page. Listening
// before hello; under ?check it also answers the saved-data stage's probes.
const saved = connectSavedData({
    namespace: "ace",
    declared: manifest.saved,
    migrate: MIGRATE,
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
                games: Number(params.get("games")) || null,
                autoplay: params.has("autoplay"),
                // Under pnpm games:check nobody is at the keyboard; its
                // party stage runs two copies side by side.
                check: params.has("check"),
                partyCheck: params.get("check") === "party",
                slow: Number(params.get("slow")) || 1,
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
        // A 1 v 1 passes the id both browsers share; a solo match gets its own.
        if (operation === "begin") return results.begin(value?.match || undefined);
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
    const view = {
        cameraOffset: { x: 0, y: 2.3, z: 4.8 },
        cameraTargetOffset: { x: 0, y: 1.25, z: 0 },
        avatarRotation: 0,
        avatarHeight: 1.75,
        fov: 50,
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
        // The party check is about who plays whom, the results check
        // about how a match ends and the locomotion check about how far a
        // walk goes, not pixels: draw small.
        pixelRatio:
            ["party", "results", "locomotion", "saved"].includes(
                params.get("check")
            ) ||
            // The process check's bot plays at keyboard speed: small,
            // unless its run is being recorded for a person to watch.
            (params.get("check") === "process" && !params.has("video"))
                ? 0.3
                : Math.min(window.devicePixelRatio || 1, 2),
    };
    const session = new RuntimeSession(createGame, {
        manifest: manifest.runtime,
        graphics,
        services: { identity, asset: () => Promise.reject(new Error("NO_ASSETS")), call, avatar },
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
    // and the page's menu (bindPausing) and the page's input pause while
    // the visitor types during a match against the CPU (the keys binder,
    // below). Alone or against the CPU the session is suspended and restored; a match another person is
    // playing goes on, the other side is told when this tab is hidden, and
    // the match catches up when it is shown again.
    pausing = sessionPausing(session, {
        mode: () =>
            departing || pageFrame.versus?.() ? "multiplayer" : "solo",
        away: (away) => pageFrame.away?.(away),
        onChange: () => {
            last = performance.now();
        },
        onError: (error) => console.error("[ace]", error),
    });
    const stopPausing = bindPausing(pausing, { document, window });
    // The keyboard, as the declared actions. The binder hands the page its
    // keys, and stops and resumes the session's input on the page's word.
    const keys = bindSessionKeys(session, {
        game: "ace",
        prefix: GAME_MESSAGE_PREFIX,
        input: manifest.runtime.input,
        // A match against the CPU stands still while the visitor types;
        // the menus and the club go on without input.
        paused: () => pageFrame.soloMatch?.() && pausing.hold("input"),
        resumed: () => pausing.release("input"),
    });
    // The mouse, and the on-screen controls and gamepad the bindings declare.
    const devices = bindDevices(session, canvas, manifest.runtime.input);
    if (params.has("qa") || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
        window.__ace = debugHooks;
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
                console.error("[ace]", error);
            }
        last = now;
    };
    requestAnimationFrame(tick);
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

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

    await session.prepare();
    // The avatar stage of pnpm games:check asks what the game sees (its
    // party stage asks the game through the link).
    answerInspect(() => session.inspect());
    // The standard facts, for the game's bot (bot.json) and the process
    // checks that read them (docs/games/good-game.md).
    exposeFacts(() => session.inspect());
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
    await session.enter({
        avatar: {
            id: identity.id,
            position: [2.4, 0, COURT.halfLength + 1.2],
            rotation: [0, 1, 0, 0],
        },
        camera: {
            position: [2.4, 2.3, COURT.halfLength + 6],
            target: [2.4, 1.25, COURT.halfLength + 1.2],
            fov: visit.arrival.view?.fov ?? 50,
            mode: "third-person",
        },
        party: [],
        arrival: visit.arrival,
        trip: visit.trip,
    });
    // The trip may have changed while the game was entering.
    if (page.embedded && JSON.stringify(page.trip) !== JSON.stringify(visit.trip))
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
        link.dispose();
        saved.dispose();
        delete pageRoom.pose;
        delete pageRoom.link;
        page.dispose();
        void session.dispose();
    };
    page.on("dispose", dispose);
    window.addEventListener("pagehide", dispose, { once: true });
}

start().catch((error) => {
    console.error(error);
    page.fail(error?.message || "boot failed");
    document.querySelector("#boot-text").textContent =
        "Something went wrong. Please reload.";
});
