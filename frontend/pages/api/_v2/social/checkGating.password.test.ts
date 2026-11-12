/** @jest-environment node */
// The password step end to end: the real gating rules, the real check
// against the hash, the real proof; storage is in memory.
import { checkGating } from "./checkGating";
import { hashWorldPassword } from "@utils/worldPassword/server";
import { readWorldAccessProof } from "@utils/worldPassword/proof";

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));
jest.mock("@api/accounts/user/utils", () => ({ getUserByDoc: jest.fn() }), {
    virtual: true,
});
jest.mock(
    "@dapp/ownership/collections",
    () => ({ isCollectionOwner: jest.fn() }),
    {
        virtual: true,
    }
);
jest.mock("@utils/auth/proxyWallets", () => ({ getProxyWallets: jest.fn() }));
jest.mock("@features/studio/utils", () => ({
    getLinkedWalletsUserProxyObject: jest.fn(() => ({})),
}));
jest.mock("ethers", () => ({ ethers: { providers: {} } }));
jest.mock("firebase-admin", () => ({
    firestore: {
        FieldPath: class {
            segments: string[];
            constructor(...segments: string[]) {
                this.segments = segments;
            }
        },
    },
}));
jest.mock("@utils/firebaseAdmin", () => {
    const store = new Map<string, any>();
    const clone = (v) =>
        v === undefined ? undefined : JSON.parse(JSON.stringify(v));
    const snap = (path: string) => ({
        id: path.split("/")[1],
        exists: store.has(path),
        data: () => clone(store.get(path)),
    });
    const ref = (path: string) => ({ path, get: async () => snap(path) });
    const db = {
        store,
        collection: (name: string) => ({
            doc: (id: string) => ref(`${name}/${id}`),
        }),
        getAll: async (...refs: any[]) =>
            refs.filter((it) => it?.path).map((it) => snap(it.path)),
        runTransaction: async (run) => {
            const writes = [];
            const result = await run({
                getAll: async (...refs: any[]) =>
                    refs.filter((it) => it?.path).map((it) => snap(it.path)),
                set: (r, v) => writes.push(() => store.set(r.path, clone(v))),
                update: (r, ...args) =>
                    writes.push(() => {
                        const data = store.get(r.path);
                        for (let i = 0; i < args.length; i += 2) {
                            const path = args[i].segments;
                            let node = data;
                            path.slice(0, -1).forEach(
                                (k) => (node = node[k] ||= {})
                            );
                            node[path[path.length - 1]] = clone(args[i + 1]);
                        }
                    }),
            });
            writes.forEach((write) => write());
            return result;
        },
    };
    return { db };
});

const { db } = jest.requireMock("@utils/firebaseAdmin");
const store: Map<string, any> = db.store;
const PLAIN = "open sesame";
const call = (input: any) =>
    checkGating.call({ userId: undefined } as any, {
        spaceId: "s@w1",
        nbPlayers: 0,
        ...input,
    });

let savedKey: string | undefined;
beforeAll(() => {
    savedKey = process.env.WORLD_ACCESS_SECRET;
    process.env.WORLD_ACCESS_SECRET = "check-gating-test-secret";
});
afterAll(() => {
    if (savedKey === undefined) delete process.env.WORLD_ACCESS_SECRET;
    else process.env.WORLD_ACCESS_SECRET = savedKey;
});
beforeEach(() => {
    store.clear();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

async function hashedWorld() {
    store.set("exhibits/w1", {
        editors: ["0xeditor"],
        gating: { password: { message: "Ask", rev: "rev-1" } },
    });
    store.set("exhibitSecrets/w1", {
        password: { hash: await hashWorldPassword(PLAIN), rev: "rev-1" },
        updatedAt: 1,
    });
}

test("the same answers as before for the visitor, and a proof with success", async () => {
    await hashedWorld();
    await expect(call({})).resolves.toEqual({ type: "password-error" });
    await expect(call({ password: "nope" })).resolves.toEqual({
        type: "password-error",
    });
    const result: any = await call({ password: PLAIN });
    expect(result.type).toBe("success");
    expect(readWorldAccessProof(result.proof)).toMatchObject({
        exhibitId: "w1",
        rev: "rev-1",
    });
    // No answer carries the password or its hash.
    const secret = store.get("exhibitSecrets/w1").password.hash;
    expect(JSON.stringify(result)).not.toContain(PLAIN);
    expect(JSON.stringify(result)).not.toContain(secret);
});

test("the proof stands in for the password, until the password changes", async () => {
    await hashedWorld();
    const { proof }: any = await call({ password: PLAIN });
    const again: any = await call({ proof });
    expect(again.type).toBe("success");
    expect(typeof again.proof).toBe("string");
    store.get("exhibits/w1").gating.password.rev = "rev-2";
    store.get("exhibitSecrets/w1").password.rev = "rev-2";
    await expect(call({ proof })).resolves.toEqual({ type: "password-error" });
});

test("an editor gets in without the password, with a proof for the room", async () => {
    await hashedWorld();
    const result: any = await checkGating.call({ userId: "0xEDITOR" } as any, {
        spaceId: "s@w1",
        nbPlayers: 0,
    });
    expect(result.type).toBe("success");
    expect(readWorldAccessProof(result.proof)?.rev).toBe("rev-1");
});

test("an old document's plain password works once more and is hashed by that check", async () => {
    store.set("exhibits/w1", {
        editors: [],
        gating: { password: { message: "Ask", password: PLAIN } },
    });
    const result: any = await call({ password: PLAIN });
    expect(result.type).toBe("success");
    const doc = store.get("exhibits/w1");
    expect(JSON.stringify(doc)).not.toContain(PLAIN);
    // The proof names the revision now in force, which the room will read.
    expect(readWorldAccessProof(result.proof)?.rev).toBe(
        doc.gating.password.rev
    );
    await expect(call({ password: "nope" })).resolves.toEqual({
        type: "password-error",
    });
    expect((await call({ password: PLAIN })).type).toBe("success");
});

test("worlds without a password give no proof", async () => {
    store.set("exhibits/w1", { editors: [], gating: { noAnonymous: false } });
    await expect(call({})).resolves.toEqual({ type: "success" });
});

test("too many wrong passwords from one address: the right one waits too", async () => {
    await hashedWorld();
    const from = (address: string, input: any) =>
        checkGating.call(
            {
                userId: undefined,
                req: { headers: { "x-forwarded-for": address } },
            } as any,
            { spaceId: "s@w1", nbPlayers: 0, ...input }
        );
    for (let i = 0; i < 10; i++)
        await expect(
            from("203.0.113.9", { password: `guess ${i}` })
        ).resolves.toEqual({ type: "password-error" });
    await expect(from("203.0.113.9", { password: PLAIN })).resolves.toEqual({
        type: "too-many-attempts-error",
    });
    // Another address, and a visitor with a proof, are not held back.
    const admitted: any = await from("198.51.100.4", { password: PLAIN });
    expect(admitted.type).toBe("success");
    expect((await from("203.0.113.9", { proof: admitted.proof })).type).toBe(
        "success"
    );
});
