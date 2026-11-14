/**
 * How far a game's result can be trusted.
 *
 * A result is computed in the player's own browser, by code the player can
 * change. So a result carries a trust level, and only some levels count:
 *
 * - "solo-unverified": one client said so. Fine for the player's own
 *   history; never ranked.
 * - "party-agreed": every member of the party reported the same outcome.
 *   Nobody who played disputes it. A whole party can still collude.
 * - "server-judged": a server ran or replayed the match. Not built yet.
 *
 * This file is the comparison for "party-agreed": pure, so the page can run
 * it today and a server can run the same code on what the pages submit. It
 * stores nothing and sends nothing; see `SubmitGameResult` for the call
 * another module provides. Rules for games: docs/games/trust.md.
 */

export type ResultTrust = "solo-unverified" | "party-agreed" | "server-judged";

export type Outcome =
    | null
    | string
    | number
    | boolean
    | Outcome[]
    | { [key: string]: Outcome };

/** One member's client saying how the match ended. */
export interface ResultReport {
    /** The member's id in the party's room, as the room server names it. */
    member: string;
    outcome: unknown;
}

export interface PartyVerdict {
    /**
     * - "agreed": every member reported, and all reports are the same.
     * - "disputed": two reports differ, or a member changed its report.
     * - "incomplete": no dispute yet, but someone has not reported.
     * - "solo": fewer than two members; there is nobody to agree with.
     */
    status: "agreed" | "disputed" | "incomplete" | "solo";
    trust: ResultTrust;
    /** The outcome everyone reported; null unless agreed. */
    outcome: Outcome | null;
    /** The members compared, in a stable order. */
    members: string[];
    /** Members with no usable report. */
    missing: string[];
    /** Members whose report differs from the most common one. */
    dissenting: string[];
}

/** What the result call receives. Another module implements the call. */
export interface GameResultSubmission {
    game: string;
    /** The party's trip id; null for a solo result. */
    party: string | null;
    /** The submitting member's room id. */
    member: string;
    outcome: Outcome;
    /** This client's view. A server must recompute it from all submissions. */
    trust: ResultTrust;
    /** The members whose reports matched, this one included. */
    agreedBy: string[];
}
export type SubmitGameResult = (
    submission: GameResultSubmission
) => Promise<void>;

/** Outcomes are compared as text, so they stay small. */
export const OUTCOME_MAX_LENGTH = 4096;
const MAX_DEPTH = 8;
const MAX_MEMBERS = 8;

/**
 * An outcome as text that is the same for the same outcome: object keys
 * sorted, no -0. Throws on anything that is not plain finite JSON.
 */
export function canonicalOutcome(value: unknown): string {
    const write = (v: unknown, depth: number): string => {
        if (depth > MAX_DEPTH) throw new Error("OUTCOME_DEPTH");
        if (v === null || typeof v === "boolean") return String(v);
        if (typeof v === "string") return JSON.stringify(v);
        if (typeof v === "number") {
            if (!Number.isFinite(v)) throw new Error("OUTCOME_INVALID");
            return JSON.stringify(v === 0 ? 0 : v);
        }
        if (Array.isArray(v))
            return `[${v.map((item) => write(item, depth + 1)).join(",")}]`;
        if (
            typeof v !== "object" ||
            ![Object.prototype, null].includes(Object.getPrototypeOf(v))
        )
            throw new Error("OUTCOME_INVALID");
        return `{${Object.keys(v)
            .sort()
            .map(
                (key) =>
                    `${JSON.stringify(key)}:${write(
                        (v as Record<string, unknown>)[key],
                        depth + 1
                    )}`
            )
            .join(",")}}`;
    };
    const text = write(value, 0);
    if (text.length > OUTCOME_MAX_LENGTH) throw new Error("OUTCOME_SIZE");
    return text;
}

/**
 * Compare what a party's clients reported.
 *
 * @param members the party room's roster when the match began, the visitor
 *   included. Take it from the room, never from a game.
 * @param reports each member's report, in the order they arrived. Reports
 *   from anyone else are ignored. A member's first report counts; a second,
 *   different one is a dispute, so nobody can switch after seeing the rest.
 */
export function judgePartyResult(
    members: readonly string[],
    reports: readonly ResultReport[]
): PartyVerdict {
    const roster = [
        ...new Set(
            members.filter((id) => typeof id === "string" && id.length > 0)
        ),
    ].sort();
    const verdict = (
        status: PartyVerdict["status"],
        rest: Partial<PartyVerdict> = {}
    ): PartyVerdict => ({
        status,
        trust: status === "agreed" ? "party-agreed" : "solo-unverified",
        outcome: null,
        members: roster,
        missing: [],
        dissenting: [],
        ...rest,
    });
    if (roster.length < 2) return verdict("solo");
    // A larger roster than a party can be is not a party's roster.
    if (roster.length > MAX_MEMBERS)
        return verdict("disputed", { dissenting: roster });

    const said = new Map<string, string>();
    const changed = new Set<string>();
    for (const report of reports) {
        const member = report?.member;
        if (!roster.includes(member)) continue;
        let text: string;
        try {
            text = canonicalOutcome(report.outcome);
        } catch {
            // An outcome that can't be compared agrees with nothing.
            changed.add(member);
            continue;
        }
        if (!said.has(member)) said.set(member, text);
        else if (said.get(member) !== text) changed.add(member);
    }

    const missing = roster.filter((id) => !said.has(id) && !changed.has(id));
    const counts = new Map<string, number>();
    for (const [member, text] of said)
        if (!changed.has(member)) counts.set(text, (counts.get(text) ?? 0) + 1);
    const most = Math.max(0, ...counts.values());
    const leaders = [...counts].filter(([, count]) => count === most);
    // With no single most common report, nobody is the odd one out: all are.
    const common = leaders.length === 1 ? leaders[0][0] : null;
    const dissenting = roster.filter(
        (id) =>
            changed.has(id) ||
            (said.has(id) && counts.size > 1 && said.get(id) !== common)
    );

    if (dissenting.length) return verdict("disputed", { missing, dissenting });
    if (missing.length) return verdict("incomplete", { missing });
    return verdict("agreed", { outcome: JSON.parse(common) as Outcome });
}

/** Only results that more than one client stands behind are ranked. */
export function leaderboardEligible(trust: ResultTrust): boolean {
    return trust === "party-agreed" || trust === "server-judged";
}
