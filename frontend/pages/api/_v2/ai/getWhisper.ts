import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import { Configuration, OpenAIApi } from "openai";

import { Readable } from "stream";

import fs from "fs";

const configuration = new Configuration({
    apiKey:
        process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

function blobToFile(theBlob, fileName) {
    //A Blob() is almost a File() - it's just missing the two properties below which we will add
    theBlob.lastModifiedDate = new Date();
    theBlob.name = fileName;
    return theBlob;
}

export const getWhisper = proc({
    cors: true,
    // Paid model calls: signed-in users only.
    auth: true,

    // schema
    schema: z.object({
        audio: z.string(),
    }),

    // handler
    async handler(opts) {
        try {
            const buffer = Buffer.from(
                opts.audio.split("data:audio/webm;base64,")[1],
                "base64"
            );

            const voiceResponse = await openai.createTranscription(
                blobToFile(buffer, "audio.webm"),
                "whisper-1",
                "in english",
                "text",
                0.2,
                "en"
            );

            return {
                success: true,
                data: voiceResponse.data,
            };
        } catch (error) {
            console.log("failed to whisper", error);
            return {
                success: false,
                message: "Failed to get whisper.",
                data: null,
            };
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
