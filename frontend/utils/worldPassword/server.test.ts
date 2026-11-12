/** @jest-environment node */
import {
    copyWorldPassword,
    createWorldPasswordCheck,
    hashWorldPassword,
    secureGatingPatches,
    verifyWorldPassword,
    writesWorldPassword,
} from "./server";
import { signWorldAccessProof } from "./proof";

// A small in-memory Firestore: documents by path, transactions applied on
// return.
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
    const clone = (value) =>
        value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    const snap = (path: string) => ({
        id: path.split("/")[1],
        exists: store.has(path),
        data: () => clone(store.get(path)),
    });
    const ref = (path: string) => ({ path, get: async () => snap(path) });
    const setPath = (data: any, segments: string[], value: any) => {
        let node = data;
        segments.slice(0, -1).forEach((key) => (node = node[key] ||= {}));
        node[segments[segments.length - 1]] = value;
    };
    const db = {
        store,
        collection: (name: string) => ({
            doc: (id: string) => ref(`${name}/${id}`),
        }),
        getAll: async (...refs: any[]) =>
            refs.filter((it) => it?.path).map((it) => snap(it.path)),
        runTransaction: async (run) => {
            const writes: Array<() => void> = [];
            const transaction = {
                getAll: async (...refs: any[]) =>
                    refs.filter((it) => it?.path).map((it) => snap(it.path)),
                set: (r, value) =>
                    writes.push(() => store.set(r.path, clone(value))),
                delete: (r) => writes.push(() => store.delete(r.path)),
                update: (r, ...args) =>
                    writes.push(() => {
                        const data = store.get(r.path);
                        for (let i = 0; i < args.length; i += 2)
                            setPath(data, args[i].segments, clone(args[i + 1]));
                    }),
            };
            const result = await run(transaction);
            writes.forEach((write) => write());
            return result;
        },
    };
    return { db };
});

const { db } = jest.requireMock("@utils/firebaseAdmin");
const store: Map<string, any> = db.store;

const PLAIN = "correct horse";
const KEY = "server-test-world-access-secret";
let savedKey: string | undefined;

