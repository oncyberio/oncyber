import type { AssetEvent } from "../../../dApp/types/AssetEvent";

const ZERO = "0x0000000000000000000000000000000000000000";
const BURN = "0x000000000000000000000000000000000000dead";
const address = (value: unknown) =>
    typeof value === "string" && /^0x[\da-f]{40}$/i.test(value)
        ? value.toLowerCase()
        : null;

function payment(data: any) {
    if (
        !/^\d{1,100}$/.test(String(data?.quantity ?? "")) ||
        !Number.isInteger(data?.decimals) ||
        data.decimals < 0 ||
        data.decimals > 36 ||
        typeof data?.symbol !== "string" ||
        !data.symbol
    )
        return null;
    const price = Number(data.quantity) / 10 ** data.decimals;
    if (!Number.isFinite(price)) return null;
    return {
        price,
        paymentToken: { symbol: data.symbol, decimals: data.decimals },
    };
}

export function openSeaEvent(raw: any): AssetEvent | null {
    if (!Number.isFinite(raw?.event_timestamp) || raw.event_timestamp <= 0)
        return null;
    const date = new Date(raw.event_timestamp * 1000);
    if (!Number.isFinite(date.getTime())) return null;
    const transactionHash = /^0x[\da-f]{64}$/i.test(raw.transaction || "")
        ? raw.transaction
        : undefined;
    const type = raw.event_type;
    const from = address(raw.from_address || raw.seller || raw.maker);
    const to = address(raw.to_address || raw.buyer);
    if (
        type === "mint" ||
        (type === "transfer" && (raw.transfer_type === "mint" || from === ZERO))
    ) {
        return to
            ? { type: "Mint", date, to: { address: to }, transactionHash }
            : null;
    }
    if (type === "transfer" && from && to) {
        return to === ZERO || to === BURN
            ? { type: "Burn", date, from: { address: from }, transactionHash }
            : {
                  type: "Transfer",
                  date,
                  from: { address: from },
                  to: { address: to },
                  transactionHash,
              };
    }
    const amount = payment(raw.payment);
    const quantity = Number(raw.quantity);
    if (!amount || !Number.isSafeInteger(quantity) || quantity <= 0 || !from)
        return null;
    if (type === "sale" && to) {
        return {
            type: "Sale",
            date,
            from: { address: from },
            to: { address: to },
            transactionHash,
            quantity,
            ...amount,
        };
    }
    if (
        type === "listing" ||
        (type === "order" && raw.order_type === "listing")
    ) {
        return {
            type: "Listing",
            date,
            from: { address: from },
            quantity,
            ...amount,
        };
    }
    return null;
}

/** Do not repeat the transfer emitted by a sale in the same transaction. */
export function openSeaEvents(raw: unknown): AssetEvent[] {
    if (!Array.isArray(raw)) throw new Error("Invalid history response");
    const events = raw.map(openSeaEvent).filter((e): e is AssetEvent => !!e);
    const transferKey = (e: any) =>
        e.transactionHash &&
        `${e.transactionHash}:${e.from?.address}:${e.to?.address}`;
    const sales = new Set(
        events
            .filter((e) => e.type === "Sale")
            .map(transferKey)
            .filter(Boolean)
    );
    const seen = new Set<string>();
    return events
        .filter((e) => {
            if (e.type === "Transfer" && sales.has(transferKey(e)))
                return false;
            const key = JSON.stringify(e);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());
}
