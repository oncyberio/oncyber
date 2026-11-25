/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mockService = {
    wallet: jest.fn(
        async (_input: unknown): Promise<any> => ({ mode: "test", cents: 1000 })
    ),
    buy: jest.fn(
        async (_input: unknown): Promise<any> => ({
            bought: true,
            order: "ace_coins-100_key",
        })
    ),
    owned: jest.fn(async (_input: unknown) => ({
        game: "ace",
        products: ["gold-racket"],
    })),
    history: jest.fn(async (_input: unknown) => ({
        purchases: [
            {
                order: "ace_gold-racket",
                game: "ace",
                product: "gold-racket",
                name: "Gold racket",
                cents: 250,
                at: 1,
            },
        ],
    })),
    addTestFunds: jest.fn(async (_input: unknown) => ({ cents: 1000 })),
};
jest.mock("@api/gamePurchases/_api", () => ({
    __esModule: true,
    default: {
        wallet: (input: unknown) => mockService.wallet(input),
        buy: (input: unknown) => mockService.buy(input),
        owned: (input: unknown) => mockService.owned(input),
        history: (input: unknown) => mockService.history(input),
        addTestFunds: (input: unknown) => mockService.addTestFunds(input),
    },
}));
jest.mock("./products.declared.json", () => ({
    ace: {
        "gold-racket": {
            name: "Gold racket",
            price: "2.50",
            kind: "permanent",
        },
        "coins-100": { name: "100 coins", price: "0.99", kind: "consumable" },
    },
}));

import {
    purchaseAction,
    PURCHASE_POLL,
    useGamePurchases,
} from "./useGamePurchases";
import { gamePauseHeld } from "./gamePause";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no Web Crypto; the page's confirmation ids need it.
if (!globalThis.crypto?.getRandomValues)
    Object.defineProperty(globalThis, "crypto", {
        value: require("node:crypto").webcrypto,
        configurable: true,
    });
const mounted: Array<{ root: Root; host: HTMLElement }> = [];
afterEach(() => {
    mounted.splice(0).forEach(({ root, host }) => {
        act(() => root.unmount());
        host.remove();
    });
    jest.clearAllMocks();
});

function mount(
    more: {
        game?: string;
        account?: string | null;
        pay?: (request: any, userId?: string) => Promise<any>;
    } = {}
) {
    const sent: any[] = [];
    const state = {
        account: more.account === undefined ? "user-a" : more.account,
    };
    const signIn = jest.fn((done: () => void) => {
        state.account = "user-a";
        done();
    });
    const openWallet = jest.fn(async () => {});
    function Probe() {
        const [, redraw] = React.useState(0);
        const purchases = useGamePurchases({
            game: more.game ?? "ace",
            title: "ACE! Tennis",
            fromGame: () => true,
            send: (message) => sent.push(message),
            account: () => state.account,
            signIn: (done) => {
                signIn(done);
                redraw((n) => n + 1);
            },
            openWallet,
            pay: more.pay,
        });
        return <main>{purchases.element}</main>;
    }
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    mounted.push({ root, host });
    act(() => root.render(<Probe />));
    const fromGame = async (kind: string, data: object) => {
        await act(async () => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: `oncyber:game:${kind}`, ...data },
                })
            );
        });
        await act(async () => {});
    };
    const press = async (label: RegExp) => {
        const button = [...host.querySelectorAll("button")].find((b) =>
            label.test(b.getAttribute("aria-label") || b.textContent || "")
        );
        if (!button) throw new Error(`no button ${label}: ${host.textContent}`);
        await act(async () => button.click());
        await act(async () => {});
    };
    return { host, sent, fromGame, press, signIn, openWallet };
}

