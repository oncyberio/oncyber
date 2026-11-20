import UploaderApi from "@api/uploader/_api";

export interface PinataUpload {
    /** The uploaded file's CID. */
    IpfsHash: string;
}

/**
 * Upload a file to Pinata from the browser.
 *
 * The Pinata key stays on the server. The page asks the uploader API for a
 * short-lived signed upload URL (signed-in visitors only), then sends the
 * file straight to Pinata with it, so large files never pass through an API
 * route.
 */
export async function uploadFile(file: Blob): Promise<PinataUpload> {
    const { url, maxSize } = await UploaderApi.createUploadUrl({});

    if (file.size > maxSize) {
        throw new Error(
            `This file is too large to upload. The limit is ${Math.floor(
                maxSize / 1024 / 1024
            )} MB.`
        );
    }

    const body = new FormData();
    body.append("file", file);
    body.append("network", "public");

    const response = await fetch(url, { method: "POST", body });

    const result = await response.json().catch(() => null);

    const cid = result?.data?.cid;

    if (!response.ok || typeof cid !== "string" || !cid) {
        throw new Error(`Pinata upload failed (${response.status})`);
    }

    return { IpfsHash: cid };
}
