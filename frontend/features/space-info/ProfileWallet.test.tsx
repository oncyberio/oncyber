/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";

const mockService = {
    wallet: jest.fn(
        async (_input: unknown): Promise<any> => ({ mode: "test", cents: 651 })
    ),
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
    addTestFunds: jest.fn(async (_input: unknown) => ({ cents: 1651 })),
};
// As the real client: every property is a server method, `then` included,
// so a client returned bare from a promise calls the server with it.
const mockUnknown = jest.fn();
jest.mock("@api/gamePurchases/_api", () => ({
    __esModule: true,
    default: new Proxy(
        {},
        {
            get: (_target, name: string) =>
                name in mockService
                    ? (input: unknown) => (mockService as any)[name](input)
                    : (...args: unknown[]) => mockUnknown(name, ...args),
        }
    ),
}));

import ProfileWallet from "./ProfileWallet";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLElement;
beforeEach(() => {
    host = document.body.appendChild(document.createElement("div"));
    root = createRoot(host);
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
    jest.clearAllMocks();
});
const show = async () => {
    await act(async () => root.render(<ProfileWallet />));
    await act(async () => {});
    await act(async () => {});
};
const press = async (label: RegExp) => {
    const found = [...host.querySelectorAll("button")].find((b) =>
        label.test(b.textContent || "")
    );
    if (!found) throw new Error(`no button ${label}: ${host.textContent}`);
    await act(async () => found.click());
    await act(async () => {});
    await act(async () => {});
};

test("play money: the balance, and one press tops it up", async () => {
    await show();
    // Only real methods were called on the client.
    expect(mockUnknown).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Test balance$6.51");
    expect(host.textContent).toContain("No real money is used.");
    await press(/^Top up \$10\.00$/);
    expect(mockService.addTestFunds).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("$16.51");
});

test("a full play-money balance says so", async () => {
    mockService.wallet.mockResolvedValueOnce({ mode: "test", cents: 10000 });
    await show();
    const button = host.querySelector("button")!;
    expect(button.textContent).toBe("Balance is full");
    expect(button.disabled).toBe(true);
});

test("your own wallet: what it holds, and topping up is its address to send to", async () => {
    const address = "0x" + "cc".repeat(20);
    mockService.wallet.mockResolvedValue({
        mode: "wallet",
        cents: 1234,
        network: "Base",
        token: "USDC",
        address,
    });
    const writeText = jest.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
    });
    await show();
    expect(host.textContent).toContain("USDC on Base$12.34");
    expect(host.textContent).not.toContain(address);
    await press(/^Top up$/);
    expect(host.textContent).toContain("Send USDC on Base to your wallet.");
    expect(host.querySelector("code")?.textContent).toBe(address);
    await press(/^Copy address$/);
    expect(writeText).toHaveBeenCalledWith(address);
    expect(host.textContent).toContain("Address copied.");
    mockService.wallet.mockResolvedValue({
        mode: "wallet",
        cents: 5000,
        network: "Base",
        token: "USDC",
        address,
    });
    await press(/^Check balance$/);
    expect(host.textContent).toContain("$50.00");
    mockService.wallet.mockResolvedValue({ mode: "test", cents: 651 });
});

test("an account that is not a wallet has no balance to show, and says how it pays", async () => {
    mockService.wallet.mockResolvedValueOnce({
        mode: "wallet",
        cents: 0,
        network: "Base",
        token: "USDC",
    });
    await show();
    expect(host.textContent).toContain("USDC on Base");
    expect(host.textContent).toContain(
        "paid from a wallet you choose when you buy"
    );
    expect(
        [...host.querySelectorAll("button")].map((b) => b.textContent)
    ).toEqual(["Purchases"]);
});

test("purchases are listed when asked for, by game title", async () => {
    await show();
    expect(mockService.history).not.toHaveBeenCalled();
    await press(/^Purchases$/);
    expect(host.textContent).toContain("Gold racket");
    expect(host.textContent).toContain("ACE! Tennis");
    expect(host.textContent).toContain("$2.50");
    await press(/^Purchases$/);
    expect(host.textContent).not.toContain("Gold racket");
});

test("where purchases are off, or the wallet can't be read, there is nothing", async () => {
    mockService.wallet.mockResolvedValueOnce({ mode: "off", cents: 0 });
    await show();
    expect(host.innerHTML).toBe("");
    act(() => root.unmount());
    root = createRoot(host);
    mockService.wallet.mockRejectedValueOnce(new Error("offline"));
    await show();
    expect(host.innerHTML).toBe("");
});
