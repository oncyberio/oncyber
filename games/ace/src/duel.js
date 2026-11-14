import { createEngine, serveGaugeAt, startMatch, update } from "./engine.js";
import {
    adopt,
    applyRivalEdge,
    applyRivalMove,
    applySnapshot,
    applyStats,
    mirrorEvent,
    readEvent,
    packInput,
    packStats,
    seatRival,
    snapshot,
    standIn,
    stepView,
    wireEvents,
} from "./versus.js";

// Who runs a 1 v 1 and what happens when someone comes or goes. Two party
// members each pick 1 v 1; the party's host runs the engine (the
// authority) and the other plays as its guest over the match channel.
//
//   The other player drops, hides the tab or leaves: the CPU takes their
//   place and the match goes on. When they come back they ask to rejoin
//   and get their side back, score intact.
//   The authority goes: the guest takes the match over the same way.
//   Anyone else in the room can watch.
//
// Packets (all `{ t, n }`, n = match number): want, start, s (snapshot),
// ev (events), in / press / release (the guest's input), rejoin, away,
// bye, live. No DOM here; main.js draws what `duel.engine` holds.

const WANT_EVERY = 1000;
const WANT_FRESH = 3500;
const LIVE_EVERY = 1000;
const STALL_MS = 3000;
const REJOIN_FOR = 12000;
/** A games-to-win count off the wire, or `fallback`. */
const gamesOf = (g, fallback) =>
    Number.isInteger(g) && g >= 1 && g <= 9 ? g : fallback;

/**
 * @param link  createPartyLink(...) from the game runtime
 * @param hooks { start({ role, players, foe, games, resume }), note(text), over() }
 * @param pick  matchAuthority from the game runtime
 */
