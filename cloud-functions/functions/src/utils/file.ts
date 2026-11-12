import fs from "fs";

import os from "os";

import path from "path";

import Busboy from "busboy";

import crypto from "node:crypto";

// import http from "node:http";

// import https from "node:https";

import url from "url";

function isValidUrl(inputUrl) {
    try {
        new URL(inputUrl);
        return true;
    } catch (error) {
        return false;
    }
}

export function extractMultipartFormData(req, onFinish) {
    return new Promise((resolve, reject) => {
        if (req.method != "POST") {
            return reject({
                success: false,
                message: "Only POST requests are accepted",
            });
        } else {
            const busboy = Busboy({ headers: req.headers });

            const tmpdir = os.tmpdir();

            const fields = {};

            const fileWrites = [];

            const uploads = {};

            const blobs = [];

            const filepath = path.join(tmpdir, Date.now() + ".vrm");

            busboy.on("field", (fieldname, val) => {
                if (!fieldname || !val) return;

                if (fields["vrmUrl"]) return;

                fields["vrmUrl"] = val;

                if (fieldname === "vrmUrl") {
                    if (!isValidUrl(val)) {
                        return reject({
                            success: false,
                            message: "Invalid URL",
                        });
                    }

                    const blob = fetch(val).then((res) => {
                        return res.arrayBuffer();
                    });

                    blobs.push(blob);
                }
            });

            busboy.on("file", (fieldname, file, { filename }) => {
                const writeStream = fs.createWriteStream(filepath);

                uploads[fieldname] = filepath;

                file.pipe(writeStream);

                const promise = new Promise((resolve, reject) => {
                    file.on("end", () => {
                        writeStream.end();
                    });

                    writeStream.on("finish", () => resolve(undefined));

                    writeStream.on("error", reject);
                });

                fileWrites.push(promise);
            });

            busboy.on("finish", async () => {
                try {
                    const result = { fields, uploads };

                    await Promise.all(fileWrites);

                    const _blobs = await Promise.all(blobs);

                    if (_blobs.length > 0) {
                        const blob = _blobs[0];

                        fs.writeFileSync(filepath, Buffer.from(blob));

                        uploads["vrm"] = filepath;
                    }

                    const filename = uploads["vrm"];

                    if (!filename)
                        return reject({
                            success: false,
                            message: "No file uploaded",
                        });

                    result.uploads["vrm"] = fs.readFileSync(filename);

                    const f_result = await onFinish(filename, fields["vrmUrl"]);

                    fs.unlinkSync(filename);

                    resolve({
                        success: true,
                        result: f_result,
                        isURL: fields["vrmUrl"],
                    });
                } catch (err) {
                    console.log("[ VRM OPTI ERROR ]", err);

                    reject({
                        success: false,
                        message: err?.message,
                    });
                }
            });

            busboy.on("error", reject);

            if (req.rawBody) {
                busboy.end(req.rawBody);
            } else {
                req.pipe(busboy);
            }
        }
    });
}

export async function getBufferHash(buffer: ArrayBuffer) {
    // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
    const hash = await crypto.subtle.digest("SHA-256", buffer);

    const hashHex = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return hashHex;
}

export async function getContent(url: string, limit: number) {
    //
    const buffer = await arrayBufferWithLimit(url, limit);

    const hash = await getBufferHash(buffer);

    return { buffer, hash };
}

async function arrayBufferWithLimit(url: string, limit: number) {
    //
    const response = await fetch(url);

    let fileSize = Infinity;

    let cl = response.headers.get("Content-Length");

    if (cl) {
        //
        fileSize = parseInt(cl) || Infinity;
    }

    if (fileSize != Infinity) {
        //
        if (fileSize > limit) {
            //
            throw new Error("Upload size limit exceeded (content-length)");
            //
        } else {
            //
            return response.arrayBuffer();
        }
    }

    // In case we didn't get a content-length header, we'll read the
    // the response buffer progressively and stop as soon as we reach
    // the limit; we don't want to read the whole file in memory
    // because it could be huge.

    let downloadedSize = 0;

    let chunks = [];

    const reader = response.body.getReader();

    let result = await reader.read();

    while (!result.done) {
        //
        downloadedSize += result.value.length;

        if (downloadedSize > limit) {
            //
            reader.cancel();

            throw new Error("Upload size limit exceeded");
        }

        chunks.push(result.value);

        // console.log("downloadedSize", result.value.length, downloadedSize);
        result = await reader.read();
    }

    // console.log("downloadedSize complete", downloadedSize, response.url);

    const fullBuffer = new Uint8Array(downloadedSize);

    let offset = 0;

    for (let chunk of chunks) {
        //
        fullBuffer.set(chunk, offset);

        offset += chunk.length;
    }

    return fullBuffer;

    // if (maxRedirects <= 0) throw new Error("Too many redirects");

    // return new Promise<ArrayBuffer>((resolve, reject) => {
    //     //

    //     const module = url.startsWith("https") ? https : http;

    //     let downloadedSize = 0;

    //     let chunks = [];

    //     const request = module
    //         .get(url, (response) => {
    //             //

    //             console.log("response", response.statusCode);
    //             console.log("headers", response.headers);

    //             // Check for redirects
    //             if (
    //                 response.statusCode >= 300 &&
    //                 response.statusCode < 400 &&
    //                 response.headers.location
    //             ) {
    //                 console.log("redirect", response.headers.location);

    //                 // @ts-ignore
    //                 return resolve(
    //                     arrayBufferWithLimit(
    //                         response.headers.location,
    //                         limit,
    //                         maxRedirects - 1
    //                     )
    //                 );
    //             }

    //             // first check if we have a content-length header
    //             // const cl = response.headers["content-length"];

    //             // const fileSize = parseInt(cl);

    //             // if (isFinite(fileSize) && fileSize > limit) {
    //             //     //
    //             //     request.destroy();

    //             //     reject(
    //             //         new Error("Upload size limit exceeded (content-length)")
    //             //     );

    //             //     return;
    //             // }

    //             response.on("data", (chunk: Buffer) => {
    //                 //
    //                 downloadedSize += chunk.length;

    //                 if (downloadedSize > limit) {
    //                     //
    //                     request.destroy();

    //                     reject(
    //                         new Error(
    //                             "Upload size limit exceeded (downloaded))"
    //                         )
    //                     );

    //                     return;
    //                 }

    //                 chunks.push(chunk);

    //                 console.log("downloadedSize", chunk.length, downloadedSize);
    //             });

    //             response.on("end", () => {
    //                 //
    //                 console.log("downloadedSize complete", downloadedSize, url);

    //                 const fullBuffer = Buffer.concat(chunks);

    //                 resolve(fullBuffer.buffer);
    //             });
    //         })
    //         .on("error", reject);
    // });
}