test("the sheet's main button follows who is signed in and what they hold", () => {
    const wallet = { mode: "test" as const, cents: 100 };
    expect(purchaseAction({ signedIn: false, wallet: null, cents: 99 })).toBe(
        "sign-in"
    );
    expect(purchaseAction({ signedIn: true, wallet: null, cents: 99 })).toBe(
        "wait"
    );
    expect(
        purchaseAction({
            signedIn: true,
            wallet: { mode: "off", cents: 0 },
            cents: 99,
        })
    ).toBe("unavailable");
    expect(purchaseAction({ signedIn: true, wallet, cents: 250 })).toBe(
        "add-funds"
    );
    expect(purchaseAction({ signedIn: true, wallet, cents: 99 })).toBe("buy");
});

test("the page asks the visitor, pays, and tells the game it was bought", async () => {
    const { host, sent, fromGame, press } = mount();
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    const sheet = host.querySelector('[role="dialog"]');
    // The name and price are the declared ones, drawn by the page.
    expect(sheet?.getAttribute("aria-label")).toBe("Buy 100 coins");
    expect(sheet?.textContent).toContain("ACE! Tennis");
    expect(sheet?.textContent).toContain("Price$0.99");
    expect(sheet?.textContent).toContain("Test balance$10.00");
    expect(sheet?.textContent).toContain("No real money is used.");
    // The game is paused while the question is up, and has heard nothing yet.
    expect(gamePauseHeld()).toBe(true);
    expect(sent).toEqual([]);
    await press(/^Buy for \$0\.99$/);
    expect(mockService.buy).toHaveBeenCalledTimes(1);
    expect(mockService.buy.mock.calls[0][0]).toMatchObject({
        game: "ace",
        product: "coins-100",
    });
    expect(sent).toEqual([
        {
            type: "ace:purchase-result",
            request: "req-0001",
            bought: true,
            order: "ace_coins-100_key",
        },
    ]);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(gamePauseHeld()).toBe(false);
});

test("Cancel, Escape and the close button are a no, and nothing is paid", async () => {
    const { host, sent, fromGame, press } = mount();
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    await press(/^Cancel$/);
    await fromGame("purchase", { request: "req-0002", product: "coins-100" });
    await act(async () => {
        window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
    });
    await fromGame("purchase", { request: "req-0003", product: "coins-100" });
    await press(/^Close buy 100 coins$/);
    expect(sent.map((m) => [m.request, m.bought, m.reason])).toEqual([
        ["req-0001", false, "cancelled"],
        ["req-0002", false, "cancelled"],
        ["req-0003", false, "cancelled"],
    ]);
    expect(mockService.buy).not.toHaveBeenCalled();
});

test("Escape belongs to a sheet opened over the question, such as the sign-in", async () => {
    const { host, sent, fromGame } = mount();
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    const over = document.body.appendChild(document.createElement("div"));
    over.setAttribute("role", "dialog");
    over.setAttribute("aria-modal", "true");
    await act(async () => {
        window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
    });
    expect(sent).toEqual([]);
    expect(host.querySelector('[data-game-overlay="purchase"]')).not.toBeNull();
    over.remove();
    await act(async () => {
        window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
    });
    expect(sent).toEqual([
        expect.objectContaining({ request: "req-0001", reason: "cancelled" }),
    ]);
});

test("a game cannot stack questions, name its own price or sell what it did not declare", async () => {
    const { host, sent, fromGame } = mount();
    await fromGame("purchase", {
        request: "req-0001",
        product: "coins-100",
        cents: 1,
        name: "Free!",
    });
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain(
        "$0.99"
    );
    expect(host.querySelector('[role="dialog"]')?.textContent).not.toContain(
        "Free!"
    );
    await fromGame("purchase", { request: "req-0002", product: "gold-racket" });
    await fromGame("purchase", { request: "req-0003", product: "sword" });
    await fromGame("purchase", { request: "req-0004", product: "NOT VALID" });
    expect(sent.map((m) => [m.request, m.reason])).toEqual([
        ["req-0002", "busy"],
        ["req-0003", "undeclared"],
        ["req-0004", "invalid"],
    ]);
    expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
});

