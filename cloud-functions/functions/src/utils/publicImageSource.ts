import dns from "dns";
import https from "https";
import net from "net";
import type { IncomingHttpHeaders, IncomingMessage } from "http";

// Same connect-time lookup approach as frontend/utils/net/publicFetch. This
// independently deployed Functions package cannot import frontend sources.
const blockedV4 = new net.BlockList();
for (const [address, prefix] of [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
    ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
    ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
    ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blockedV4.addSubnet(address, prefix, "ipv4");

// Limit IPv6 to ordinary global unicast. Exclude transition/protocol and
// documentation ranges; mapped IPv4, NAT64, loopback and local ranges never
// enter this allowlist. See IANA's IPv4/IPv6 Special-Purpose registries.
const globalV6 = new net.BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const blockedV6 = new net.BlockList();
for (const [address, prefix] of [
    ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
] as const) blockedV6.addSubnet(address, prefix, "ipv6");

export class PublicImageSourceError extends Error {}

export function isPublicAddress(address: string): boolean {
    const family = net.isIP(address);
    if (family === 4) return !blockedV4.check(address, "ipv4");
    return family === 6 && globalV6.check(address, "ipv6") &&
        !blockedV6.check(address, "ipv6");
}

export function assertPublicHttpsUrl(input: string): URL {
    if (typeof input !== "string" || input.length > 8192)
        throw new PublicImageSourceError("Invalid image URL");
    let url: URL;
    try { url = new URL(input); }
    catch { throw new PublicImageSourceError("Invalid image URL"); }
    if (url.protocol !== "https:" || url.username || url.password)
        throw new PublicImageSourceError("Only public HTTPS URLs are supported");
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && !isPublicAddress(host))
        throw new PublicImageSourceError("Image address is not public");
    return url;
}

function publicLookup(hostname: string, options: any, callback: any) {
    // The addresses validated here are the addresses handed directly to the
    // socket. Do not preflight DNS and then let fetch resolve the name again.
    dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
        if (error) return callback(error);
        if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address)))
            return callback(new PublicImageSourceError("Image address is not public"));
        if (options?.all) return callback(null, addresses);
        callback(null, addresses[0].address, addresses[0].family);
    });
}

type Options = { maxBytes?: number; timeoutMs?: number; maxRedirects?: number };
type HopResponse = { status: number; headers: IncomingHttpHeaders; body: Buffer };
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

/** Read an image source with bounded memory and an absolute deadline.
 * Existing preview screenshots use raster base64 data URLs. Decode these
 * locally; every network request must use public HTTPS, including redirects.
 */
export async function readPublicImageSource(
    input: string,
    { maxBytes = 25 * 1024 * 1024, timeoutMs = 15000, maxRedirects = 3 }: Options = {}
): Promise<Buffer> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 ||
        !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 ||
        !Number.isSafeInteger(maxRedirects) || maxRedirects < 0)
        throw new PublicImageSourceError("Invalid image fetch limits");
    if (typeof input !== "string") throw new PublicImageSourceError("Invalid image source");
    if (input.startsWith("data:")) {
        if (input.length > 4 * Math.ceil(maxBytes / 3) + 64)
            throw new PublicImageSourceError("Image is too large");
        const match = /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,([A-Za-z0-9+/]*={0,2})$/.exec(input);
        if (!match || !match[1].length || match[1].length % 4 !== 0)
            throw new PublicImageSourceError("Invalid raster image data URL");
        const body = Buffer.from(match[1], "base64");
        if (body.length > maxBytes) throw new PublicImageSourceError("Image is too large");
        return body;
    }
    let url = assertPublicHttpsUrl(input);
    const deadline = Date.now() + timeoutMs;
    for (let hop = 0; ; hop++) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) throw new PublicImageSourceError("Image download timed out");
        const response = await requestOnce(url, maxBytes, remainingMs);
        if (redirectStatuses.has(response.status)) {
            if (hop >= maxRedirects) throw new PublicImageSourceError("Too many image redirects");
            if (!response.headers.location) throw new PublicImageSourceError("Invalid image redirect");
            url = assertPublicHttpsUrl(new URL(response.headers.location, url).toString());
            continue;
        }
        return response.body;
    }
}

function requestOnce(url: URL, maxBytes: number, timeoutMs: number): Promise<HopResponse> {
    return new Promise((resolve, reject) => {
        let settled = false;
        let incoming: IncomingMessage | undefined;
        let timer: ReturnType<typeof setTimeout>;
        const finish = (error?: Error, value?: HopResponse) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) {
                incoming?.destroy();
                request.destroy();
                reject(error);
            } else resolve(value!);
        };
        const request = https.request(url, {
            method: "GET",
            // No pooled connection can bypass this request's checked lookup.
            agent: false,
            lookup: publicLookup as any,
            headers: { accept: "image/*", "accept-encoding": "identity" },
        }, (response) => {
            if (settled) { response.destroy(); return; }
            incoming = response;
            response.on("error", (error) => finish(error));
            response.on("aborted", () => finish(new PublicImageSourceError("Image download interrupted")));
            const status = response.statusCode || 0;
            if (redirectStatuses.has(status)) {
                finish(undefined, { status, headers: response.headers, body: Buffer.alloc(0) });
                response.destroy();
                return;
            }
            if (status < 200 || status >= 300) {
                finish(new PublicImageSourceError("Image download failed"));
                return;
            }
            if (Number(response.headers["content-length"]) > maxBytes) {
                finish(new PublicImageSourceError("Image is too large"));
                return;
            }
            // Do not decompress untrusted payloads after applying a wire-size
            // limit. Request identity and reject servers that ignore it.
            const encoding = response.headers["content-encoding"];
            if (encoding && encoding.toLowerCase() !== "identity") {
                finish(new PublicImageSourceError("Encoded image responses are unsupported"));
                return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            response.on("data", (chunk: Buffer) => {
                if (settled) return;
                size += chunk.length;
                if (size > maxBytes) finish(new PublicImageSourceError("Image is too large"));
                else chunks.push(chunk);
            });
            response.on("end", () => finish(undefined, {
                status, headers: response.headers, body: Buffer.concat(chunks),
            }));
        });
        request.on("error", (error) => finish(error));
        timer = setTimeout(() => finish(new PublicImageSourceError("Image download timed out")), timeoutMs);
        request.end();
    });
}
