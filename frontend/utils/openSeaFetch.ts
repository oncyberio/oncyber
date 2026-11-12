import { nodeEnv } from "@env";

const OPENSEA_HOST = "https://api.opensea.io/api/v2";

/** Read-only OpenSea v2 paths the app requests (relative to /api/v2). */
export const OPENSEA_ALLOWED_PATH =
    /^(?:chain\/[a-z_]+\/(?:account\/[A-Za-z0-9]{20,64}\/nfts|contract\/[A-Za-z0-9]{20,64}\/nfts(?:\/[A-Za-z0-9._-]{1,100})?)|collection\/[a-z0-9_-]{1,100}\/nfts|collections(?:\/[a-z0-9_-]{1,100})?|events\/accounts\/[A-Za-z0-9]{20,64})(?:\?[A-Za-z0-9_=&%.-]{0,600})?$/;

/** Accepts "chain/…" or a full https://api.opensea.io/(api/)v2/… URL. */
export function openSeaPath(url: string) {
    return url.replace(/^https:\/\/api\.opensea\.io\/(?:api\/)?v2\//, "");
}

/**
 * OpenSea needs an API key, which must stay on the server. In the browser,
 * requests go through /api/opensea; on the server they go direct.
 */
export async function openSeaJson(url: string, signal?: AbortSignal) {
    const path = openSeaPath(url);
    const response =
        typeof window === "undefined"
            ? await fetch(`${OPENSEA_HOST}/${path}`, {
                  headers: {
                      "X-API-KEY": nodeEnv.OPENSEA_X_API_KEY,
                      Accept: "application/json",
                  },
                  signal,
              })
            : await fetch(`/api/opensea?path=${encodeURIComponent(path)}`, {
                  headers: { Accept: "application/json" },
                  signal,
              });
    if (!response.ok)
        throw new Error(
            `API Client Error: ${response.status} ${response.statusText}`
        );
    return response.json();
}
