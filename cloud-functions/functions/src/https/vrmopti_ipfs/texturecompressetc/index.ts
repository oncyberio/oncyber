import { Document, NodeIO, VertexLayout } from "@gltf-transform/core";

import { toktx } from "./toktx.js";

import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";

import { metalRough, resample, dedup, prune } from "@gltf-transform/functions";

import { textureResize } from "./textureresize.js";

import { VRMExtension, VRMC_materials_mtoon, VRMC_springBone, VRMC_Extension, VRMC_node_constraint } from "./VRMextensions.js";

import fs from "fs";

import path from "path";

export const processing = async function (filePath, filename) {
    // Load file and print contents
    try {
        const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

        io.registerExtensions([VRMExtension, VRMC_materials_mtoon, VRMC_springBone, VRMC_Extension, VRMC_node_constraint]);

        io.setVertexLayout(VertexLayout.SEPARATE)

        // Read from URL.
        const document = await io.read(filePath);

        await document.transform(
            metalRough(),

            // Losslessly resample animation frames.
            resample(),

            // Remove duplicate vertex or texture data, if any.
            dedup(),

            // Remove unused nodes, textures, or other data.
            // prune(),

            // @ts-ignore
            textureResize({ size: [256, 256], square: true }),

            toktx({
                mode: "etc1s",
                powerOfTwo: true,
            })
        );

        const parts = filePath.split(".");

        const base = parts.slice(0, parts.length - 1).join(".");

        const filepath = path.join(`${base}_compressed.glb`);

        await io.write(filepath, document);

        const vrm = fs.readFileSync(filepath);

        return {
            buffer: vrm,
            file: filepath,
            filename: `${filename.split(".")[0]}_compressed.glb`,
        };
    } catch (err) {
        console.log(err);

        return {
            success: false,
            message: err?.message || "Failed to compress vrm",
        };
    }
};
