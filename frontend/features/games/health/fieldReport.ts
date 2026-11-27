/**
 * A game's field health as its maker is told it: the numbers from real
 * visits and what they ask for (./healthFindings.ts), for the account
 * that published the game or a site admin. Behind `gamePublish.health`
 * and `oncyber health`. Server-side only.
 */
import { isSiteAdmin } from "@utils/siteAdmins";
import { publishedGame } from "../publish/publishedGamesServer";
import { readFieldHealth, type ReleaseHealth } from "./gameHealthSummary";
import {
    FIELD_BUDGETS,
    healthFindings,
    type HealthFinding,
} from "./healthFindings";

export interface FieldReport {
    id: string;
    /** Real visits of the last seven days, or this server's own (dev). */
    source: "posthog" | "local";
    /** Why the real visits could not be read, when they could not. */
    error?: string;
    budgets: typeof FIELD_BUDGETS;
    /** The release visitors get now, when the game is a published one. */
    current: string | null;
    releases: Array<ReleaseHealth & { findings: HealthFinding[] }>;
}

export interface FieldReportDeps {
    game: typeof publishedGame;
    admin: typeof isSiteAdmin;
    read: typeof readFieldHealth;
}
const live: FieldReportDeps = {
    game: publishedGame,
    admin: isSiteAdmin,
    read: readFieldHealth,
};

/**
 * Throws for anyone but the game's own account or a site admin: what
 * breaks in a game, and how many play it, is its maker's to know.
 */
export async function fieldReport(
    account: string,
    id: string,
    deps: FieldReportDeps = live
): Promise<FieldReport> {
    const record = await deps.game(id);
    const owns =
        !!record && record.owner.toLowerCase() === account.toLowerCase();
    if (!owns && !deps.admin(account))
        throw new Error(
            record
                ? `${id} is another account's game: only its own account can read its field health.`
                : `${id} is not a game this account has published.`
        );
    const field = (await deps.read([id]))[id];
    // Off a development server, "local" means the site cannot read visits
    // back at all: say so, or an empty report reads as "nobody played".
    const unread =
        field?.source !== "posthog" &&
        !field?.error &&
        process.env.NODE_ENV === "production"
            ? "This site is not set up to read visits back, so there is nothing to show (it needs POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID)."
            : undefined;
    const current = record?.current ?? null;
    const releases = (field?.releases ?? []).map((release) => ({
        ...release,
        findings: healthFindings(release),
    }));
    return {
        id,
        source: field?.source ?? "local",
        ...(field?.error && { error: field.error }),
        ...(unread && { error: unread }),
        budgets: FIELD_BUDGETS,
        current,
        // The release on show first: it is the one to fix.
        releases: [
            ...releases.filter((release) => release.release === current),
            ...releases.filter((release) => release.release !== current),
        ],
    };
}
