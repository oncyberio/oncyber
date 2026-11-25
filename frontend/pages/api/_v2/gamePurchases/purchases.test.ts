/** @jest-environment node */

// The procedures run against the real store code; only Firestore underneath
// is replaced, by this in-memory one.
const mockDocs = new Map<string, Record<string, any>>();
const mockSnapshot = (path: string) => ({
    exists: mockDocs.has(path),
    data: () => mockDocs.get(path),
});
const mockDoc = (path: string) => ({
    path,
    get: async () => mockSnapshot(path),
    set: async (data: Record<string, any>) => void mockDocs.set(path, data),
    collection: (name: string) => mockCollection(`${path}/${name}`),
});
const mockCollection = (path: string) => ({
    doc: (id: string) => mockDoc(`${path}/${id}`),
    orderBy: (field: string) => ({
        limit: (count: number) => ({
            get: async () => ({
                docs: [...mockDocs.entries()]
                    .filter(
                        ([key]) =>
                            key.startsWith(`${path}/`) &&
                            !key.slice(path.length + 1).includes("/")
                    )
                    .sort(([, a], [, b]) => b[field] - a[field])
                    .slice(0, count)
                    .map(([, data]) => ({ data: () => data })),
            }),
        }),
    }),
});
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: (path: string) => mockCollection(path),
        runTransaction: async (run: (tx: any) => Promise<unknown>) => {
            const writes: Array<() => void> = [];
            const result = await run({
                get: async (ref: { path: string }) => mockSnapshot(ref.path),
                set: (ref: { path: string }, data: Record<string, any>) =>
                    void writes.push(() => mockDocs.set(ref.path, data)),
            });
            writes.forEach((write) => write());
            return result;
        },
    },
}));
jest.mock("../../../../features/games/products.declared.json", () => ({
    ace: {
        "gold-racket": {
            name: "Gold racket",
            price: "2.50",
            kind: "permanent",
        },
        "coins-100": { name: "100 coins", price: "0.99", kind: "consumable" },
    },
}));

import Service from "./index";
import {
    purchaseProduct,
    testRail,
    type PaymentRail,
} from "@utils/firestore/gamePurchases";
import { gameProducts } from "@features/games/gamePurchases";

const env = process.env as Record<string, string | undefined>;
const previous = { ...env };
beforeEach(() => {
    mockDocs.clear();
    env.GAMES_PREVIEW = "1";
    env.GAMES_PURCHASES = "test";
    delete env.GAMES_PURCHASE_FEE_PERCENT;
});
afterAll(() => {
    for (const name of [
        "GAMES_PREVIEW",
        "GAMES_PURCHASES",
        "GAMES_PURCHASE_FEE_PERCENT",
    ])
        if (previous[name] === undefined) delete env[name];
        else env[name] = previous[name];
});

const call = (name: string, userId: string | undefined, input: unknown = {}) =>
    (Service as any)[name].call({ userId }, input);
const opts = (name: string) => (Service as any)[name]._RPC_OPTS;
const fund = async (userId: string, times = 1) => {
    for (let i = 0; i < times; i++) await call("addTestFunds", userId);
};

test("every purchase call needs a session, and no game frame can call them", () => {
    for (const name of ["wallet", "buy", "owned", "history", "addTestFunds"])
        expect([name, opts(name).auth]).toEqual([name, true]);
    expect((Service as any).cors).toBe(false);
    return expect(
        call("buy", undefined, {
            game: "ace",
            product: "coins-100",
            key: "key-0001",
        })
    ).rejects.toThrow("Unauthorized");
});

test("the schema takes a product id and a key, nothing that sets a price", () => {
    const schema = opts("buy").schema;
    expect(
        schema.safeParse({ game: "ace", product: "coins-100", key: "key-0001" })
            .success
    ).toBe(true);
    expect(
        schema.safeParse({ game: "ace", product: "Coins", key: "key-0001" })
            .success
    ).toBe(false);
    expect(
        schema.safeParse({ game: "ace", product: "coins-100", key: "k" })
            .success
    ).toBe(false);
    // An extra price is dropped, never read.
    const parsed = schema.parse({
        game: "ace",
        product: "coins-100",
        key: "key-0001",
        cents: 1,
    });
    expect(parsed).toEqual({
        game: "ace",
        product: "coins-100",
        key: "key-0001",
    });
});

test("a purchase takes the declared price from the visitor's own balance", async () => {
    await fund("user-a");
    expect(await call("wallet", "user-a")).toEqual({
        mode: "test",
        cents: 1000,
    });
    const answer = await call("buy", "user-a", {
        game: "ace",
        product: "coins-100",
        key: "key-0001",
    });
    expect(answer).toEqual({ bought: true, order: "ace_coins-100_key-0001" });
    expect(await call("wallet", "user-a")).toEqual({
        mode: "test",
        cents: 901,
    });
    expect(
        mockDocs.get("gameWallets/user-a/orders/ace_coins-100_key-0001")
    ).toMatchObject({
        game: "ace",
        product: "coins-100",
        cents: 99,
        status: "paid",
        rail: "test",
        seller: null,
    });
    expect(
        mockDocs.get("gameSales/ace/sales/user-a_ace_coins-100_key-0001")
    ).toMatchObject({
        buyer: "user-a",
        cents: 99,
        feeCents: 0,
        sellerCents: 99,
    });
    // Someone else's balance and history are untouched.
    expect(await call("wallet", "user-b")).toEqual({ mode: "test", cents: 0 });
    expect(await call("history", "user-b")).toEqual({ purchases: [] });
});

