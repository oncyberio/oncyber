import { GAME_MESSAGE_PREFIX, RuntimeSession } from "@oncyber/game-runtime";
import { postCheckReport, runCheck } from "@oncyber/game-runtime/check";
import { bindSessionKeys } from "@oncyber/game-runtime/keys-browser";
import { createDeparture } from "@oncyber/game-runtime/departure";
import { connectPage } from "@oncyber/game-runtime/page";
import { createPartyLink } from "@oncyber/game-runtime/partyLink";
import { connectVoice } from "@oncyber/game-runtime/voice";
import { answerInspect } from "@oncyber/avatar-kit/page";
import manifest from "../game.json";
import scenario from "../scenario.json";
import { COURT } from "./config.js";
import createGame, {
    debugHooks,
    pageDeparture,
    pageRoom,
    pageSound,
} from "./game.js";
import { createHud } from "./hud.js";
import { bindDevices } from "./input.js";
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
// over (docs/games/party.md). Standalone (vite dev) it plays on
// localStorage; `?arrive` and `?party=4` stand in for a lobby trip.

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
    storageKeys: ["settings", "muted"],
    storageMax: 64 * 1024,
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
page.on("departure", (reason) => departure.receive("departure", { reason }));
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
        if (operation === "get") return { value: page.storage.get(value?.key) };
        if (operation === "set") return page.storage.set(value?.key, value?.value);
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
        // The party check is about who plays whom, not pixels: draw small.
        pixelRatio:
            params.get("check") === "party"
                ? 0.3
                : Math.min(window.devicePixelRatio || 1, 2),
    };
    const session = new RuntimeSession(createGame, {
        manifest: manifest.runtime,
        graphics,
        services: { identity, asset: () => Promise.reject(new Error("NO_ASSETS")), call, avatar },
        sendUI() {},
        now: () => performance.now(),
    });
    // The keyboard, as the declared actions. The binder hands the page its
    // keys, and stops and resumes the session's input on the page's word.
    const keys = bindSessionKeys(session, {
        game: "ace",
        prefix: GAME_MESSAGE_PREFIX,
        input: manifest.runtime.input,
        muted: (muted) => pageSound.muted?.(muted),
    });
    const devices = bindDevices(session, canvas, document.querySelector(".touch-pad"));
    if (params.has("qa") || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
        window.__ace = debugHooks;
        window.__session = session;
    }

    // The host owns the clock. It stops while a check plays its scenario
    // (`checking`) and between staging a lobby arrival and the lobby
    // letting go (`hidden`).
    let alive = true;
    let checking = false;
    let hidden = false;
    let last = performance.now();
    const tick = (now) => {
        if (!alive) return;
        requestAnimationFrame(tick);
        graphics.width = window.innerWidth;
        graphics.height = window.innerHeight;
        devices.poll();
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

    await session.prepare();
    // The avatar stage of pnpm games:check asks what the game sees (its
    // party stage asks the game through the link).
    answerInspect(() => session.inspect());
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
    // stages ask their own questions instead).
    if (
        params.has("check") &&
        !["avatars", "party"].includes(params.get("check"))
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
            })
        );

    document.addEventListener("visibilitychange", () => {
        last = performance.now();
        if (document.hidden && session.phase === "entered") void session.suspend();
        else if (!document.hidden && session.phase === "suspended") void session.restore();
    });
    const dispose = () => {
        if (!alive) return;
        alive = false;
        keys.dispose();
        devices.dispose();
        hud.dispose();
        voice.dispose();
        link.dispose();
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
