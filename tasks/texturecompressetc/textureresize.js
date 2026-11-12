import ndarray from 'ndarray';
import { lanczos2, lanczos3 } from 'ndarray-lanczos';
import { getPixels, savePixels } from 'ndarray-pixels';
import { Document } from '@gltf-transform/core';
/**
 * Returns names of all texture slots using the given texture.
 *
 * Example:
 *
 * ```js
 * const slots = listTextureSlots(texture);
 * // → ['occlusionTexture', 'metallicRoughnesTexture']
 * ```
 */

function createTransform(name, fn) {
    Object.defineProperty(fn, 'name', { value: name });
    return fn;
}

function listTextureSlots(texture) {
    const document = Document.fromGraph(texture.getGraph());
    const root = document.getRoot();
    const slots = texture
        .getGraph()
        .listParentEdges(texture)
        .filter((edge) => edge.getParent() !== root)
        .map((edge) => edge.getName());
    return Array.from(new Set(slots));
}

const NAME = 'textureResize';
/** Resampling filter methods. LANCZOS3 is sharper, LANCZOS2 is smoother. */
export var TextureResizeFilter;
(function (TextureResizeFilter) {
    /** Lanczos3 (sharp) */
    TextureResizeFilter["LANCZOS3"] = "lanczos3";
    /** Lanczos2 (smooth) */
    TextureResizeFilter["LANCZOS2"] = "lanczos2";
})(TextureResizeFilter || (TextureResizeFilter = {}));
export const TEXTURE_RESIZE_DEFAULTS = {
    size: [2048, 2048],
    filter: TextureResizeFilter.LANCZOS3,
    pattern: null,
    slots: null,
    square : false
};
/**
 * Resize PNG or JPEG {@link Texture Textures}, with {@link https://en.wikipedia.org/wiki/Lanczos_algorithm Lanczos filtering}.
 *
 * Implementation provided by {@link https://github.com/donmccurdy/ndarray-lanczos ndarray-lanczos}
 * package, which works in Web and Node.js environments. For a faster and more robust implementation
 * based on Sharp (available only in Node.js), use {@link textureCompress} with the 'resize' option.
 */
export function textureResize(_options = TEXTURE_RESIZE_DEFAULTS) {
    const options = Object.assign(Object.assign({}, TEXTURE_RESIZE_DEFAULTS), _options);
    return createTransform(NAME, async (doc) => {
        const logger = doc.getLogger();
        for (const texture of doc.getRoot().listTextures()) {
            const name = texture.getName();
            const uri = texture.getURI();
            const match = !options.pattern || options.pattern.test(name) || options.pattern.test(uri);
            if (!match) {
                logger.debug(`${NAME}: Skipping, excluded by "pattern" parameter.`);
                continue;
            }
            if (texture.getMimeType() !== 'image/png' && texture.getMimeType() !== 'image/jpeg') {
                logger.warn(`${NAME}: Skipping, unsupported texture type "${texture.getMimeType()}".`);
                continue;
            }
            const slots = listTextureSlots(texture);
            if (options.slots && !slots.some((slot) => { var _a; return (_a = options.slots) === null || _a === void 0 ? void 0 : _a.test(slot); })) {
                logger.debug(`${NAME}: Skipping, [${slots.join(', ')}] excluded by "slots" parameter.`);
                continue;
            }



            const [maxWidth, maxHeight] = options.size;
            const [srcWidth, srcHeight] = texture.getSize();

            let dstWidth, dstHeight;

            if(options.square){

                let closestSquare = closestSquarePowerOfTwo(srcWidth, srcHeight, maxWidth)

                dstWidth = closestSquare;
                dstHeight = closestSquare;
            }

            else {

                if (srcWidth <= maxWidth && srcHeight <= maxHeight) {
                    logger.debug(`${NAME}: Skipping, not within size range.`);
                    continue;
                }
                
                dstWidth = srcWidth;
                
                dstHeight = srcHeight;
                
                if (dstWidth > maxWidth) {
                    dstHeight = Math.floor(dstHeight * (maxWidth / dstWidth));
                    dstWidth = maxWidth;
                }
                if (dstHeight > maxHeight) {
                    dstWidth = Math.floor(dstWidth * (maxHeight / dstHeight));
                    dstHeight = maxHeight;
                }
            }
           
            const srcImage = texture.getImage();
            const srcPixels = (await getPixels(srcImage, texture.getMimeType()));
            const dstPixels = ndarray(new Uint8Array(dstWidth * dstHeight * 4), [dstWidth, dstHeight, 4]);
            logger.debug(`${NAME}: Resizing "${uri || name}", ${srcPixels.shape} → ${dstPixels.shape}...`);
            logger.debug(`${NAME}: Slots → [${slots.join(', ')}]`);
            try {
                options.filter === TextureResizeFilter.LANCZOS3
                    ? lanczos3(srcPixels, dstPixels)
                    : lanczos2(srcPixels, dstPixels);
            }
            catch (e) {
                if (e instanceof Error) {
                    logger.warn(`${NAME}: Failed to resize "${uri || name}": "${e.message}".`);
                    continue;
                }
                throw e;
            }
            texture.setImage(await savePixels(dstPixels, texture.getMimeType()));
        }
        logger.debug(`${NAME}: Complete.`);
    });
}

function closestSquarePowerOfTwo(width, height, maxSize) {
  const maxDimension = Math.max(width, height);
  const log2 = Math.ceil(Math.log2(maxDimension));
  const closestPowerOfTwo = 2 ** log2;
  return Math.min(closestPowerOfTwo, maxSize);
}