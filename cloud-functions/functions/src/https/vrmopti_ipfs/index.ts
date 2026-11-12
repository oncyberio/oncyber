import { onRequest } from "firebase-functions/v2/https";

import { createApp } from "../../utils/express";

import { processing } from "./texturecompressetc";

import { extractMultipartFormData } from "../../utils/file";

import { database } from "../../utils/db";
import { uploadIPFS } from "utils/ipfsUpload";

const app = createApp({ cors: true, auth: true });

app.post("/", async (req, res) => {
    try {
        async function onFinish(filename, url) {
            let doc;

            if (url) {
                const snap = await database
                    .collection("vrm")
                    .where("url", "==", url)
                    .get();

                if (!snap.empty) {
                    // then update the doc with the compressed vrm url

                    doc = snap.docs[0];

                    const data = doc.data();

                    if (data.urlCompressed) return data.urlCompressed as string;
                }
            }

            const optivrm = await processing(filename, "vrm");

            const c_result = await uploadIPFS(
                optivrm.buffer,
                `${Date.now()}.vrm`,
                "model/vrm"
            );

            if (doc?.ref) {
                await doc.ref.update({
                    urlCompressed: c_result.secure_url,
                });
            }

            return c_result.secure_url;
        }

        const form: any = await extractMultipartFormData(req, onFinish);

        const { result, success, message } = form;

        if (!success) {
            res.status(400).json({
                success: false,
                message: message || "Failed to upload file",
            });
        }

        res.status(200).json({
            success: true,
            result,
        });
    } catch (err) {
        console.log("[ VRM OPTI ERROR ]", err);

        res.status(400).json({
            error: err.message,
        });
    }
});

export const vrmoptization_ipfs = onRequest({ memory: "4GiB" }, app);
