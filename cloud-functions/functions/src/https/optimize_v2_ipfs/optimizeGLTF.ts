import { Document, NodeIO, VertexLayout } from "@gltf-transform/core";

import { toktx } from "./toktx";

import { KHRONOS_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";

import { MeshoptSimplifier } from "meshoptimizer";

import sharp from "sharp";

import {
    prune,
    dedup,
    resample,
    simplify,
    metalRough,
    draco,
    weld,
    // textureCompress,
    instance,
    dequantize,
    join,
    palette,
    clearNodeTransform,
    transformMesh,
} from "@gltf-transform/functions";

import textureCompress from "./scripts/texturecompress.js";

import { textureResize } from "../vrmopti_ipfs/texturecompressetc/textureresize.js";

import draco3d from "draco3dgltf";

export async function optimizeGLTF(
    data: ArrayBuffer,
    ids: { high: string; low: string; lowCompressed: string }
) {
    // Load file and print contents

    const io = new NodeIO()
        .registerExtensions(KHRONOS_EXTENSIONS)
        .registerExtensions([EXTTextureWebP]);

    io.registerDependencies({
        "draco3d.decoder": await draco3d.createDecoderModule(), // Optional.
        "draco3d.encoder": await draco3d.createEncoderModule(), // Optional.
    });

    const uint8 = new Uint8Array(data);

    // const highDocument = await io.readBinary(uint8);

    const originalDocument = await io.readBinary(uint8);

    await originalDocument.transform(
        metalRough(),

        palette({ min: 5 }),

        dequantize(),

        join(),

        instance(),

        prune(),

        dedup(),

        weld({ tolerance: 0.0001 }),

        simplify({
            simplifier: MeshoptSimplifier,
            ratio: 0.0,
            error: 0.001,
            lockBorder: true,
        }),

        draco()
    );

    const highDocument = originalDocument.clone();

    // high buffer

    await highDocument.transform(
        textureCompress({
            // targetFormat: 'webp',
            encoder: sharp,
            quality: 90,
            resize: [2048, 2048],
            slots: /^(?!normalTexture).*$/,
        })
    );

    const highBuffer = await io.writeBinary(highDocument);

    const resultHigh = {
        buffer: highBuffer,
        name: ids.high,
    };

    // =====================

    // low buffer

    const lowDocument = highDocument.clone();

    await lowDocument.transform(
        textureCompress({
            encoder: sharp,
            quality: 80,
            resize: [1024, 1024],
            slots: /^(?!normalTexture).*$/,
        })
    );

    const lowBuffer = await io.writeBinary(lowDocument);

    const resultlow = {
        buffer: lowBuffer,
        name: ids.low,
    };

    // =========

    // low compressed

    const lowCompressedDocument = lowDocument.clone();

    await lowCompressedDocument.transform(
        textureResize({ size: [1024, 1024], square: true } as any),

        toktx({
            mode: "etc1s",
            powerOfTwo: true,
        })
    );

    const lowCompressedBuffer = await io.writeBinary(lowCompressedDocument);

    const resultlowCompressed = {
        buffer: lowCompressedBuffer,
        name: ids.lowCompressed,
    };

    return {
        high: resultHigh,
        low: resultlow,
        lowCompressed: resultlowCompressed,
    };
}
