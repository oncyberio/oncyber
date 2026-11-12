import { openSeaEvents } from "./events";
const from = "0x" + "a".repeat(40),
    to = "0x" + "b".repeat(40);
const tx = "0x" + "1".repeat(64);
const transfer = {
    event_type: "transfer",
    event_timestamp: 1700000000,
    from_address: from,
    to_address: to,
    transaction: tx,
};
const sale = {
    event_type: "sale",
    event_timestamp: 1700000000,
    seller: from,
    buyer: to,
    transaction: tx,
    quantity: 1,
    payment: { quantity: "15400000000000000", decimals: 18, symbol: "WETH" },
};
test("maps actual v2 sales with the payment token's decimals and symbol", () => {
    expect(openSeaEvents([sale])).toEqual([
        expect.objectContaining({
            type: "Sale",
            price: 0.0154,
            paymentToken: { decimals: 18, symbol: "WETH" },
            from: { address: from },
            to: { address: to },
            date: new Date(1700000000000),
        }),
    ]);
    expect(
        openSeaEvents([
            {
                ...sale,
                payment: { quantity: "12500000", decimals: 6, symbol: "USDC" },
            },
        ])[0]
    ).toMatchObject({ price: 12.5, paymentToken: { symbol: "USDC" } });
});
test("deduplicates sale transfers without removing unrelated transfers", () => {
    expect(
        openSeaEvents([
            transfer,
            sale,
            sale,
            { ...transfer, transaction: "0x" + "2".repeat(64) },
        ]).map((e) => e.type)
    ).toEqual(["Sale", "Transfer"]);
});
test("supports v2 order/listing and mint/burn transfer shapes", () => {
    const zero = "0x" + "0".repeat(40);
    expect(
        openSeaEvents([
            {
                ...sale,
                event_type: "order",
                order_type: "listing",
                maker: from,
                seller: undefined,
            },
        ])[0]
    ).toMatchObject({ type: "Listing", price: 0.0154 });
    expect(openSeaEvents([{ ...transfer, from_address: zero }])[0].type).toBe(
        "Mint"
    );
    expect(openSeaEvents([{ ...transfer, to_address: zero }])[0].type).toBe(
        "Burn"
    );
});
test("malformed or unsupported events cannot break the whole timeline", () => {
    expect(
        openSeaEvents([
            null,
            {},
            { ...sale, payment: null },
            { ...transfer, event_timestamp: "bad" },
            transfer,
        ])
    ).toHaveLength(1);
    expect(openSeaEvents([])).toEqual([]);
    expect(() => openSeaEvents({ error: "unavailable" })).toThrow(
        "Invalid history response"
    );
});
test("orders newest first", () => {
    expect(
        openSeaEvents([
            transfer,
            { ...transfer, event_timestamp: 1700000001 },
        ]).map((e) => e.date.getTime())
    ).toEqual([1700000001000, 1700000000000]);
});
