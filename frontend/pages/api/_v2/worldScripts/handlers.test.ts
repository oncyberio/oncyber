/** @jest-environment node */

// The procedures run as they are; only Firestore underneath is replaced, by
// this in-memory one. Transactions run one after another, which is what
// Firestore makes of transactions on the same document.
const mockDocs = new Map<string, Record<string, any>>();
let mockQueue: Promise<unknown> = Promise.resolve();
let mockAuto = 0;
const mockMerge = (path: string, data: Record<string, any>) => {
    const next = { ...(mockDocs.get(path) || {}) };
    for (const [key, value] of Object.entries(data))
        next[key] =
            value && typeof value === "object" && "mockAdd" in value
                ? (Number(next[key]) || 0) + value.mockAdd
                : value;
    mockDocs.set(path, next);
};
const mockSnap = (path: string) => ({
    exists: mockDocs.has(path),
    data: () => mockDocs.get(path),
    ref: { path },
});
const mockRef = (path: string) => ({ path, get: async () => mockSnap(path) });
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: (name: string) => ({
            doc: (id?: string) =>
                mockRef(`${name}/${id ?? `auto${++mockAuto}`}`),
        }),
        runTransaction(run: (transaction: any) => Promise<unknown>) {
            const result = mockQueue.then(() =>
                run({
                    get: async (ref: { path: string }) => {
                        // A read takes a moment: time for another request.
                        await new Promise((resolve) => setTimeout(resolve, 1));
                        return mockSnap(ref.path);
                    },
                    set: (ref: { path: string }, data: Record<string, any>) =>
                        mockMerge(ref.path, data),
                    update: (
                        ref: { path: string },
                        data: Record<string, any>
                    ) => mockMerge(ref.path, data),
                })
            );
            mockQueue = result.catch(() => undefined);
            return result;
        },
        batch() {
            const writes: Array<() => void> = [];
            return {
                set: (ref: { path: string }, data: Record<string, any>) =>
                    void writes.push(() => mockMerge(ref.path, data)),
                commit: async () => writes.forEach((write) => write()),
            };
        },
    },
    fire: { FieldValue: { increment: (by: number) => ({ mockAdd: by }) } },
}));
jest.mock("@api/accounts/authenticate/utils/link", () => ({
    getAccountDoc: jest.fn(async (id: string) => ({ id, data: () => ({}) })),
}));
jest.mock("@api/social/isMod", () => ({ ADMINS: ["site-admin"] }));

import { access, generate } from "./generate";
import { save } from "./save";

const env = process.env as Record<string, string | undefined>;
const before = { ...env };
const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const usage = (userId: string) => mockDocs.get(`aiUsageDaily/${userId}_${day}`);
const ledger = () =>
    [...mockDocs.entries()]
        .filter(([path]) => path.startsWith("aiUsage/"))
        .map(([, row]) => row);
const space = () => mockDocs.get("exhibits/space-1");

const script = (source = "world.add({});") => ({
    id: "s1",
    name: "Game",
    source,
    enabled: true,
});
const style = {
    summary: "Neon.",
    palette: ["#000000", "#ff00ff"],
    look: "glow",
    strokes: 0.5,
    wobble: 0,
    outline: false,
};
const as = (userId: string) => ({
    save: (input: object) => (save as any).call({ userId }, input),
    generate: (input: object) => (generate as any).call({ userId }, input),
    access: () => (access as any).call({ userId }, { experienceId: "space-1" }),
});

/** The model, answering with a script (or as told). */
const model = jest.fn();
const answers = (content = '{"say":"Done","name":"Game","source":"go()"}') =>
    model.mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            model: "test/model",
            choices: [{ message: { content } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.01 },
        }),
    }));

