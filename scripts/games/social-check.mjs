// The chat and voice stage of `pnpm games:check` (docs/games/voice-chat.md).
//
// Two visitors chat in a lobby, travel into the game together and carry on:
// the page's own social layer (frontend/features/games/gameSocial.ts) runs
// in a browser around the real game build in the site's sandbox. It proves:
//
//   - chat sent before the trip is still on screen after it;
//   - a message sent in the game arrives;
//   - voice state survives the trip (who was talking still is, who was
//     listening still listens) and "who is talking" reaches the game frame;
//   - the game takes no part: it is posted no chat, and a relay packet from
//     the game that reads as chat is refused.
//
// The rooms and the audio are stand-ins (BroadcastChannels and levels): a
// headless browser has no microphone and the check needs no room server.
// A static rule runs first: a game's build must not open a microphone or a
// peer connection of its own.
import { createServer } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_MESSAGE_PREFIX } from "../../games/runtime/src/contract.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".css": "text/css",
    ".wasm": "application/wasm",
    ".glb": "model/gltf-binary",
    ".vrm": "model/gltf-binary",
};
const OWN_VOICE =
    /\b(getUserMedia|RTCPeerConnection|webkitRTCPeerConnection|SpeechRecognition|MediaRecorder)\b/;

/** Files in the build that reach for a microphone or a peer connection. */
export function scanOwnVoice(out) {
    const findings = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) walk(path);
            else if (/\.(m?js|html)$/.test(entry.name)) {
                const match = readFileSync(path, "utf8").match(OWN_VOICE);
                if (match)
                    findings.push({
                        code: "SOCIAL_OWN_VOICE",
                        message: `${path.slice(out.length + 1)} uses ${
                            match[1]
                        }: a game never builds its own chat or voice (docs/games/voice-chat.md)`,
                    });
            }
        }
    };
    walk(out);
    return findings;
}

