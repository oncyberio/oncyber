// Who runs a round, and how the others follow it (docs/games/party.md).
//
// Alone, the visitor's own browser runs the round. In a party one member is
// the authority: it lights the lanterns, keeps the clock and the scores, and
// sends the whole round as a small snapshot on the match channel. Everyone
// else walks their own avatar, sends "I caught this lantern" and "I joined",
// and draws what the snapshots say. When the authority drops, leaves, hides
// its tab or goes silent for three seconds, the next member takes the round
// over from the last snapshot it received. A round in progress can be joined
// at any time, from zero. No DOM and no renderer here: the tests play whole
// rounds through an in-memory room.
import {
    catchLantern,
    createRound,
    joinRound,
    leaveRound,
    playing,
    readSnapshot,
    snapshot,
    stepRound,
    touching,
} from "./round.js";

const SILENCE_MS = 3000;
const KNOWN_MS = 4000;
const PARTY_FORMATS = ["duel", "round"];

/**
 * `link` is the runtime's party link (roster, channel, events) or a stand-in
 * with the same shape. `authorityOf(roster, ids)` is the runtime's
 * `matchAuthority`. `onEvent(event)` hears what happened, for sound and the
 * HUD: lit, faded, caught (with `mine`), started, joined, taken-over, over.
 */
