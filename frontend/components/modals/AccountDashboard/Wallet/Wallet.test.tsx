/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mockService = {
    wallet: jest.fn(
        async (_input: unknown): Promise<any> => ({
            mode: "test",
            cents: 651,
        })
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
jest.mock("@api/gamePurchases/_api", () => ({
    __esModule: true,
    default: {
        wallet: (input: unknown) => mockService.wallet(input),
        history: (input: unknown) => mockService.history(input),
        addTestFunds: (input: unknown) => mockService.addTestFunds(input),
    },
}));

import Wallet from "./index";

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
    await act(async () => root.render(<Wallet />));
    await act(async () => {});
};
const press = async (label: RegExp) => {
    const button = [...host.querySelectorAll("button")].find((b) =>
        label.test(b.textContent || "")
    );
    if (!button) throw new Error(`no button ${label}: ${host.textContent}`);
    await act(async () => button.click());
    await act(async () => {});
};

test("the wallet shows the balance and what was bought, by game title", async () => {
    await show();
    expect(host.textContent).toContain("Test balance$6.51");
    expect(host.textContent).toContain("No real money is used.");
    expect(host.textContent).toContain("Gold racket");
    expect(host.textContent).toContain("ACE! Tennis");
    expect(host.textContent).toContain("$2.50");
});

test("adding test funds updates the balance", async () => {
    await show();
    await press(/^Add \$10\.00 test funds$/);
    expect(mockService.addTestFunds).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("$16.51");
});

test("a full test balance says so instead of offering more", async () => {
    mockService.wallet.mockResolvedValueOnce({ mode: "test", cents: 10000 });
    await show();
    const button = host.querySelector("button");
    expect(button?.textContent).toBe("Test balance is full");
    expect(button?.disabled).toBe(true);
});

test("where purchases are off the wallet says so", async () => {
    mockService.wallet.mockResolvedValueOnce({ mode: "off", cents: 0 });
    await show();
    expect(host.textContent).toBe("Purchases aren’t available here yet.");
});

test("a wallet that cannot be read offers another try", async () => {
    mockService.wallet.mockRejectedValueOnce(new Error("offline"));
    await show();
    expect(host.textContent).toContain("Couldn’t load your wallet.");
    await press(/^Try again$/);
    expect(host.textContent).toContain("$6.51");
});

test("with their own wallet there is no balance, only where purchases are paid", async () => {
    mockService.wallet.mockResolvedValueOnce({
        mode: "wallet",
        cents: 0,
        network: "Base",
        token: "USDC",
    });
    await show();
    expect(host.textContent).toContain("Purchases are paid withUSDC on Base");
    expect(host.textContent).toContain("There is no balance to top up here.");
    expect(host.querySelector("button")).toBeNull();
    expect(host.textContent).toContain("Gold racket");
});