beforeAll(() => {
    savedKey = process.env.WORLD_ACCESS_SECRET;
    process.env.WORLD_ACCESS_SECRET = KEY;
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

async function hashedWorld(id = "w1", rev = "rev-1") {
    store.set(`exhibits/${id}`, {
        info: {},
        gating: { password: { message: "Ask Bob", rev } },
    });
    store.set(`exhibitSecrets/${id}`, {
        password: { hash: await hashWorldPassword(PLAIN), rev },
        updatedAt: 1,
    });
}

function legacyWorld(id = "w1") {
    store.set(`exhibits/${id}`, {
        info: {},
        lastUpdatedAt: 1,
        gating: { password: { message: "Ask Bob", password: PLAIN } },
    });
}

describe("hashing", () => {
    test("a salted scrypt hash that only the password matches", async () => {
        const a = await hashWorldPassword(PLAIN);
        const b = await hashWorldPassword(PLAIN);
        expect(a).toMatch(/^scrypt\$16384\$8\$1\$/);
        expect(a).not.toBe(b);
        expect(a).not.toContain(PLAIN);
        expect(await verifyWorldPassword(PLAIN, a)).toBe(true);
        expect(await verifyWorldPassword(PLAIN, b)).toBe(true);
        expect(await verifyWorldPassword("correct horse ", a)).toBe(false);
        expect(await verifyWorldPassword("", a)).toBe(false);
        expect(await verifyWorldPassword(undefined, a)).toBe(false);
    });

    test("the migration script hashes in the same format", async () => {
        const { hash } = require("../../../tasks/world-passwords/migrate.js");
        const stored = await hash(PLAIN);
        expect(await verifyWorldPassword(PLAIN, stored)).toBe(true);
        expect(await verifyWorldPassword("wrong", stored)).toBe(false);
    });

    test.each([
        ["plain text", PLAIN],
        ["another scheme", "bcrypt$10$abc"],
        [
            "a cost that would stall the server",
            "scrypt$1073741824$8$1$c2FsdA==$aGFzaA==",
        ],
        ["N not a power of two", "scrypt$1000$8$1$c2FsdA==$aGFzaA=="],
        ["missing parts", "scrypt$16384$8$1"],
    ])("a stored value that is %s never matches", async (_, stored) => {
        expect(await verifyWorldPassword(PLAIN, stored)).toBe(false);
    });
});

describe("checking a password", () => {
    const check = (input: { password?: string; proof?: string }, gating?) =>
        createWorldPasswordCheck({ exhibitId: "w1", gating, ...input });

    test("a hashed world accepts its password only", async () => {
        await hashedWorld();
        const gating = store.get("exhibits/w1").gating;
        expect(await check({ password: PLAIN }, gating).check()).toBe(true);
        expect(await check({ password: "wrong" }, gating).check()).toBe(false);
        expect(await check({}, gating).check()).toBe(false);
        // Read from storage when the caller has only the public exhibit.
        expect(await check({ password: PLAIN }).check()).toBe(true);
    });

    test("a missing secret fails closed", async () => {
        await hashedWorld();
        store.delete("exhibitSecrets/w1");
        expect(await check({ password: PLAIN }).check()).toBe(false);
    });

    test("a secret from another revision does not count", async () => {
        await hashedWorld();
        store.get("exhibits/w1").gating.password.rev = "rev-2";
        expect(await check({ password: PLAIN }).check()).toBe(false);
    });

    test("a proof for the current password stands in for it", async () => {
        await hashedWorld();
        const proof = (rev: string, exhibitId = "w1") =>
            signWorldAccessProof({ exhibitId, rev });
        expect(await check({ proof: proof("rev-1") }).check()).toBe(true);
        expect(await check({ proof: proof("rev-0") }).check()).toBe(false);
        expect(await check({ proof: proof("rev-1", "w2") }).check()).toBe(
            false
        );
        expect(await check({ proof: "wa1.forged.proof" }).check()).toBe(false);
    });

    test("an expired proof still renews for a day, then the password is needed", async () => {
        await hashedWorld();
        const hour = 60 * 60 * 1000;
        const issued = (ago: number) =>
            signWorldAccessProof(
                { exhibitId: "w1", rev: "rev-1" },
                { now: Date.now() - ago }
            );
        expect(await check({ proof: issued(2 * hour) }).check()).toBe(true);
        expect(await check({ proof: issued(26 * hour) }).check()).toBe(false);
    });

    test("an old document is compared once more, then hashed on that check", async () => {
        legacyWorld();
        const accepted = check({ password: PLAIN });
        expect(await accepted.check()).toBe(true);
        const doc = store.get("exhibits/w1");
        const secret = store.get("exhibitSecrets/w1");
        expect(JSON.stringify(doc)).not.toContain(PLAIN);
        expect(doc.gating.password).toEqual({
            message: "Ask Bob",
            rev: secret.password.rev,
        });
        expect(doc.lastUpdatedAt).toBeGreaterThan(1);
        expect(accepted.rev).toBe(secret.password.rev);
        expect(await verifyWorldPassword(PLAIN, secret.password.hash)).toBe(
            true
        );
        // From now on, the hash decides.
        expect(await check({ password: PLAIN }).check()).toBe(true);
        expect(await check({ password: "wrong" }).check()).toBe(false);
    });

    test("a wrong password on an old document is refused, and still hashed", async () => {
        legacyWorld();
        expect(await check({ password: "wrong" }).check()).toBe(false);
        expect(JSON.stringify(store.get("exhibits/w1"))).not.toContain(PLAIN);
        expect(store.has("exhibitSecrets/w1")).toBe(true);
    });

    test("a world without a password needs none", async () => {
        store.set("exhibits/w1", { gating: { noAnonymous: true } });
        expect(await check({}).check()).toBe(true);
    });
});

describe("saving from the studio", () => {
    const current = { password: { message: "Old", rev: "rev-1" } };
    const legacy = { password: { message: "Old", password: PLAIN } };

    async function secure(patches: any[], gating: any = current) {
        const result = await secureGatingPatches(patches, gating);
        expect(JSON.stringify(result.patches)).not.toContain(PLAIN);
        return result;
    }

    test("a new password is hashed into the secret under a new revision", async () => {
        const { patches, secretWrite } = await secure([
            {
                op: "replace",
                path: ["gating", "password"],
                value: { password: PLAIN, message: "Hi" },
            },
        ]);
        expect(secretWrite.type).toBe("set");
        const secret = (secretWrite as any).secret.password;
        expect(patches).toEqual([
            {
                op: "replace",
                path: ["gating", "password"],
                value: { message: "Hi", rev: secret.rev },
            },
        ]);
        expect(secret.rev).not.toBe("rev-1");
        expect(await verifyWorldPassword(PLAIN, secret.hash)).toBe(true);
    });

    test("a new gating object with a password", async () => {
        const { patches, secretWrite } = await secure(
            [
                {
                    op: "add",
                    path: ["gating"],
                    value: { noAnonymous: true, password: { password: PLAIN } },
                },
            ],
            null
        );
        expect(patches[0].value).toEqual({
            noAnonymous: true,
            password: {
                message: "",
                rev: (secretWrite as any).secret.password.rev,
            },
        });
    });

    test.each([
        ["a message edit", { message: "New" }],
        // What a client read comes back with a save: its rev is not trusted.
        ["the public shape coming back", { message: "New", rev: "forged" }],
    ])("%s keeps the password in force", async (_, value) => {
        const { patches, secretWrite } = await secure([
            { op: "replace", path: ["gating", "password"], value },
        ]);
        expect(secretWrite).toBeNull();
        expect(patches[0].value).toEqual({ message: "New", rev: "rev-1" });
    });

    test("a single field write of the password", async () => {
        const { patches, secretWrite } = await secure([
            {
                op: "replace",
                path: ["gating", "password", "password"],
                value: PLAIN,
            },
            {
                op: "replace",
                path: ["gating", "password", "rev"],
                value: "forged",
            },
            {
                op: "replace",
                path: ["gating", "password", "message"],
                value: "M",
            },
        ]);
        const rev = (secretWrite as any).secret.password.rev;
        expect(patches).toEqual([
            { op: "remove", path: ["gating", "password", "password"] },
            { op: "add", path: ["gating", "password", "rev"], value: rev },
            {
                op: "replace",
                path: ["gating", "password", "message"],
                value: "M",
            },
        ]);
    });

    test.each([
        [{ op: "remove", path: ["gating"] }],
        [{ op: "remove", path: ["gating", "password"] }],
    ])("removing the gate removes the secret: %o", async (patch) => {
        const { patches, secretWrite } = await secure([patch]);
        expect(secretWrite).toEqual({ type: "delete" });
        expect(patches).toEqual([patch]);
    });

    test("a cleared field removes the password, as an empty one never asked", async () => {
        const { patches, secretWrite } = await secure([
            {
                op: "replace",
                path: ["gating", "password"],
                value: { password: "", message: "M" },
            },
        ]);
        expect(secretWrite).toEqual({ type: "delete" });
        expect(patches[0].value).toEqual({ message: "M" });
    });

    test("any save of an old document's gate hashes its password", async () => {
        const { patches, secretWrite } = await secure(
            [
                {
                    op: "replace",
                    path: ["gating", "password"],
                    value: { message: "New" },
                },
            ],
            legacy
        );
        const secret = (secretWrite as any).secret.password;
        expect(patches[0].value).toEqual({ message: "New", rev: secret.rev });
        expect(await verifyWorldPassword(PLAIN, secret.hash)).toBe(true);
    });

    test("other fields pass through untouched", async () => {
        const patch = {
            op: "replace",
            path: ["gating", "noAnonymous"],
            value: true,
        };
        const art = {
            op: "add",
            path: ["artworks", "a"],
            value: { password: 1 },
        };
        const { patches, secretWrite } = await secure([patch, art]);
        expect(patches).toEqual([patch, art]);
        expect(secretWrite).toBeNull();
    });
});

describe("legacy updates", () => {
    test.each([
        [{ gating: { password: { password: PLAIN } } }, true],
        [
            {
                FIRESTORE_UPDATE_Field: true,
                update: { gating: { password: {} } },
            },
            true,
        ],
        [
            {
                FIRESTORE_UPDATE_Field: true,
                update: { "gating.password.password": "x" },
            },
            true,
        ],
        [
            {
                FIRESTORE_UPDATE_Field: true,
                update: { gating: { FIRESTORE_DELETE_Field: true } },
            },
            false,
        ],
        [
            {
                FIRESTORE_UPDATE_Field: true,
                update: { gating: { noAnonymous: true } },
            },
            false,
        ],
        [
            {
                FIRESTORE_UPDATE_Field: true,
                update: { info: { headline: "x" } },
            },
            false,
        ],
        [{ FIRESTORE_ADD_ASSET: true, asset: { password: "x" } }, false],
    ])("%o writes a password: %s", (payload, writes) => {
        expect(writesWorldPassword(payload)).toBe(writes);
    });
});

describe("copying a world", () => {
    test("a hashed password is copied under a new revision", async () => {
        await hashedWorld("src");
        const copy = await copyWorldPassword("src");
        const source = store.get("exhibitSecrets/src").password;
        expect(copy.password).toEqual({
            message: "Ask Bob",
            rev: copy.secret.password.rev,
        });
        expect(copy.secret.password.rev).not.toBe(source.rev);
        expect(copy.secret.password.hash).toBe(source.hash);
    });

    test("an old document's password is hashed for the copy", async () => {
        legacyWorld("src");
        const copy = await copyWorldPassword("src");
        expect(JSON.stringify(copy.password)).not.toContain(PLAIN);
        expect(
            await verifyWorldPassword(PLAIN, copy.secret.password.hash)
        ).toBe(true);
    });

    test("a world without a password copies none", async () => {
        store.set("exhibits/src", { gating: { noAnonymous: true } });
        expect(await copyWorldPassword("src")).toBeNull();
    });
});
