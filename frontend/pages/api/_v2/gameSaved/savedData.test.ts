/** @jest-environment node */
// The procedures against an in-memory Firestore: what they keep where games
// are on, and that they touch nothing where games are hidden.
const mockDocs = new Map<string, Record<string, any>>();
const mockRuns = jest.fn();
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: (name: string) => ({
            doc: (id: string) => ({ path: `${name}/${id}` }),
        }),
        runTransaction: async (run: (tx: any) => Promise<unknown>) => {
            mockRuns();
            return run({
                get: async (ref: { path: string }) => ({
                    exists: mockDocs.has(ref.path),
                    data: () => mockDocs.get(ref.path),
                }),
                set: (ref: { path: string }, data: Record<string, any>) =>
                    void mockDocs.set(ref.path, data),
                delete: (ref: { path: string }) =>
                    void mockDocs.delete(ref.path),
            });
        },
    },
}));

import GameSavedService from "./index";
import declared from "@features/games/savedData.declared.json";

const env = process.env as Record<string, string | undefined>;
const previous = env.GAMES_PREVIEW;
beforeEach(() => {
    mockDocs.clear();
    mockRuns.mockClear();
    env.GAMES_PREVIEW = "1";
});
afterAll(() => {
    if (previous === undefined) delete env.GAMES_PREVIEW;
    else env.GAMES_PREVIEW = previous;
});

const call = (name: string, userId: string | undefined, input: unknown) =>
    (GameSavedService as any)[name].call({ userId }, input);
// A key a catalogued game really declares for each visitor.
const [game, keys] = Object.entries(declared as Record<string, any>).find(
    ([, keys]) =>
        Object.values(keys).some((key: any) => key.scope === "visitor")
);
const [key, declaration] = Object.entries(keys as Record<string, any>).find(
    ([, key]) => key.scope === "visitor"
);
const write = {
    game,
    key,
    op: "set",
    stateVersion: declaration.stateVersion,
    value: { a: 1 },
};

test("where games are on, a visitor's value is kept and read back", async () => {
    expect(await call("savedWrite", "user-a", write)).toMatchObject({
        ok: true,
    });
    expect(await call("savedRead", "user-a", { game, key })).toMatchObject({
        ok: true,
        entry: { value: { a: 1 } },
    });
    expect(mockDocs.size).toBeGreaterThan(0);
});

test("where games are hidden, nothing is read or written", async () => {
    delete env.GAMES_PREVIEW;
    expect(await call("savedWrite", "user-a", write)).toEqual({
        ok: false,
        reason: "undeclared",
    });
    expect(await call("savedRead", "user-a", { game, key })).toEqual({
        ok: false,
        reason: "undeclared",
    });
    // Not even a transaction: the store is never asked.
    expect(mockRuns).not.toHaveBeenCalled();
    expect(mockDocs.size).toBe(0);
});

test("what was saved while games were on does not answer once they are hidden", async () => {
    await call("savedWrite", "user-a", write);
    delete env.GAMES_PREVIEW;
    expect(await call("savedRead", "user-a", { game, key })).toEqual({
        ok: false,
        reason: "undeclared",
    });
});
