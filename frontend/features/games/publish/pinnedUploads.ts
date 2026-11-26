/**
 * Upload mode `pinata` of publishing from outside the repository
 * (docs/games/publishing.md): the creator's command sends the release
 * straight to the site's Pinata account through a short-lived signed
 * address, and the site reads every file back through its gateway before
 * it registers anything.
 *
 * Two halves, of different standing:
 *
 * - `verifyPinnedRelease` reads a stored release back through the gateway
 *   with the releases route's own request (pinnedGateway.ts) and compares
 *   sizes and SHA-256. It depends on nothing but a gateway serving
 *   `/ipfs/<cid>/<path>`, and is tested against a stand-in.
 * - `PinnedUploadSigner` hands out the upload address. `pinataSigner` asks
 *   Pinata's documented endpoint for a signed upload URL. What is NOT
 *   established is that one signed URL can take a whole release as one
 *   IPFS directory: Pinata documents signed URLs for single files, and
 *   says its current upload endpoint takes no folders. A directory would
 *   have to travel as one CAR file (the endpoint's `car` field), which has
 *   not been run. So the mode is off unless a person sets
 *   `GAMES_PUBLISHING_PINATA=car` (`pinnedUploadsConfig`), and `begin`
 *   answers "not available on this server" without it.
 */
import { createHash } from "crypto";
import { pinnedGatewayBase } from "./gameRelease";
import { gatewayGet, type GatewayResponse } from "./pinnedGateway";
import type { PublishFile } from "./publishedGames";

export interface PinnedUploadSigner {
    /** A short-lived address the command may send one upload to. */
    sign(request: {
        /** A name for the upload in the storage account. */
        name: string;
        maxBytes: number;
        expiresSeconds: number;
    }): Promise<string>;
}

export interface PinnedUploads {
    signer: PinnedUploadSigner;
    /** The gateway origin releases are read through, with no trailing slash. */
    gateway: string;
}

/**
 * Pinata's signed upload URLs: `POST /v3/files/sign` with the account's
 * key answers `{ data: "<url>" }`. Only the request named in Pinata's
 * documentation is made; the key never leaves this server.
 */
export function pinataSigner(options: {
    jwt: string;
    fetch?: typeof fetch;
    api?: string;
}): PinnedUploadSigner {
    const { jwt, api = "https://uploads.pinata.cloud" } = options;
    const request = options.fetch ?? globalThis.fetch;
    return {
        async sign({ name, maxBytes, expiresSeconds }) {
            const response = await request(`${api}/v3/files/sign`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${jwt}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    network: "public",
                    expires: expiresSeconds,
                    filename: name,
                    max_file_size: maxBytes,
                }),
            });
            if (!response.ok)
                throw new Error(`storage answered ${response.status}`);
            const url = (await response.json())?.data;
            let parsed: URL | null = null;
            try {
                parsed = new URL(url);
            } catch {
                // Not an address.
            }
            if (typeof url !== "string" || parsed?.protocol !== "https:")
                throw new Error("storage returned no upload address");
            return url;
        },
    };
}

/**
 * The site's own Pinata storage for uploads, or null. It needs the key,
 * a gateway origin, and the explicit switch described at the top of this
 * file; without all three the mode does not exist on this server.
 */
export function pinnedUploadsConfig(
    env: Record<string, string | undefined> = process.env
): PinnedUploads | null {
    if (env.GAMES_PUBLISHING_PINATA !== "car") return null;
    const gateway = (env.GAMES_RELEASES_GATEWAY ?? "")
        .replace(/\/+$/, "")
        .replace(/\/ipfs$/, "");
    if (!env.PINATA_JWT_KEY || !/^https:\/\/[^/]+$/.test(gateway)) return null;
    return { signer: pinataSigner({ jwt: env.PINATA_JWT_KEY }), gateway };
}

/** The gateway folder of a CID, if the releases route would serve it. */
export function pinnedReleaseBase(
    gateway: string,
    address: unknown
): string | null {
    return typeof address === "string"
        ? pinnedGatewayBase({
              backend: "pinata",
              address,
              base: `${gateway}/ipfs/${address}/`,
          })
        : null;
}

type Get = (url: URL) => Promise<GatewayResponse>;

async function readBack(get: Get, base: string, file: PublishFile) {
    const url = new URL(
        file.path.split("/").map(encodeURIComponent).join("/"),
        base
    );
    if (!url.href.startsWith(base)) return "bad path";
    const { status, body } = await get(url);
    if (status !== 200) {
        body.destroy();
        return `gateway answered ${status}`;
    }
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of body) {
        bytes += chunk.length;
        // Never read more than the file was said to hold.
        if (bytes > file.bytes) {
            body.destroy();
            return `longer than ${file.bytes} bytes`;
        }
        hash.update(chunk);
    }
    if (bytes !== file.bytes) return `${bytes} bytes, not ${file.bytes}`;
    return hash.digest("hex") === file.sha256 ? null : "SHA-256 differs";
}

/**
 * Reads every file of a release back from its gateway folder and compares
 * it with the list `begin` took. Returns the problems; none means the
 * stored release is the one that was checked.
 */
export async function verifyPinnedRelease(
    base: string,
    files: ReadonlyArray<PublishFile>,
    { get = gatewayGet as Get, concurrency = 6 } = {}
): Promise<Array<{ path: string; problem: string }>> {
    const problems: Array<{ path: string; problem: string }> = [];
    let next = 0;
    const worker = async () => {
        while (next < files.length && problems.length < 5) {
            const file = files[next++];
            const problem = await readBack(get, base, file).catch((error) =>
                String(error?.message ?? error)
            );
            if (problem) problems.push({ path: file.path, problem });
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(concurrency, files.length) }, worker)
    );
    return problems;
}
