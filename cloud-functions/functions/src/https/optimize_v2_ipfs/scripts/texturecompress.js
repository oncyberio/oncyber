// @ts-check

import { BufferUtils, ImageUtils, TextureChannel } from "@gltf-transform/core";
import { EXTTextureAVIF, EXTTextureWebP } from "@gltf-transform/extensions";
import { getTextureChannelMask } from "./listtexturechannel.js";
import { listTextureSlots } from "./listtextureslot.js";
import { createTransform, formatBytes } from "./utils2.js";
import { TextureResizeFilter } from "../../vrmopti_ipfs/texturecompressetc/textureresize.js";
const NAME = "textureCompress";
const FORMATS = ["jpeg", "png", "webp", "avif"];
const SUPPORTED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
];
export const TEXTURE_COMPRESS_DEFAULTS = {
    resizeFilter: TextureResizeFilter.LANCZOS3,
    pattern: null,
    formats: null,
    slots: null,
    quality: null,
    effort: null,
    lossless: false,
    nearLossless: false,
};
/**
 * Optimizes images, optionally resizing or converting to JPEG, PNG, WebP, or AVIF formats.
 *
 * Requires `sharp`, and is available only in Node.js environments.
 *
 * Example:
 *
 * ```javascript
 * import { textureCompress } from '@gltf-transform/functions';
 * import sharp from 'sharp';
 *
 * // (A) Optimize without conversion.
 * await document.transform(
 *  textureCompress({encoder: sharp})
 * );
 *
 * // (B) Optimize and convert images to WebP.
 * await document.transform(
 *  textureCompress({
 *      encoder: sharp,
 *      targetFormat: 'webp',
 *      slots: /^(?!normalTexture).*$/ // exclude normal maps
 *  })
 * );
 * ```
 *
 * @category Transforms
 */
export default function textureCompress(_options) {
    const options = Object.assign(
        Object.assign({}, TEXTURE_COMPRESS_DEFAULTS),
        _options
    );
    const encoder = options.encoder;
    const targetFormat = options.targetFormat;
    const patternRe = options.pattern;
    const formatsRe = options.formats;
    const slotsRe = options.slots;
    if (!encoder) {
        throw new Error(
            `${targetFormat}: encoder dependency required — install "sharp".`
        );
    }

    return createTransform(NAME, async (document) => {
        const logger = document.getLogger();
        const textures = document.getRoot().listTextures();
        await Promise.all(
            textures.map(async (texture, textureIndex) => {
                const options2 = Object.assign(
                    Object.assign({}, TEXTURE_COMPRESS_DEFAULTS),
                    _options
                );

                const slots = listTextureSlots(texture);
                const channels = getTextureChannelMask(texture);
                const textureLabel =
                    texture.getURI() ||
                    texture.getName() ||
                    `${textureIndex + 1}/${
                        document.getRoot().listTextures().length
                    }`;
                const prefix = `${NAME}(${textureLabel})`;

                // FILTER: Exclude textures that don't match (a) 'slots' or (b) expected formats.
                if (!SUPPORTED_MIME_TYPES.includes(texture.getMimeType())) {
                    logger.debug(
                        `${prefix}: Skipping, unsupported texture type "${texture.getMimeType()}".`
                    );
                    return;
                } else if (
                    patternRe &&
                    !patternRe.test(texture.getName()) &&
                    !patternRe.test(texture.getURI())
                ) {
                    logger.debug(
                        `${prefix}: Skipping, excluded by "pattern" parameter.`
                    );
                    return;
                } else if (
                    formatsRe &&
                    !formatsRe.test(texture.getMimeType())
                ) {
                    logger.debug(
                        `${prefix}: Skipping, "${texture.getMimeType()}" excluded by "formats" parameter.`
                    );
                    return;
                } else if (
                    slotsRe &&
                    slots.length &&
                    !slots.some((slot) => slotsRe.test(slot))
                ) {
                    console.log(
                        "image is a slot texture so no quality compression to be done "
                    );
                    console.log(
                        "but alpha check to be done, so setting quality to 100"
                    );

                    options2.quality = 100;
                    // logger.debug(`${prefix}: Skipping, [${slots.join(', ')}] excluded by "slots" parameter.`);
                    // return;
                } else if (
                    options2.targetFormat === "jpeg" &&
                    channels & TextureChannel.A
                ) {
                    console.log("well ? ");
                    logger.warn(
                        `${prefix}: Skipping, [${slots.join(
                            ", "
                        )}] requires alpha channel.`
                    );
                    return;
                }

                // console.log('')

                const srcFormat = getFormat(texture);
                const dstFormat = targetFormat || srcFormat;
                logger.debug(`${prefix}: Format = ${srcFormat} → ${dstFormat}`);
                logger.debug(`${prefix}: Slots = [${slots.join(", ")}]`);
                const srcImage = texture.getImage();
                const srcByteLength = srcImage.byteLength;
                await compressTexture(texture, options2);
                const dstImage = texture.getImage();
                const dstByteLength = dstImage.byteLength;
                const flag = srcImage === dstImage ? " (SKIPPED" : "";
                logger.debug(
                    `${prefix}: Size = ${formatBytes(
                        srcByteLength
                    )} → ${formatBytes(dstByteLength)}${flag}`
                );
            })
        );
        // Attach EXT_texture_webp if needed.
        const webpExtension = document.createExtension(EXTTextureWebP);
        if (
            textures.some((texture) => texture.getMimeType() === "image/webp")
        ) {
            webpExtension.setRequired(true);
        } else {
            webpExtension.dispose();
        }
        // Attach EXT_texture_avif if needed.
        const avifExtension = document.createExtension(EXTTextureAVIF);
        if (
            textures.some((texture) => texture.getMimeType() === "image/avif")
        ) {
            avifExtension.setRequired(true);
        } else {
            avifExtension.dispose();
        }
        logger.debug(`${NAME}: Complete.`);
    });
}
/**
 * Optimizes a single {@link Texture}, optionally resizing or converting to JPEG, PNG, WebP, or AVIF formats.
 *
 * Requires `sharp`, and is available only in Node.js environments.
 *
 * Example:
 *
 * ```javascript
 * import { compressTexture } from '@gltf-transform/functions';
 * import sharp from 'sharp';
 *
 * const texture = document.getRoot().listTextures()
 *  .find((texture) => texture.getName() === 'MyTexture');
 *
 * await compressTexture(texture, {
 *  encoder: sharp,
 *  targetFormat: 'webp',
 *  resize: [1024, 1024]
 * });
 * ```
 */
