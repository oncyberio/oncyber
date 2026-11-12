// @ts-check

import Renderer from '@3renderer'

/**
 * Reorders an RGBA8 readback into top-down rows (ImageData / canvas order).
 * - WebGPU copies texture rows top-down, padded to 256-byte rows.
 * - The WebGL2 fallback reads bottom-up (glReadPixels), tightly packed.
 *
 * @param { ArrayLike<number> } data
 * @param { number } width
 * @param { number } height
 * @param { boolean } bottomUp
 * @returns { Uint8ClampedArray }
 */
export function toTopDownRows(data, width, height, bottomUp) {

    const lineWidth = width * 4

    const stride = height > 1 ? ( data.length - lineWidth ) / ( height - 1 ) : lineWidth

    const out = new Uint8ClampedArray(lineWidth * height)

    const src = /** @type { Uint8Array } */ (data)

    for (let y = 0; y < height; y++) {

        const row = bottomUp ? height - 1 - y : y

        out.set(src.subarray(row * stride, row * stride + lineWidth), y * lineWidth)
    }

    return out
}

/**
 * Reads an RGBA8 render target back as ImageData (top row first) on both
 * backends. The GPU copy is queued synchronously, so the target can be drawn
 * into again (or disposed after the promise resolves) right after the call.
 *
 * @param { import('three').RenderTarget } renderTarget
 * @param { number } [cubeFace]
 * @returns { Promise<ImageData> }
 */
export function readRenderTargetImage(renderTarget, cubeFace = 0) {

    const { width, height } = renderTarget

    const bottomUp = !(/** @type { any } */ (Renderer.backend).isWebGPUBackend)

    return Renderer.readRenderTargetPixelsAsync(renderTarget, 0, 0, width, height, 0, cubeFace)

        .then((pixels) => new ImageData(toTopDownRows(pixels, width, height, bottomUp), width, height))
}
