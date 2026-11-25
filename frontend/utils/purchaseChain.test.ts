/** @jest-environment node */
import { walletPaymentConfig } from "@features/games/walletPayment";
import {
    paymentReference,
    walletRail,
    type ChainReader,
} from "./purchaseChain";

const config = walletPaymentConfig({
    GAMES_PURCHASE_CHAIN_ID: "8453",
    GAMES_PURCHASE_CHAIN_NAME: "Base",
    GAMES_PURCHASE_RPC_URL: "https://rpc.example/v1",
    GAMES_PURCHASE_TOKEN: "0x" + "aa".repeat(20),
    GAMES_PURCHASE_RECIPIENT: "0x" + "bb".repeat(20),
    GAMES_PURCHASE_CONFIRMATIONS: "2",
})!;
const payer = "0x" + "Cc".repeat(20);
const hash = "0x" + "ab".repeat(32);
const TRANSFER =
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const topic = (address: string) =>
    "0x" + "0".repeat(24) + address.slice(2).toLowerCase();
const asked = {
    userId: "user-a",
    payment: "ace_coins-100_key-0001",
    cents: 99,
};

/** A chain holding one transfer, as the visitor's wallet would have sent it. */
function chain(
    change: {
        tx?: Record<string, unknown> | null;
        receipt?: Record<string, unknown> | null;
        log?: Record<string, unknown>;
    } = {}
) {
    const request = walletRail(config, {} as ChainReader).request!(asked);
    const log = {
        address: config.token,
        topics: [TRANSFER, topic(payer), topic(config.recipient)],
        data: "0x" + BigInt(request.units).toString(16).padStart(64, "0"),
        ...change.log,
    };
    const reader: ChainReader = {
        getTransaction: async () =>
            change.tx === null
                ? null
                : ({
                      to: config.token,
                      from: payer,
                      data: request.data,
                      ...change.tx,
                  } as any),
        getTransactionReceipt: async () =>
            change.receipt === null
                ? null
                : ({
                      status: 1,
                      confirmations: 2,
                      logs: [log],
                      ...change.receipt,
                  } as any),
    };
    return walletRail(config, reader);
}
const verify = (rail = chain(), input = asked) =>
    rail.verify!({ ...input, proof: hash });

test("a reference belongs to one account's one payment", () => {
    const a = paymentReference("user-a", "ace_coins-100_key-0001");
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(paymentReference("user-a", "ace_coins-100_key-0001")).toBe(a);
    expect(paymentReference("user-b", "ace_coins-100_key-0001")).not.toBe(a);
    expect(paymentReference("user-a", "ace_coins-100_key-0002")).not.toBe(a);
});

test("the transfer asked for, confirmed, pays for the order", async () => {
    expect(await verify()).toEqual({ ok: true, reference: hash });
});

test("a transfer not seen or not confirmed yet is pending, not refused", async () => {
    expect(await verify(chain({ tx: null }))).toEqual({
        ok: false,
        reason: "payment-pending",
    });
    expect(await verify(chain({ receipt: null }))).toEqual({
        ok: false,
        reason: "payment-pending",
    });
    expect(await verify(chain({ receipt: { confirmations: 1 } }))).toEqual({
        ok: false,
        reason: "payment-pending",
    });
});

test("nothing but that exact transfer pays for it", async () => {
    const failed = { ok: false, reason: "payment-failed" };
    // Another account's payment, or another order's, carries another reference.
    expect(await verify(chain(), { ...asked, userId: "user-b" })).toEqual(
        failed
    );
    expect(
        await verify(chain(), { ...asked, payment: "ace_coins-100_key-0002" })
    ).toEqual(failed);
    // A cheaper product's transfer does not buy a dearer one.
    expect(await verify(chain(), { ...asked, cents: 250 })).toEqual(failed);
    // Another token, or a plain transfer with no reference.
    expect(await verify(chain({ tx: { to: "0x" + "dd".repeat(20) } }))).toEqual(
        failed
    );
    const plain = walletRail(config, {} as ChainReader).request!(
        asked
    ).data.slice(0, 138);
    expect(await verify(chain({ tx: { data: plain } }))).toEqual(failed);
    // Sent but reverted.
    expect(await verify(chain({ receipt: { status: 0 } }))).toEqual(failed);
    // The token did not log that transfer: wrong amount, recipient, sender or contract.
    expect(
        await verify(chain({ log: { data: "0x" + "0".repeat(63) + "1" } }))
    ).toEqual(failed);
    expect(
        await verify(
            chain({
                log: {
                    topics: [
                        TRANSFER,
                        topic(payer),
                        topic("0x" + "ee".repeat(20)),
                    ],
                },
            })
        )
    ).toEqual(failed);
    expect(
        await verify(
            chain({
                log: {
                    topics: [
                        TRANSFER,
                        topic("0x" + "ee".repeat(20)),
                        topic(config.recipient),
                    ],
                },
            })
        )
    ).toEqual(failed);
    expect(
        await verify(chain({ log: { address: "0x" + "dd".repeat(20) } }))
    ).toEqual(failed);
    expect(await verify(chain({ receipt: { logs: [] } }))).toEqual(failed);
});

test("the rail holds no balance and takes no money itself", () => {
    const rail = walletRail(config, {} as ChainReader);
    expect(rail.balance).toBeUndefined();
    expect(rail.pay).toBeUndefined();
});
