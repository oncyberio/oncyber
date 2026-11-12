import * as logger from "firebase-functions/logger";
import pinataSDK from "@pinata/sdk";
import { Readable } from "stream";
import { mimetoExt } from "./mimeUtils";
import { readPublicImageSource } from "./publicImageSource";

//

const PINATA_JWT_KEY = process.env.PINATA_JWT_KEY;

export enum UploadType {
    Artwork = "Artwork",
    Feed = "Feed",
    HeroImg = "HeroImg",
}

export async function uploadModel3D(buffer: ArrayBuffer, publicId: string) {
    try {
        //
        let then = Date.now();

        logger.info("[uploadModel]", { publicId });

        let result = await uploadIPFS(buffer, publicId, "model/gltf-binary");

        const ts = Date.now() - then;

        logger.info("uploadModel/success", { result, ts });

        return result.secure_url;
        //
    } catch (error) {
        // console.error("uploadModel/error]", error);
        logger.error("uploadModel/error]", error);
        throw error;
    }
}

export async function uploadImage(url: string, userId: string) {
    //
    const publicId = `${userId}-assets-${Date.now()}`;

    const result = await uploadIPFS(url, publicId, "image/jpeg");

    return result.secure_url;
}

export async function uploadIPFS(
    source: string | ArrayBuffer,
    publicId: string,
    mimeType: string
): Promise<{ secure_url: string; url: string; public_id: string }> {
    //
    const pinata = await uploadPinata(source, publicId.replace(/\//g, "_"));

    const ipfsHash = pinata?.IpfsHash;

    if (!ipfsHash) throw new Error("Failed to upload file");

    const ext = mimetoExt[mimeType];

    const url = `https://cyber.mypinata.cloud/ipfs/${ipfsHash}?filename=${publicId}.${ext}`;

    if (!url) {
        throw "err";
    }

    return {
        url,
        secure_url: url,
        public_id: ipfsHash,
    } as any;
}

const pinata = new pinataSDK({ pinataJWTKey: PINATA_JWT_KEY });

export async function uploadPinata(
    file: string | ArrayBuffer,
    filename: string
) {
    //
    try {
        let buffer: ArrayBuffer;

        if (typeof file === "string") {
            // Raster screenshot data URLs stay local; remote URLs are resolved
            // and checked at socket connection time before any bytes are pinned.
            const body = await readPublicImageSource(file);
            buffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
        } else {
            buffer = file;
        }

        let arrayBufferView = new Uint8Array(buffer);

        const buf = Buffer.from(arrayBufferView);

        const stream = Readable.from(buf);

        // let stream = new Readable({
        //     read() {
        //         this.push(arrayBufferView);
        //         this.push(null); // Indicates the end of the stream
        //     },
        // });

        const options = {
            pinataMetadata: {
                name: filename,
            },
        };

        // const result = await fetch(
        //     "https://api.pinata.cloud/pinning/pinFileToIPFS",
        //     {
        //         method: "POST",
        //         body,
        //         headers: {
        //             Authorization: `Bearer ${PINATA_JWT_KEY}`,
        //         },
        //     }
        // ).then((res) => {
        //     if (!res.ok) {
        //         logger.error("uploadPinata/error", res.statusText);
        //         return null;
        //     }

        //     return res.json();
        // });

        const result = await pinata.pinFileToIPFS(stream, options);

        return result;
    } catch (err) {
        logger.error("uploadPinata/error", err);
        return null;
    }
}
