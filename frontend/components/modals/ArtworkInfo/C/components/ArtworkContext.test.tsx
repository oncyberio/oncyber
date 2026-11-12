/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { showError } from "@components/Dialogs";
import { connectMetamask } from "@dapp/connect";
import { switchWalletNetwork } from "@dapp/switchNetwork";
import { ArtworkInfoProvider, useArtworkInfo } from "./ArtworkContext";

let mockMarketplace: any;
let mockConnectionValid = true;
jest.mock("@env", () => ({ nodeEnv: {} }));
jest.mock(
    "@dapp/connect",
    () => ({
        // The real cancel check, without the wallet libraries around it.
        isEthAbort: jest.requireActual("../../../../../dApp/connect")
            .isEthAbort,
        connectMetamask: jest.fn(),
        connectTezos: jest.fn(),
    }),
    { virtual: true }
);
jest.mock(
    "@dapp/switchNetwork",
    () => ({
        switchWalletNetwork: jest.fn(async () => "ready"),
        wrongNetworkMessage: jest.requireActual(
            "../../../../../dApp/switchNetwork"
        ).wrongNetworkMessage,
    }),
    { virtual: true }
);
jest.mock(
    "@dapp/Marketplace",
    () => ({
        isValidConnection: () => mockConnectionValid,
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
jest.mock("next/router", () => ({ useRouter: () => ({ asPath: "/gallery" }) }));
jest.mock("@components/Dialogs", () => ({ showError: jest.fn() }));
jest.mock("@utils/saveToDb", () => ({ logEvent: jest.fn() }));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("@utils/fetchAssets", () => ({
    fetchAssetById: jest.fn(async () => ({ success: false })),
}));
jest.mock("@utils/formatAssets", () => ({
    formatAsset: (asset) => asset,
    isSameAsset: () => true,
}));
jest.mock("@utils/artworks/mergeArtworkMetadata", () => ({
    mergeArtworkMetadata: (asset) => asset,
}));

const artwork: any = {
    id: "frame-1",
    token_id: "7",
    contract_address: "0xabc",
    blockchain: "ethereum",
    name: "Spacepod",
};
const exhibit: any = { id: "exhibit-1", editors: ["curator"] };
const denied = () => new Error("DENIED");
const cancellations: [string, () => any][] = [
    ["the adapter's DENIED error", denied],
    ["wallet code 4001", () => ({ code: 4001, message: "Rejected" })],
    ["ACTION_REJECTED", () => ({ code: "ACTION_REJECTED" })],
    [
        "a rejected request message",
        () => new Error("User rejected the request."),
    ],
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let state: ReturnType<typeof useArtworkInfo>;
let alertSpy: jest.Mock;
function Probe() {
    state = useArtworkInfo();
    return null;
}
beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    (showError as jest.Mock).mockReset();
    (switchWalletNetwork as jest.Mock).mockReset();
    (switchWalletNetwork as jest.Mock).mockResolvedValue("ready");
    alertSpy = jest.fn();
    window.alert = alertSpy;
    mockConnectionValid = true;
    mockMarketplace = {
        getSellOrders: jest.fn(async () => [{ currentPrice: 1 }]),
        getBuyOrders: jest.fn(async () => []),
        fullfillOrder: jest.fn(),
        makeOffer: jest.fn(),
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () =>
        root.render(
            <ArtworkInfoProvider
                artwork={artwork}
                exhibit={exhibit}
                {...({} as any)}
            >
                <Probe />
            </ArtworkInfoProvider>
        )
    );
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

it.each(cancellations)(
    "ends a purchase quietly when the visitor cancels with %s",
    async (_name, cancel) => {
        mockMarketplace.fullfillOrder.mockRejectedValue(cancel());
        await act(() => state.buyArtwork());
        expect(showError).not.toHaveBeenCalled();
        expect(alertSpy).not.toHaveBeenCalled();
        expect(state.orderError).toBeNull();
        expect(state.confirming).toBe(false);
        expect(state.submitting).toBe(false);
    }
);

it("still explains a purchase that really failed, beside the controls", async () => {
    mockMarketplace.fullfillOrder.mockRejectedValue(
        new Error("Balance is too low to proceed with the transaction.")
    );
    await act(() => state.buyArtwork());
    expect(state.orderError).toEqual({
        action: "purchase",
        message: "Balance is too low to proceed with the transaction.",
    });
    // Neither a blocking dialog nor the browser's alert.
    expect(showError).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(state.confirming).toBe(false);
    expect(state.submitting).toBe(false);
});

it.each([
    [
        "insufficient funds",
        { type: "Error", errorCode: "INSUFFICIENT_FUNDS" },
        "You do not have enough funds in the connected wallet.",
    ],
    [
        "the marketplace's own message",
        { type: "Error", errorCode: "OTHER", message: "Listing expired!. x" },
        "Listing expired",
    ],
    ["no message at all", { type: "Error" }, "The purchase didn't go through."],
])("explains a purchase refused with %s", async (_name, result, message) => {
    mockMarketplace.fullfillOrder.mockResolvedValue(result);
    await act(() => state.buyArtwork());
    expect(state.orderError).toEqual({ action: "purchase", message });
    expect(alertSpy).not.toHaveBeenCalled();
});

it("ends a purchase quietly when Tezos reports the closed wallet as a result", async () => {
    mockMarketplace.fullfillOrder.mockResolvedValue({
        type: "Error",
        errorCode: "DENIED",
    });
    await act(() => state.buyArtwork());
    expect(state.orderError).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
});

it("clears the failure when the visitor retries, and retries the same action", async () => {
    mockMarketplace.fullfillOrder.mockRejectedValueOnce(new Error("Timed out"));
    await act(() => state.buyArtwork());
    expect(state.orderError.message).toBe("Timed out");

    let finish: (result: any) => void;
    mockMarketplace.fullfillOrder.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        })
    );
    let retry: Promise<void>;
    await act(async () => {
        retry = state.retryOrder();
    });
    expect(mockMarketplace.fullfillOrder).toHaveBeenCalledTimes(2);
    expect(state.orderError).toBeNull();
    expect(state.confirming).toBe(true);
    await act(async () => {
        finish({ type: "Error", errorCode: "DENIED" });
        await retry;
    });
    expect(state.orderError).toBeNull();

    mockMarketplace.makeOffer.mockRejectedValueOnce(new Error("No funds"));
    await act(() => state.makeOfferOnArtwork(2));
    mockMarketplace.makeOffer.mockResolvedValueOnce({
        type: "Error",
        errorCode: "DENIED",
    });
    await act(() => state.retryOrder());
    expect(mockMarketplace.makeOffer).toHaveBeenCalledTimes(2);
    expect(mockMarketplace.makeOffer.mock.calls[1][2]).toBe(2);
    expect(mockMarketplace.fullfillOrder).toHaveBeenCalledTimes(2);
});

it("explains a wallet that could not be reached, and retries the same action", async () => {
    mockConnectionValid = false;
    (connectMetamask as jest.Mock).mockImplementation(() => {
        throw new Error("No wallet found");
    });
    await act(() => state.makeOfferOnArtwork(2));
    expect(state.orderError).toEqual({
        action: "offer",
        amount: 2,
        message: "Couldn't connect to your wallet. No wallet found",
    });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockMarketplace.makeOffer).not.toHaveBeenCalled();

    await act(() => state.retryOrder());
    expect(connectMetamask).toHaveBeenCalledTimes(2);
    expect(state.orderError.action).toBe("offer");
    (connectMetamask as jest.Mock).mockReset();
});

