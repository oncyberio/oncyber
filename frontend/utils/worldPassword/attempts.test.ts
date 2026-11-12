/** @jest-environment node */
import {
    attemptClientKey,
    createFirestoreAttemptLimiter,
    WORLD_PASSWORD_LIMITS,
} from "./attempts";

jest.mock("@utils/firebaseAdmin", () => {
    const store = new Map<string, any>();
    const clone = (v) =>
        v === undefined ? undefined : JSON.parse(JSON.stringify(v));
    const snap = (path: string) => ({
        exists: store.has(path),
        data: () => clone(store.get(path)),
    });
    // Transactions run one at a time, as Firestore's retries make them look.
    let queue = Promise.resolve();
    const db = {
        store,
        collection: (name: string) => ({
            doc: (id: string) => ({ path: `${name}/${id}` }),
        }),
        runTransaction: (run) => {
            const next = queue.then(async () => {
                const writes = [];
                const result = await run({
                    getAll: async (...refs: any[]) =>
                        refs.map((it) => snap(it.path)),
                    set: (r, v) =>
                        writes.push(() => store.set(r.path, clone(v))),
                });
                writes.forEach((write) => write());
                return result;
            });
            queue = next.then(
                () => undefined,
                () => undefined
            );
            return next;
        },
    };
    return { db };
});

const { db } = jest.requireMock("@utils/firebaseAdmin");

beforeEach(() => db.store.clear());

const { client, world } = WORLD_PASSWORD_LIMITS;

test("one address gets a limited number of tries per world and window", async () => {
    let now = 1_000_000;
    const limit = createFirestoreAttemptLimiter(() => now);
    for (let i = 0; i < client.max; i++)
        expect((await limit("w1", "ip:1.2.3.4")).allowed).toBe(true);
    expect((await limit("w1", "ip:1.2.3.4")).allowed).toBe(false);
    // Another address, and another world, are counted apart.
    expect((await limit("w1", "ip:5.6.7.8")).allowed).toBe(true);
    expect((await limit("w2", "ip:1.2.3.4")).allowed).toBe(true);
    // The window ends.
    now += client.windowMs;
    expect((await limit("w1", "ip:1.2.3.4")).allowed).toBe(true);
});

test("parallel guesses cannot pass the count", async () => {
    const limit = createFirestoreAttemptLimiter(() => 5);
    const results = await Promise.all(
        Array.from({ length: client.max * 3 }, () => limit("w1", "ip:9.9.9.9"))
    );
    expect(results.filter((it) => it.allowed)).toHaveLength(client.max);
});

test("a right password gives its try back", async () => {
    const limit = createFirestoreAttemptLimiter(() => 5);
    for (let i = 0; i < client.max * 2; i++) {
        const attempt = await limit("w1", "ip:10.0.0.1");
        expect(attempt.allowed).toBe(true);
        await attempt.release();
    }
});

test("a world takes a limited number of tries from all addresses together", async () => {
    const limit = createFirestoreAttemptLimiter(() => 5);
    for (let i = 0; i < world.max; i++)
        expect(
            (await limit("w1", `ip:10.0.${i >> 8}.${i & 255}`)).allowed
        ).toBe(true);
    expect((await limit("w1", "ip:192.168.0.1")).allowed).toBe(false);
    expect((await limit("w2", "ip:192.168.0.1")).allowed).toBe(true);
});

test("a refused try is not counted", async () => {
    const limit = createFirestoreAttemptLimiter(() => 5);
    for (let i = 0; i < client.max + 20; i++) await limit("w1", "ip:1.1.1.1");
    // The world's window counted only the allowed ones.
    const counts = [...db.store.values()].map((it) => it.count).sort();
    expect(counts).toEqual([client.max, client.max]);
});

describe("attemptClientKey", () => {
    const req = (headers: Record<string, string>, remoteAddress?: string) =>
        ({ headers, socket: { remoteAddress } } as any);

    test("takes the first forwarded address", () => {
        expect(
            attemptClientKey(
                req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })
            )
        ).toBe("ip:203.0.113.7");
        expect(attemptClientKey(req({}, "::ffff:198.51.100.2"))).toBe(
            "ip:198.51.100.2"
        );
    });

    test("groups an IPv6 address by its /64", () => {
        const a = attemptClientKey(
            req({ "x-forwarded-for": "2001:db8:1:2:aaaa::1" })
        );
        const b = attemptClientKey(
            req({ "x-forwarded-for": "2001:DB8:1:2:ffff:1:2:3" })
        );
        expect(a).toBe("ip6:2001:0db8:0001:0002");
        expect(b).toBe(a);
    });

    test("an unknown address still has a key", () => {
        expect(attemptClientKey(undefined)).toBe("unknown");
    });
});