export function createDuel({
    link,
    hooks,
    pick,
    now = () => performance.now(),
    settings = () => ({}),
}) {
    const duel = {
        /** "idle" | "waiting" | "playing" */
        state: "idle",
        /** "authority" | "guest" | "watch" | null */
        role: null,
        engine: null,
        players: [],
        foe: "",
        games: 2,
        n: 0,
        /** The CPU is holding the other player's place. */
        standIn: false,
        /** Someone else's match seen on the channel: { from, players, at }. */
        live: null,
        /** This member's own match, still running without them (a reload). */
        mine: null,
        wants: new Map(),
    };
    const channel = link.channel;
    let events = [];
    let wantAt = 0;
    let liveAt = 0;
    let stateAt = 0;
    let snapTime = 0;
    let authority = "";
    let adopted = false;
    let gone = false;
    let rejoinUntil = 0;
    let rejoinAt = 0;
    let hidden = false;

    const self = () => link.roster.self;
    const member = (id) => link.roster.members.find((m) => m.id === id) ?? null;
    const nameOf = (id) => member(id)?.name ?? "Player";
    const send = (t, data = {}, to) =>
        channel.event({ t, n: duel.n, ...data }, to);

    /** The one other seated player, when the party is exactly two. */
    function partner() {
        const seated = link.roster.members.filter((m) => m.seat === "player");
        if (seated.length !== 2 || !self()) return null;
        return seated.find((m) => m.id !== self()) ?? null;
    }

    function tryStart() {
        if (duel.state !== "waiting" || !link.roster.online) return;
        const other = partner();
        const theirs = other && duel.wants.get(other.id);
        if (
            !other ||
            other.state !== "here" ||
            !theirs ||
            now() - theirs.at > WANT_FRESH
        )
            return;
        const players = [self(), other.id];
        if (pick(link.roster, players) !== self()) return; // their start is coming
        duel.n = Math.max(duel.n, theirs.n || 0) + 1;
        send("start", { g: duel.games, p: players });
        begin("authority", players, duel.games, false);
    }

    function begin(role, players, games, resume) {
        duel.state = "playing";
        duel.role = role;
        duel.players = players;
        duel.foe = players.find((id) => id !== self()) ?? "";
        duel.games = games;
        duel.standIn = false;
        duel.wants.clear();
        events = [];
        adopted = false;
        gone = false;
        rejoinUntil = 0;
        stateAt = now();
        if (role === "authority") {
            authority = self();
            const engine = createEngine({
                difficulty: settings().difficulty,
                games,
                seed: (Math.random() * 1e9) | 0,
            });
            startMatch(engine);
            seatRival(engine);
            duel.engine = engine;
        } else {
            authority = players[0];
            // A guest or spectator who already holds an engine keeps it:
            // the renderer is pointing at it.
            if (!resume || !duel.engine) {
                duel.engine = createEngine({ games, seed: 1 });
                startMatch(duel.engine);
            }
            duel.engine.remote = false; // the first snapshot places everything
        }
        hooks.start({ role, players, foe: duel.foe, games, resume });
    }

    /** This side now runs the match; the CPU plays the other player. */
    function carryOn(why) {
        if (duel.state !== "playing" || duel.role === "watch") return;
        if (duel.role === "guest") {
            adopt(duel.engine);
            duel.role = "authority";
            authority = self();
            adopted = true;
            events = [];
        } else if (duel.engine.rival) standIn(duel.engine);
        if (!duel.standIn && why) hooks.note(why);
        duel.standIn = true;
    }

    /** The other player is back: this side keeps the engine, they steer again. */
    function resume() {
        seatRival(duel.engine);
        duel.standIn = false;
        gone = false;
        rejoinUntil = 0;
        send(
            "start",
            { g: duel.games, p: [self(), duel.foe], resume: true },
            duel.foe
        );
        hooks.note(`${nameOf(duel.foe)} is back`);
    }

    /** Hand the engine over and play on as the other side's guest. */
    function yieldTo(from, d) {
        authority = from;
        duel.role = "guest";
        duel.standIn = false;
        duel.games = gamesOf(d.g, duel.games);
        duel.n = d.n || duel.n;
        adopted = false;
        gone = false;
        rejoinUntil = 0;
        events = [];
        stateAt = now();
        duel.engine.rival = null;
        duel.engine.remote = false;
        hooks.start({
            role: "guest",
            players: duel.players,
            foe: duel.foe,
            games: duel.games,
            resume: true,
        });
    }

    function askToRejoin() {
        if (duel.state !== "playing" || duel.role === "watch" || gone) return;
        rejoinUntil = now() + REJOIN_FOR;
        rejoinAt = 0;
    }

    function endWatch() {
        duel.state = "idle";
        duel.role = null;
        duel.live = null;
        hooks.over();
    }

    // ------------------------------------------------------------ choices

    /** Pick 1 v 1 (or a rematch): starts once the other player has too. */
    duel.want = (games = 2) => {
        if (
            duel.state === "playing" &&
            duel.role !== "watch" &&
            duel.engine?.match.winner === null &&
            !gone
        )
            return;
        duel.state = "waiting";
        duel.role = null;
        duel.games = games;
        wantAt = 0;
        tryStart();
    };
    duel.cancel = () => {
        if (duel.state !== "waiting") return;
        duel.state = "idle";
        send("want", { f: null });
    };
    /** Watch the match other members are playing. */
    duel.watch = () => {
        if (!duel.live || duel.state === "playing") return false;
        duel.n = duel.live.n;
        begin("watch", duel.live.players, 2, false);
        authority = duel.live.from;
        return true;
    };
    /** Back after a reload: take this member's side of their match again. */
    duel.rejoin = () => {
        if (!duel.mine || duel.state === "playing") return false;
        const { from, n } = duel.mine;
        duel.n = n;
        duel.mine = null;
        begin("guest", [from, self()], duel.games, false);
        send("rejoin", {}, from);
        return true;
    };
    /** Walk away from the match or the wait. */
    duel.leave = () => {
        if (duel.state === "playing" && duel.role !== "watch") send("bye");
        if (duel.state === "waiting") send("want", { f: null });
        duel.state = "idle";
        duel.role = null;
        channel.flush();
    };
    /** The tab was hidden or shown: a hidden player can't play their side. */
    duel.hidden = (isHidden) => {
        if (hidden === isHidden) return;
        hidden = isHidden;
        if (duel.state !== "playing" || duel.role === "watch") return;
        if (isHidden) {
            send("away");
            channel.flush();
        } else {
            // Whoever stayed has the match now; ask for this side back.
            carryOn("");
            askToRejoin();
        }
    };

    // ------------------------------------------------------------ roster

    link.on("roster", (roster, changes) => {
        for (const e of changes) {
            if (e.type === "offline") {
                carryOn("Connection lost. Playing on against the CPU");
            } else if (e.type === "online") {
                askToRejoin();
            } else if (
                (e.type === "dropped" || e.type === "left") &&
                duel.state === "playing"
            ) {
                if (duel.role === "watch") {
                    if (e.member.id === authority) endWatch();
                } else if (e.member.id === duel.foe) {
                    carryOn(`${e.member.name} dropped. The CPU plays on`);
                    if (e.type === "left") gone = true;
                }
            }
            if (e.type === "left" || e.type === "dropped")
                duel.wants.delete(e.member.id);
        }
        if (duel.live && !member(duel.live.from)) duel.live = null;
        tryStart();
    });

    // ----------------------------------------------------------- packets

    link.on("match", ({ from, data: d }) => {
        if (!d || typeof d.t !== "string" || from === self()) return;
        const playing = duel.state === "playing" && duel.role !== "watch";
        const fromFoe = playing && from === duel.foe;
        switch (d.t) {
            case "want":
                if (d.f === "singles") {
                    const live =
                        playing &&
                        duel.engine.match.winner === null &&
                        !duel.standIn;
                    if (
                        !duel.wants.has(from) &&
                        duel.state !== "waiting" &&
                        !live
                    )
                        hooks.note(`${nameOf(from)} wants to play 1 v 1`);
                    duel.wants.set(from, { at: now(), n: d.n | 0, g: d.g });
                } else duel.wants.delete(from);
                tryStart();
                break;
            case "start": {
                if (
                    !Array.isArray(d.p) ||
                    d.p.length !== 2 ||
                    d.p[0] !== from ||
                    !d.p.includes(self())
                )
                    break;
                if (playing && duel.role === "authority") {
                    // Two engines for one match. The side that asked to
                    // rejoin, or was told the other took over, gives way.
                    if (fromFoe && (rejoinUntil || d.resume)) yieldTo(from, d);
                    else if (!fromFoe || from < self()) {
                        duel.n = d.n | 0;
                        begin("guest", d.p, gamesOf(d.g, 2), false);
                    }
                } else if (playing && fromFoe && d.resume) {
                    if (authority !== from) yieldTo(from, d);
                } else if (duel.state === "waiting") {
                    duel.n = d.n | 0;
                    begin("guest", d.p, gamesOf(d.g, 2), false);
                }
                break;
            }
            case "s":
                if (
                    duel.state === "playing" &&
                    duel.role !== "authority" &&
                    from === authority
                ) {
                    if (
                        applySnapshot(duel.engine, d.s, duel.role === "guest")
                    ) {
                        stateAt = now();
                        snapTime = duel.engine.time;
                    }
                } else if (
                    fromFoe &&
                    adopted &&
                    !rejoinUntil &&
                    now() - rejoinAt > 1000
                ) {
                    // They are still sending their own match: say who has it.
                    rejoinAt = now();
                    resume();
                } else if (!playing && duel.live?.from === from)
                    duel.live.at = now();
                else if (!playing && duel.mine?.from === from)
                    duel.mine.at = now();
                break;
            case "ev":
                if (
                    duel.state !== "playing" ||
                    duel.role === "authority" ||
                    from !== authority ||
                    !Array.isArray(d.e)
                )
                    break;
                applyStats(duel.engine, d.st, duel.role === "guest");
                for (const raw of d.e.slice(0, 16)) {
                    const e = readEvent(raw);
                    if (!e) continue;
                    const event = duel.role === "guest" ? mirrorEvent(e) : e;
                    // The freeze frame on a perfect hit, as the authority had.
                    if (event.type === "hit" && event.grade === "perfect")
                        duel.engine.freeze =
                            event.kind === "smash" ? 0.12 : 0.085;
                    events.push(event);
                }
                break;
            case "in":
                if (fromFoe && duel.role === "authority")
                    applyRivalMove(duel.engine, d.i);
                break;
            case "press":
            case "release":
                if (fromFoe && duel.role === "authority")
                    applyRivalEdge(duel.engine, d.t, d.s, d.g);
                break;
            case "rejoin":
                if (
                    !fromFoe ||
                    duel.role !== "authority" ||
                    duel.engine.match.winner !== null
                )
                    break;
                // Both came back at once: the roster names one authority.
                if (rejoinUntil && pick(link.roster, duel.players) !== self())
                    break;
                resume();
                break;
            case "away":
                if (fromFoe)
                    carryOn(`${nameOf(from)} stepped away. The CPU plays on`);
                break;
            case "bye":
                if (fromFoe) {
                    carryOn(`${nameOf(from)} left. The CPU plays on`);
                    gone = true;
                }
                if (duel.role === "watch" && from === authority) endWatch();
                break;
            case "live":
                if (playing || !Array.isArray(d.p)) break;
                if (d.p.includes(self()))
                    duel.mine = { from, n: d.n | 0, at: now() };
                else
                    duel.live = {
                        from,
                        players: d.p.slice(0, 2).map(String),
                        n: d.n | 0,
                        at: now(),
                    };
                break;
            default:
                break;
        }
    });

    // ------------------------------------------------------------- frame

    /**
     * Once per frame, in menus too. While a match is on it advances
     * `duel.engine` and returns that frame's engine events for this
     * screen (already turned around for a guest).
     */
    duel.frame = (input, dt, paused = false) => {
        const time = now();
        let out = [];
        if (duel.state === "waiting" && time - wantAt >= WANT_EVERY) {
            wantAt = time;
            send("want", { f: "singles", g: duel.games });
        }
        if (
            duel.live &&
            time - duel.live.at > STALL_MS &&
            duel.state !== "playing"
        )
            duel.live = null;
        if (duel.mine && time - duel.mine.at > STALL_MS) duel.mine = null;
        if (duel.state === "playing") {
            const e = duel.engine;
            if (duel.role === "authority") {
                // A match between two people has no pause: the menu opens
                // over it. Alone against the CPU it can wait.
                if (!paused || !duel.standIn) {
                    out = [...update(e, input, dt)];
                    channel.state({ t: "s", n: duel.n, s: snapshot(e) });
                    if (out.length) {
                        const point = out.some(
                            (x) => x.type === "point" || x.type === "match"
                        );
                        send("ev", {
                            e: wireEvents(out),
                            ...(point ? { st: packStats(e.match) } : {}),
                        });
                    }
                }
                if (time - liveAt >= LIVE_EVERY) {
                    liveAt = time;
                    send("live", { p: duel.players });
                }
                if (rejoinUntil) {
                    if (time > rejoinUntil) rejoinUntil = 0;
                    else if (time - rejoinAt >= 1000) {
                        rejoinAt = time;
                        send("rejoin", {}, duel.foe);
                    }
                }
            } else {
                stepView(e, dt);
                out = events;
                events = [];
                if (duel.role === "guest") {
                    e.humanAim = input.aim;
                    channel.state({ t: "in", n: duel.n, i: packInput(input) });
                    const gauge =
                        e.phase === "toss" && e.match.server === 0
                            ? serveGaugeAt(e.time - e.tossAt)
                            : undefined;
                    if (input.press)
                        send("press", { s: input.press, g: gauge });
                    if (input.release) send("release", { g: gauge });
                    // No word from the authority and no roster change: it
                    // has stalled. Take the match rather than freeze.
                    if (time - stateAt > STALL_MS && e.match.winner === null)
                        carryOn(
                            `Lost touch with ${nameOf(
                                duel.foe
                            )}. The CPU plays on`
                        );
                } else if (time - stateAt > STALL_MS * 2) endWatch();
            }
        }
        channel.pump();
        return out;
    };

    duel.authority = () => authority;
    /** For the party report and the HUD. */
    duel.describe = () =>
        duel.state !== "playing"
            ? null
            : {
                  format: "singles",
                  players: duel.players,
                  authority,
                  role: duel.role === "watch" ? "spectator" : duel.role,
                  // The match clock as simulated: a guest's own guess
                  // between snapshots is not the match moving.
                  progress: Math.round(
                      (duel.role === "authority"
                          ? duel.engine.time
                          : snapTime) * 10
                  ),
                  standIns: duel.standIn ? [duel.foe] : [],
              };
    return duel;
}
