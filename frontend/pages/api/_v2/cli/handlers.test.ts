/** @jest-environment node */
import crypto from "crypto";

// The procedures run as they are, on an in-memory Firestore.
const mockDocs = new Map<string, Record<string, any>>();
const mockSnap = (path: string) => ({
    exists: mockDocs.has(path),
    data: () => mockDocs.get(path),
});
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: (name: string) => ({
            doc: (id: string) => ({
                path: `${name}/${id}`,
                set: async (data: Record<string, any>) =>
                    void mockDocs.set(`${name}/${id}`, data),
            }),
        }),
        runTransaction: (run: (transaction: any) => Promise<unknown>) =>
            run({
                get: async (ref: { path: string }) => mockSnap(ref.path),
                update: (ref: { path: string }, data: Record<string, any>) =>
                    void mockDocs.set(ref.path, {
                        ...mockDocs.get(ref.path),
                        ...data,
                    }),
            }),
    },
}));

import jwt from "jsonwebtoken";
import { authorize, CODE_TTL_MS } from "./authorize";
import { exchange } from "./exchange";

const mint = (userId: string, input: object = {}) =>
    (authorize as any).call({ userId }, input) as Promise<{ code: string }>;
const trade = (input: object) => (exchange as any).call({}, input);
const secret = () => crypto.randomBytes(32).toString("base64url");
const challengeOf = (verifier: string) =>
    crypto.createHash("sha256").update(verifier).digest("base64url");

beforeEach(() => {
    mockDocs.clear();
    process.env.SECRET_JWT_KEY = "test-secret";
});

describe("signing a terminal in", () => {
    test("a code from a redirect is traded once for a session", async () => {
        const { code } = await mint("acc-1");
        const answer = await trade({ code });
        expect(answer.userId).toBe("acc-1");
        expect(jwt.verify(answer.token, "test-secret")).toMatchObject({
            user: "acc-1",
        });
        await expect(trade({ code })).rejects.toThrow(/already-used/);
    });

    test("a code carried over by hand answers only the terminal that asked", async () => {
        const verifier = secret();
        const { code } = await mint("acc-1", {
            challenge: challengeOf(verifier),
        });
        // Whoever else sees the code has nothing.
        await expect(trade({ code })).rejects.toThrow(/Invalid/);
        await expect(trade({ code, verifier: secret() })).rejects.toThrow(
            /Invalid/
        );
        // And their tries do not spend it for the one who asked.
        const answer = await trade({ code, verifier });
        expect(answer.userId).toBe("acc-1");
        await expect(trade({ code, verifier })).rejects.toThrow(/already-used/);
    });

    test("a code does not last", async () => {
        const verifier = secret();
        const { code } = await mint("acc-1", {
            challenge: challengeOf(verifier),
        });
        const path = `cliAuthCodes/${code}`;
        mockDocs.set(path, {
            ...mockDocs.get(path),
            createdAt: Date.now() - CODE_TTL_MS - 1,
        });
        await expect(trade({ code, verifier })).rejects.toThrow(/expired/);
    });
});
