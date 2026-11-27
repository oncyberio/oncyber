import dns from "dns";
import type { IncomingHttpHeaders } from "http";
import https from "https";
import type { Readable } from "stream";
import { assertPublicUrl, isPublicAddress } from "@utils/net/publicFetch";

/**
 * One GET to the IPFS gateway a pinned release is read through, for the
 * releases route (pages/api/games/releases). The address comes from the
 * committed pointer, not from a visitor, and it is still held to what
 * utils/net/publicFetch holds a visitor's URL to: https only, and every
 * address the host resolves to must be public, checked when connecting, so
 * a gateway name cannot send this server to loopback, the private network
 * or cloud metadata. The body is a stream (a release's models can be
 * large), and a redirect is returned as it is, never followed.
 */
export interface GatewayResponse {
    status: number;
    headers: IncomingHttpHeaders;
    body: Readable;
}

function publicLookup(hostname: string, options: any, callback: any) {
    dns.lookup(hostname, { ...options, all: true }, (error, found: any) => {
        if (error) return callback(error);
        const list = (Array.isArray(found) ? found : [found]) as {
            address: string;
            family: number;
        }[];
        if (!list.length || !list.every((at) => isPublicAddress(at.address)))
            return callback(
                Object.assign(new Error("Address not allowed"), {
                    code: "EADDRBLOCKED",
                })
            );
        if (options?.all) return callback(null, list);
        callback(null, list[0].address, list[0].family);
    });
}

/** Rejects on a network error, or when the gateway is silent for `timeoutMs`. */
export function gatewayGet(
    url: URL,
    { timeoutMs = 15000 } = {}
): Promise<GatewayResponse> {
    return new Promise((resolve, reject) => {
        if (url.protocol !== "https:" || url.username || url.password)
            return reject(new Error("Unsupported URL"));
        try {
            // An address written as numbers is never looked up: refuse a
            // private one here.
            assertPublicUrl(url.href);
        } catch (error) {
            return reject(error);
        }
        const options = {
            method: "GET",
            lookup: publicLookup,
            timeout: timeoutMs,
            headers: {
                accept: "*/*",
                // The bytes as stored: the route sets its own headers.
                "accept-encoding": "identity",
                "user-agent": "OncyberReleases/1.0",
            },
        };
        const request = https.request(url, options, (response) =>
            resolve({
                status: response.statusCode || 0,
                headers: response.headers,
                body: response,
            })
        );
        request.on("timeout", () => request.destroy(new Error("Timed out")));
        request.on("error", reject);
        request.end();
    });
}
