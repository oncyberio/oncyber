import type { NextApiRequest } from "next";

/** Host supplied by the request router, never a frame's claimed origin. */
export function contentHostOrigin(
    req: Pick<NextApiRequest, "headers">
): string {
    const host = req.headers.host;
    if (typeof host !== "string" || !host || /[\s\/@?#]/.test(host))
        throw new Error("Invalid host");
    const url = new URL(`https://${host}`);
    if (
        process.env.NODE_ENV === "development" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
        url.protocol = "http:";
    return url.origin;
}

export function isContentHostRequest(
    req: Pick<NextApiRequest, "headers">
): boolean {
    try {
        return req.headers.origin === contentHostOrigin(req);
    } catch {
        return false;
    }
}
