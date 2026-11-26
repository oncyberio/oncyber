import { z } from "zod";
import {
    canonicalOutcome,
    judgePartyResult,
    type Outcome,
    type PartyVerdict,
    type ResultReport,
} from "./resultTrust";

/**
 * Match results on the page side. A game sends `<id>:result` when a match
 * ends (games/runtime/src/results.ts); the page validates it here with the
 * same rules, records it for a signed-in visitor through the games RPC and
 * shows it to the party. A result is one browser's word, so it is stored and
 * shown as unverified, unless it is a match between members of a party and
 * every one of them reported the same outcome (`judgeMatchResult`). See
 * docs/games/results.md and docs/games/trust.md.
 */
const trimmed = (max: number, code: string) =>
    z
        .string(code)
        .transform((value) => value.trim().slice(0, max))
        .refine((value) => value.length > 0, code);

const playerSchema = z.object(
    {
        id: z
            .string("RESULT_PLAYERS")
            .min(1, "RESULT_PLAYERS")
            .max(64, "RESULT_PLAYERS"),
        name: trimmed(24, "RESULT_PLAYERS"),
        kind: z.enum(["self", "peer", "cpu"], "RESULT_PLAYERS"),
    },
    "RESULT_PLAYERS"
);
const teamSchema = z.object(
    {
        name: z
            .unknown()
            .transform((value) =>
                typeof value === "string" && value.trim()
                    ? value.trim().slice(0, 24)
                    : undefined
            )
            .optional(),
        score: z
            .number("RESULT_SCORE")
            .refine(
                (value) => Number.isFinite(value) && Math.abs(value) <= 1e9,
                "RESULT_SCORE"
            ),
        players: z
            .array(playerSchema, "RESULT_PLAYERS")
            .min(1, "RESULT_PLAYERS"),
    },
    "RESULT_TEAMS"
);

/** Mirrors `readMatchResult` in games/runtime/src/results.ts. */
export const gameResultSchema = z
    .object(
        {
            match: z
                .string("RESULT_MATCH_ID")
                .regex(/^[A-Za-z0-9_-]{6,64}$/, "RESULT_MATCH_ID"),
            format: z
                .string("RESULT_FORMAT")
                .regex(/^[a-z0-9][a-z0-9-]{0,31}$/, "RESULT_FORMAT"),
            durationSeconds: z
                .number("RESULT_DURATION")
                .refine(
                    (value) =>
                        Number.isFinite(value) && value >= 0 && value <= 86400,
                    "RESULT_DURATION"
                )
                .transform((value) => Math.round(value * 10) / 10),
            teams: z
                .array(teamSchema, "RESULT_TEAMS")
                .min(2, "RESULT_TEAMS")
                .max(8, "RESULT_TEAMS"),
            winner: z
                .number("RESULT_WINNER")
                .int("RESULT_WINNER")
                .min(0, "RESULT_WINNER")
                .nullable(),
        },
        "RESULT_INVALID"
    )
    .superRefine((result, context) => {
        const players = result.teams.flatMap((team) => team.players);
        const issue = (message: string) =>
            context.addIssue({ code: "custom", message });
        if (new Set(players.map((p) => p.id)).size !== players.length)
            issue("RESULT_PLAYER_REPEATED");
        else if (players.length > 16) issue("RESULT_PLAYERS");
        // A browser may only report a match its own visitor played in.
        else if (players.filter((p) => p.kind === "self").length !== 1)
            issue("RESULT_SELF");
        else if (result.winner !== null && result.winner >= result.teams.length)
            issue("RESULT_WINNER");
    });

export type GameResult = z.infer<typeof gameResultSchema>;
export type GameResultOutcome = "win" | "loss" | "draw";

export function readGameResult(
    value: unknown
): { ok: true; result: GameResult } | { ok: false; error: string } {
    const parsed = gameResultSchema.safeParse(value);
    if (parsed.success === false)
        return {
            ok: false,
            error: parsed.error.issues[0]?.message || "RESULT_INVALID",
        };
    // Drop the `name: undefined` a nameless team parses to.
    return { ok: true, result: JSON.parse(JSON.stringify(parsed.data)) };
}

/** Win, loss or draw for the visitor who reported the result. */
export function gameResultOutcome(result: GameResult): GameResultOutcome {
    if (result.winner === null) return "draw";
    return result.teams[result.winner].players.some((p) => p.kind === "self")
        ? "win"
        : "loss";
}

/**
 * The reporting visitor under the name the page knows them by, not the
 * game's own label ("You"): this is what is stored and what a party sees.
 */
export function withSelfName(result: GameResult, name: unknown): GameResult {
    const known =
        typeof name === "string" && name.trim() ? name.trim().slice(0, 24) : "";
    if (!known) return result;
    return {
        ...result,
        teams: result.teams.map((team) => ({
            ...team,
            players: team.players.map((player) =>
                player.kind === "self" ? { ...player, name: known } : player
            ),
        })),
    };
}

const sideName = (team: GameResult["teams"][number]) =>
    team.name || team.players.map((p) => p.name).join(" & ");