test("the same confirmation sent twice charges once", async () => {
    await fund("user-a");
    const input = { game: "ace", product: "coins-100", key: "key-0001" };
    const [first, second] = await Promise.all([
        call("buy", "user-a", input),
        call("buy", "user-a", input),
    ]);
    expect(first).toEqual({ bought: true, order: "ace_coins-100_key-0001" });
    expect(second).toEqual(first);
    expect(await call("buy", "user-a", input)).toEqual(first);
    expect((await call("wallet", "user-a")).cents).toBe(901);
    // A new confirmation is a new purchase of a consumable.
    await call("buy", "user-a", { ...input, key: "key-0002" });
    expect((await call("wallet", "user-a")).cents).toBe(802);
});

test("a permanent product is bought once, even asked for twice at once", async () => {
    await fund("user-a");
    const buy = (key: string) =>
        call("buy", "user-a", { game: "ace", product: "gold-racket", key });
    const answers = await Promise.all([buy("key-0001"), buy("key-0002")]);
    expect(answers.filter((a: any) => a.bought)).toHaveLength(2);
    expect((await call("wallet", "user-a")).cents).toBe(750);
    expect(await buy("key-0003")).toEqual({
        bought: false,
        reason: "already-owned",
    });
    expect((await call("wallet", "user-a")).cents).toBe(750);
    expect(await call("owned", "user-a", { game: "ace" })).toEqual({
        game: "ace",
        products: ["gold-racket"],
    });
    expect(await call("owned", "user-b", { game: "ace" })).toEqual({
        game: "ace",
        products: [],
    });
});

test("too little money buys nothing, and the visitor can try again after topping up", async () => {
    const buy = (key: string) =>
        call("buy", "user-a", { game: "ace", product: "gold-racket", key });
    expect(await buy("key-0001")).toEqual({
        bought: false,
        reason: "insufficient-funds",
    });
    // The same confirmation again is the same no, with no new charge tried.
    expect(await buy("key-0001")).toEqual({
        bought: false,
        reason: "insufficient-funds",
    });
    expect(await call("owned", "user-a", { game: "ace" })).toEqual({
        game: "ace",
        products: [],
    });
    await fund("user-a");
    expect(await buy("key-0002")).toEqual({
        bought: true,
        order: "ace_gold-racket",
    });
    expect(await call("history", "user-a")).toEqual({
        purchases: [
            expect.objectContaining({
                game: "ace",
                product: "gold-racket",
                name: "Gold racket",
                cents: 250,
            }),
        ],
    });
});

test("unknown products and unknown games are refused", async () => {
    await fund("user-a");
    expect(
        await call("buy", "user-a", {
            game: "ace",
            product: "sword",
            key: "key-0001",
        })
    ).toEqual({ bought: false, reason: "undeclared" });
    await expect(
        call("buy", "user-a", {
            game: "nope",
            product: "coins-100",
            key: "key-0001",
        })
    ).rejects.toThrow("Unknown game");
    expect((await call("wallet", "user-a")).cents).toBe(1000);
});

test("where purchases are off nothing is sold and no test money is given", async () => {
    env.GAMES_PURCHASES = "";
    expect(await call("wallet", "user-a")).toEqual({ mode: "off", cents: 0 });
    expect(
        await call("buy", "user-a", {
            game: "ace",
            product: "coins-100",
            key: "key-0001",
        })
    ).toEqual({ bought: false, reason: "unavailable" });
    await expect(call("addTestFunds", "user-a")).rejects.toThrow(
        "not available"
    );
    // A value this build does not know is off too.
    env.GAMES_PURCHASES = "live";
    expect((await call("wallet", "user-a")).mode).toBe("off");
    env.GAMES_PURCHASES = "test";
    delete env.GAMES_PREVIEW;
    expect((await call("wallet", "user-a")).mode).toBe("off");
    await expect(call("addTestFunds", "user-a")).rejects.toThrow(
        "not available"
    );
});

test("test money stops at its cap", async () => {
    await fund("user-a", 12);
    expect((await call("wallet", "user-a")).cents).toBe(10000);
});

test("the fee is taken from the sale, rounded in the seller's favour", async () => {
    env.GAMES_PURCHASE_FEE_PERCENT = "30";
    await fund("user-a");
    await call("buy", "user-a", {
        game: "ace",
        product: "coins-100",
        key: "key-0001",
    });
    expect(
        mockDocs.get("gameSales/ace/sales/user-a_ace_coins-100_key-0001")
    ).toMatchObject({
        cents: 99,
        feeCents: 29,
        sellerCents: 70,
    });
});

test("a payment whose outcome is unknown is finished by the next ask, paid once", async () => {
    const product = gameProducts("ace")["coins-100"];
    await fund("user-a");
    let calls = 0;
    const payments: string[] = [];
    // Charges, then loses the answer the first time.
    const flaky: PaymentRail = {
        id: "test",
        balance: testRail.balance,
        async pay(input) {
            payments.push(input.payment);
            const paid = await testRail.pay(input);
            if (++calls === 1) throw new Error("connection lost");
            return paid;
        },
    };
    const ask = (key: string) =>
        purchaseProduct({
            userId: "user-a",
            game: "ace",
            product,
            key,
            rail: flaky,
            feePercent: 0,
        });
    expect(await ask("key-0001")).toEqual({
        bought: false,
        reason: "payment-failed",
    });
    expect(
        mockDocs.get("gameWallets/user-a/orders/ace_coins-100_key-0001").status
    ).toBe("pending");
    expect(await ask("key-0001")).toEqual({
        bought: true,
        order: "ace_coins-100_key-0001",
    });
    expect(new Set(payments).size).toBe(1);
    expect(await testRail.balance("user-a")).toBe(901);
});
