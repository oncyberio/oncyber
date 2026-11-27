// The browser host for The Revolving Hotel. It runs the game through the lifecycle
// on the page's canvas, binds the keyboard, the mouse drag, the touch
// controls and the gamepad to the actions game.json declares, and is the
// game's one way to the Oncyber page: identity, the visit (arrival and
// trip), the party's room, results, sound, the safe areas, loading and
// pausing, and the way back to the lobby. Each helper is the runtime's;
// the docs are under docs/games/.
import { GAME_MESSAGE_PREFIX, RuntimeSession } from "@oncyber/game-runtime";
import { connectGameAudio } from "@oncyber/game-runtime/audio-browser";
import { exposeInspect } from "@oncyber/game-runtime/bot";
import { postCheckReport, runCheck } from "@oncyber/game-runtime/check";
import { createDeparture } from "@oncyber/game-runtime/departure";
import { deviceAct } from "@oncyber/game-runtime/device-check";
import { bindDeviceControls } from "@oncyber/game-runtime/device-controls";
import { reportHealth } from "@oncyber/game-runtime/health";
import { bindSessionKeys } from "@oncyber/game-runtime/keys-browser";
import { createLoading, redrawOnResize } from "@oncyber/game-runtime/loading";
import { connectPage } from "@oncyber/game-runtime/page";
import { createPartyLink } from "@oncyber/game-runtime/partyLink";
import {
    PAUSE_REASONS,
    bindPausing,
    sessionPausing,
} from "@oncyber/game-runtime/pausing";
import { createResults } from "@oncyber/game-runtime/results";
import {
    answerHudRequests,
    hudRects,
    watchSafeArea,
} from "@oncyber/game-runtime/safe-area";
import { connectVoice } from "@oncyber/game-runtime/voice";
import { connectAvatar } from "@oncyber/game-runtime/avatar";
import { answerInspect } from "@oncyber/avatar-kit/page";
import manifest from "../game.json";
import scenario from "../scenario.json";
import createGame, { bridge } from "./game.js";
// Oncyber's UI kit first, so the game's own styles sit on top of it.
import "@oncyber/game-ui/fonts.css";
import "@oncyber/game-ui/oncyber-ui.css";
import "./style.css";

const params = new URLSearchParams(location.search);
const canvas = document.querySelector("#stage");
const check = params.has("check") ? params.get("check") || "scenario" : "";
// Visits of the check that play no scenario: each asks its own questions.
const OWN_VISITS = [
    "avatars",
    "party",
    "results",
    "locomotion",
    "saved",
    "process",
];

