/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { ThemeProvider } from "styled-components";
import { showError } from "@components/Dialogs";
import { ArtworkInfoProvider } from "./ArtworkContext";
import { OrderInfo } from "./OrderInfo";

// The real provider and the real panel, with the marketplace and wallet
// replaced: what the visitor sees when a purchase or an offer fails.
let mockMarketplace: any;
jest.mock("@env", () => ({ nodeEnv: {} }));
jest.mock(
    "@dapp/connect",
    () => ({
        isEthAbort: jest.requireActual("../../../../../dApp/connect")
            .isEthAbort,
        connectMetamask: jest.fn(),
        connectTezos: jest.fn(),
    }),
    { virtual: true }
);
// The wallet is already on the artwork's network.
jest.mock(
    "@dapp/switchNetwork",
    () => ({
        switchWalletNetwork: async () => "ready",
        wrongNetworkMessage: () => "",
    }),
    { virtual: true }
);
jest.mock(
    "@dapp/Marketplace",
    () => ({
        isValidConnection: () => true,
        selectMarketplace: () => mockMarketplace,
    }),
    { virtual: true }
);
jest.mock(
    "@context/UserContext",
    () => ({
        UserContext: require("react").createContext({
            user: { id: "visitor" },
            walletConnection: { type: "ethereum" },
        }),
    }),
    { virtual: true }
);
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({ user: { id: "visitor" } }),
}));
jest.mock("next/router", () => ({ useRouter: () => ({ asPath: "/gallery" }) }));
jest.mock("@components/Dialogs", () => ({ showError: jest.fn() }));
jest.mock("@utils/saveToDb", () => ({ logEvent: jest.fn() }));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@utils/fetchAssets", () => ({
    // Found, so the provider goes on to load the listing.
    fetchAssetById: jest.fn(async () => ({ success: true, asset: {} })),
}));
jest.mock("@utils/formatAssets", () => ({
    formatAsset: (asset) => asset,
    isSameAsset: () => true,
}));
jest.mock("@utils/artworks/mergeArtworkMetadata", () => ({
    mergeArtworkMetadata: (asset) => asset,
}));
jest.mock("./Price", () => ({
    Price: ({ price }) => <span>{price} ETH</span>,
}));
jest.mock("@components/Icons/CloseIcon", () => () => null);

const artwork: any = {
    id: "frame-1",
    token_id: "7",
    contract_address: "0xabc",
    blockchain: "ethereum",
    name: "Spacepod",
    owner: { address: "collector" },
};
const exhibit: any = { id: "exhibit-1", editors: ["curator"] };
const theme = {
    color: "#f3f3f1",
    background: "#191919",
    border: { color: "#ffffff24" },
    button: { border: { strong: "#fff", light: "#ffffff24" } },
    filters: { invert: 0 },
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let alertSpy: jest.Mock;
beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    (showError as jest.Mock).mockReset();
    alertSpy = jest.fn();
    window.alert = alertSpy;
    mockMarketplace = {
        getSellOrders: jest.fn(async () => [{ currentPrice: 1 }]),
        getBuyOrders: jest.fn(async () => []),
        fullfillOrder: jest.fn(),
        makeOffer: jest.fn(),
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await show();
});
const show = (surface?: "light", shown = artwork) =>
    act(async () =>
        root.render(
            <ThemeProvider theme={theme}>
                <ArtworkInfoProvider
                    artwork={shown}
                    exhibit={exhibit}
                    {...({} as any)}
                >
                    <OrderInfo surface={surface} />
                </ArtworkInfoProvider>
            </ThemeProvider>
        )
    );
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

const button = (name: string) =>
    Array.from(container.querySelectorAll("button")).find(
        (element) => element.textContent === name
    );
const click = (name: string) => act(async () => Simulate.click(button(name)));
const failure = () => container.querySelector('[role="alert"]');
const controls = () => container.querySelector(".artwork-order-info");
async function offer(amount: string) {
    await click("Make Offer");
    const input = container.querySelector("input");
    act(() => Simulate.change(input, { target: { value: amount } } as any));
    await click("Confirm");
}

