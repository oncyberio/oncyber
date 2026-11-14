import {
    applySavedWrite,
    createLocalSavedStore,
    encodeSavedValue,
    readSavedDeclarations,
    readSavedRequest,
    type SavedSlot,
} from "./savedData";
import { createSavedDataBridge } from "./savedDataBridge";
import {
    runSavedCall,
    SAVED_PARTY_TTL_MS,
    SAVED_WRITES_PER_MINUTE,
    type SavedDoc,
    type SavedQuotaDoc,
    type SavedTransaction,
} from "./savedDataServer";

const RAW = {
    settings: { scope: "visitor", stateVersion: 2, maxBytes: 64 },
    format: { scope: "party", stateVersion: 1, maxBytes: 64 },
    tally: { scope: "game", stateVersion: 1, maxBytes: 64, sample: { n: 1 } },
};
const { declared } = readSavedDeclarations(RAW);
const ALL = { ace: RAW };
const PARTY = "trip-0123456789abcdef";

function memory() {
    const values = new Map<string, string>();
    return {
        values,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, value),
        removeItem: (key: string) => void values.delete(key),
    };
}
const slot = (over: Partial<SavedSlot> = {}): SavedSlot => ({
    game: "ace",
    scope: "visitor",
    owner: "guest",
    key: "settings",
    ...over,
});

describe("declarations", () => {
    test("keeps scope, version and limit; drops check-only fields", () => {
        expect(declared.tally).toEqual({
            scope: "game",
            stateVersion: 1,
            maxBytes: 64,
        });
    });
    test("names every problem", () => {
        const { declared, problems } = readSavedDeclarations({
            Bad: { scope: "visitor", stateVersion: 1, maxBytes: 8 },
            a: { scope: "world", stateVersion: 1, maxBytes: 8 },
            b: { scope: "game", stateVersion: 0, maxBytes: 8 },
            c: { scope: "game", stateVersion: 1, maxBytes: 1024 * 1024 },
        });
        expect(Object.keys(declared)).toEqual([]);
        expect(problems).toHaveLength(4);
        expect(readSavedDeclarations([]).problems).toHaveLength(1);
        expect(readSavedDeclarations(undefined).problems).toEqual([]);
    });
});

describe("requests", () => {
    test("refuses undeclared keys, non-JSON and oversized values", () => {
        const set = (key: string, value: unknown, extra = {}) =>
            readSavedRequest(declared, {
                op: "set",
                key,
                stateVersion: 2,
                value,
                ...extra,
            });
        expect(set("token", 1)).toEqual({ reason: "undeclared" });
        expect(set("__proto__", 1)).toEqual({ reason: "invalid" });
        expect(set("settings", { when: new Date() })).toEqual({
            reason: "invalid",
        });
        expect(set("settings", { n: NaN })).toEqual({ reason: "invalid" });
        expect(set("settings", "x".repeat(80))).toEqual({
            reason: "too-large",
        });
        // 34 characters, 66 bytes: measured in bytes, not characters.
        expect(set("settings", "é".repeat(32))).toEqual({
            reason: "too-large",
        });
        expect(set("settings", { a: [1, "b", null] })).toMatchObject({
            request: { value: { a: [1, "b", null] } },
        });
        expect(encodeSavedValue(undefined, 64)).toEqual({ reason: "invalid" });
    });
    test("shared keys need the revision they replace", () => {
        const write = { op: "set", key: "tally", stateVersion: 1, value: 1 };
        expect(readSavedRequest(declared, write)).toEqual({
            reason: "revision-required",
        });
        expect(
            readSavedRequest(declared, { ...write, ifRevision: 0 })
        ).toMatchObject({ request: { ifRevision: 0 } });
        expect(
            readSavedRequest(declared, { op: "remove", key: "tally" })
        ).toEqual({ reason: "revision-required" });
    });
});

test("a write that lost the race gets the winner back", () => {
    const first = applySavedWrite(null, {
        op: "set",
        key: "tally",
        stateVersion: 1,
        value: 1,
        ifRevision: 0,
    });
    expect(first.next).toEqual({ stateVersion: 1, value: 1, revision: 1 });
    const late = applySavedWrite(first.next!, {
        op: "set",
        key: "tally",
        stateVersion: 1,
        value: 9,
        ifRevision: 0,
    });
    expect(late).toEqual({
        result: { ok: false, reason: "conflict", entry: first.next },
    });
    // An older build never replaces a newer save.
    expect(
        applySavedWrite(
            { stateVersion: 3, value: {}, revision: 4 },
            { op: "set", key: "settings", stateVersion: 2, value: {} }
        ).result
    ).toMatchObject({ ok: false, reason: "stale-version" });
});

