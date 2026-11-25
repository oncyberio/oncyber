// The party stage of `pnpm games:check` (docs/games/party.md).
//
// 1. Statement: game.json says what the game offers a party of 1, 2, 3, 4
//    and 5 to 8 (always with a solo option), and what late, dropped and
//    extra players get. The options by size are the contract's
//    `party.formats` (docs/games/contract.md): one declaration, read here
//    and by the contract check.
// 2. Options: the game is told it arrived with a party of each size and
//    asked what it offers. The answers must match the statement, include
//    a solo option every time, and differ between two and four.
// 3. Drop: two copies of the game join one party and start the format the
//    statement names (`play`). Mid-match one member drops; the other's
//    match must keep moving. Then again, dropping the host.
//
// The page here stands in for the game page and the party's room: it
// sends the trip with the room's roster in it (`enter` to a contract
// game, then `party` on every change), relays `match` packets between the
// frames under the channel's real limits, and asks each game for its
// report (`party-probe` / `party-report`, see
// games/runtime/src/partyLink.ts). It answers a game in the prefix its
// `hello` came in.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

// The channel's limits, as multiplayer/src/rooms/cyber/match/limits.ts
// (held to the runtime's and the page's by games/runtime/test/parity.test.mjs).
const MATCH_RATE = 32;
const MATCH_BURST = 16;
const MATCH_MAX_BYTES = 1200;
const SIZES = [1, 2, 3, 4, 5, 6, 7, 8];
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

/** The option ids game.json offers a party of `count`, in the order it shows them. */
export function statedOptions(party, count) {
    return (Array.isArray(party?.formats) ? party.formats : [])
        .filter(
            (format) =>
                Array.isArray(format?.sizes) && format.sizes.includes(count)
        )
        .map((format) => format.id);
}

/** Findings from game.json alone. */
export function partyStatement(manifest) {
    const findings = [];
    const party = manifest?.party;
    const add = (message) =>
        findings.push({ code: "PARTY_STATEMENT", message });
    if (!party || typeof party !== "object") {
        add(
            'game.json has no "party" block: state what 1, 2, 3, 4 and 5-8 players get, and what late, dropped and extra players get'
        );
        return findings;
    }
    const solo = typeof party.solo === "string" ? party.solo : "";
    if (!solo) add("party.solo must name the option one member can play alone");
    for (const size of SIZES) {
        const options = statedOptions(party, size);
        if (!options.length || options.some((o) => typeof o !== "string" || !o))
            add(
                `a party of ${size} is offered nothing: party.formats must list the options for every size from 1 to 8`
            );
        else if (solo && !options.includes(solo))
            add(`a party of ${size} has no solo option ("${solo}")`);
    }
    for (const key of ["late", "dropped", "extra"])
        if (typeof party[key] !== "string" || party[key].trim().length < 12)
            add(`party.${key} must say what a ${key} player gets`);
    const same =
        JSON.stringify(statedOptions(party, 2)) ===
        JSON.stringify(statedOptions(party, 4));
    if (same && typeof party.shared !== "string")
        add(
            "a party of 2 and a party of 4 are offered the same options; offer each its own, or say why not in party.shared"
        );
    if (
        party.play !== undefined &&
        (typeof party.play !== "string" ||
            !statedOptions(party, 2).includes(party.play))
    )
        add("party.play must be an option offered to a party of 2");
    return findings;
}