test("a guest is sent to the site's sign-in, then buys as that account", async () => {
    const { host, sent, fromGame, press, signIn } = mount({ account: null });
    expect(mockService.wallet).not.toHaveBeenCalled();
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    expect(host.textContent).toContain(
        "Sign in to buy this with your Oncyber wallet."
    );
    expect(
        [...host.querySelectorAll("button")].some((b) =>
            /^Buy for/.test(b.textContent || "")
        )
    ).toBe(false);
    await press(/^Sign in to buy$/);
    expect(signIn).toHaveBeenCalledTimes(1);
    await press(/^Buy for \$0\.99$/);
    expect(sent).toEqual([
        expect.objectContaining({ request: "req-0001", bought: true }),
    ]);
});

test("too little in the wallet offers a top-up, and the purchase stays open", async () => {
    mockService.wallet
        .mockResolvedValueOnce({ mode: "test", cents: 0 })
        .mockResolvedValueOnce({ mode: "test", cents: 0 });
    const { host, sent, fromGame, press } = mount();
    await fromGame("purchase", { request: "req-0001", product: "gold-racket" });
    expect(host.textContent).toContain("Add funds to buy this.");
    await press(/^Add \$10\.00 test funds$/);
    expect(mockService.addTestFunds).toHaveBeenCalledTimes(1);
    await press(/^Buy for \$2\.50$/);
    expect(sent).toEqual([
        expect.objectContaining({ request: "req-0001", bought: true }),
    ]);
});

test("a payment with no answer keeps its key; a refused one gets a new key", async () => {
    const { host, sent, fromGame, press } = mount();
    mockService.buy.mockRejectedValueOnce(new Error("offline"));
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    await press(/^Buy for/);
    expect(host.textContent).toContain(
        "The payment didn't go through. Try again."
    );
    expect(sent).toEqual([]);
    mockService.buy.mockResolvedValueOnce({
        bought: false,
        reason: "payment-failed",
    });
    await press(/^Buy for/);
    await press(/^Buy for/);
    const keys = mockService.buy.mock.calls.map(([input]: any) => input.key);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
    expect(sent).toEqual([
        expect.objectContaining({ request: "req-0001", bought: true }),
    ]);
});

test("a refusal the visitor can't fix closes the sheet and reaches the game", async () => {
    mockService.buy.mockResolvedValueOnce({
        bought: false,
        reason: "already-owned",
    });
    const { host, sent, fromGame, press } = mount();
    await fromGame("purchase", { request: "req-0001", product: "gold-racket" });
    await press(/^Buy for/);
    expect(sent).toEqual([
        {
            type: "ace:purchase-result",
            request: "req-0001",
            bought: false,
            reason: "already-owned",
        },
    ]);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
});

test("what the visitor owns is the server's list; a guest owns nothing", async () => {
    const signed = mount();
    await signed.fromGame("owned", { request: "req-0001" });
    expect(signed.sent).toEqual([
        {
            type: "ace:owned-result",
            request: "req-0001",
            products: ["gold-racket"],
        },
    ]);
    const guest = mount({ account: null });
    mockService.owned.mockClear();
    await guest.fromGame("owned", { request: "req-0002" });
    expect(guest.sent).toContainEqual({
        type: "ace:owned-result",
        request: "req-0002",
        products: [],
    });
});

test("the wallet is the account's: the sidebar links to it and reads the balance again", async () => {
    const { host, press, fromGame, openWallet } = mount();
    // No wallet of the page's own over the game.
    expect(host.querySelector("button")).toBeNull();
    expect(mockService.wallet).not.toHaveBeenCalled();
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    const before = mockService.wallet.mock.calls.length;
    mockService.wallet.mockResolvedValueOnce({ mode: "test", cents: 2000 });
    await press(/^Wallet/);
    expect(openWallet).toHaveBeenCalledTimes(1);
    expect(mockService.wallet.mock.calls.length).toBe(before + 1);
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain(
        "Test balance$20.00"
    );
    // History is the dashboard's to show, not the sidebar's.
    expect(mockService.history).not.toHaveBeenCalled();
});