beforeEach(() => {
    mockDocs.clear();
    mockDocs.set("exhibits/space-1", {
        owner: "Owner",
        editors: ["editor"],
        info: {},
    });
    env.NEXT_PUBLIC_WORLD_SCRIPTS = "1";
    env.WORLD_SCRIPTS_AI_ALLOWLIST = "owner, editor";
    env.WORLD_SCRIPTS_AI_DAILY_LIMIT = "3";
    env.OPENROUTER_API_KEY = "key";
    model.mockReset();
    answers();
    (global as any).fetch = model;
});
afterAll(() => {
    for (const key of Object.keys(env)) if (!(key in before)) delete env[key];
    Object.assign(env, before);
});

describe("saving a space's script", () => {
    test("every procedure needs a session", () => {
        for (const procedure of [save, generate, access])
            expect((procedure as any)._RPC_OPTS.auth).toBe(true);
    });

    test("an admin in early access saves it, stamped", async () => {
        const result = await as("owner").save({
            experienceId: "space-1",
            scripts: [script()],
            base: 0,
        });
        expect(result).toMatchObject({ ok: true });
        expect(result.scripts[0].updatedAt).toBeGreaterThan(0);
        expect(space()).toMatchObject({
            worldScripts: result.scripts,
            worldScriptsUpdatedBy: "owner",
        });
    });

    test("it is off unless the flag is on", async () => {
        env.NEXT_PUBLIC_WORLD_SCRIPTS = "";
        expect(
            await as("owner").save({
                experienceId: "space-1",
                scripts: [script()],
            })
        ).toEqual({ ok: false, error: "World scripts are off here." });
        expect(space().worldScripts).toBeUndefined();
    });

    test("nobody but the space's admins writes to it", async () => {
        env.WORLD_SCRIPTS_AI_ALLOWLIST = "*";
        const result = await as("visitor").save({
            experienceId: "space-1",
            scripts: [script("for(;;){}")],
        });
        expect(result).toEqual({
            ok: false,
            error: "Only this space's admins can change its scripts.",
        });
        expect(space().worldScripts).toBeUndefined();
        expect(
            await as("site-admin").save({
                experienceId: "space-1",
                scripts: [script()],
            })
        ).toMatchObject({ ok: true });
    });

    test("an admin outside early access puts no script or style on a space, but may take scripts away", async () => {
        mockDocs.get("exhibits/space-1").worldScripts = [
            { ...script(), updatedAt: 5 },
        ];
        env.WORLD_SCRIPTS_AI_ALLOWLIST = "owner";
        const editor = as("editor");
        for (const input of [{ scripts: [script("mine()")] }, { style }])
            expect(
                await editor.save({ experienceId: "space-1", ...input })
            ).toEqual({
                ok: false,
                error: "World scripts are in early access for now.",
            });
        expect(space().worldScripts[0].source).toBe("world.add({});");
        expect(space().worldStyle).toBeUndefined();
        expect(
            await editor.save({ experienceId: "space-1", scripts: [], base: 5 })
        ).toMatchObject({ ok: true, scripts: [] });
        expect(space().worldScripts).toEqual([]);
    });

    test("a save that builds on an older script than the space has is refused, not written over it", async () => {
        const owner = as("owner");
        const first = await owner.save({
            experienceId: "space-1",
            scripts: [script("first()")],
            base: 0,
        });
        // Another tab, still on what it loaded.
        const stale = await as("editor").save({
            experienceId: "space-1",
            scripts: [script("stale()")],
            base: 0,
        });
        expect(stale).toMatchObject({ ok: false, conflict: true });
        expect(space().worldScripts[0].source).toBe("first()");
        const second = await owner.save({
            experienceId: "space-1",
            scripts: [script("second()")],
            base: first.scripts[0].updatedAt,
        });
        expect(second).toMatchObject({ ok: true });
        // Later than the one before it, even within one millisecond.
        expect(second.scripts[0].updatedAt).toBeGreaterThan(
            first.scripts[0].updatedAt
        );
    });

    test("a style is checked, and saved without touching the script", async () => {
        const owner = as("owner");
        await owner.save({
            experienceId: "space-1",
            scripts: [script()],
            base: 0,
        });
        expect(
            await owner.save({ experienceId: "space-1", style: { look: 1 } })
        ).toEqual({ ok: false, error: "That style isn't valid." });
        expect(
            await owner.save({ experienceId: "space-1", style })
        ).toMatchObject({ ok: true, scripts: null, style });
        expect(space().worldStyle).toEqual(style);
        expect(space().worldScripts).toHaveLength(1);
    });
});

