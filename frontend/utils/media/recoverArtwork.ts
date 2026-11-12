import { applyRecoveredMedia, recoveryIdentity } from "./recovery";

// A space may contain the same NFT several times. Share its lookup and bound
// cache growth. Gallery loading already limits the number of concurrent tasks.
const requests = new Map<string, Promise<any>>();

export async function recoverArtworkMedia(data: any, failed = false) {
    const identity = recoveryIdentity(data, failed);
    if (!identity) return;
    const query = new URLSearchParams(identity).toString();
    if (!requests.has(query)) {
        if (requests.size >= 1000)
            requests.delete(requests.keys().next().value);
        requests.set(
            query,
            (async () => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 12000);
                try {
                    const response = await fetch(
                        `/api/artwork-media?${query}`,
                        {
                            signal: controller.signal,
                        }
                    );
                    return response.ok ? await response.json() : null;
                } catch {
                    return null;
                } finally {
                    clearTimeout(timer);
                }
            })()
        );
    }
    const media = await requests.get(query);
    if (media) applyRecoveredMedia(data, media, failed);
    // A provider outage must remain retryable on a later visit/load.
    else requests.delete(query);
}