it("explains a failed purchase beside Buy now, and Retry buys again", async () => {
    mockMarketplace.fullfillOrder.mockRejectedValueOnce(
        new Error("Balance is too low to proceed with the transaction.")
    );
    await click("Buy now");
    expect(failure().textContent).toBe(
        "Balance is too low to proceed with the transaction.Retry"
    );
    // Directly after the Buy / offer controls, in the same panel.
    expect(controls().nextElementSibling).toBe(failure());
    expect(button("Buy now")).toBeTruthy();
    expect(showError).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();

    mockMarketplace.fullfillOrder.mockResolvedValueOnce({
        type: "Error",
        errorCode: "INSUFFICIENT_FUNDS",
    });
    await click("Retry");
    expect(mockMarketplace.fullfillOrder).toHaveBeenCalledTimes(2);
    expect(failure().textContent).toBe(
        "You do not have enough funds in the connected wallet.Retry"
    );
});

it("says nothing when the visitor closes the wallet prompt", async () => {
    mockMarketplace.fullfillOrder.mockRejectedValueOnce({ code: 4001 });
    await click("Buy now");
    expect(failure()).toBeNull();
    mockMarketplace.makeOffer.mockRejectedValueOnce(new Error("DENIED"));
    await offer("2");
    expect(failure()).toBeNull();
    expect(showError).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
});

it("hides the failure while the retry is running", async () => {
    mockMarketplace.fullfillOrder.mockRejectedValueOnce(new Error("Timed out"));
    await click("Buy now");
    let finish: (result: any) => void;
    mockMarketplace.fullfillOrder.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        })
    );
    await click("Retry");
    expect(failure()).toBeNull();
    expect(container.textContent).toContain("Submitting…");
    await act(async () => finish({ type: "Error", errorCode: "DENIED" }));
    expect(failure()).toBeNull();
    expect(button("Buy now")).toBeTruthy();
});

it("explains a failed offer beside Make Offer, and Retry offers the same amount", async () => {
    mockMarketplace.makeOffer.mockResolvedValueOnce({
        type: "Error",
        errorCode: "OTHER",
        message: "The transaction is invalid",
    });
    await offer("2.5");
    expect(failure().textContent).toBe("The transaction is invalid" + "Retry");
    expect(controls().nextElementSibling).toBe(failure());
    expect(alertSpy).not.toHaveBeenCalled();

    mockMarketplace.makeOffer.mockRejectedValueOnce(new Error("No funds"));
    await click("Retry");
    expect(mockMarketplace.makeOffer).toHaveBeenCalledTimes(2);
    expect(mockMarketplace.makeOffer.mock.calls[1][2]).toBe(2.5);
    expect(failure().textContent).toBe("No funds" + "Retry");

    // Starting a new offer puts the old failure away.
    await click("Make Offer");
    expect(failure()).toBeNull();
});

it("asks for a valid amount beside the offer field, without Retry", async () => {
    await offer("0");
    expect(failure().textContent).toBe("Enter an amount greater than 0.");
    expect(controls().nextElementSibling).toBe(failure());
    expect(mockMarketplace.makeOffer).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    const input = container.querySelector("input");
    act(() => Simulate.change(input, { target: { value: "1" } } as any));
    expect(failure()).toBeNull();
});

it("puts the failure away when the listing changes", async () => {
    mockMarketplace.fullfillOrder.mockRejectedValue(new Error("Timed out"));
    await click("Buy now");
    expect(failure()).not.toBeNull();
    mockMarketplace.getSellOrders.mockResolvedValue([{ currentPrice: 2 }]);
    await show(undefined, { ...artwork, token_id: "8" });
    expect(container.textContent).toContain("2 ETH");
    expect(failure()).toBeNull();
});

it("uses the light surface only when the panel says so", async () => {
    mockMarketplace.fullfillOrder.mockRejectedValue(new Error("Timed out"));
    await click("Buy now");
    expect(failure().getAttribute("data-surface")).toBe("dark");
    await show("light");
    expect(failure().getAttribute("data-surface")).toBe("light");
});
