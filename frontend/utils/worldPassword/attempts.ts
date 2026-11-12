/**
 * A limit on typed world passwords, shared by every server instance: the
 * counters live in Firestore (`worldPasswordAttempts`), written only here
 * with the Admin SDK. Firestore security rules must not let clients read or
 * write this collection.
 *
 * Two fixed windows per typed password, both counted before the hash is
 * checked (so parallel guesses cannot slip past the count):
 * - one visitor address on one world: 10 per 10 minutes;
 * - one world, all addresses together: 300 per 10 minutes, so that guesses
 *   spread over many addresses stay slow.
 * A correct password gives its attempt back, so many visitors behind one
 * address (an event's Wi-Fi) can all get in. Visitors who already hold a
 * world access proof never type the password and are never counted.
 *
 * `expiresAt` lets a Firestore TTL policy delete old counters; without the
 * policy they are only overwritten.
 *
 * Server only.
 */
import { createHash } from "crypto";
import type { NextApiRequest } from "next";
import { db } from "@utils/firebaseAdmin";

export const ATTEMPTS_COLLECTION = "worldPasswordAttempts";

export const WORLD_PASSWORD_LIMITS = {
    client: { max: 10, windowMs: 10 * 60 * 1000 },
    world: { max: 300, windowMs: 10 * 60 * 1000 },
} as const;

type Scope = keyof typeof WORLD_PASSWORD_LIMITS;

interface Counter {
    count: number;
    windowStart: number;
    expiresAt?: Date;
}

export interface AttemptReservation {
    /** false: a limit is reached; the password must not be checked. */
    allowed: boolean;
    /** Give the attempt back (the password was right). Never throws. */
    release: () => Promise<void>;
}

export type AttemptLimiter = (
    exhibitId: string,
    client: string
) => Promise<AttemptReservation>;

const counterId = (scope: Scope, exhibitId: string, client: string) =>
    createHash("sha256")
        .update(`${scope}\n${exhibitId}\n${scope === "client" ? client : ""}`)
        .digest("hex")
        .slice(0, 40);

const live = (counter: Counter | undefined, now: number, scope: Scope) =>
    !!counter &&
    typeof counter.count === "number" &&
    typeof counter.windowStart === "number" &&
    now - counter.windowStart < WORLD_PASSWORD_LIMITS[scope].windowMs;

const SCOPES: Scope[] = ["client", "world"];

export function createFirestoreAttemptLimiter(
    clock: () => number = () => Date.now()
): AttemptLimiter {
    return async (exhibitId, client) => {
        const refs = SCOPES.map((scope) =>
            db
                .collection(ATTEMPTS_COLLECTION)
                .doc(counterId(scope, exhibitId, client))
        );
        // The windows this attempt was counted in, to give it back.
        let counted: (number | null)[] = [null, null];

        const allowed = await db.runTransaction(async (transaction) => {
            const docs = await transaction.getAll(...refs);
            const now = clock();
            const counters = docs.map(
                (doc) =>
                    (doc?.exists ? doc.data() : undefined) as
                        | Counter
                        | undefined
            );
            const full = SCOPES.some(
                (scope, i) =>
                    live(counters[i], now, scope) &&
                    counters[i].count >= WORLD_PASSWORD_LIMITS[scope].max
            );
            if (full) return false;
            counted = SCOPES.map((scope, i) => {
                const current = counters[i];
                const next: Counter = live(current, now, scope)
                    ? { ...current, count: current.count + 1 }
                    : { count: 1, windowStart: now };
                next.expiresAt = new Date(
                    next.windowStart + WORLD_PASSWORD_LIMITS[scope].windowMs
                );
                transaction.set(refs[i], next);
                return next.windowStart;
            });
            return true;
        });

        async function release() {
            if (!allowed) return;
            try {
                await db.runTransaction(async (transaction) => {
                    const docs = await transaction.getAll(...refs);
                    docs.forEach((doc, i) => {
                        const current = (
                            doc?.exists ? doc.data() : undefined
                        ) as Counter | undefined;
                        // Only the window this attempt was counted in.
                        if (
                            !current ||
                            current.windowStart !== counted[i] ||
                            !(current.count > 0)
                        )
                            return;
                        transaction.set(refs[i], {
                            ...current,
                            count: current.count - 1,
                        });
                    });
                });
            } catch {
                // The attempt stays counted: harmless.
            }
        }

        return { allowed, release };
    };
}

let limiter: AttemptLimiter = createFirestoreAttemptLimiter();

export const reserveWorldPasswordAttempt: AttemptLimiter = (
    exhibitId,
    client
) => limiter(exhibitId, client);

/** Tests only. Returns the limiter it replaced. */
export function setWorldPasswordAttemptLimiter(
    next: AttemptLimiter
): AttemptLimiter {
    const previous = limiter;
    limiter = next;
    return previous;
}

/** Expand an IPv6 address to its 8 groups, or null if it is not one. */
function ipv6Groups(address: string): string[] | null {
    const [head, tail, extra] = address.split("::");
    if (extra !== undefined) return null;
    const left = head ? head.split(":") : [];
    const right = tail ? tail.split(":") : [];
    const missing = 8 - left.length - right.length;
    if (tail === undefined ? missing !== 0 : missing < 1) return null;
    const groups = [...left, ...Array(missing).fill("0"), ...right];
    return groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))
        ? groups.map((group) => group.toLowerCase().padStart(4, "0"))
        : null;
}

/**
 * The visitor's address as the limit counts it: an IPv4 address, or an IPv6
 * address's /64 network (one household or phone usually holds a whole /64).
 * Vercel sets `x-forwarded-for` itself; a client cannot choose it there.
 */
export function attemptClientKey(req: NextApiRequest | undefined): string {
    const header = (name: string) => {
        const value = req?.headers?.[name];
        return Array.isArray(value) ? value[0] : value;
    };
    const raw =
        header("x-vercel-forwarded-for") ||
        header("x-forwarded-for") ||
        header("x-real-ip") ||
        req?.socket?.remoteAddress ||
        "";
    let address = raw.split(",")[0].trim().toLowerCase();
    if (address.startsWith("::ffff:") && address.includes("."))
        address = address.slice(7);
    if (address.includes(":")) {
        const groups = ipv6Groups(address.replace(/%.*$/, ""));
        if (groups) return `ip6:${groups.slice(0, 4).join(":")}`;
    }
    return address ? `ip:${address}` : "unknown";
}