describe("local store", () => {
    test("saves, reloads and removes", async () => {
        const storage = memory();
        const store = createLocalSavedStore(storage);
        expect(await store.read(slot())).toEqual({ ok: true, entry: null });
        await store.write(slot(), {
            op: "set",
            key: "settings",
            stateVersion: 2,
            value: { games: 3 },
        });
        expect(await createLocalSavedStore(storage).read(slot())).toEqual({
            ok: true,
            entry: { stateVersion: 2, value: { games: 3 }, revision: 1 },
        });
        expect(await store.read(slot({ game: "garden" }))).toEqual({
            ok: true,
            entry: null,
        });
        await store.write(slot(), { op: "remove", key: "settings" });
        expect(storage.values.size).toBe(0);
    });
    test("hands the pre-declaration value over as version 0", async () => {
        const storage = memory();
        storage.setItem("oncyber:game:ace:settings", '{"games":3}');
        const store = createLocalSavedStore(storage);
        expect(await store.read(slot())).toEqual({
            ok: true,
            entry: { stateVersion: 0, value: '{"games":3}', revision: 0 },
        });
        // Not for shared scopes: that string was one person's.
        expect(
            await store.read(
                slot({ scope: "game", owner: "", key: "settings" })
            )
        ).toEqual({ ok: true, entry: null });
    });
    test("survives blocked or corrupt storage", async () => {
        const blocked = {
            getItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
            removeItem: () => {},
        };
        const store = createLocalSavedStore(blocked);
        expect(await store.read(slot())).toEqual({
            ok: false,
            reason: "unavailable",
        });
        const storage = memory();
        storage.setItem("oncyber:game:ace:saved:visitor:guest:settings", "{");
        expect(await createLocalSavedStore(storage).read(slot())).toEqual({
            ok: true,
            entry: null,
        });
    });
});

function server() {
    const values = new Map<string, SavedDoc>();
    const quotas = new Map<string, SavedQuotaDoc>();
    const tx: SavedTransaction = {
        getValue: async (id) => values.get(id) ?? null,
        setValue: (id, doc) =>
            void (doc ? values.set(id, doc) : values.delete(id)),
        getQuota: async (id) => quotas.get(id) ?? null,
        setQuota: (id, doc) => void quotas.set(id, doc),
    };
    const call = (
        request: object,
        userId?: string,
        extra: { party?: string; now?: number; game?: string } = {}
    ) =>
        runSavedCall(
            tx,
            { game: extra.game ?? "ace", party: extra.party, request },
            userId,
            extra.now ?? 1000,
            ALL
        );
    return { values, quotas, call, tx };
}
const setTally = (value: number, ifRevision?: number) => ({
    op: "set",
    key: "tally",
    stateVersion: 1,
    value,
    ifRevision,
});

describe("server rules", () => {
    test("visitor keys belong to the signed-in account", async () => {
        const { call } = server();
        const write = { op: "set", key: "settings", stateVersion: 2, value: 1 };
        expect(await call(write)).toEqual({
            ok: false,
            reason: "sign-in-required",
        });
        expect(await call({ op: "get", key: "settings" })).toEqual({
            ok: false,
            reason: "sign-in-required",
        });
        expect(await call(write, "ada")).toMatchObject({ ok: true });
        expect(await call({ op: "get", key: "settings" }, "ada")).toEqual({
            ok: true,
            entry: { stateVersion: 2, value: 1, revision: 1 },
        });
        expect(await call({ op: "get", key: "settings" }, "bob")).toEqual({
            ok: true,
            entry: null,
        });
    });
    test("two writers of a shared key cannot overwrite each other", async () => {
        const { call } = server();
        expect(await call(setTally(1), "ada")).toEqual({
            ok: false,
            reason: "revision-required",
        });
        expect(await call(setTally(1, 0), "ada")).toMatchObject({ ok: true });
        // Bob read "nothing saved" at the same time as Ada.
        expect(await call(setTally(5, 0), "bob")).toEqual({
            ok: false,
            reason: "conflict",
            entry: { stateVersion: 1, value: 1, revision: 1 },
        });
        expect(await call(setTally(2, 1), "bob")).toMatchObject({
            ok: true,
            entry: { value: 2, revision: 2 },
        });
        // Guests read what everyone shares, and cannot write it.
        expect(await call({ op: "get", key: "tally" })).toMatchObject({
            entry: { value: 2 },
        });
        expect(await call(setTally(3, 2))).toEqual({
            ok: false,
            reason: "sign-in-required",
        });
    });
    test("party keys live under the trip id and expire after the trip", async () => {
        const { call } = server();
        const write = {
            op: "set",
            key: "format",
            stateVersion: 1,
            value: "duel",
            ifRevision: 0,
        };
        expect(await call(write, "ada")).toEqual({
            ok: false,
            reason: "no-party",
        });
        expect(await call(write, "ada", { party: "../x" })).toEqual({
            ok: false,
            reason: "no-party",
        });
        expect(await call(write, "ada", { party: PARTY })).toMatchObject({
            ok: true,
        });
        const get = { op: "get", key: "format" };
        expect(await call(get, undefined, { party: PARTY })).toMatchObject({
            entry: { value: "duel" },
        });
        expect(await call(get, undefined, { party: PARTY + "-other" })).toEqual(
            { ok: true, entry: null }
        );
        expect(
            await call(get, undefined, {
                party: PARTY,
                now: 1000 + SAVED_PARTY_TTL_MS,
            })
        ).toEqual({ ok: true, entry: null });
    });
    test("refuses unknown games, undeclared keys and oversized values", async () => {
        const { call, values } = server();
        expect(await call(setTally(1, 0), "ada", { game: "nope" })).toEqual({
            ok: false,
            reason: "undeclared",
        });
        expect(await call({ op: "get", key: "token" }, "ada")).toEqual({
            ok: false,
            reason: "undeclared",
        });
        expect(
            await call({ ...setTally(1, 0), value: "x".repeat(100) }, "ada")
        ).toEqual({ ok: false, reason: "too-large" });
        expect(values.size).toBe(0);
    });
    test("limits writes per account per minute", async () => {
        const { call } = server();
        for (let i = 0; i < SAVED_WRITES_PER_MINUTE; i++)
            expect(await call(setTally(i, i), "ada")).toMatchObject({
                ok: true,
            });
        const next = setTally(0, SAVED_WRITES_PER_MINUTE);
        expect(await call(next, "ada")).toEqual({
            ok: false,
            reason: "rate-limited",
        });
        expect(await call(next, "bob")).toMatchObject({ ok: true });
        expect(
            await call(setTally(0, SAVED_WRITES_PER_MINUTE + 1), "ada", {
                now: 62_000,
            })
        ).toMatchObject({ ok: true });
    });
});