// Field health first, so a failure while loading is reported too.
const health = reportHealth();
// The party's room: listening before the page client, so the roster is read
// before the game hears `party(trip)` for the same message.
const link = createPartyLink();
const page = connectPage({
    worldControls: true,
    storageNamespace: "revolving-hotel",
    storageKeys: [],
    arrival: manifest.arrival,
    party: manifest.party,
    identityTimeoutMs: 1500,
});
// Safe areas, before hello: the page answers it with the insets. The HUD of
// every screen is reported, not only the one showing: `hud-measure` lays the
// hidden ones out for the one reading.
const safeArea = watchSafeArea();
const hud = () => {
    document.body.classList.add("hud-measure");
    try {
        return hudRects();
    } finally {
        document.body.classList.remove("hud-measure");
    }
};
const stopHud = answerHudRequests(() => ({ hud: hud() }), {
    insets: () => safeArea.insets,
});
// Who is talking comes from the page; the game builds no chat or voice.
const voice = connectVoice(GAME_MESSAGE_PREFIX.slice(0, -1));
// The one sound output, before hello. Lowered while someone else talks.
const sound = connectGameAudio();
voice.onTalking((ids, self) => sound.setTalking(ids.length > (self ? 1 : 0)));
// Only avatars the page vouches for are fetched: the visitor's own and
// those of the players it announced.
const vouched = new Set();
page.on("peers", (players) => {
    for (const p of players)
        for (const ref of [p.vrm, p.avatarUrl])
            if (typeof ref === "string" && ref && ref.length <= 2048)
                vouched.add(ref);
    bridge.peers?.(
        players.map((p) => ({
            ...p,
            talking: p.talking === true || voice.isTalking(p.id),
        }))
    );
});
link.on("roster", (roster) => {
    for (const member of roster.members)
        if (member.avatarUrl) vouched.add(member.avatarUrl);
});
// Changing avatar is the page's (docs/games/avatar-kit.md): the game asks
// for the picker, the page shows the lobby's and says what was chosen, and
// the game wears it in place. Standalone there is no page to ask.
const avatars = connectAvatar();
page.on("avatar", (ref) => { if (identity && typeof ref === "string" && ref) { vouched.add(ref); identity.avatar = ref; bridge.wear?.(ref); } });
page.on("emote", (name) => bridge.emote?.(name));
avatars.on((chosen) => {
    vouched.add(chosen.url);
    // What the visitor's own avatar is from now on (the avatar service).
    if (identity) identity.avatar = chosen.url;
    bridge.wear?.(chosen.url);
});
// The older page client includes storage and places its own avatar button in the world toolbar.
if (avatars.available && !page.storage) bridge.changeAvatar = () => avatars.ask();
// Every way out asks the page to start the trip back; the page then asks
// for the last frame, which the game stages in its arrival state.
const departure = createDeparture({
    post: (kind, data) => page.post(kind, data),
    stage(reason) {
        if (!bridge.stageDeparture) throw new Error("NOT_READY");
        return bridge.stageDeparture(reason);
    },
});
let pausing = null;
let departing = false;
page.on("departure", (reason) => {
    departing = true;
    // Leaving wins over a pause: the last frame is drawn whatever held the game.
    for (const held of PAUSE_REASONS) pausing?.release(held);
    departure.receive("departure", { reason });
});
const loading = createLoading({ post: (kind, data) => page.post(kind, data) });
// One result per finished round.
const results = createResults((result) => page.post("result", { result }));
page.hello();

let identity = null;

