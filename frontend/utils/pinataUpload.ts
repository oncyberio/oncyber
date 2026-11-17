/**
 * Server-side Pinata upload utilities for Next.js API routes.
 * Uploads data URLs (base64) to Pinata/IPFS and returns gateway URLs.
 */

import { mimetoExt } from "./mimeUtils";
import { sniffImageType, type ImageType } from "./imageType";
import { publicFetch } from "@utils/net/publicFetch";

const PINATA_API_URL = "https://api.pinata.cloud/pinning";
const PINATA_JWT = process.env.PINATA_JWT_KEY;

const PINATA_GATEWAY = "https://cyber.mypinata.cloud/ipfs/";

// Max file size: 50MB for 3D models, 10MB for images/thumbnails
const MAX_MODEL_SIZE = 50 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * Convert a data URL (base64) to a Blob.
 */
function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
    // Handle raw URLs (not data URLs)
    if (!dataUrl.startsWith("data:")) {
        return { blob: new Blob([dataUrl]), mimeType: "application/octet-stream" };
    }

    const [header, base64Data] = dataUrl.split(",");
    const mimeType = header.match(/:(.*?);/)?.[1] || "application/octet-stream";
    const byteString = atob(base64Data);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
    }
    return { blob: new Blob([bytes], { type: mimeType }), mimeType };
}

/**
 * Upload a single file (as data URL) to Pinata.
 * Returns the full gateway URL.
 */
export async function uploadToPinata(
    dataUrl: string,
    name: string,
    maxSize: number = MAX_MODEL_SIZE
): Promise<string> {
    const { blob, mimeType } = dataUrlToBlob(dataUrl);

    if (blob.size > maxSize) {
        throw new Error(
            `File size ${(blob.size / 1024 / 1024).toFixed(1)}MB exceeds limit of ${(maxSize / 1024 / 1024).toFixed(0)}MB`
        );
    }

    const formData = new FormData();
    const filename = `${name}_${Date.now()}`;
    formData.append("file", blob, filename);

    const metadata = JSON.stringify({
        name: filename,
    });
    formData.append("pinataMetadata", metadata);

    const options = JSON.stringify({
        cidVersion: 0,
    });
    formData.append("pinataOptions", options);

    const response = await fetch(`${PINATA_API_URL}/pinFileToIPFS`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata upload failed: ${errorText}`);
    }

    const result = await response.json();

    if (!result.IpfsHash) {
        throw new Error("Pinata upload: no IPFS hash returned");
    }

    return `${PINATA_GATEWAY}${result.IpfsHash}`;
}

/**
 * Fetch a remote (http/https) URL or a data URL into memory and pin it to
 * Pinata. Returns the same shape as the client-side `uploadFile` helper
 * (`https://cyber.mypinata.cloud/ipfs/<CID>?filename=<name>.<ext>`).
 */
export async function uploadUrlToPinata(
    source: string,
    name: string,
    mimeType: string,
    maxSize: number = MAX_MODEL_SIZE,
    { accept }: { accept?: string } = {}
): Promise<{
    url: string;
    secure_url: string;
    public_id: string;
    imageType: ImageType | null;
}> {
    // The source comes from API callers: only data URLs or public https hosts,
    // checked at connect time (see publicFetch).
    let buffer: ArrayBuffer;
    if (source.startsWith("data:")) {
        buffer = await (await fetch(source)).arrayBuffer();
    } else {
        if (!source.startsWith("https:")) throw new Error("Unsupported upload source");
        const res = await publicFetch(source, {
            maxBytes: maxSize,
            maxRedirects: 0,
            ...(accept ? { accept } : {}),
        });
        if (res.status < 200 || res.status >= 300) {
            throw new Error(`Failed to fetch upload source (${res.status})`);
        }
        buffer = res.body.buffer.slice(res.body.byteOffset, res.body.byteOffset + res.body.byteLength) as ArrayBuffer;
    }

    if (buffer.byteLength > maxSize) {
        throw new Error(
            `File size ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB exceeds limit of ${(maxSize / 1024 / 1024).toFixed(0)}MB`
        );
    }

    const filename = `${name.replace(/\//g, "_")}_${Date.now()}`;

    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: mimeType }), filename);
    formData.append("pinataMetadata", JSON.stringify({ name: filename }));
    formData.append("pinataOptions", JSON.stringify({ cidVersion: 0 }));

    const response = await fetch(`${PINATA_API_URL}/pinFileToIPFS`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata upload failed: ${errorText}`);
    }

    const result = await response.json();

    if (!result.IpfsHash) {
        throw new Error("Pinata upload: no IPFS hash returned");
    }

    const ext = mimetoExt[mimeType] || "bin";

    const url = `${PINATA_GATEWAY}${result.IpfsHash}?filename=${name}.${ext}`;

    return {
        url,
        secure_url: url,
        public_id: result.IpfsHash,
        imageType: sniffImageType(buffer),
    };
}

/**
 * Upload a JSON object to Pinata as a JSON pin.
 * Returns the full gateway URL.
 */
export async function uploadJsonToPinata(
    json: Record<string, any>,
    name: string
): Promise<string> {
    const response = await fetch(`${PINATA_API_URL}/pinJSONToIPFS`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({
            pinataContent: json,
            pinataMetadata: { name: `${name}_${Date.now()}` },
            pinataOptions: { cidVersion: 0 },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata JSON upload failed: ${errorText}`);
    }

    const result = await response.json();

    if (!result.IpfsHash) {
        throw new Error("Pinata JSON upload: no IPFS hash returned");
    }

    return `${PINATA_GATEWAY}${result.IpfsHash}`;
}

export { MAX_MODEL_SIZE, MAX_IMAGE_SIZE, PINATA_GATEWAY };
