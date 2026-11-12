import type { AssetEvent } from "../../../dApp/types/AssetEvent";
import type { Result } from "../../js";

export async function fetchArtworkHistory(
    asset: {
        contract_address?: string;
        token_address?: string;
        token_id?: string;
    },
    chain: string,
    signal?: AbortSignal
): Promise<Result<AssetEvent[]>> {
    const query = new URLSearchParams({
        chain,
        contract: asset.contract_address || asset.token_address,
        token: String(asset.token_id ?? ""),
    });
    const controller = new AbortController();
    const cancel = () => controller.abort();
    const timeout = setTimeout(cancel, 12000);
    signal?.addEventListener("abort", cancel, { once: true });
    try {
        if (signal?.aborted) throw new Error("Cancelled");
        const response = await fetch(`/api/artwork-history?${query}`, {
            signal: controller.signal,
        });
        if (!response.ok) throw new Error("History unavailable");
        const result = await response.json();
        if (!Array.isArray(result.events))
            throw new Error("Invalid history response");
        return {
            success: true,
            value: result.events.map((event) => ({
                ...event,
                date: new Date(event.date),
            })),
        };
    } catch {
        return {
            success: false,
            error: "Artwork history is temporarily unavailable.",
        };
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", cancel);
    }
}