test("a guest has no wallet to open from the sidebar", async () => {
    const { host, fromGame } = mount({ account: null });
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    expect(
        [...host.querySelectorAll("button")].map((b) => b.textContent)
    ).toEqual(expect.not.arrayContaining([expect.stringMatching(/^Wallet/)]));
});

test("a game that sells nothing gets no sidebar", async () => {
    const { host, sent, fromGame } = mount({ game: "garden" });
    await act(async () => {});
    expect(host.querySelector("button")).toBeNull();
    expect(mockService.wallet).not.toHaveBeenCalled();
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    expect(sent).toEqual([
        {
            type: "garden:purchase-result",
            request: "req-0001",
            bought: false,
            reason: "undeclared",
        },
    ]);
});

test("leaving with a question open answers no", async () => {
    const { sent, fromGame } = mount();
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    const { root } = mounted[mounted.length - 1];
    act(() => root.unmount());
    mounted.pop();
    expect(sent).toEqual([
        expect.objectContaining({
            request: "req-0001",
            bought: false,
            reason: "cancelled",
        }),
    ]);
});

// Paying from the visitor's own wallet.
const ownWallet = { mode: "wallet", cents: 0, network: "Base", token: "USDC" };
const payment = {
    rail: "wallet",
    chainId: 8453,
    chainName: "Base",
    token: "0x" + "aa".repeat(20),
    tokenSymbol: "USDC",
    recipient: "0x" + "bb".repeat(20),
    units: "990000",
    data:
        "0xa9059cbb" +
        "0".repeat(24) +
        "bb".repeat(20) +
        "f1b30".padStart(64, "0") +
        "12".repeat(32),
};
const proof = "0x" + "ab".repeat(32);
const required = { bought: false, reason: "payment-required", payment };
const pending = { bought: false, reason: "payment-pending" };
const bought = { bought: true, order: "ace_coins-100_key" };
const sentRecord = "oncyber:purchase:user-a:ace:coins-100";
beforeEach(() => {
    PURCHASE_POLL.ms = 0;
    window.localStorage.clear();
});

test("with their own wallet the visitor pays the transfer asked for, and the page waits for it", async () => {
    mockService.wallet.mockResolvedValue(ownWallet);
    mockService.buy
        .mockResolvedValueOnce(required)
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(bought);
    const pay = jest.fn(async () => ({ paid: true, proof }));
    const { host, sent, fromGame, press } = mount({ pay });
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    const text = host.querySelector('[role="dialog"]')?.textContent;
    expect(text).toContain("Paid withUSDC on Base");
    expect(text).toContain("You confirm the payment in your own wallet.");
    // No balance of the site's, and nothing to top up.
    expect(text).not.toContain("balance");
    await press(/^Pay \$0\.99$/);
    await act(async () => {
        await new Promise((done) => setTimeout(done, 20));
    });
    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay).toHaveBeenCalledWith(payment, "user-a");
    const calls = mockService.buy.mock.calls.map(([input]: any) => input);
    expect(calls).toHaveLength(4);
    // One order throughout; the payment is shown from the second ask on.
    expect(new Set(calls.map((c: any) => c.key)).size).toBe(1);
    expect(calls.map((c: any) => c.proof)).toEqual([
        undefined,
        proof,
        proof,
        proof,
    ]);
    expect(sent).toEqual([
        { type: "ace:purchase-result", request: "req-0001", ...bought },
    ]);
    expect(window.localStorage.getItem(sentRecord)).toBeNull();
    mockService.wallet.mockResolvedValue({ mode: "test", cents: 1000 });
});

