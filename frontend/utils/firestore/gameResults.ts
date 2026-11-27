import { db } from "@utils/firebaseAdmin";
import {
    gameResultOutcome,
    type GameResult,
    type GameResultOutcome,
} from "@features/games/results/gameResults";
import {
    leaderboardEligible,
    type ResultTrust,
} from "@features/games/results/resultTrust";

/**
 * Where match results live. Two small collections per game:
 *
 *   gameResults/<game>/matches/<userId>_<match>   one reported result
 *   gameResults/<game>/standings/<userId>         that account's totals
 *
 * Every write is keyed by the reporting account, so an account can only
 * add to its own results and standing. A result is one browser's word:
 * `verified` is false on both documents until something else decides which
 * results count. Other players named in a result are text, never accounts.
 *
 * Each result carries a trust level (features/games/results/resultTrust.ts). Only
 * results a whole party agreed on count for the leaderboard: they add to
 * the standing's `rankedPlayed` and `rankedWins`, which is what the
 * leaderboard lists. A solo result is kept and never ranked.
 */
const MIN_SECONDS_BETWEEN_RESULTS = 5;

export interface GameStanding {
    name: string;
    played: number;
    wins: number;
    verified: boolean;
}

const gameDoc = (game: string) => db.collection("gameResults").doc(game);

export async function recordGameResult(
    userId: string,
    game: string,
    result: GameResult,
    now = Date.now(),
    trust: ResultTrust = "solo-unverified"
): Promise<{
    recorded: boolean;
    reason?: "duplicate" | "too-soon";
    outcome: GameResultOutcome;
    standing: GameStanding | null;
}> {
    const outcome = gameResultOutcome(result);
    const self = result.teams
        .flatMap((team) => team.players)
        .find((player) => player.kind === "self");
    const matchRef = gameDoc(game)
        .collection("matches")
        .doc(`${userId}_${result.match}`);
    const standingRef = gameDoc(game).collection("standings").doc(userId);
    return db.runTransaction(async (tx) => {
        const [match, standing] = await Promise.all([
            tx.get(matchRef),
            tx.get(standingRef),
        ]);
        const before = standing.exists ? standing.data() : null;
        const current: GameStanding | null = before
            ? {
                  name: before.name,
                  played: before.played,
                  wins: before.wins,
                  verified: false,
              }
            : null;
        // One result per match per account, however often it is sent.
        if (match.exists)
            return {
                recorded: false,
                reason: "duplicate" as const,
                outcome,
                standing: current,
            };
        if (
            before &&
            now - before.updatedAt < MIN_SECONDS_BETWEEN_RESULTS * 1000
        )
            return {
                recorded: false,
                reason: "too-soon" as const,
                outcome,
                standing: current,
            };
        const next: GameStanding = {
            name: self.name,
            played: (before?.played ?? 0) + 1,
            wins: (before?.wins ?? 0) + (outcome === "win" ? 1 : 0),
            verified: false,
        };
        const ranked = leaderboardEligible(trust);
        tx.set(matchRef, {
            game,
            reporter: userId,
            ...result,
            outcome,
            verified: false,
            trust,
            source: "browser",
            createdAt: now,
        });
        tx.set(standingRef, {
            ...next,
            rankedPlayed: (before?.rankedPlayed ?? 0) + (ranked ? 1 : 0),
            rankedWins:
                (before?.rankedWins ?? 0) +
                (ranked && outcome === "win" ? 1 : 0),
            userId,
            game,
            updatedAt: now,
        });
        return { recorded: true, outcome, standing: next };
    });
}

export async function readGameLeaderboard(
    game: string,
    limit = 10
): Promise<GameStanding[]> {
    const snapshot = await gameDoc(game)
        .collection("standings")
        .orderBy("rankedWins", "desc")
        .limit(limit)
        .get();
    // Only results a party agreed on are ranked: a standing with none of
    // them is not listed, and the totals shown are those results.
    return snapshot.docs
        .map((doc) => doc.data())
        .filter((data) => Number(data.rankedPlayed) > 0)
        .map((data) => ({
            name: String(data.name ?? "Player").slice(0, 24),
            played: Number(data.rankedPlayed) || 0,
            wins: Number(data.rankedWins) || 0,
            verified: data.verified === true,
        }));
}
