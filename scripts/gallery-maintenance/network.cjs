const dns = require("node:dns/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const fs = require("node:fs");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

function publicIP(address) {
    if (net.isIP(address) === 4) {
        const [a, b] = address.split(".").map(Number);
        return !(
            a === 0 ||
            a === 10 ||
            a === 127 ||
            a >= 224 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && (b === 168 || b === 0)) ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 198 && (b === 18 || b === 19))
        );
    }
    if (net.isIP(address) === 6) {
        // Only global unicast IPv6; reject loopback, mapped IPv4 and local ranges.
        return (
            /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:db8:/i.test(address)
        );
    }
    return false;
}

function mediaURL(value) {
    if (typeof value !== "string" || value.length > 4096) return null;
    let raw = value.replace(
        /^https:\/\/polar-mountain-96590\.herokuapp\.com\//,
        ""
    );
    if (raw.startsWith("ipfs://"))
        raw =
            "https://cyber.mypinata.cloud/ipfs/" +
            raw.slice(7).replace(/^ipfs\//, "");
    if (raw.startsWith("ar://")) raw = "https://arweave.net/" + raw.slice(5);
    try {
        const u = new URL(raw);
        if (
            !["http:", "https:"].includes(u.protocol) ||
            u.username ||
            u.password ||
            (u.port && !["80", "443"].includes(u.port))
        )
            return null;
        if (
            u.hostname === "localhost" ||
            u.hostname.endsWith(".local") ||
            u.hostname.endsWith(".internal")
        )
            return null;
        if (
            net.isIP(u.hostname.replace(/^\[|\]$/g, "")) &&
            !publicIP(u.hostname.replace(/^\[|\]$/g, ""))
        )
            return null;
        return u.href;
    } catch {
        return null;
    }
}

function retiredURL(raw) {
    const url = mediaURL(raw);
    if (!url) return false;
    const u = new URL(url);
    return (
        u.hostname === "img.reservoir.tools" ||
        (u.hostname === "res.cloudinary.com" &&
            /^\/(oncyber-io|oncybertesting|ugc-oo-oo)\//.test(u.pathname))
    );
}

async function request(raw, { method = "GET", signal, redirects = 4 } = {}) {
    const url = mediaURL(raw);
    if (!url) throw new Error("Unsafe or unsupported media URL");
    const u = new URL(url);
    const hostname = u.hostname.replace(/^\[|\]$/g, "");
    const addresses = await new Promise((resolve, reject) => {
        const aborted = () => reject(new Error("Media request cancelled"));
        if (signal?.aborted) return aborted();
        signal?.addEventListener("abort", aborted, { once: true });
        dns.lookup(hostname, { all: true })
            .then(resolve, reject)
            .finally(() => signal?.removeEventListener("abort", aborted));
    });
    if (!addresses.length || addresses.some((a) => !publicIP(a.address)))
        throw new Error("Media host resolved to a non-public address");
    if (signal?.aborted) throw new Error("Media request cancelled");
    const chosen = addresses.find((a) => a.family === 4) || addresses[0];
    // Pin the validated DNS result for the actual connection, including redirects.
    const res = await new Promise((resolve, reject) => {
        const req = (u.protocol === "https:" ? https : http).request(
            u,
            {
                method,
                signal,
                headers: {
                    "User-Agent": "Oncyber-Gallery-Maintenance/1.0",
                    Accept: "*/*",
                },
                lookup: (_host, options, callback) =>
                    options?.all
                        ? callback(null, [chosen])
                        : callback(null, chosen.address, chosen.family),
            },
            resolve
        );
        req.once("error", reject);
        req.end();
    });
    if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.destroy();
        if (!redirects || !res.headers.location)
            throw new Error("Too many media redirects");
        return request(new URL(res.headers.location, url).href, {
            method,
            signal,
            redirects: redirects - 1,
        });
    }
    res.mediaURL = url;
    return res;
}

async function download(
    url,
    target,
    { maxBytes = 128 * 1024 * 1024, timeoutMs = 45000 } = {}
) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let bytes = 0;
    try {
        const res = await request(url, { signal: controller.signal });
        if (res.statusCode < 200 || res.statusCode >= 300) {
            res.destroy();
            throw new Error(`Media HTTP ${res.statusCode}`);
        }
        if (Number(res.headers["content-length"]) > maxBytes) {
            res.destroy();
            throw new Error("Media exceeds size limit");
        }
        await pipeline(
            res,
            new Transform({
                transform(chunk, _encoding, cb) {
                    bytes += chunk.length;
                    cb(
                        bytes > maxBytes
                            ? new Error("Media exceeds size limit")
                            : null,
                        chunk
                    );
                },
            }),
            fs.createWriteStream(target, { mode: 0o600 }),
            { signal: controller.signal }
        );
        if (!bytes) throw new Error("Empty media response");
        return {
            url: res.mediaURL,
            bytes,
            contentType: String(res.headers["content-type"] || "").split(
                ";"
            )[0],
        };
    } finally {
        clearTimeout(timer);
    }
}

async function readJSON(url) {
    const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 12000);
    try {
        const res = await request(url, { signal: controller.signal });
        if (res.statusCode !== 200) {
            res.destroy();
            throw new Error(`Metadata HTTP ${res.statusCode}`);
        }
        let bytes = 0;
        const chunks = [];
        for await (const c of res) {
            bytes += c.length;
            if (bytes > 2 * 1024 * 1024) {
                res.destroy();
                throw new Error("Metadata too large");
            }
            chunks.push(c);
        }
        const value = JSON.parse(Buffer.concat(chunks).toString());
        if (!value || typeof value !== "object" || Array.isArray(value))
            throw new Error("Invalid original metadata");
        return value;
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    publicIP,
    mediaURL,
    retiredURL,
    request,
    download,
    readJSON,
};