const visitorPage = (
    title
) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
<script>window.GAME_MESSAGE_PREFIX = ${JSON.stringify(
    GAME_MESSAGE_PREFIX
)};</script>
<script type="module" src="/social/visitor.js"></script>`;

export function serveSocialCheck(id, out) {
    const social = stripTypeScriptTypes(
        readFileSync(
            join(root, "frontend/features/games/gameSocial.ts"),
            "utf8"
        )
    );
    const server = createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        const send = (type, body) => {
            res.writeHead(200, {
                "content-type": type,
                "access-control-allow-origin": "*",
            });
            res.end(body);
        };
        if (url.pathname === "/visitor")
            return send(
                "text/html",
                visitorPage(url.searchParams.get("name") ?? "visitor")
            );
        if (url.pathname === "/social/gameSocial.js")
            return send("text/javascript", social);
        if (url.pathname === "/social/visitor.js")
            return send(
                "text/javascript",
                readFileSync(join(here, "social-check-page.js"))
            );
        const prefix = `/games/${id}/`;
        const path = resolve(
            out,
            `.${decodeURIComponent(url.pathname.slice(prefix.length - 1))}`
        );
        if (
            !url.pathname.startsWith(prefix) ||
            !path.startsWith(out + sep) ||
            !existsSync(path) ||
            statSync(path).isDirectory()
        ) {
            res.writeHead(404);
            return res.end();
        }
        send(
            TYPES[extname(path)] ?? "application/octet-stream",
            readFileSync(path)
        );
    });
    return new Promise((done) =>
        server.listen(0, "127.0.0.1", () => done(server))
    );
}

/**
 * Runs the stage in `browser` (a Playwright browser). Resolves with
 * `{ stage: "social", status, ms, error?, facts }`; never throws.
 */
export async function checkSocial({
    id,
    out,
    browser,
    timeoutMs = 120_000,
    network = null,
}) {
    const started = Date.now();
    const facts = {};
    const pageErrors = [];
    let server, context;
    const until = async (what, test, ms = 15_000) => {
        const deadline = Date.now() + ms;
        for (;;) {
            const value = await test();
            if (value) return value;
            if (Date.now() > deadline) throw new Error(what);
            await new Promise((done) => setTimeout(done, 100));
        }
    };
    try {
        server = await serveSocialCheck(id, out);
        // The game's files under its declared network policy (networkCheck.mjs).
        network?.guard(server);
        const base = `http://127.0.0.1:${server.address().port}`;
        // One context: its pages share the BroadcastChannel rooms.
        context = await browser.newContext({
            viewport: { width: 960, height: 540 },
        });
        const open = async (name) => {
            const page = await context.newPage();
            page.on("pageerror", (error) =>
                pageErrors.push(
                    `${name}: ${String(error.message).slice(0, 300)}`
                )
            );
            await page.goto(`${base}/visitor?game=${id}&name=${name}`);
            await page.waitForFunction(() => !!window.visitor);
            return page;
        };
        const report = (page) => page.evaluate(() => window.visitor.report());
        const [ada, ben] = [await open("Ada"), await open("Ben")];

        // In the lobby: Ada says something and turns her microphone on; Ben
        // listens.
        const BEFORE = "check: said in the lobby before the trip";
        const AFTER = "check: said in the game";
        await ada.evaluate((text) => window.visitor.sayInLobby(text), BEFORE);
        await until(
            "LOBBY_CHAT: the lobby message did not reach the second visitor",
            () =>
                ben.evaluate(
                    (text) => window.visitor.lobbyTexts().includes(text),
                    BEFORE
                )
        );
        await ada.evaluate(() => window.visitor.setLobbyVoice("live"));
        await ben.evaluate(() => window.visitor.setLobbyVoice("muted"));

        // They travel together, into the party's room for this game.
        const room = `oncyber-${id}-party-check-trip-0000000001`;
        for (const page of [ada, ben])
            await page.evaluate((label) => window.visitor.travel(label), room);
        await until(
            "GAME_NOT_READY: the game did not say ready for both visitors",
            async () => {
                const reports = [await report(ada), await report(ben)];
                const failed = reports.find((r) => r.gameError);
                if (failed) throw new Error(`GAME_FAILED: ${failed.gameError}`);
                return reports.every((r) => r.ready);
            },
            timeoutMs
        );

        // Chat before the trip is still visible after it, for both.
        for (const [who, page] of [
            ["Ada", ada],
            ["Ben", ben],
        ]) {
            const { messages } = await report(page);
            const carried = messages.find((m) => m.text === BEFORE);
            if (
                !carried?.carried ||
                carried.name !== "Ada" ||
                carried.self !== (who === "Ada")
            )
                throw new Error(
                    `CHAT_NOT_CARRIED: ${who} lost the lobby's chat on the way into the game`
                );
        }
        facts.chatCarried = true;

        // A message sent in the game arrives.
        if (
            !(await ben.evaluate(
                (text) => window.visitor.social.send(text),
                AFTER
            ))
        )
            throw new Error(
                "CHAT_NOT_SENT: the page could not send chat in the game's room"
            );
        await until(
            "CHAT_NOT_DELIVERED: a message sent in the game did not arrive",
            async () =>
                (
                    await report(ada)
                ).messages.some(
                    (m) =>
                        m.text === AFTER &&
                        m.name === "Ben" &&
                        !m.carried &&
                        !m.self
                )
        );
        await until(
            "CHAT_NO_ECHO: the sender does not see their own message",
            async () =>
                (
                    await report(ben)
                ).messages.some((m) => m.text === AFTER && m.self)
        );
        facts.chatDelivered = true;

        // Voice state survives the trip, with nobody touching a button.
        const voices = await until(
            "VOICE_NOT_RESTORED: voice did not come back after the trip",
            async () => {
                const [a, b] = [await report(ada), await report(ben)];
                return a.voice === "live" && b.voice === "muted"
                    ? [a, b]
                    : null;
            }
        );
        if (voices[0].micRequests !== 1 || voices[1].micRequests !== 0)
            throw new Error(
                "VOICE_MIC: the microphone opened for the wrong visitor, or more than once"
            );
        if (voices.some((v) => v.lobbyVoice !== "off"))
            throw new Error("VOICE_TWICE: the lobby kept a voice running");
        facts.voiceRestored = { ada: voices[0].voice, ben: voices[1].voice };

        // Who is talking reaches both pages and both game frames.
        await ada.evaluate(() => window.visitor.room.speak(0.8));
        const adaId = voices[0].id;
        await until(
            "TALKING_NOT_HEARD: the listener was not told who is talking",
            async () => {
                const b = await report(ben);
                return (
                    b.talking.includes(adaId) &&
                    b.postedKinds.includes("talking")
                );
            }
        );
        await until(
            "TALKING_SELF: the talker's own game was not told",
            async () =>
                (
                    await report(ada)
                ).posted.includes(`"ids":["${adaId}"],"self":true`)
        );
        await ada.evaluate(() => window.visitor.room.speak(0));
        await until(
            "TALKING_STUCK: talking did not end",
            async () => (await report(ben)).talking.length === 0
        );
        facts.talking = true;

        // Poses from the game place a voice; players it leaves out keep the
        // room's rule.
        const gains = await ben.evaluate((id) => {
            const v = window.visitor;
            v.gameMessage("voice", {
                listener: { x: 0, y: 1.6, z: 0, h: 0 },
                players: [{ id, x: 2, y: 1.6, z: 0 }],
            });
            const near = v.gainFor(id);
            v.gameMessage("voice", {
                listener: { x: 0, y: 1.6, z: 0, h: 0 },
                players: [{ id, x: 500, y: 1.6, z: 0 }],
            });
            return {
                near,
                far: v.gainFor(id),
                unplaced: v.gainFor("someone-else"),
            };
        }, adaId);
        if (gains.near !== 1 || gains.far !== 0 || gains.unplaced !== null)
            throw new Error(
                `VOICE_POSES: wrong volumes from the game's poses (${JSON.stringify(
                    gains
                )})`
            );
        facts.spatial = true;

        // The game takes no part: a relay packet that reads as chat is
        // refused, an ordinary one still crosses, and no chat text was ever
        // posted to a game frame.
        const FORGED = "check: forged by the game";
        const relay = await ben.evaluate(
            (text) => ({
                forged: window.visitor.gameMessage("net", {
                    data: { type: "MESSAGE", text },
                }),
                packet: window.visitor.gameMessage("net", {
                    data: { check: "packet" },
                }),
            }),
            FORGED
        );
        if (relay.forged !== false || relay.packet !== true)
            throw new Error(
                "RELAY_GUARD: the game's relay accepted chat, or refused an ordinary packet"
            );
        await until(
            "RELAY_LOST: an ordinary game packet did not cross the room",
            async () =>
                (
                    await report(ada)
                ).relayed.some((packet) => packet?.check === "packet")
        );
        for (const [who, page] of [
            ["Ada", ada],
            ["Ben", ben],
        ]) {
            const r = await report(page);
            if (r.messages.some((m) => m.text === FORGED))
                throw new Error(
                    "RELAY_GUARD: the game spoke in a visitor's name"
                );
            if ([BEFORE, AFTER].some((text) => r.posted.includes(text)))
                throw new Error(
                    `CHAT_LEAKED: ${who}'s game frame was posted chat`
                );
        }
        facts.gameIsolated = true;
        facts.gameSent = (await report(ada)).fromGame;
        if (pageErrors.length) throw new Error(`PAGE_ERROR: ${pageErrors[0]}`);
        return {
            stage: "social",
            status: "passed",
            ms: Date.now() - started,
            facts,
        };
    } catch (error) {
        return {
            stage: "social",
            status: "failed",
            ms: Date.now() - started,
            error: String(error?.message ?? error).slice(0, 500),
            facts,
        };
    } finally {
        await context?.close().catch(() => {});
        server?.close();
    }
}