test("refusing in the wallet leaves the question open, with nothing sent and no error", async () => {
    mockService.wallet.mockResolvedValue(ownWallet);
    mockService.buy.mockResolvedValue(required);
    const pay = jest
        .fn()
        .mockResolvedValueOnce({ paid: false, reason: "cancelled" })
        .mockResolvedValueOnce({
            paid: false,
            reason: "failed",
            message:
                "That wallet holds $0.20 in USDC on Base. This costs $0.99.",
        });
    const { host, sent, fromGame, press } = mount({ pay });
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    await press(/^Pay/);
    const status = () => host.querySelector(".purchase-status");
    expect(status()?.getAttribute("data-tone")).toBeNull();
    expect(sent).toEqual([]);
    // A wallet that can't pay says why, as an error.
    await press(/^Pay/);
    expect(status()?.textContent).toContain("holds $0.20 in USDC on Base");
    expect(status()?.getAttribute("data-tone")).toBe("error");
    // The same order both times: a later payment is for it.
    const keys = mockService.buy.mock.calls.map(([input]: any) => input.key);
    expect(keys[1]).toBe(keys[0]);
    expect(window.localStorage.getItem(sentRecord)).toBeNull();
    mockService.buy.mockResolvedValue(bought);
    mockService.wallet.mockResolvedValue({ mode: "test", cents: 1000 });
});

test("a payment that has not arrived yet is kept: trying again never pays twice", async () => {
    PURCHASE_POLL.tries = 2;
    mockService.wallet.mockResolvedValue(ownWallet);
    mockService.buy.mockResolvedValueOnce(required).mockResolvedValue(pending);
    const pay = jest.fn(async () => ({ paid: true, proof }));
    const { host, sent, fromGame, press } = mount({ pay });
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    await press(/^Pay/);
    await act(async () => {
        await new Promise((done) => setTimeout(done, 20));
    });
    expect(host.textContent).toContain("The payment hasn’t arrived yet.");
    expect(sent).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(sentRecord)!).proof).toBe(
        proof
    );
    mockService.buy.mockResolvedValue(bought);
    await press(/^Finish purchase$/);
    expect(pay).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([expect.objectContaining({ bought: true })]);
    PURCHASE_POLL.tries = 40;
    mockService.wallet.mockResolvedValue({ mode: "test", cents: 1000 });
});

test("a payment sent before the tab was closed is finished, not asked for again", async () => {
    window.localStorage.setItem(
        sentRecord,
        JSON.stringify({ key: "key-from-before", proof })
    );
    mockService.wallet.mockResolvedValue(ownWallet);
    mockService.buy.mockResolvedValueOnce(bought);
    const pay = jest.fn();
    const { host, sent, fromGame, press } = mount({ pay });
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    expect(host.textContent).toContain("You already sent a payment for this.");
    expect(
        host.querySelector(".purchase-status")?.getAttribute("data-tone")
    ).toBeNull();
    await press(/^Finish purchase$/);
    expect(pay).not.toHaveBeenCalled();
    expect(mockService.buy.mock.calls[0][0]).toMatchObject({
        key: "key-from-before",
        proof,
    });
    expect(sent).toEqual([expect.objectContaining({ bought: true })]);
    expect(window.localStorage.getItem(sentRecord)).toBeNull();
    mockService.wallet.mockResolvedValue({ mode: "test", cents: 1000 });
});

test("a payment the chain refused is forgotten, and paying again is for the same order", async () => {
    mockService.wallet.mockResolvedValue(ownWallet);
    mockService.buy
        .mockResolvedValueOnce(required)
        .mockResolvedValueOnce({ bought: false, reason: "payment-failed" })
        .mockResolvedValueOnce(required)
        .mockResolvedValueOnce(bought);
    const pay = jest.fn(async () => ({ paid: true, proof }));
    const { sent, fromGame, press } = mount({ pay });
    await fromGame("purchase", { request: "req-0001", product: "coins-100" });
    await press(/^Pay/);
    expect(window.localStorage.getItem(sentRecord)).toBeNull();
    await press(/^Pay/);
    expect(pay).toHaveBeenCalledTimes(2);
    const calls = mockService.buy.mock.calls.map(([input]: any) => input);
    expect(new Set(calls.map((c: any) => c.key)).size).toBe(1);
    expect(sent).toEqual([expect.objectContaining({ bought: true })]);
    mockService.wallet.mockResolvedValue({ mode: "test", cents: 1000 });
});