it("clears the failure when the panel moves to another artwork", async () => {
    mockMarketplace.fullfillOrder.mockRejectedValue(new Error("Timed out"));
    await act(() => state.buyArtwork());
    expect(state.orderError).not.toBeNull();
    mockMarketplace.getSellOrders.mockResolvedValue([{ currentPrice: 2 }]);
    await act(async () =>
        root.render(
            <ArtworkInfoProvider
                artwork={{ ...artwork, token_id: "8" }}
                exhibit={exhibit}
                {...({} as any)}
            >
                <Probe />
            </ArtworkInfoProvider>
        )
    );
    expect(state.orderError).toBeNull();
});

it.each(cancellations)(
    "ends an offer quietly when the visitor cancels with %s",
    async (_name, cancel) => {
        mockMarketplace.makeOffer.mockRejectedValue(cancel());
        await act(() => state.makeOfferOnArtwork(2));
        expect(alertSpy).not.toHaveBeenCalled();
        expect(showError).not.toHaveBeenCalled();
        expect(state.orderError).toBeNull();
        expect(state.confirming).toBe(false);
        expect(state.submitting).toBe(false);
    }
);

it("ends an offer quietly when Tezos reports the closed wallet as a result", async () => {
    mockMarketplace.makeOffer.mockResolvedValue({
        type: "Error",
        errorCode: "DENIED",
        message: "Error while executing the transaction.\nAborted",
    });
    await act(() => state.makeOfferOnArtwork(2));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(state.orderError).toBeNull();
    expect(state.confirming).toBe(false);
});