const harness = (
    id
) => `<!doctype html><meta charset="utf-8"><title>party check</title>
<style>html,body{margin:0;height:100%;background:#000;display:flex}iframe{border:0;flex:1;min-width:0;height:100%}</style>
<script>
const GAME = ${JSON.stringify(id)};
const LIMIT = { rate: ${MATCH_RATE}, burst: ${MATCH_BURST}, bytes: ${MATCH_MAX_BYTES} };
const seats = new Map(); // member id -> { frame, ready, state, order, name, tokens, last, sent, refused, largest }
const ghosts = []; // members with no frame, for the options stage
let party = null, order = 0, probeId = 0;
const waiting = new Map();
const CONTRACT = "oncyber:game:";
// A game is answered in the prefix its hello came in.
const post = (seat, kind, data) => seat.prefix && seat.frame && seat.frame.contentWindow && seat.frame.contentWindow.postMessage({ type: seat.prefix + kind, ...data }, "*");
function roster(self) {
    const members = [...[...seats].map(([id, s]) => ({ id, session: s.state === "here" ? id : "", name: s.name, seat: "player", state: s.state, order: s.order })), ...ghosts];
    members.sort((a, b) => a.order - b.order);
    const host = members.find((m) => m.state === "here");
    return { self, host: host ? host.id : "", online: true, members };
}
// The trip as the game page sends it: the party, with the room's roster in it.
function trip(self) {
    const list = roster(self);
    const others = list.members.filter((m) => m.id !== self);
    if (!party || !others.length) return null;
    const member = (m) => ({ id: m.id, name: m.name, pfp: "", avatarUrl: "" });
    return { id: party, room: "check-party-room", size: others.length + 1, members: others.map(member), self, arrived: others.filter((m) => m.state === "here").map(member), roster: list };
}
function announce() {
    for (const [id, seat] of seats)
        if (seat.state === "here") post(seat, "party", { party: trip(id) });
}
addEventListener("message", (event) => {
    const entry = [...seats].find(([, s]) => s.frame && s.frame.contentWindow === event.source);
    const type = event.data && event.data.type;
    const prefix = typeof type === "string" && [CONTRACT, GAME + ":"].find((p) => type.startsWith(p));
    if (!entry || !prefix) return;
    const [id, seat] = entry;
    const kind = type.slice(prefix.length);
    if (kind === "hello" && !seat.greeted) {
        seat.greeted = true;
        seat.prefix = prefix;
        post(seat, "identity", { name: seat.name, pfp: "", avatarUrl: "" });
        // A contract game gets its visit, the trip included, in enter.
        if (prefix === CONTRACT) post(seat, "enter", { arrival: { from: "direct", view: null }, trip: trip(id) });
        announce();
    } else if (kind === "ready") {
        seat.ready = true;
        post(seat, "entered", {});
        announce();
    } else if (kind === "error") seat.error = String(event.data.message || "error");
    else if (kind === "party-report") {
        const done = waiting.get(event.data.id);
        if (done) { waiting.delete(event.data.id); done(event.data.report); }
    } else if (kind === "match") {
        // The room's rules: a size cap and a token bucket per sender.
        const now = performance.now();
        seat.tokens = Math.min(LIMIT.burst, seat.tokens + ((now - seat.last) / 1000) * LIMIT.rate);
        seat.last = now;
        const data = event.data.data;
        let bytes = Infinity;
        try { bytes = JSON.stringify(data).length; } catch {}
        seat.largest = Math.max(seat.largest, Number.isFinite(bytes) ? bytes : 0);
        if (!Array.isArray(data) || bytes > LIMIT.bytes || seat.tokens < 1) { seat.refused++; return; }
        seat.tokens -= 1;
        seat.sent++;
        for (const [other, peer] of seats)
            if (other !== id && peer.state === "here" && (!event.data.to || event.data.to === other)) post(peer, "match", { from: id, data });
    }
});
window.__party = {
    join(id, name) {
        const frame = document.createElement("iframe");
        frame.setAttribute("sandbox", "allow-scripts allow-pointer-lock");
        frame.setAttribute("referrerpolicy", "no-referrer");
        frame.src = "/games/" + GAME + "/index.html?check=party";
        seats.set(id, { frame, name, state: "here", order: ++order, ready: false, tokens: LIMIT.burst, last: performance.now(), sent: 0, refused: 0, largest: 0 });
        document.body.append(frame);
    },
    /** The connection drops: the frame goes, the seat is held as away. */
    drop(id) {
        const seat = seats.get(id);
        seat.frame.remove();
        seat.frame = null;
        seat.state = "away";
        announce();
    },
    /** A party of \`size\`: the frames plus members who exist only on the roster. */
    resize(size, id) {
        party = size > 1 ? id : null;
        ghosts.length = 0;
        for (let i = seats.size; i < size; i++) ghosts.push({ id: "ghost-" + i, session: "ghost-" + i, name: "Player " + (i + 1), seat: "player", state: "here", order: 100 + i });
        announce();
    },
    probe(id, op, option) {
        const seat = seats.get(id);
        const n = ++probeId;
        return new Promise((done) => {
            waiting.set(n, done);
            setTimeout(() => { if (waiting.delete(n)) done(null); }, 2000);
            post(seat, "party-probe", { id: n, op, option });
        });
    },
    status() {
        return Object.fromEntries([...seats].map(([id, s]) => [id, { ready: s.ready, error: s.error || null, state: s.state, sent: s.sent, refused: s.refused, largest: s.largest }]));
    },
};
</script>`;

