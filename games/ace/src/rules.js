import { COURT } from "./config.js";
import { inServiceBox, inSingles } from "./physics.js";

// Players are indexed 0 (human, near half, z > 0) and 1 (CPU, far half).
export const sideOf = (who) => (who === 0 ? 1 : -1);
export const other = (who) => 1 - who;

export function createMatch(gamesToWin = 2) {
    return {
        gamesToWin,
        games: [0, 0],
        points: [0, 0],
        server: 0,
        faults: 0,
        winner: null,
        stats: [
            { aces: 0, winners: 0, perfects: 0, faults: 0 },
            { aces: 0, winners: 0, perfects: 0, faults: 0 },
        ],
        longestRally: 0,
    };
}

/** Deuce court on even point totals (server stands right of centre). */
export function serveSide(match) {
    return (match.points[0] + match.points[1]) % 2 === 0 ? "deuce" : "ad";
}

/** Server's x position sign: right of centre for deuce, from the server's view. */
export function serverXSign(match) {
    const deuce = serveSide(match) === "deuce";
    // Near player faces -z: right is +x. Far player faces +z: right is -x.
    const right = match.server === 0 ? 1 : -1;
    return deuce ? right : -right;
}

/** The target service box is diagonal: opposite x sign to the server. */
export function serviceBoxSign(match) {
    return -serverXSign(match);
}

export function pointLabel(match) {
    const [a, b] = match.points;
    if (a >= 3 && b >= 3) {
        if (a === b) return { kind: "deuce", text: "DEUCE" };
        const leader = a > b ? 0 : 1;
        return { kind: "advantage", leader, text: "ADVANTAGE" };
    }
    const names = ["LOVE", "15", "30", "40"];
    if (a === b)
        return { kind: "all", text: a === 0 ? "LOVE ALL" : `${names[a]} ALL` };
    // Spoken from the server's side first.
    const s = match.server;
    return {
        kind: "score",
        text: `${names[match.points[s]]}–${names[match.points[other(s)]]}`,
    };
}

/** Award a point. Returns { game: boolean, match: boolean, gameWinner }. */
export function awardPoint(match, who) {
    match.points[who] += 1;
    match.faults = 0;
    const [a, b] = match.points;
    const lead = Math.abs(a - b);
    const top = Math.max(a, b);
    if (top >= 4 && lead >= 2) {
        const gameWinner = a > b ? 0 : 1;
        match.games[gameWinner] += 1;
        match.points = [0, 0];
        match.server = other(match.server);
        if (match.games[gameWinner] >= match.gamesToWin) {
            match.winner = gameWinner;
            return { game: true, match: true, gameWinner };
        }
        return { game: true, match: false, gameWinner };
    }
    return { game: false, match: false, gameWinner: null };
}

export function isGamePoint(match) {
    const s = match.points;
    for (const who of [0, 1]) {
        if (s[who] >= 3 && s[who] - s[other(who)] >= 1) return who;
    }
    return null;
}

/**
 * Rally referee. Feed it hits and bounces; it answers with a verdict when the
 * point is decided: { winner, reason }.
 */
export function createRally(match) {
    return {
        server: match.server,
        boxSign: serviceBoxSign(match),
        serving: true, // the next valid bounce must land in the service box
        lastHitter: null,
        bouncesSinceHit: 0,
        hits: 0,
        verdict: null,
    };
}

export function rallyHit(rally, who) {
    if (rally.verdict) return rally.verdict;
    // Receiver hitting the serve before it bounced loses the point.
    if (
        rally.serving &&
        rally.lastHitter !== null &&
        who !== rally.lastHitter &&
        rally.bouncesSinceHit === 0
    ) {
        rally.verdict = { winner: rally.lastHitter, reason: "volley-serve" };
        return rally.verdict;
    }
    if (rally.lastHitter !== null && rally.lastHitter !== who)
        rally.serving = false;
    rally.lastHitter = who;
    rally.bouncesSinceHit = 0;
    rally.hits += 1;
    return null;
}

export function rallyBounce(rally, x, z) {
    if (rally.verdict || rally.lastHitter === null) return rally.verdict;
    const hitter = rally.lastHitter;
    const receiver = other(hitter);
    rally.bouncesSinceHit += 1;
    if (rally.bouncesSinceHit === 1) {
        const onReceiverHalf = sideOf(receiver) > 0 ? z > 0 : z < 0;
        if (!onReceiverHalf) {
            rally.verdict = {
                winner: receiver,
                reason: rally.serving ? "fault-net" : "net",
            };
            return rally.verdict;
        }
        const good = rally.serving
            ? inServiceBox(x, z, sideOf(receiver), rally.boxSign)
            : inSingles(x, z, sideOf(receiver));
        if (!good)
            rally.verdict = {
                winner: receiver,
                reason: rally.serving ? "fault" : "out",
            };
        return rally.verdict;
    }
    // Second bounce on the receiver's side: the receiver didn't get there.
    rally.verdict = {
        winner: hitter,
        reason: rally.serving ? "ace" : "winner",
    };
    return rally.verdict;
}

/** Called when the ball leaves play without bouncing again (e.g. far behind). */
export function rallyGone(rally) {
    if (rally.verdict || rally.lastHitter === null) return rally.verdict;
    const hitter = rally.lastHitter;
    if (rally.bouncesSinceHit >= 1)
        rally.verdict = {
            winner: hitter,
            reason: rally.serving ? "ace" : "winner",
        };
    else
        rally.verdict = {
            winner: other(hitter),
            reason: rally.serving ? "fault" : "out",
        };
    return rally.verdict;
}

export function isFault(verdict) {
    return (
        verdict &&
        (verdict.reason === "fault" || verdict.reason === "fault-net")
    );
}

export const PLAY_LIMIT = {
    x: COURT.doublesHalfWidth + 6.5,
    z: COURT.halfLength + 7,
};