export function createMatch({
    link,
    authorityOf,
    self,
    now = () => performance.now(),
    newId = () =>
        `lt-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(
            36
        )}`,
    onEvent = () => {},
}) {
    let round = null,
        format = "",
        role = "",
        authority = "",
        heard = 0,
        away = false;
    // A party round heard on the channel that this member is not in.
    let known = null;
    // Lanterns this guest has already claimed: `post:since`.
    const claimed = new Set();
    const off = [];

    const inRoster = (id) => link.roster.members.some((m) => m.id === id);
    const here = (id) =>
        link.roster.members.some((m) => m.id === id && m.state === "here");
    const party = () => PARTY_FORMATS.includes(format);
    const send = (data, to) => link.channel.event(data, to);

    function finish() {
        if (!round) return;
        round.over = true;
        round.lit = {};
        onEvent({ type: "over" });
    }

    /** The next member to run the round when `gone` no longer can. */
    function successor(gone) {
        const ids = playing(round).filter(
            (id) => id !== gone && (id === self() || here(id))
        );
        return (
            authorityOf(link.roster, ids) ||
            (ids.includes(self()) ? self() : "")
        );
    }

    function takeOver(gone) {
        if (!round || role !== "guest") return;
        const next = successor(gone);
        if (gone) leaveRound(round, gone);
        if (next === self()) {
            role = "authority";
            authority = self();
            joinRound(round, self());
            onEvent({ type: "taken-over" });
        } else if (next) {
            // Someone else's to run: wait for their snapshots.
            authority = next;
            heard = now();
        }
    }

    function follow(next, nextFormat, from) {
        const before = round;
        round = next;
        format = nextFormat;
        role = "guest";
        authority = from;
        heard = now();
        if (before && before.id === next.id) {
            for (const post of Object.keys(next.lit))
                if (before.lit[post] !== next.lit[post])
                    onEvent({ type: "lit", post: Number(post) });
            const mine = self();
            if ((next.scores[mine] ?? 0) > (before.scores[mine] ?? 0))
                onEvent({ type: "caught", mine: true });
        }
        if (next.over && !(before && before.id === next.id && before.over))
            onEvent({ type: "over" });
    }

    off.push(
        link.on("match", ({ from, data }) => {
            if (!inRoster(from) || from === self() || !Array.isArray(data))
                return;
            const [kind, a, b, c] = data;
            if (kind === "s" || kind === "o") {
                if (!PARTY_FORMATS.includes(a)) return;
                const next = readSnapshot(b, (id) => inRoster(id));
                if (!next) return;
                if (!round || round.over) {
                    // Not playing: remember it, so the menu can offer it.
                    if (!next.over)
                        known = { round: next, format: a, from, at: now() };
                    else if (known?.round.id === next.id) known = null;
                    return;
                }
                if (!party()) return;
                if (role === "authority") {
                    // Two members running a round: the one the roster
                    // names keeps it, the other follows.
                    if (authorityOf(link.roster, [self(), from]) === self())
                        return;
                    if (next.id !== round.id)
                        onEvent({ type: "merged", id: next.id });
                    send(["j", next.id], from);
                    follow(next, a, from);
                    return;
                }
                if (next.id !== round.id) return;
                // The authority's word; or anyone's once it has gone or
                // gone quiet (it handed the round on, or was taken over).
                if (
                    from !== authority &&
                    here(authority) &&
                    now() - heard < 1000
                )
                    return;
                follow(next, a, from);
                return;
            }
            if (!round || role !== "authority" || a !== round.id) {
                // The authority said it is stepping away.
                if (
                    kind === "a" &&
                    round &&
                    a === round.id &&
                    from === authority
                )
                    takeOver(from);
                return;
            }
            if (kind === "j") {
                if (joinRound(round, from))
                    onEvent({ type: "joined", id: from });
            } else if (kind === "c") {
                if (
                    Number.isInteger(b) &&
                    typeof c === "number" &&
                    catchLantern(round, from, b, c / 10)
                )
                    onEvent({ type: "caught", mine: false, id: from });
            } else if (kind === "l" || kind === "a") leaveRound(round, from);
        }),
        link.on("dropped", ({ member }) => gone(member.id)),
        link.on("left", ({ member }) => gone(member.id))
    );
    function gone(id) {
        if (known?.from === id) known = null;
        if (!round || round.over || !party()) return;
        if (role === "authority") leaveRound(round, id);
        else if (id === authority) takeOver(id);
    }

    return {
        get round() {
            return round;
        },
        get format() {
            return format;
        },
        get role() {
            return role;
        },
        get authority() {
            return authority;
        },
        /** True while a round other people can be in is being played. */
        get versus() {
            return !!round && !round.over && party();
        },
        /** A party round in progress that the visitor could join, or null. */
        joinable() {
            if (known && (now() - known.at > KNOWN_MS || !here(known.from)))
                known = null;
            return known;
        },
        /** Start a round alone: this browser runs it. */
        startSolo({ seed, duration }) {
            format = "solo";
            role = "solo";
            authority = self();
            round = createRound({
                id: newId(),
                seed,
                duration,
                players: [self()],
            });
            onEvent({ type: "started" });
            return round.id;
        },
        /**
         * Start the party's round, or join the one in progress. Returns
         * the round's id, which every member's result is reported under.
         */
        startParty({ format: wanted, seed, duration }) {
            const open = this.joinable();
            claimed.clear();
            if (open) {
                known = null;
                round = open.round;
                format = open.format;
                role = "guest";
                authority = open.from;
                heard = now();
                send(["j", round.id], authority);
                onEvent({ type: "started", joined: true });
                return round.id;
            }
            format = wanted;
            role = "authority";
            authority = self();
            round = createRound({
                id: newId(),
                seed,
                duration,
                players: [self()],
            });
            onEvent({ type: "started" });
            return round.id;
        },
        /** Once a frame while a round is on. `position` is the visitor's [x, z]. */
        update(seconds, position) {
            if (!round || round.over) return;
            if (role === "guest") {
                // The clock runs on between snapshots, never past them by much.
                round.elapsed = Math.min(
                    round.duration,
                    round.elapsed + seconds
                );
                if (!away)
                    for (const post of touching(round, position)) {
                        const key = `${post}:${round.lit[post]}`;
                        if (claimed.has(key)) continue;
                        claimed.add(key);
                        send(
                            [
                                "c",
                                round.id,
                                post,
                                Math.round(round.lit[post] * 10),
                            ],
                            authority
                        );
                    }
                if (now() - heard > SILENCE_MS) takeOver(authority);
            } else {
                for (const event of stepRound(round, seconds)) {
                    if (event.type === "over") continue;
                    onEvent(event);
                }
                if (!away)
                    for (const post of touching(round, position))
                        if (catchLantern(round, self(), post, round.lit[post]))
                            onEvent({ type: "caught", mine: true });
                if (party()) {
                    if (round.over) {
                        // The last word must arrive: an event, not a state.
                        send(["o", format, snapshot(round)]);
                        link.channel.flush();
                    } else link.channel.state(["s", format, snapshot(round)]);
                }
                if (round.over) onEvent({ type: "over" });
            }
            if (party()) link.channel.pump();
        },
        /** The visitor leaves the round before it ends. */
        leave() {
            if (round && !round.over && party()) {
                if (role === "guest") send(["l", round.id], authority);
                else {
                    // Hand the round to whoever is next before going:
                    // they run it on from the last snapshot they have.
                    link.channel.state(null);
                    send(["a", round.id]);
                }
                link.channel.flush();
                link.channel.pump();
            }
            round = null;
            format = role = authority = "";
            claimed.clear();
        },
        /** The round is over and has been shown: forget it. */
        clear() {
            round = null;
            format = role = authority = "";
            claimed.clear();
        },
        /**
         * The tab was hidden or shown (docs/games/loading-and-pausing.md):
         * a hidden member draws no frames, so it says so and, when others
         * are playing, lets the next member run the round.
         */
        away(hidden) {
            away = hidden;
            if (!round || round.over || !party()) return;
            if (hidden) {
                const others = playing(round).filter(
                    (id) => id !== self() && here(id)
                );
                if (role === "authority" && others.length) {
                    link.channel.state(null);
                    send(["a", round.id]);
                    link.channel.flush();
                    role = "guest";
                    authority = authorityOf(link.roster, others) || others[0];
                    heard = now();
                }
            } else if (role === "guest") {
                // Back: ask whoever kept the round going for the seat.
                send(["j", round.id], authority);
                heard = now();
            }
        },
        /** What the party check asks about the round (PartyReport.match). */
        report() {
            if (!round || round.over) return null;
            return {
                format,
                players: playing(round),
                authority,
                role,
                progress: Math.round(round.elapsed * 10),
                standIns: [],
            };
        },
        finish,
        dispose() {
            off.forEach((stop) => stop());
        },
    };
}