function serve(id, out) {
    const server = createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname === "/") {
            res.writeHead(200, { "content-type": "text/html" });
            return res.end(harness(id));
        }
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
        res.writeHead(200, {
            "content-type": TYPES[extname(path)] ?? "application/octet-stream",
            "access-control-allow-origin": "*",
        });
        res.end(readFileSync(path));
    });
    return new Promise((done) =>
        server.listen(0, "127.0.0.1", () => done(server))
    );
}

class PartyFailure extends Error {}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * Run the stage. Returns { status: "passed" | "failed" | "skipped",
 * findings, detail } and never throws for a game's failure.
 */
export async function partyCheck({
    id,
    manifest,
    out,
    source,
    headed = false,
    network = null,
}) {
    const started = Date.now();
    const findings = partyStatement(manifest);
    const detail = { options: {}, drops: [] };
    const done = (status) => ({
        stage: "party",
        status,
        ms: Date.now() - started,
        findings,
        detail,
    });
    if (findings.length) return done("failed");
    const statement = manifest.party;
    // One shared activity for any size: nothing to tell apart or to drop.
    if (typeof statement.shared === "string") return done("passed");

    let chromium;
    try {
        ({ chromium } = createRequire(import.meta.url)("playwright"));
    } catch {
        findings.push({ code: "PARTY_CHECK", message: "Playwright not found" });
        return done("failed");
    }
    const server = await serve(id, out);
    const browser = await chromium.launch({
        headless: !headed,
        channel: process.env.PW_CHANNEL || undefined,
        args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"],
    });
    // The game's files under its declared network policy (networkCheck.mjs).
    network?.guard(server);
    network?.patrol(browser);
    const url = `http://127.0.0.1:${server.address().port}/`;
    const partyId = "check-party-0123456789";

    async function open(members) {
        const page = await browser.newPage({
            viewport: { width: 1280, height: 480 },
        });
        await page.goto(url);
        for (const m of members)
            await page.evaluate(
                ([mid, name]) => window.__party.join(mid, name),
                [m, `Player ${m.toUpperCase()}`]
            );
        const deadline = Date.now() + 120_000;
        for (;;) {
            const status = await page.evaluate(() => window.__party.status());
            const failed = Object.entries(status).find(([, s]) => s.error);
            if (failed)
                throw new PartyFailure(
                    `${failed[0]} failed to load: ${failed[1].error}`
                );
            if (Object.values(status).every((s) => s.ready)) break;
            if (Date.now() > deadline)
                throw new PartyFailure(
                    "the game did not say ready within 120 s"
                );
            await sleep(250);
        }
        const probe = async (member, op = "report", option) => {
            const report = await page.evaluate(
                ([m, o, x]) => window.__party.probe(m, o, x),
                [member, op, option]
            );
            if (!report || !Array.isArray(report.options))
                throw new PartyFailure(
                    "the game did not answer the party probe; use createPartyLink(...).report(...)"
                );
            return report;
        };
        /** Poll a member's report until `test` passes. */
        const until = async (member, test, what, seconds) => {
            const end = Date.now() + seconds * 1000;
            let report;
            for (;;) {
                report = await probe(member);
                if (test(report)) return report;
                if (Date.now() > end)
                    throw new PartyFailure(
                        `${what} (member ${member}: ${JSON.stringify({
                            phase: report.phase,
                            match: report.match,
                        })})`
                    );
                await sleep(400);
            }
        };
        return { page, probe, until };
    }

    try {
        // ---- options by party size
        {
            const { page, probe } = await open(["a"]);
            for (const [key, size] of [
                ["1", 1],
                ["2", 2],
                ["3", 3],
                ["4", 4],
                ["5-8", 6],
            ]) {
                await page.evaluate(
                    ([n, p]) => window.__party.resize(n, p),
                    [size, partyId]
                );
                await sleep(300);
                const report = await probe("a");
                const offered = report.options.map((o) => o.id);
                detail.options[key] = offered;
                const stated = statedOptions(statement, size);
                if (
                    !report.options.some(
                        (o) => o.solo && o.id === statement.solo
                    )
                )
                    findings.push({
                        code: "PARTY_NO_SOLO",
                        message: `a party of ${size} is offered ${JSON.stringify(
                            offered
                        )}: no solo option`,
                    });
                if (JSON.stringify(offered) !== JSON.stringify(stated))
                    findings.push({
                        code: "PARTY_OPTIONS",
                        message: `a party of ${size} is offered ${JSON.stringify(
                            offered
                        )}; game.json states ${JSON.stringify(stated)}`,
                    });
            }
            if (
                JSON.stringify(detail.options["2"]) ===
                JSON.stringify(detail.options["4"])
            )
                findings.push({
                    code: "PARTY_OPTIONS_SAME",
                    message: `?party=2 and ?party=4 offer the same options: ${JSON.stringify(
                        detail.options["2"]
                    )}`,
                });
            await page.close();
        }

        // ---- drop a member mid-match: once the guest, once the host
        for (const dropped of statement.play ? ["b", "a"] : []) {
            const stays = dropped === "a" ? "b" : "a";
            const { page, probe, until } = await open(["a", "b"]);
            await page.evaluate((p) => window.__party.resize(2, p), partyId);
            await sleep(300);
            await probe("a", "choose", statement.play);
            await probe("b", "choose", statement.play);
            const inMatch = (r) =>
                r.phase === "match" &&
                r.match &&
                r.match.players.length === 2 &&
                r.match.progress > 0;
            await until(
                "a",
                inMatch,
                `picking "${statement.play}" on both members started no match`,
                30
            );
            await until(
                "b",
                inMatch,
                `picking "${statement.play}" on both members started no match`,
                30
            );
            // Let it play, and measure what the channel carried meanwhile.
            const before = await page.evaluate(() => window.__party.status());
            const t0 = Date.now();
            const first = await probe(stays);
            await until(
                stays,
                (r) => r.match && r.match.progress >= first.match.progress + 15,
                "the match did not move while both members were playing",
                30
            );
            const seconds = (Date.now() - t0) / 1000;
            const after = await page.evaluate(() => window.__party.status());
            const rate = Object.fromEntries(
                ["a", "b"].map((m) => [
                    m,
                    Math.round(
                        ((after[m].sent - before[m].sent) / seconds) * 10
                    ) / 10,
                ])
            );
            const refused = after.a.refused + after.b.refused;
            const largest = Math.max(after.a.largest, after.b.largest);
            if (refused)
                findings.push({
                    code: "PARTY_MATCH_LIMIT",
                    message: `${refused} packet(s) broke the match channel's limits (${MATCH_RATE} a second, ${MATCH_MAX_BYTES} bytes); largest ${largest}`,
                });
            mkdirSync(join(source, ".check"), { recursive: true });
            await page.screenshot({
                path: join(
                    source,
                    `.check/party-${
                        dropped === "a" ? "host" : "guest"
                    }-drop.png`
                ),
            });

            await page.evaluate((m) => window.__party.drop(m), dropped);
            const atDrop = await probe(stays);
            const went = await until(
                stays,
                (r) =>
                    r.phase === "match" &&
                    r.match &&
                    r.match.progress >= atDrop.match.progress + 15,
                `after ${
                    dropped === "a" ? "the host" : "a member"
                } dropped mid-match, the game stopped`,
                25
            );
            // Moving is not enough: a match that plays on against someone
            // who is no longer there has not noticed.
            if (
                went.match.players.includes(dropped) &&
                !(went.match.standIns ?? []).includes(dropped)
            )
                throw new PartyFailure(
                    `after ${
                        dropped === "a" ? "the host" : "a member"
                    } dropped, the match still counts them as playing: give their seat a stand-in (match.standIns) or take them out (match.players)`
                );
            detail.drops.push({
                dropped: dropped === "a" ? "host" : "guest",
                packetsPerSecond: rate,
                largestPacket: largest,
                refused,
                after: {
                    role: went.match.role,
                    authority: went.match.authority,
                    standIns: went.match.standIns,
                },
            });
            await page.close();
        }
    } catch (error) {
        if (!(error instanceof PartyFailure)) console.error(error);
        findings.push({
            code: "PARTY_CHECK",
            message: String(error?.message ?? error).slice(0, 600),
        });
    } finally {
        await browser.close();
        server.close();
    }
    return done(findings.length ? "failed" : "passed");
}