// export function hasAlpha( view  ){

//     if (view.getUint32(0) === 0x89504E47 && view.getUint32(4) === 0x0D0A1A0A) {

//         // 1st method

//         // We know format field exists in the IHDR chunk. The chunk exists at
//         // offset 8 +8 bytes (size, name) +8 (depth) & +9 (type)
//         var depth = view.getUint8(8 + 8 + 8);
//         var type  = view.getUint8(8 + 8 + 9);

//         var hasAlpha1 =  type === 4 || type === 6

//         if( hasAlpha1 == true ) {

//             console.log('method type ', hasAlpha1)

//             return true
//         }

//         var hasAlpha2 = false

//         if (view.getUint32(0) !== 0x89504E47) {
//                 throw new Error('Not a valid PNG file.');
//         }

//         let cursor = 8;  // Start after PNG signature
//         while (cursor < view.byteLength) {
//             // Read chunk length
//             const chunkLength = view.getUint32(cursor);

//             // Check chunk type
//             const chunkType = String.fromCharCode(view.getUint8(cursor + 4),
//                                                   view.getUint8(cursor + 5),
//                                                   view.getUint8(cursor + 6),
//                                                   view.getUint8(cursor + 7));

//             if (chunkType === 'tRNS') {
//                 hasAlpha2 = true;
//                 cursor = view.byteLength
//             }

//             if (chunkType === 'IDAT') {
//                 hasAlpha2 = false;
//                 cursor = view.byteLength
//             }

//             // Move cursor to next chunk (add 12 for length, type, and CRC fields)
//             cursor += chunkLength + 12;
//         }

//         console.log('method tRNS ', hasAlpha2)

//         return hasAlpha2

//     }

//     return false

// }

export async function compressTexture(texture, _options) {
    const options = Object.assign(
        Object.assign({}, TEXTURE_COMPRESS_DEFAULTS),
        _options
    );
    const encoder = options.encoder;
    if (!encoder) {
        throw new Error(
            `${options.targetFormat}: encoder dependency required — install "sharp".`
        );
    }
    const srcFormat = getFormat(texture);
    var dstFormat = options.targetFormat || srcFormat;
    const srcMimeType = texture.getMimeType();

    let encoderOptions = {};

    const srcImage = texture.getImage();

    const instance = encoder(srcImage);

    if (srcMimeType == "image/png" && dstFormat == "png") {
        const hasAlpha = (await instance.metadata()).hasAlpha;

        if (hasAlpha == false) {
            dstFormat = "jpeg";
            console.log(
                "texture was png, but no alpha detected, so transforming to jpg"
            );
        }
    }

    var dstMimeType = `image/${dstFormat}`;

    switch (dstFormat) {
        case "jpeg":
            encoderOptions = { quality: options.quality };
            break;
        case "png":
            encoderOptions = {
                quality: options.quality,
                effort: remap(options.effort, 100, 10),
            };
            break;
        case "webp":
            encoderOptions = {
                quality: options.quality,
                effort: remap(options.effort, 100, 6),
                lossless: options.lossless,
                nearLossless: options.nearLossless,
            };
            break;
        case "avif":
            encoderOptions = {
                quality: options.quality,
                effort: remap(options.effort, 100, 9),
                lossless: options.lossless,
            };
            break;
    }

    instance.toFormat(dstFormat, encoderOptions);

    // Resize.
    if (options.resize) {
        instance.resize(options.resize[0], options.resize[1], {
            fit: "inside",
            kernel: options.resizeFilter,
            withoutEnlargement: true,
        });
    }
    var dstImage = BufferUtils.toView(await instance.toBuffer());

    const srcByteLength = srcImage.byteLength;
    const dstByteLength = dstImage.byteLength;

    if (srcMimeType === dstMimeType && dstByteLength >= srcByteLength) {
        // Skip if src/dst formats match and dst is larger than the original.
        return;
    } else if (srcMimeType === dstMimeType) {
        // Overwrite if src/dst formats match and dst is smaller than the original.
        texture.setImage(dstImage);
    } else {
        console.log("overwrite", dstMimeType);
        // Overwrite, then update path and MIME type if src/dst formats differ.
        const srcExtension = ImageUtils.mimeTypeToExtension(srcMimeType);
        const dstExtension = ImageUtils.mimeTypeToExtension(dstMimeType);
        const dstURI = texture
            .getURI()
            .replace(new RegExp(`\\.${srcExtension}$`), `.${dstExtension}`);
        texture.setImage(dstImage).setMimeType(dstMimeType).setURI(dstURI);
    }
}
function getFormat(texture) {
    const mimeType = texture.getMimeType();
    const format = mimeType.split("/").pop();
    if (!format || !FORMATS.includes(format)) {
        throw new Error(`Unknown MIME type "${mimeType}".`);
    }
    return format;
}
function remap(value, srcMax, dstMax) {
    if (value == null) return null;
    return Math.round((value / srcMax) * dstMax);
}