async function call(capability, operation, value) {
    if (capability === "results") {
        if (operation === "begin")
            return results.begin(value?.match || undefined);
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

async function avatar(ref, signal) {
    if (ref !== identity.avatar && !vouched.has(ref))
        throw new Error("AVATAR_NOT_VOUCHED");
    const response = await fetch(ref, { signal, credentials: "omit" });
    if (!response.ok) throw new Error(`AVATAR_HTTP_${response.status}`);
    return response.arrayBuffer();
}

/** Standalone (vite dev) only: `?arrive` and `?party=3` stand in for a lobby trip. */
function standInEnter() {
    const count = Number(params.get("party"));
    return {
        arrival: params.has("arrive")
            ? {
                  from: "lobby",
                  view: {
                      cameraOffset: { x: 0, y: 2, z: 5.04 },
                      cameraTargetOffset: { x: 0, y: 1.05, z: 0 },
                      avatarRotation: 0,
                      avatarHeight: 1.7,
                      fov: 58,
                  },
              }
            : { from: "direct", view: null },
        trip:
            Number.isInteger(count) && count >= 2 && count <= 8
                ? {
                      id: `dev-party-${count}`,
                      room: "",
                      size: count,
                      self: "",
                      arrived: [],
                      roster: null,
                      members: Array.from({ length: count - 1 }, (_, i) => ({
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
        id: "visitor",
        name: who.name || "You",
        pfp: who.pfp,
        avatar: who.avatarUrl || "",
    };
    const seconds = Number(params.get("round"));
    bridge.link = link;
    bridge.pose = (pose) => page.pose(pose);
    bridge.config = {
        embedded: page.embedded,
        check,
        // A check's own match: the game plays itself (game.json "results").
        autoplay: params.has("autoplay"),
        // A shorter round, for a check or a bot: ?round=20.
        round: seconds >= 5 && seconds <= 600 ? seconds : 0,
    };
    const graphics = {
        canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        // These visits of the check are about rules, not pixels: draw
        // small (the machine that runs them may have no GPU). The bot's
        // run is small too unless it is being recorded.
        pixelRatio:
            ["party", "results", "locomotion"].includes(check) ||
            (check === "process" && !params.has("video"))
                ? 0.3
                : Math.min(window.devicePixelRatio || 1, 2),
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
        onProgress: (value, label) => { loading.progress(value, label); document.querySelector("#boot-text").textContent = label; },
        audio: sound,
        now: () => performance.now(),
    });
    // The host owns the clock. It stops while a check plays its scenario
    // and between staging a lobby arrival and the lobby letting go.
    let alive = true,
        checking = false,
        hidden = false,
        last = performance.now();
    // One pause: a hidden tab, the page's menu, and typing during a round
    // played alone. Alone the session is suspended and restored; a round
    // other people are in goes on and catches up.
    pausing = sessionPausing(session, {
        mode: () => (departing || bridge.versus?.() ? "multiplayer" : "solo"),
        away: (away) => bridge.away?.(away),
        onChange: () => {
            last = performance.now();
        },
        onError: (error) => console.error("[revolving-hotel]", error),
    });
    const stopPausing = bindPausing(pausing, { document, window });
    const keys = bindSessionKeys(session, {
        game: "revolving-hotel",
        prefix: GAME_MESSAGE_PREFIX,
        input: manifest.runtime.input,
        paused: () => bridge.soloMatch?.() && pausing.hold("input"),
        resumed: () => pausing.release("input"),
    });
    // Touch stick, buttons and gamepad, from the same bindings.
    const controls = bindDeviceControls(session, manifest.runtime.input);
    // Dragging on the view looks around: the declared lookX / lookY, in
    // hundreds of pixels. No binding of the runtime's draws a drag.
    const live = new AbortController();
    let drag = null;
    const look = (action, pixels) => {
        try {
            session.delta(action, Math.max(-1, Math.min(1, pixels / 100)));
        } catch {
            /* not entered yet, or disposed */
        }
    };
    canvas.addEventListener(
        "pointerdown",
        (e) => (drag = { id: e.pointerId, x: e.clientX, y: e.clientY }),
        { signal: live.signal }
    );
    window.addEventListener(
        "pointermove",
        (e) => {
            if (drag?.id !== e.pointerId) return;
            look("lookX", e.clientX - drag.x);
            look("lookY", e.clientY - drag.y);
            drag.x = e.clientX;
            drag.y = e.clientY;
        },
        { signal: live.signal }
    );
    for (const type of ["pointerup", "pointercancel"])
        window.addEventListener(type, () => (drag = null), {
            signal: live.signal,
        });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), {
        signal: live.signal,
    });

    const tick = (now) => {
        if (!alive) return;
        requestAnimationFrame(tick);
        graphics.width = window.innerWidth;
        graphics.height = window.innerHeight;
        if (!checking && !hidden)
            try {
                session.tick(Math.max(0, now - last) / 1000);
            } catch (error) {
                console.error("[revolving-hotel]", error);
                health.stageFailed("update", error);
            }
        last = now;
    };
    requestAnimationFrame(tick);
    const frame = () =>
        new Promise((resolve) => requestAnimationFrame(resolve));

    // A resize draws at once, paused or not.
    const stopRedraw = redrawOnResize(
        loading,
        () => {
            graphics.width = window.innerWidth;
            graphics.height = window.innerHeight;
            bridge.redraw?.();
        },
        window
    );

    await health.stage("prepare", () => session.prepare());
    const facts = () => ({
        ...session.inspect(),
        ...results.inspect(),
        hud: hud(),
    });
    // The avatar stage of the check, and the bot and the process checks.
    answerInspect(facts);
    exposeInspect(facts);
    // prepare() ends on a drawn frame: say so, then that the game can be
    // entered. (A tab opened in the background gets no animation frame.)
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
                position: [0, 0, 6],
                rotation: [0, 1, 0, 0],
            },
            camera: {
                position: [0, 2, 11],
                target: [0, 1.05, 6],
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
    // has revealed the game: the visitor stands up in view.
    await frame();
    await frame();
    if (visit.arrival.from === "lobby" && !page.revealed) {
        hidden = true;
        page.on("revealed", () => {
            hidden = false;
            last = performance.now();
            bridge.entered?.();
        });
    } else bridge.entered?.();
    page.arrivalReady();

    if (check && !OWN_VISITS.includes(check))
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
                // ?check=phone and ?check=gamepad press the real controls.
                act: deviceAct(session),
            })
        );

    const dispose = () => {
        if (!alive) return;
        alive = false;
        stopPausing();
        stopRedraw();
        stopHud();
        safeArea.dispose();
        keys.dispose();
        controls.dispose();
        live.abort();
        voice.dispose();
        link.dispose();
        sound.dispose();
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

