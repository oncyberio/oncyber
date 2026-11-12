/** @jest-environment jsdom */
// Buying a space never changes who the visitor is: without a wallet that can
// pay, it asks for one through the payment chooser (dApp/paymentWallet),
// never the sign-in sheet, and uses it for this payment only.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { RoomBuyNowPrvider, useRoomBuyNowContext } from "./index";
import { UserContext } from "@context/UserContext";
import { connectEthereumForPayment } from "@dapp/paymentWallet";
import { ensureEthChainId } from "@dapp/connect";

const mockMarketplace = {
    buyToken: jest.fn(async () => {}),
};

jest.mock(
    "@context/UserContext",
    () => ({ UserContext: require("react").createContext({}) }),
    { virtual: true }
);
jest.mock(
    "@dapp/ReservoirMarketplace",
    () => ({
        ReservoirMarketplace: { getInstance: () => mockMarketplace },
    }),
    { virtual: true }
);
jest.mock(
    "@dapp/paymentWallet",
    () => ({ connectEthereumForPayment: jest.fn() }),
    { virtual: true }
);
jest.mock(
    "@dapp/connect",
    () => ({
        ensureEthChainId: jest.fn(async () => {}),
        isEthAbort: () => false,
    }),
    { virtual: true }
);
jest.mock("@components/Dialogs", () => ({
    createModal: () => () => {},
    showError: jest.fn(),
    showSuccess: jest.fn(async () => {}),
}));
jest.mock("../shared/Transaction/Confirming", () => ({
    Confirming: () => null,
}));
jest.mock("../shared/Transaction/TxPending", () => ({
    TxPending: () => null,
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));

const chooseWallet = connectEthereumForPayment as jest.Mock;
const payer = {
    type: "ethereum",
    provider: "wallet_connect",
    walletId: "0xpayer",
    eth: { id: "payer-eth" },
    ethers: {},
};
const room: any = {
    blockchain: "polygon",
    contract_address: "0xroom",
    token_id: "3",
    name: "Room",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let buyNow: ReturnType<typeof useRoomBuyNowContext>;

function Probe() {
    buyNow = useRoomBuyNowContext();
    return null;
}

async function open(walletConnection: any) {
    const session = { user: { id: "0xsignedin" }, walletConnection };
    await act(async () =>
        root.render(
            <UserContext.Provider value={session as any}>
                <RoomBuyNowPrvider>
                    <Probe />
                </RoomBuyNowPrvider>
            </UserContext.Provider>
        )
    );
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    chooseWallet.mockReset();
    mockMarketplace.buyToken.mockClear();
    (ensureEthChainId as jest.Mock).mockClear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

it("asks for a wallet to pay with when none is connected, and pays with it", async () => {
    chooseWallet.mockResolvedValue(payer);
    await open(null);
    let bought: boolean;
    await act(async () => {
        bought = await buyNow.buyRoom(room, 1);
    });
    expect(chooseWallet).toHaveBeenCalledWith("0xsignedin");
    expect(ensureEthChainId).toHaveBeenCalledWith(payer.eth, "polygon");
    expect(mockMarketplace.buyToken).toHaveBeenCalledWith(
        "0xroom",
        "3",
        payer,
        expect.any(Function)
    );
    expect(bought).toBe(true);
});

it("uses the wallet already connected without asking", async () => {
    await open(payer);
    await act(async () => {
        await buyNow.buyRoom(room, 1);
    });
    expect(chooseWallet).not.toHaveBeenCalled();
    expect(mockMarketplace.buyToken).toHaveBeenCalledTimes(1);
});

it("does nothing when the visitor closes the chooser", async () => {
    chooseWallet.mockResolvedValue(undefined);
    await open(null);
    let bought: boolean;
    await act(async () => {
        bought = await buyNow.buyRoom(room, 1);
    });
    expect(bought).toBeUndefined();
    expect(ensureEthChainId).not.toHaveBeenCalled();
    expect(mockMarketplace.buyToken).not.toHaveBeenCalled();
});
