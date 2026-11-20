/**
 * Match results: how a game tells Oncyber who won. A game opens a match with
 * `begin()` and closes it with exactly one `report()`; the page validates
 * the result, records it for the signed-in visitor and shows it to the
 * party. A result comes from one browser, so the page stores it as
 * unverified. No imports: the page check and the tests load this file as is.
 * See docs/games/results.md.
 */

export interface ResultPlayer {
    /** The game's id for this player: a room id, or any stable label. */
    id: string;
    name: string;
    /** `self` is the visitor reporting; `peer` another person; `cpu` the game. */
    kind: "self" | "peer" | "cpu";
}
export interface ResultTeam {
    /** Optional label for a side of more than one player. */
    name?: string;
    score: number;
    players: ResultPlayer[];
}
export interface MatchResult {
    /** Unique per match. Every browser in the same match sends the same id. */
    match: string;
    /** What was played: "cpu", "singles", "doubles", "race", ... */
    format: string;
    durationSeconds: number;
    /** Sides in the match; a solo player is a team of one. */
    teams: ResultTeam[];
    /** Index into `teams`, or null for a draw. */
    winner: number | null;
}
export type ResultRead =
    | { ok: true; result: MatchResult }
    | { ok: false; error: string };

export const RESULT_LIMITS = {
    match: /^[A-Za-z0-9_-]{6,64}$/,
    format: /^[a-z0-9][a-z0-9-]{0,31}$/,
    maxSeconds: 24 * 60 * 60,
    minTeams: 2,
    maxTeams: 8,
    maxPlayers: 16,
    maxScore: 1e9,
    idLength: 64,
    nameLength: 24,
} as const;
const KINDS = ["self", "peer", "cpu"];

const isObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "";

/**
 * The one definition of a valid result. Returns a clean copy (unknown
 * fields dropped, names trimmed) or the first rule that failed.
 */
export function readMatchResult(value: unknown): ResultRead {
    const fail = (error: string): ResultRead => ({ ok: false, error });
    if (!isObject(value)) return fail("RESULT_INVALID");
    const L = RESULT_LIMITS;
    if (typeof value.match !== "string" || !L.match.test(value.match))
        return fail("RESULT_MATCH_ID");
    if (typeof value.format !== "string" || !L.format.test(value.format))
        return fail("RESULT_FORMAT");
    const seconds = value.durationSeconds;
    if (
        typeof seconds !== "number" ||
        !Number.isFinite(seconds) ||
        seconds < 0 ||
        seconds > L.maxSeconds
    )
        return fail("RESULT_DURATION");
    if (
        !Array.isArray(value.teams) ||
        value.teams.length < L.minTeams ||
        value.teams.length > L.maxTeams
    )
        return fail("RESULT_TEAMS");
    const teams: ResultTeam[] = [];
    const ids = new Set<string>();
    let selves = 0;
    for (const raw of value.teams) {
        if (!isObject(raw)) return fail("RESULT_TEAMS");
        if (
            typeof raw.score !== "number" ||
            !Number.isFinite(raw.score) ||
            Math.abs(raw.score) > L.maxScore
        )
            return fail("RESULT_SCORE");
        if (!Array.isArray(raw.players) || raw.players.length < 1)
            return fail("RESULT_PLAYERS");
        const players: ResultPlayer[] = [];
        for (const p of raw.players) {
            if (!isObject(p)) return fail("RESULT_PLAYERS");
            const id =
                typeof p.id === "string" && p.id.length <= L.idLength
                    ? p.id
                    : "";
            const name = text(p.name, L.nameLength);
            if (
                !id ||
                !name ||
                typeof p.kind !== "string" ||
                !KINDS.includes(p.kind)
            )
                return fail("RESULT_PLAYERS");
            if (ids.has(id)) return fail("RESULT_PLAYER_REPEATED");
            ids.add(id);
            if (p.kind === "self") selves++;
            players.push({ id, name, kind: p.kind as ResultPlayer["kind"] });
        }
        const name = text(raw.name, L.nameLength);
        teams.push(
            name
                ? { name, score: raw.score, players }
                : { score: raw.score, players }
        );
    }
    if (ids.size > L.maxPlayers) return fail("RESULT_PLAYERS");
    // A browser may only report a match its own visitor played in.
    if (selves !== 1) return fail("RESULT_SELF");
    const winner = value.winner;
    if (
        winner !== null &&
        !(
            Number.isInteger(winner) &&
            (winner as number) >= 0 &&
            (winner as number) < teams.length
        )
    )
        return fail("RESULT_WINNER");
    return {
        ok: true,
        result: {
            match: value.match,
            format: value.format,
            durationSeconds: Math.round(seconds * 10) / 10,
            teams,
            winner: winner as number | null,
        },
    };
}