/** What the card says: who won, against whom, and the score. */
export interface GameResultSummary {
    match: string;
    headline: string;
    score: string;
    format: string;
}

export function summarizeGameResult(result: GameResult): GameResultSummary {
    const { teams, winner } = result;
    const score = (order: number[]) =>
        order.map((i) => teams[i].score).join(" – ");
    const all = teams.map((_, i) => i);
    if (winner === null)
        return {
            match: result.match,
            headline: `${teams.map(sideName).join(" and ")} drew`,
            score: score(all),
            format: result.format,
        };
    const rest = all.filter((i) => i !== winner);
    return {
        match: result.match,
        headline:
            rest.length === 1
                ? `${sideName(teams[winner])} beat ${sideName(teams[rest[0]])}`
                : `${sideName(teams[winner])} won`,
        // A line of four scores says little; the headline carries it.
        score: rest.length === 1 ? score([winner, ...rest]) : "",
        format: result.format,
    };
}

/**
 * One visit's results. The page takes one result per match id and a bounded
 * number per visit, whatever the game sends.
 */
export const RESULTS_PER_VISIT = 200;
export class GameResultLedger {
    private seen = new Set<string>();
    accept(
        value: unknown
    ): { ok: true; result: GameResult } | { ok: false; error: string } {
        const read = readGameResult(value);
        if (read.ok === false) return read;
        if (this.seen.has(read.result.match))
            return { ok: false, error: "RESULT_ALREADY_REPORTED" };
        if (this.seen.size >= RESULTS_PER_VISIT)
            return { ok: false, error: "RESULT_LIMIT" };
        this.seen.add(read.result.match);
        return read;
    }
}

/**
 * What every member's browser must say alike for a match to be agreed: the
 * match, its format, each side's score and players by id, and the winner.
 * Names, who "self" is and the duration are each browser's own.
 */
export function resultOutcome(result: GameResult): Outcome {
    return {
        match: result.match,
        format: result.format,
        teams: result.teams.map((team) => ({
            score: team.score,
            players: team.players.map((player) => player.id),
        })),
        winner: result.winner,
    };
}

/** The people who played a match (not its CPU sides), by the result's ids. */
export const resultMembers = (result: GameResult) =>
    result.teams
        .flatMap((team) => team.players)
        .filter((player) => player.kind !== "cpu")
        .map((player) => player.id);

/**
 * How far a result can be trusted (resultTrust.ts). A match one person
 * played is "solo". A match between people is judged against the party
 * room's roster: its players must be members by the ids the room gave them,
 * the visitor's own side must be the visitor, and it is "agreed" only when
 * every player's browser reported the same outcome under the same match id.
 *
 * @param roster the room's roster (`self` and the members' ids), from the
 *   room server; null outside a party
 * @param reports what the other members' pages sent, by roster id
 */
export function judgeMatchResult(
    result: GameResult,
    roster: { self: string; members: ReadonlyArray<{ id: string }> } | null,
    reports: readonly ResultReport[]
): PartyVerdict {
    const members = resultMembers(result);
    if (members.length < 2) return judgePartyResult(members, []);
    const self = result.teams
        .flatMap((team) => team.players)
        .find((player) => player.kind === "self").id;
    const known = new Set(roster?.members.map((member) => member.id));
    // Not the room's people: nobody else's report can stand behind it.
    if (
        !roster?.self ||
        self !== roster.self ||
        !members.every((id) => known.has(id))
    )
        return judgePartyResult(members, []);
    return judgePartyResult(members, [
        { member: self, outcome: resultOutcome(result) },
        ...reports.filter((report) => report.member !== self),
    ]);
}

/**
 * The packet a page sends through the party's room so the other members see
 * the result too, and can compare it with their own (`outcome`). It is a
 * page-to-page message: it never reaches a game.
 */
const PARTY_RESULT = "oncyber:party-result";
export function partyResultPacket(
    summary: GameResultSummary,
    outcome?: Outcome
) {
    return {
        type: PARTY_RESULT,
        summary,
        ...(outcome === undefined ? {} : { outcome }),
    };
}
/** The outcome a member's page reported with its summary, or null. */
export function readPartyResultOutcome(data: unknown): Outcome | null {
    const packet = data as { type?: unknown; outcome?: unknown };
    if (packet?.type !== PARTY_RESULT || packet.outcome === undefined)
        return null;
    try {
        return JSON.parse(canonicalOutcome(packet.outcome)) as Outcome;
    } catch {
        return null;
    }
}
const line = (value: unknown, max: number) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : "";
export function readPartyResultPacket(data: unknown): GameResultSummary | null {
    const packet = data as {
        type?: unknown;
        summary?: Record<string, unknown>;
    };
    if (packet?.type !== PARTY_RESULT || !packet.summary) return null;
    const summary = {
        match: line(packet.summary.match, 64),
        headline: line(packet.summary.headline, 160),
        score: line(packet.summary.score, 80),
        format: line(packet.summary.format, 32),
    };
    return summary.match && summary.headline ? summary : null;
}
export const isPartyResultPacket = (data: unknown) =>
    (data as { type?: unknown })?.type === PARTY_RESULT;