describe("page bridge", () => {
    function bridge(options: {
        account?: string | null;
        party?: string | null;
        remote?: boolean;
        localShared?: boolean;
    }) {
        const storage = memory();
        const { call } = server();
        const local = createLocalSavedStore(storage);
        const down = { value: false };
        const run = (s: SavedSlot, request: object) =>
            down.value
                ? Promise.resolve({
                      ok: false as const,
                      reason: "unavailable" as const,
                  })
                : call(request, options.account ?? undefined, {
                      party: s.scope === "party" ? s.owner : undefined,
                  });
        const handle = createSavedDataBridge({
            game: "ace",
            declared,
            local,
            remote:
                options.remote === false
                    ? null
                    : {
                          read: (s) => run(s, { op: "get", key: s.key }),
                          write: run,
                      },
            account: () => options.account ?? null,
            party: () => options.party ?? null,
            localShared: options.localShared,
        });
        return { handle, storage, down };
    }
    const save = { op: "set", key: "settings", stateVersion: 2, value: 7 };

    test("guests save in the browser; shared keys stay read-only", async () => {
        const { handle, storage } = bridge({});
        expect(await handle(save)).toMatchObject({ ok: true });
        expect(storage.values.size).toBe(1);
        expect(await handle({ op: "get", key: "settings" })).toMatchObject({
            entry: { value: 7, revision: 1 },
        });
        expect(await handle({ op: "get", key: "tally" })).toEqual({
            ok: true,
            entry: null,
        });
        expect(await handle(setTally(1, 0))).toEqual({
            ok: false,
            reason: "sign-in-required",
        });
        expect(await handle({ op: "get", key: "format" })).toEqual({
            ok: false,
            reason: "no-party",
        });
        expect(await handle({ op: "get", key: "token" })).toEqual({
            ok: false,
            reason: "undeclared",
        });
    });
    test("signed in: the server holds it, and guest progress carries over", async () => {
        const { handle, storage } = bridge({ account: "ada", party: PARTY });
        storage.setItem("oncyber:game:ace:settings", '{"games":3}');
        expect(await handle({ op: "get", key: "settings" })).toEqual({
            ok: true,
            entry: { stateVersion: 0, value: '{"games":3}', revision: 0 },
        });
        expect(await handle({ ...save, ifRevision: 0 })).toMatchObject({
            ok: true,
        });
        expect(storage.values.size).toBe(1);
        expect(await handle({ op: "get", key: "settings" })).toMatchObject({
            entry: { value: 7, stateVersion: 2 },
        });
        expect(
            await handle({
                op: "set",
                key: "format",
                stateVersion: 1,
                value: "duel",
                ifRevision: 0,
            })
        ).toMatchObject({ ok: true });
    });
    test("an unreachable server is an answer, not an exception", async () => {
        const { handle, down } = bridge({ account: "ada" });
        down.value = true;
        expect(await handle(setTally(1, 0))).toEqual({
            ok: false,
            reason: "unavailable",
        });
        expect(await handle(save)).toEqual({
            ok: false,
            reason: "unavailable",
        });
    });
    test("development without a server keeps shared keys in the browser", async () => {
        const { handle, down } = bridge({ party: PARTY, localShared: true });
        down.value = true;
        expect(await handle(setTally(1, 0))).toMatchObject({ ok: true });
        expect(await handle(setTally(2, 0))).toMatchObject({
            ok: false,
            reason: "conflict",
            entry: { value: 1 },
        });
        down.value = false;
        expect(await handle(setTally(2, 0))).toEqual({
            ok: false,
            reason: "sign-in-required",
        });
    });
});
