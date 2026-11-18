/**
 * IndexNow: tells Bing and the other engines that take part (and the AI
 * search built on them) that a page is new or changed, instead of waiting
 * for their next crawl. Off until INDEXNOW_KEY is set; the key is any
 * 8-128 letters, digits or dashes, and is served at /indexnow-key.txt so
 * the engines can check the site sent the request.
 */
import { SEARCH_ORIGIN } from "./siteUrl";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const INDEXNOW_KEY_PATH = "/indexnow-key.txt";

/** The configured key, or null when unset or not a valid key. */
export function indexNowKey(value = process.env.INDEXNOW_KEY): string | null {
    const key = (value || "").trim();
    return /^[A-Za-z0-9-]{8,128}$/.test(key) ? key : null;
}

/** The request for these paths, or null when there is nothing to send. */
export function indexNowRequest(
    paths: string[],
    { key = indexNowKey(), origin = SEARCH_ORIGIN } = {}
): {
    host: string;
    key: string;
    keyLocation: string;
    urlList: string[];
} | null {
    const urlList = [
        ...new Set(
            paths
                .filter(
                    (path) => typeof path === "string" && path.startsWith("/")
                )
                .map((path) => origin + path)
        ),
    ];
    if (!key || !urlList.length) return null;
    return {
        host: new URL(origin).host,
        key,
        keyLocation: origin + INDEXNOW_KEY_PATH,
        urlList,
    };
}

/**
 * Sends the notice and never fails the caller: it waits at most `timeoutMs`
 * and swallows errors (a missed notice only means the usual crawl delay).
 */
export async function notifyIndexNow(
    paths: string[],
    {
        send = fetch,
        timeoutMs = 1500,
        ...options
    }: {
        send?: typeof fetch;
        timeoutMs?: number;
        key?: string | null;
        origin?: string;
    } = {}
): Promise<boolean> {
    const body = indexNowRequest(paths, options);
    if (!body) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await send(INDEXNOW_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}
