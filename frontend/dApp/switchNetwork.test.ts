import { switchWalletNetwork, wrongNetworkMessage } from "./switchNetwork";

// Minting asks the wallet to switch network the way buying does
// (`ensureEthChainId`), and never throws, so the callers' own check still
// decides what happens next.
function wallet(chainId: string, onSwitch?: () => unknown) {
    return {
        chainId,
        request: jest.fn(async ({ method }) => {
            if (method === "wallet_switchEthereumChain") return onSwitch?.();
        }),
    };
}

beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("a wallet already on the network is not asked anything", async () => {
    const eth = wallet("0x1");
    await expect(switchWalletNetwork(eth, 1)).resolves.toBe("ready");
    expect(eth.request).not.toHaveBeenCalled();
});

test("a wallet on another network is asked to switch", async () => {
    const eth = wallet("0x1");
    await expect(switchWalletNetwork(eth, 137)).resolves.toBe("ready");
    expect(eth.request).toHaveBeenCalledWith({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x89" }],
    });
});

test("closing the switch request is a cancellation", async () => {
    const eth = wallet("0x89", () => {
        throw { code: 4001 };
    });
    await expect(switchWalletNetwork(eth, 1)).resolves.toBe("cancelled");
});

test("a switch the wallet refuses for another reason is a failure", async () => {
    const eth = wallet("0x89", () => {
        throw { code: -32603, message: "internal" };
    });
    await expect(switchWalletNetwork(eth, 1)).resolves.toBe("failed");
});

test("no wallet, or a network it cannot switch to, is a failure", async () => {
    await expect(switchWalletNetwork(undefined, 1)).resolves.toBe("failed");
    const eth = wallet("0x1");
    await expect(switchWalletNetwork(eth, 5)).resolves.toBe("failed");
    expect(eth.request).not.toHaveBeenCalled();
});

test("the message names the network", () => {
    expect(wrongNetworkMessage("polygon", "claim this space")).toBe(
        "Your wallet is on another network. Switch it to Polygon to claim this space."
    );
    expect(wrongNetworkMessage("", "mint")).toBe(
        "Your wallet is on another network. Switch it to the right one to mint."
    );
});
