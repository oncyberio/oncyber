// @ts-nocheck
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import micromatch from "micromatch";
import os from "os";
import tmp from "tmp";
import pLimit from "p-limit";
import { FileUtils, ImageUtils, TextureChannel, uuid } from "@gltf-transform/core";
import { KHRTextureBasisu } from "@gltf-transform/extensions";
import { createTransform, getTextureChannelMask, listTextureSlots } from "@gltf-transform/functions";
import { spawn, formatBytes, waitExit, MICROMATCH_OPTIONS } from "./utils.js";

tmp.setGracefulCleanup();

const NUM_CPUS = os.cpus().length || 1; // microsoft/vscode#112122

export const Mode = {
    ETC1S: "etc1s",
    UASTC: "uastc",
};

export const Filter = {
    BOX: "box",
    TENT: "tent",
    BELL: "bell",
    BSPLINE: "b-spline",
    MITCHELL: "mitchell",
    LANCZOS3: "lanczos3",
    LANCZOS4: "lanczos4",
    LANCZOS6: "lanczos6",
    LANCZOS12: "lanczos12",
    BLACKMAN: "blackman",
    KAISER: "kaiser",
    GAUSSIAN: "gaussian",
    CATMULLROM: "catmullrom",
    QUADRATIC_INTERP: "quadratic_interp",
    QUADRATIC_APPROX: "quadratic_approx",
    QUADRATIC_MIX: "quadratic_mix",
};

const GLOBAL_DEFAULTS = {
    filter: Filter.LANCZOS4,
    filterScale: 1,
    powerOfTwo: false,
    slots: "*",
    // See: https://github.com/donmccurdy/glTF-Transform/pull/389#issuecomment-1089842185
    jobs: 2 * NUM_CPUS,
};

export const ETC1S_DEFAULTS = Object.assign({ quality: 128, compression: 1 }, GLOBAL_DEFAULTS);
export const UASTC_DEFAULTS = Object.assign({ level: 2, rdo: 0, rdoDictionarySize: 32768, rdoBlockScale: 10.0, rdoStdDev: 18.0, rdoMultithreading: true, zstd: 18 }, GLOBAL_DEFAULTS);

export const toktx = function (options) {
    options = Object.assign(Object.assign({}, options.mode === Mode.ETC1S ? ETC1S_DEFAULTS : UASTC_DEFAULTS), options);

    return createTransform(options.mode, async (doc) => {
        const logger = doc.getLogger();

        const batchPrefix = uuid();

        const batchDir = join(tmp.tmpdir, "gltf-transform");

        if (!existsSync(batchDir)) mkdirSync(batchDir);

        const basisuExtension = doc.createExtension(KHRTextureBasisu).setRequired(true);

        let numCompressed = 0;

        const limit = pLimit(options.jobs);

        const textures = doc.getRoot().listTextures();

        const numTextures = textures.length;

        const promises = textures.map((texture, textureIndex) =>
            limit(async () => {
                const slots = listTextureSlots(texture);

                const channels = getTextureChannelMask(texture);

                const textureLabel = texture.getURI() || texture.getName() || `${textureIndex + 1}/${doc.getRoot().listTextures().length}`;

                const prefix = `toktx:texture(${textureLabel})`;

                logger.debug(`${prefix}: Slots → [${slots.join(", ")}]`);

                // FILTER: Exclude textures that don't match (a) 'slots' or (b) expected formats.
                if (texture.getMimeType() === "image/ktx2") {
                    logger.debug(`${prefix}: Skipping, already KTX.`);
                    return;
                } else if (texture.getMimeType() !== "image/png" && texture.getMimeType() !== "image/jpeg") {
                    logger.warn(`${prefix}: Skipping, unsupported texture type "${texture.getMimeType()}".`);
                    return;
                } else if (options.slots !== "*" && !slots.find((slot) => micromatch.isMatch(slot, options.slots, MICROMATCH_OPTIONS))) {
                    logger.debug(`${prefix}: Skipping, excluded by pattern "${options.slots}".`);
                    return;
                }

                const image = texture.getImage();

                const size = texture.getSize();

                if (!image || !size) {
                    logger.warn(`${prefix}: Skipping, unreadable texture.`);
                    return;
                }
                // PREPARE: Create temporary in/out paths for the 'toktx' CLI tool, and determine
                // necessary command-line flags.
                const extension = texture.getURI() ? FileUtils.extension(texture.getURI()) : ImageUtils.mimeTypeToExtension(texture.getMimeType());

                const inPath = join(batchDir, `${batchPrefix}_${textureIndex}.${extension}`);

                const outPath = join(batchDir, `${batchPrefix}_${textureIndex}.ktx2`);

                const inBytes = image.byteLength;

                await fs.writeFile(inPath, Buffer.from(image));

                const params = ["-ktx2", "-mipmap", "-file", inPath, "-output_path", batchDir + "/"];

                logger.debug(`${prefix}: Spawning → toktx ${params.join(" ")}`);

                const [status, stdout, stderr] = await waitExit(spawn("./node_modules/.bin/basisu", params));

                if (status !== 0) {
                    logger.error(`${prefix}: Failed → \n\n${stderr.toString()}`);
                } else {
                    // PACK: Replace image data in the glTF asset.
                    texture.setImage(await fs.readFile(outPath)).setMimeType("image/ktx2");
                    if (texture.getURI()) {
                        texture.setURI(FileUtils.basename(texture.getURI()) + ".ktx2");
                    }
                    numCompressed++;
                }

                const outBytes = texture.getImage().byteLength;

                logger.debug(`${prefix}: ${formatBytes(inBytes)} → ${formatBytes(outBytes)} bytes`);
            })
        );

        await Promise.all(promises);

        if (numCompressed === 0) {
            logger.warn("toktx: No textures were found, or none were selected for compression.");
        }

        const usesKTX2 = doc
            .getRoot()
            .listTextures()
            .some((t) => t.getMimeType() === "image/ktx2");

        if (!usesKTX2) {
            basisuExtension.dispose();
        }
    });
};
