/** @jest-environment jsdom */
// Paying never changes who the visitor is: without a wallet that can pay,
// checkout asks for one through the payment chooser (dApp/paymentWallet),
// never the sign-in sheet, and uses it for this payment only.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useNftOrderInfo, {
    NftBuyPrvider,
    useNftBuyContext,
} from "./NftBuyContext";
import { UserContext } from "./UserContext";
import { connectEthereumForPayment } from "@dapp/paymentWallet";
import { ensureEthChainId } from "@dapp/connect";

const mockMarketplace = {
    getSellOrders: jest.fn(async () => []),
    getBuyOrders: jest.fn(async () => []),
    fullfillOrder: jest.fn(async () => ({ type: "Success" })),
};

jest.mock("./UserContext", () => {
    const React = require("react");
    return { UserContext: React.createContext({}) };
});
jest.mock(
    "@dapp/Marketplace",
    () => ({
        selectMarketplace: () => mockMarketplace,
        isValidConnection: (_m: any, connection: any) =>
            connection?.type === "ethereum" && !!connection.ethers,
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
        connectTezos: jest.fn(),
        ensureEthChainId: jest.fn(async () => {}),
        isEthAbort: () => false,
    }),
    { virtual: true }
);
jest.mock("@utils/fetchAssets", () => ({
    fetchAssetById: jest.fn(async () => ({ success: false })),
}));
jest.mock("@utils/formatAssets", () => ({
    formatAsset: (asset: any) => asset,
    isSameAsset: () => true,
}));
jest.mock("@utils/artworks/mergeArtworkMetadata", () => ({
    mergeArtworkMetadata: (a: any, b: any) => ({ ...a, ...b }),
}));
jest.mock("@components/Dialogs", () => ({
    createModal: () => () => {},
    showError: jest.fn(),
    showSuccess: jest.fn(),
}));
jest.mock(
    "@features/spaces/create/components/DestinationSelector/shared/Transaction/Confirming",
    () => ({ Confirming: () => null })
);
jest.mock(
    "@features/spaces/create/components/DestinationSelector/shared/Transaction/TxPending",
    () => ({ TxPending: () => null })
);
jest.mock("next/router", () => ({ useRouter: () => ({ asPath: "/" }) }));

const chooseWallet = connectEthereumForPayment as jest.Mock;
const payer = {
    type: "ethereum",
    provider: "wallet_connect",
    walletId: "0xpayer",
    eth: { id: "payer-eth" },
    ethers: {},
};
const nft = {
    token_id: "1",
    contract_address: "0xcontract",
    blockchain: "ethereum",
    marketplace: "ethereum",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let buy: ReturnType<typeof useNftBuyContext>;
const dispatch = jest.fn();

function Probe() {
    buy = useNftBuyContext();
    return null;
}

async function open(walletConnection: any) {
    const session = {
        authenticated: true,
        isAnonymous: false,
        user: { id: "0xsignedin" },
        token: "session-token",
        walletConnection,
        dispatch,
    };
    await act(async () =>
        root.render(
            <UserContext.Provider value={session as any}>
                <NftBuyPrvider nft={nft as any}>
                    <Probe />
                </NftBuyPrvider>
            </UserContext.Provider>
        )
    );
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    chooseWallet.mockReset();
    dispatch.mockReset();
    mockMarketplace.fullfillOrder.mockClear();
    (ensureEthChainId as jest.Mock).mockClear();
    document.cookie = "_CCA=0xsignedin; path=/";
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

test("without a wallet that can pay, the chosen wallet pays and the account stays the same", async () => {
    chooseWallet.mockResolvedValue(payer);
    await open(null);

    let bought: boolean;
    await act(async () => {
        bought = await buy.buyArtwork();
    });

    expect(chooseWallet).toHaveBeenCalledWith("0xsignedin");
    expect(ensureEthChainId).toHaveBeenCalledWith(payer.eth, "ethereum");
    expect(mockMarketplace.fullfillOrder).toHaveBeenCalledWith(
        undefined,
        payer,
        expect.any(Function)
    );
    expect(bought).toBe(true);
    // Who the visitor is did not change.
    expect(dispatch).not.toHaveBeenCalled();
    expect(document.cookie).toContain("_CCA=0xsignedin");
});

test("closing the wallet chooser buys nothing", async () => {
    chooseWallet.mockResolvedValue(undefined);
    await open(null);

    await act(async () => {
        await buy.buyArtwork();
    });

    expect(mockMarketplace.fullfillOrder).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
});

test("a wallet the visitor already connected pays without asking again", async () => {
    await open(payer);

    await act(async () => {
        await buy.buyArtwork();
    });

    expect(chooseWallet).not.toHaveBeenCalled();
    expect(mockMarketplace.fullfillOrder).toHaveBeenCalledWith(
        undefined,
        payer,
        expect.any(Function)
    );
});

test("an offer asks for a wallet the same way", async () => {
    chooseWallet.mockResolvedValue(undefined);
    await open(null);

    await act(async () => {
        await buy.makeOfferOnArtwork(1);
    });

    expect(chooseWallet).toHaveBeenCalledWith("0xsignedin");
    expect(dispatch).not.toHaveBeenCalled();
});

test("an offer amount that is not above 0 is explained beside the field", async () => {
    let offer: ReturnType<typeof useNftOrderInfo>;
    function OfferProbe() {
        offer = useNftOrderInfo();
        return null;
    }
    await act(async () =>
        root.render(
            <UserContext.Provider value={{ user: { id: "0xme" } } as any}>
                <NftBuyPrvider nft={nft as any}>
                    <OfferProbe />
                </NftBuyPrvider>
            </UserContext.Provider>
        )
    );
    act(() => offer.handleMakeOffer());
    act(() => offer.handleAmountChange({ target: { value: "0" } }));
    act(() => offer.handleConfirmOffer());

    expect(offer.amountError).toBe("Enter an amount greater than 0.");
    expect(offer.makingOffer).toBe(true);
    expect(chooseWallet).not.toHaveBeenCalled();

    // Correcting the amount clears it; so does cancelling.
    act(() => offer.handleAmountChange({ target: { value: "2" } }));
    expect(offer.amountError).toBe("");
    act(() => offer.handleConfirmOffer());
    act(() => offer.handleMakeOffer());
    act(() => offer.handleConfirmOffer());
    expect(offer.amountError).not.toBe("");
    act(() => offer.handleCancelOffer());
    expect(offer.amountError).toBe("");
});
