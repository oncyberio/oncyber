import {
    readWalletPaymentRequest,
    tokenUnits,
    transferData,
    walletPaymentConfig,
    walletPaymentRequest,
} from "./walletPayment";
import { purchasesMode } from "./gamePurchases";

const env = {
    GAMES_PURCHASES: "wallet",
    GAMES_PURCHASE_CHAIN_ID: "8453",
    GAMES_PURCHASE_CHAIN_NAME: "Base",
    GAMES_PURCHASE_RPC_URL: "https://rpc.example/v1",
    GAMES_PURCHASE_TOKEN: "0x" + "Aa".repeat(20),
    GAMES_PURCHASE_RECIPIENT: "0x" + "bB".repeat(20),
};
const reference = "0x" + "12".repeat(32);

test("the settings are read whole, addresses in lower case, one confirmation by default", () => {
    expect(walletPaymentConfig(env)).toEqual({
        chainId: 8453,
        chainName: "Base",
        rpcUrl: "https://rpc.example/v1",
        token: "0x" + "aa".repeat(20),
        tokenSymbol: "USDC",
        recipient: "0x" + "bb".repeat(20),
        confirmations: 1,
    });
    expect(purchasesMode(env)).toBe("wallet");
});

test("a rail with any setting missing or malformed is off", () => {
    for (const [name, value] of [
        ["GAMES_PURCHASE_CHAIN_ID", ""],
        ["GAMES_PURCHASE_CHAIN_ID", "0"],
        ["GAMES_PURCHASE_CHAIN_ID", "1.5"],
        ["GAMES_PURCHASE_CHAIN_NAME", ""],
        ["GAMES_PURCHASE_RPC_URL", "http://rpc.example"],
        ["GAMES_PURCHASE_RPC_URL", ""],
        ["GAMES_PURCHASE_TOKEN", "0x1234"],
        ["GAMES_PURCHASE_RECIPIENT", ""],
        // Paying the token contract itself would burn the money.
        ["GAMES_PURCHASE_RECIPIENT", env.GAMES_PURCHASE_TOKEN.toLowerCase()],
        ["GAMES_PURCHASE_CONFIRMATIONS", "0"],
        ["GAMES_PURCHASE_CONFIRMATIONS", "many"],
    ] as const) {
        const broken = { ...env, [name]: value };
        expect([name, value, walletPaymentConfig(broken)]).toEqual([
            name,
            value,
            null,
        ]);
        expect(purchasesMode(broken)).toBe("off");
    }
});

test("cents become the token's units with no rounding", () => {
    expect(tokenUnits(250)).toBe("2500000");
    expect(tokenUnits(10)).toBe("100000");
    expect(tokenUnits(10000)).toBe("100000000");
});

test("the transaction data is a plain transfer followed by the order's reference", () => {
    const data = transferData("0x" + "bb".repeat(20), "2500000", reference);
    expect(data).toBe(
        "0xa9059cbb" +
            "0".repeat(24) +
            "bb".repeat(20) +
            (2500000).toString(16).padStart(64, "0") +
            "12".repeat(32)
    );
    expect(() => transferData("0xnope", "1", reference)).toThrow();
    expect(() =>
        transferData("0x" + "bb".repeat(20), "0", reference)
    ).toThrow();
    expect(() => transferData("0x" + "bb".repeat(20), "1", "0x12")).toThrow();
});

test("the page takes a request only in the shape the server makes", () => {
    const request = walletPaymentRequest(
        walletPaymentConfig(env)!,
        250,
        reference
    );
    expect(request).toMatchObject({
        rail: "wallet",
        chainId: 8453,
        chainName: "Base",
        units: "2500000",
    });
    // The server's node address never reaches the page.
    expect(JSON.stringify(request)).not.toContain("rpc.example");
    expect(readWalletPaymentRequest(request)).toEqual(request);
    for (const broken of [
        null,
        { ...request, rail: "card" },
        { ...request, token: "0x12" },
        { ...request, units: "-5" },
        // Not a transfer: an approval would hand over the whole balance.
        { ...request, data: "0x095ea7b3" + request.data.slice(10) },
        { ...request, data: request.data + "00" },
    ])
        expect(readWalletPaymentRequest(broken)).toBeNull();
});