/** "win", "loss" or "draw" for the reporting visitor. */
export function resultOutcome(result: MatchResult): "win" | "loss" | "draw" {
    if (result.winner === null) return "draw";
    return result.teams[result.winner].players.some((p) => p.kind === "self")
        ? "win"
        : "loss";
}

export interface ResultReport {
    format: string;
    teams: ResultTeam[];
    winner: number | null;
    /** Defaults to the time since `begin()`. */
    durationSeconds?: number;
}
export interface Results {
    /**
     * A match starts. `match` is the shared id when several browsers play
     * the same match; left out, one is made. Starting a new match drops an
     * unfinished one, which then reports nothing.
     */
    begin(match?: string): string;
    /** The match ended: send its one result. Throws when there is no open match or the result is invalid. */
    report(report: ResultReport): MatchResult;
    /** The match was left before it ended: nothing is reported. */
    abandon(): void;
    /** For a game's `inspect()`: `{ matchOpen, resultsSent }`. */
    inspect(): { matchOpen: boolean; resultsSent: number };
}

/**
 * `send` posts the result to the page (the `result` message, in the form
 * the game speaks: `oncyber:game:result`, or `<id>:result`). `now`
 * is a millisecond clock. One reporter per game instance.
 */
export function createResults(
    send: (result: MatchResult) => void,
    now: () => number = () => Date.now()
): Results {
    let open: { match: string; at: number } | null = null;
    let sent = 0;
    const newId = () => {
        const bytes = new Uint8Array(12);
        globalThis.crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
            ""
        );
    };
    return {
        begin(match) {
            const id = match ?? newId();
            if (!RESULT_LIMITS.match.test(id))
                throw new Error("RESULT_MATCH_ID");
            open = { match: id, at: now() };
            return id;
        },
        report(report) {
            if (!open) throw new Error("RESULT_NO_OPEN_MATCH");
            const read = readMatchResult({
                match: open.match,
                format: report?.format,
                durationSeconds:
                    report?.durationSeconds ??
                    Math.max(0, (now() - open.at) / 1000),
                teams: report?.teams,
                winner: report?.winner,
            });
            if (read.ok === false) throw new Error(read.error);
            // Closed before sending: a second report for this match throws.
            open = null;
            sent++;
            send(read.result);
            return read.result;
        },
        abandon() {
            open = null;
        },
        inspect: () => ({ matchOpen: open !== null, resultsSent: sent }),
    };
}

/**
 * What the check asserts about a run: every result valid, no match reported
 * twice, and (when the run played a match to the end) exactly one result.
 */
export function auditResults(
    sent: unknown[],
    expectOne: boolean
): { ok: boolean; findings: string[]; results: MatchResult[] } {
    const findings: string[] = [];
    const results: MatchResult[] = [];
    const seen = new Set<string>();
    for (const [i, value] of sent.entries()) {
        const read = readMatchResult(value);
        if (read.ok === false) {
            findings.push(`result ${i + 1} is invalid: ${read.error}`);
            continue;
        }
        if (seen.has(read.result.match))
            findings.push(`match ${read.result.match} reported more than once`);
        seen.add(read.result.match);
        results.push(read.result);
    }
    if (expectOne && sent.length !== 1)
        findings.push(
            sent.length
                ? `the match sent ${sent.length} results; it must send exactly one`
                : "the match ended without a result"
        );
    return { ok: findings.length === 0, findings, results };
}
