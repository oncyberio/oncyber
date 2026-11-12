import dns from "dns";
import http from "http";
import https from "https";
import net from "net";

/**
 * Server-side fetch for user-supplied URLs. Only http(s) to public internet
 * addresses: every hop (including redirects) is resolved and checked at
 * connect time, so a hostname cannot point the server at loopback, the
 * private network or cloud metadata.
 */
const blocked = new net.BlockList();
for (const [address, prefix] of [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
    ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
    ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
    ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64],
    ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(address, prefix, "ipv6");

export function isPublicAddress(address: string) {
    const family = net.isIP(address);
    if (!family) return false;
    return !blocked.check(address, family === 6 ? "ipv6" : "ipv4");
}

function publicLookup(hostname: string, options: any, callback: any) {
    dns.lookup(hostname, { ...options, all: true }, (error, addresses: any) => {
        if (error) return callback(error);
        const list = (Array.isArray(addresses) ? addresses : [addresses]) as dns.LookupAddress[];
        const usable = list.filter((entry) => isPublicAddress(entry.address));
        if (!usable.length || usable.length !== list.length)
            return callback(Object.assign(new Error("Address not allowed"), { code: "EADDRBLOCKED" }));
        if (options?.all) return callback(null, usable);
        callback(null, usable[0].address, usable[0].family);
    });
}

export class PublicFetchError extends Error {}

export type PublicResponse = {
    status: number;
    url: string;
    headers: http.IncomingHttpHeaders;
    body: Buffer;
};

export function assertPublicUrl(input: string) {
    let url: URL;
    try {
        url = new URL(input);
    } catch {
        throw new PublicFetchError("Invalid URL");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new PublicFetchError("Unsupported URL");
    if (url.username || url.password) throw new PublicFetchError("Unsupported URL");
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && !isPublicAddress(host)) throw new PublicFetchError("Address not allowed");
    return url;
}

export async function publicFetch(
    input: string,
    { maxBytes = 25 * 1024 * 1024, timeoutMs = 15000, maxRedirects = 5, accept = "*/*", method = "GET" } = {}
): Promise<PublicResponse> {
    let url = assertPublicUrl(input);
    for (let hop = 0; ; hop++) {
        const response = await requestOnce(url, { maxBytes, timeoutMs, accept, method });
        const location = response.headers.location;
        if (response.status >= 300 && response.status < 400 && location) {
            if (hop >= maxRedirects) throw new PublicFetchError("Too many redirects");
            url = assertPublicUrl(new URL(location, url).toString());
            continue;
        }
        return response;
    }
}

function requestOnce(url: URL, { maxBytes, timeoutMs, accept, method }): Promise<PublicResponse> {
    return new Promise((resolve, reject) => {
        const client = url.protocol === "https:" ? https : http;
        const request = client.request(
            url,
            { method, lookup: publicLookup as any, timeout: timeoutMs, headers: { accept, "accept-encoding": "identity", "user-agent": "OncyberFetch/1.0" } },
            (response) => {
                const declared = Number(response.headers["content-length"]);
                if (method !== "HEAD" && declared > maxBytes) {
                    response.destroy();
                    return reject(new PublicFetchError("Response too large"));
                }
                const chunks: Buffer[] = [];
                let size = 0;
                response.on("data", (chunk: Buffer) => {
                    size += chunk.length;
                    if (size > maxBytes) {
                        response.destroy();
                        reject(new PublicFetchError("Response too large"));
                    } else chunks.push(chunk);
                });
                response.on("end", () =>
                    resolve({ status: response.statusCode || 0, url: url.toString(), headers: response.headers, body: Buffer.concat(chunks) })
                );
                response.on("error", reject);
            }
        );
        request.on("timeout", () => request.destroy(new PublicFetchError("Timed out")));
        request.on("error", reject);
        request.end();
    });
}