describe("asking the model", () => {
    const ask = (userId: string, extra: object = {}) =>
        as(userId).generate({
            experienceId: "space-1",
            request: "make a game",
            ...extra,
        });

    test("who may: the space's admins who are in early access", async () => {
        expect(await as("owner").access()).toMatchObject({
            canEdit: true,
            earlyAccess: true,
            allowed: true,
            remaining: 3,
        });
        expect(await as("visitor").access()).toMatchObject({
            canEdit: false,
            allowed: false,
        });
        env.WORLD_SCRIPTS_AI_ALLOWLIST = "owner";
        expect(await as("editor").access()).toMatchObject({
            canEdit: true,
            earlyAccess: false,
            allowed: false,
        });
        expect(await ask("visitor")).toMatchObject({ ok: false });
        expect(await ask("editor")).toMatchObject({ ok: false });
        expect(model).not.toHaveBeenCalled();
        expect(ledger()).toEqual([]);
    });

    test("a request is counted, charged and answered", async () => {
        expect(await ask("owner")).toMatchObject({
            ok: true,
            source: "go()",
            remaining: 2,
        });
        expect(usage("owner")).toMatchObject({ requests: 1, costUsd: 0.01 });
        expect(ledger()).toEqual([
            expect.objectContaining({
                userId: "owner",
                experienceId: "space-1",
                model: "test/model",
                ok: true,
                costUsd: 0.01,
            }),
        ]);
    });

    test("a call that fails or times out is counted all the same", async () => {
        model.mockImplementation(async () => ({
            ok: false,
            status: 502,
            json: async () => ({ error: { message: "upstream" } }),
        }));
        expect(await ask("owner")).toMatchObject({ ok: false });
        model.mockImplementation(async () => {
            throw new Error("socket hang up");
        });
        expect(await ask("owner")).toMatchObject({ ok: false });
        expect(usage("owner").requests).toBe(2);
        expect(ledger().map((row) => row.ok)).toEqual([false, false]);
        // One left of three.
        answers();
        expect(await ask("owner")).toMatchObject({ ok: true, remaining: 0 });
        expect(await ask("owner")).toEqual({
            ok: false,
            error: "That's today's limit. Try again tomorrow.",
        });
        expect(model).toHaveBeenCalledTimes(3);
    });

    test("requests made at once cannot all slip under the limit", async () => {
        const results = await Promise.all(
            Array.from({ length: 8 }, () => ask("owner"))
        );
        expect(results.filter((result) => result.ok)).toHaveLength(3);
        expect(model).toHaveBeenCalledTimes(3);
        expect(usage("owner").requests).toBe(3);
    });

    test("a request that builds on a script changed elsewhere is refused before it costs anything", async () => {
        mockDocs.get("exhibits/space-1").worldScripts = [
            { ...script(), updatedAt: 9 },
        ];
        expect(await ask("owner", { base: 4 })).toMatchObject({
            ok: false,
            error: expect.stringContaining("changed somewhere else"),
        });
        expect(model).not.toHaveBeenCalled();
        expect(usage("owner")).toBeUndefined();
        expect(await ask("owner", { base: 9 })).toMatchObject({ ok: true });
    });

    test("it is off unless the flag is on", async () => {
        env.NEXT_PUBLIC_WORLD_SCRIPTS = "";
        expect(await ask("owner")).toEqual({
            ok: false,
            error: "World scripts are off here.",
        });
        expect(await as("owner").access()).toMatchObject({ canEdit: false });
        expect(model).not.toHaveBeenCalled();
    });
});
