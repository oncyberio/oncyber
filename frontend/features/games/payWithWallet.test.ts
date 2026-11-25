import { payWithWallet } from "./payWithWallet";
import { walletPaymentConfig, walletPaymentRequest } from "./walletPayment";

const request = walletPaymentRequest(
    walletPaymentConfig({
        GAMES_PURCHASE_CHAIN_ID: "8453",
        GAMES_PURCHASE_CHAIN_NAME: "Base",
        GAMES_PURCHASE_RPC_URL: "https://rpc.example/v1",
        GAMES_PURCHASE_TOKEN: "0x" + "aa".repeat(20),
        GAMES_PURCHASE_RECIPIENT: "0x" + "bb".repeat(20),
    })!,
    250,
    "0x" + "12".repeat(32)
);
const account = "0x" + "cc".repeat(20);
const hash = "0x" + "ab".repeat(32);

/** An injected wallet holding `units` of the token on `chainId`. */
function wallet(
    more: {
        chainId?: number;
        units?: bigint;
        on?: Record<string, (params: any[]) => unknown>;
    } = {}
) {
    let chainId = more.chainId ?? 8453;
    const calls: Array<{ method: string; params?: any[] }> = [];
    return {
        calls,
        request: jest.fn(async ({ method, params }: any) => {
            calls.push({ method, params });
            if (more.on?.[method]) return more.on[method](params);
            if (method === "eth_requestAccounts") return [account];
            if (method === "eth_chainId") return "0x" + chainId.toString(16);
            if (method === "wallet_switchEthereumChain") {
                chainId = Number(params[0].chainId);
                return null;
            }
            if (method === "eth_call")
                return "0x" + (more.units ?? BigInt(5_000_000)).toString(16);
            if (method === "eth_sendTransaction") return hash;
            throw new Error(`unexpected ${method}`);
        }),
    };
}
const pay = (w: ReturnType<typeof wallet> | undefined) =>
    payWithWallet(request, { choose: async () => w });

test("the wallet sends exactly the transfer the server asked for", async () => {
    const w = wallet();
    expect(await pay(w)).toEqual({ paid: true, proof: hash });
    const sent = w.calls.find((c) => c.method === "eth_sendTransaction");
    expect(sent?.params).toEqual([
        { from: account, to: request.token, data: request.data, value: "0x0" },
    ]);
    // Already on the right network: it is not asked to switch.
    expect(w.calls.some((c) => c.method === "wallet_switchEthereumChain")).toBe(
        false
    );
});

test("a wallet on another network is asked to switch first", async () => {
    const w = wallet({ chainId: 1 });
    expect(await pay(w)).toEqual({ paid: true, proof: hash });
    expect(w.calls.map((c) => c.method)).toEqual([
        "eth_requestAccounts",
        "eth_chainId",
        "wallet_switchEthereumChain",
        "eth_call",
        "eth_sendTransaction",
    ]);
    expect(w.calls[2].params).toEqual([{ chainId: "0x2105" }]);
});

test("a wallet that can't switch is told which network to choose, and nothing is sent", async () => {
    const w = wallet({
        chainId: 1,
        on: {
            wallet_switchEthereumChain: () => {
                throw Object.assign(new Error("Unrecognized chain"), {
                    code: 4902,
                });
            },
        },
    });
    expect(await pay(w)).toEqual({
        paid: false,
        reason: "failed",
        message: "Switch your wallet to Base, then try again.",
    });
    expect(w.calls.some((c) => c.method === "eth_sendTransaction")).toBe(false);
});

test("too little of the token is said in dollars, and nothing is sent", async () => {
    const w = wallet({ units: BigInt(1_200_000) });
    expect(await pay(w)).toEqual({
        paid: false,
        reason: "failed",
        message: "That wallet holds $1.20 in USDC on Base. This costs $2.50.",
    });
    expect(w.calls.some((c) => c.method === "eth_sendTransaction")).toBe(false);
});

test("closing the chooser or refusing in the wallet is a cancel, not an error", async () => {
    expect(await pay(undefined)).toEqual({ paid: false, reason: "cancelled" });
    const refusing = wallet({
        on: {
            eth_sendTransaction: () => {
                throw Object.assign(new Error("User rejected the request."), {
                    code: 4001,
                });
            },
        },
    });
    expect(await pay(refusing)).toEqual({ paid: false, reason: "cancelled" });
});

test("a wallet that fails to send says so", async () => {
    const broken = wallet({
        on: {
            eth_sendTransaction: () => {
                throw new Error("nonce too low");
            },
        },
    });
    expect(await pay(broken)).toEqual({
        paid: false,
        reason: "failed",
        message: "The payment wasn’t sent. Try again.",
    });
    const odd = wallet({ on: { eth_sendTransaction: () => "ok" } });
    expect((await pay(odd)).paid).toBe(false);
});
