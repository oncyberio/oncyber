/** @jest-environment node */
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import type { WalletPaymentConfig } from "@features/games/walletPayment";
import { walletRail } from "./purchaseChain";

/**
 * The wallet rail against a JSON-RPC node, through the real chain client:
 * the answers are shaped as a node gives them, so this covers how they are
 * parsed, which the fake reader in purchaseChain.test.ts cannot.
 */
const token = "0x" + "aa".repeat(20);
const recipient = "0x" + "bb".repeat(20);
const payer = "0x" + "cc".repeat(20);
const hash = "0x" + "ab".repeat(32);
const block = "0x" + "ef".repeat(32);
const TRANSFER =
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const word = (hex: string) => "0x" + hex.replace(/^0x/, "").padStart(64, "0");

let server: Server;
let config: WalletPaymentConfig;
// What the node holds: set per test.
let node: { data: string; mined: number | null; head: number; status: string };

beforeAll(async () => {
    server = createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            const call = JSON.parse(body);
            const answer = (one: any) => {
                const mined = node.mined !== null;
                const tx = {
                    hash,
                    blockHash: mined ? block : null,
                    blockNumber: mined ? "0x" + node.mined!.toString(16) : null,
                    transactionIndex: mined ? "0x0" : null,
                    from: payer,
                    to: token,
                    input: node.data,
                    value: "0x0",
                    nonce: "0x1",
                    gas: "0x186a0",
                    gasPrice: "0x3b9aca00",
                    chainId: "0x2105",
                    type: "0x0",
                    v: "0x422d",
                    r: word("1"),
                    s: word("2"),
                };
                const result =
                    one.method === "eth_chainId"
                        ? "0x2105"
                        : one.method === "eth_blockNumber"
                        ? "0x" + node.head.toString(16)
                        : one.method === "eth_getTransactionByHash"
                        ? one.params[0] === hash
                            ? tx
                            : null
                        : one.method === "eth_getTransactionReceipt"
                        ? one.params[0] === hash && mined
                            ? {
                                  transactionHash: hash,
                                  transactionIndex: "0x0",
                                  blockHash: block,
                                  blockNumber: tx.blockNumber,
                                  from: payer,
                                  to: token,
                                  cumulativeGasUsed: "0xc350",
                                  gasUsed: "0xc350",
                                  effectiveGasPrice: "0x3b9aca00",
                                  contractAddress: null,
                                  logsBloom: "0x" + "00".repeat(256),
                                  status: node.status,
                                  type: "0x0",
                                  logs: [
                                      {
                                          address: token,
                                          topics: [
                                              TRANSFER,
                                              word(payer),
                                              word(recipient),
                                          ],
                                          // The amount: the transfer's second argument.
                                          data: "0x" + node.data.slice(74, 138),
                                          blockHash: block,
                                          blockNumber: tx.blockNumber,
                                          transactionHash: hash,
                                          transactionIndex: "0x0",
                                          logIndex: "0x0",
                                          removed: false,
                                      },
                                  ],
                              }
                            : null
                        : null;
                return { jsonrpc: "2.0", id: one.id, result };
            };
            res.setHeader("content-type", "application/json");
            res.end(
                JSON.stringify(
                    Array.isArray(call) ? call.map(answer) : answer(call)
                )
            );
        });
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    config = {
        chainId: 8453,
        chainName: "Base",
        rpcUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        token,
        tokenSymbol: "USDC",
        recipient,
        confirmations: 2,
    };
});
afterAll(() => new Promise((done) => server.close(done)));

const asked = {
    userId: "user-a",
    payment: "ace_coins-100_key-0001",
    cents: 99,
};
// A chain client of its own for each test: a client remembers the height
// for a few seconds, which on a chain can only count a transfer as less
// confirmed than it is, and here would carry one test's height into the next.
let clients = 0;
let url = "";
beforeEach(() => (url = `${config.rpcUrl}/?client=${++clients}`));
const rail = () => walletRail({ ...config, rpcUrl: url });
const verify = (input = asked) => rail().verify!({ ...input, proof: hash });

test("a mined, confirmed transfer read from a node pays for its order", async () => {
    const request = rail().request!(asked);
    node = { data: request.data, mined: 100, head: 101, status: "0x1" };
    expect(await verify()).toEqual({ ok: true, reference: hash });
    // The same transfer is nobody else's, and no other order's.
    expect(await verify({ ...asked, userId: "user-b" })).toEqual({
        ok: false,
        reason: "payment-failed",
    });
});

test("in the mempool, or one block deep, it is pending", async () => {
    const request = rail().request!(asked);
    node = { data: request.data, mined: null, head: 200, status: "0x1" };
    expect(await verify()).toEqual({ ok: false, reason: "payment-pending" });
    node = { data: request.data, mined: 200, head: 200, status: "0x1" };
    expect(await verify()).toEqual({ ok: false, reason: "payment-pending" });
});

test("a reverted transfer, or one the node has never seen, pays for nothing", async () => {
    const request = rail().request!(asked);
    node = { data: request.data, mined: 300, head: 305, status: "0x0" };
    expect(await verify()).toEqual({ ok: false, reason: "payment-failed" });
    expect(
        await rail().verify!({ ...asked, proof: "0x" + "cd".repeat(32) })
    ).toEqual({ ok: false, reason: "payment-pending" });
});