it("still explains an offer that really failed, beside the controls", async () => {
    mockMarketplace.makeOffer.mockRejectedValueOnce(new Error("No funds"));
    await act(() => state.makeOfferOnArtwork(2));
    expect(state.orderError).toEqual({
        action: "offer",
        amount: 2,
        message: "No funds",
    });

    mockMarketplace.makeOffer.mockResolvedValueOnce({
        type: "Error",
        errorCode: "OTHER",
        message: "The transaction is invalid",
    });
    await act(() => state.makeOfferOnArtwork(3));
    expect(state.orderError).toEqual({
        action: "offer",
        amount: 3,
        message: "The transaction is invalid",
    });
    expect(alertSpy).not.toHaveBeenCalled();
});

it("tells the confirming overlay whether it waits on a purchase or an offer", async () => {
    let finish: (result: any) => void;
    const pending = () =>
        new Promise((resolve) => {
            finish = resolve;
        });
    mockMarketplace.makeOffer.mockReturnValue(pending());
    let offer: Promise<void>;
    await act(async () => {
        offer = state.makeOfferOnArtwork(2);
    });
    expect(state.confirming).toBe(true);
    expect(state.confirmingAction).toBe("offer");
    await act(async () => {
        finish({ type: "Error", errorCode: "DENIED", message: "Aborted" });
        await offer;
    });

    mockMarketplace.fullfillOrder.mockReturnValue(pending());
    let purchase: Promise<void>;
    await act(async () => {
        purchase = state.buyArtwork();
    });
    expect(state.confirming).toBe(true);
    expect(state.confirmingAction).toBe("purchase");
    await act(async () => {
        finish({ type: "Error", errorCode: "DENIED" });
        await purchase;
    });
    expect(state.confirming).toBe(false);
});

it("keeps the order going when the visitor closes the confirming overlay", async () => {
    let finish: (result: any) => void;
    mockMarketplace.fullfillOrder.mockReturnValue(
        new Promise((resolve) => {
            finish = resolve;
        })
    );
    let purchase: Promise<void>;
    await act(async () => {
        purchase = state.buyArtwork();
    });
    expect(state.purchase.status).toBe("confirming");
    act(() => state.setConfirming(false));
    expect(state.confirming).toBe(false);
    expect(state.submitting).toBe(true);
    expect(state.purchase.status).toBe("waiting");
    await act(async () => {
        finish({ type: "Success" });
        await purchase;
    });
    expect(state.submitting).toBe(false);
    expect(state.buyingSuccess).toBe(true);
    expect(state.purchase.status).toBe("succeeded");
});

it("asks the wallet to move to the artwork's network before ordering", async () => {
    const order: string[] = [];
    (switchWalletNetwork as jest.Mock).mockImplementation(async () => {
        order.push("switch");
        return "ready";
    });
    mockMarketplace.fullfillOrder.mockImplementation(async () => {
        order.push("order");
        return { type: "Error", errorCode: "DENIED" };
    });
    await act(() => state.buyArtwork());
    expect(order).toEqual(["switch", "order"]);
    expect(switchWalletNetwork).toHaveBeenCalledWith(undefined, 1);
});

it("ends quietly, sending nothing, when the visitor closes the switch request", async () => {
    (switchWalletNetwork as jest.Mock).mockResolvedValue("cancelled");
    await act(() => state.buyArtwork());
    await act(() => state.makeOfferOnArtwork(2));
    expect(mockMarketplace.fullfillOrder).not.toHaveBeenCalled();
    expect(mockMarketplace.makeOffer).not.toHaveBeenCalled();
    expect(state.orderError).toBeNull();
    expect(state.purchase.status).toBe("idle");
});

it("names the network beside the controls when the wallet cannot switch", async () => {
    (switchWalletNetwork as jest.Mock).mockResolvedValue("failed");
    await act(() => state.makeOfferOnArtwork(2));
    expect(mockMarketplace.makeOffer).not.toHaveBeenCalled();
    expect(state.orderError).toEqual({
        action: "offer",
        amount: 2,
        message:
            "Your wallet is on another network. Switch it to Ethereum to make an offer.",
    });

    (switchWalletNetwork as jest.Mock).mockResolvedValue("ready");
    mockMarketplace.makeOffer.mockResolvedValue({
        type: "Error",
        errorCode: "DENIED",
    });
    await act(() => state.retryOrder());
    expect(mockMarketplace.makeOffer).toHaveBeenCalledTimes(1);
    expect(mockMarketplace.makeOffer.mock.calls[0][2]).toBe(2);

    (switchWalletNetwork as jest.Mock).mockResolvedValue("failed");
    await act(() => state.buyArtwork());
    expect(state.orderError.message).toBe(
        "Your wallet is on another network. Switch it to Ethereum to buy this artwork."
    );
    expect(alertSpy).not.toHaveBeenCalled();
});
