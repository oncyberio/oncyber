import * as THREE from "three/webgpu";

// Text for signs and nameplates without a canvas: a 5×7 bitmap font drawn
// into pixels, then blurred and re-thresholded into chunky rounded letters
// that suit the toon style. Pure data, so it runs in any WebGPU host.

const GLYPHS = {
    A: "01110100011000111111100011000110001",
    B: "11110100011000111110100011000111110",
    C: "01110100011000010000100001000101110",
    D: "11110100011000110001100011000111110",
    E: "11111100001000011110100001000011111",
    F: "11111100001000011110100001000010000",
    G: "01110100011000010111100011000101111",
    H: "10001100011000111111100011000110001",
    I: "01110001000010000100001000010001110",
    J: "00111000100001000010000101001001100",
    K: "10001100101010011000101001001010001",
    L: "10000100001000010000100001000011111",
    M: "10001110111010110101100011000110001",
    N: "10001100011100110101100111000110001",
    O: "01110100011000110001100011000101110",
    P: "11110100011000111110100001000010000",
    Q: "01110100011000110001101011001001101",
    R: "11110100011000111110101001001010001",
    S: "01111100001000001110000010000111110",
    T: "11111001000010000100001000010000100",
    U: "10001100011000110001100011000101110",
    V: "10001100011000110001100010101000100",
    W: "10001100011000110101101011010101010",
    X: "10001100010101000100010101000110001",
    Y: "10001100010101000100001000010000100",
    Z: "11111000010001000100010001000011111",
    0: "01110100011001110101110011000101110",
    1: "00100011000010000100001000010001110",
    2: "01110100010000100010001000100011111",
    3: "11111000100010000010000011000101110",
    4: "00010001100101010010111110001000010",
    5: "11111100001111000001000011000101110",
    6: "00110010001000011110100011000101110",
    7: "11111000010001000100010000100001000",
    8: "01110100011000101110100011000101110",
    9: "01110100011000101111000010001001100",
    "!": "00100001000010000100001000000000100",
    "?": "01110100010000100010001000000000100",
    ".": "00000000000000000000000000110001100",
    "-": "00000000000000011111000000000000000",
    "'": "00100001000100000000000000000000000",
    ":": "00000011000110000000011000110000000",
    "&": "01100100101010001000101011001001101",
    "·": "00000000000000001100011000000000000",
    " ": "00000000000000000000000000000000000",
};

const hex = (c) => {
    const v = typeof c === "string" ? parseInt(c.replace("#", ""), 16) : c;
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/**
 * Rasterize `text` into an RGBA texture `w`×`h` pixels: foreground `fg` on
 * `bg` (or transparent when bg is null), letters as big as fit.
 */
export function textTexture(text, { w = 512, h = 128, fg = "#ffffff", bg = null, pad = 0.12 } = {}) {
    const chars = [...String(text).toUpperCase()].map((c) => (GLYPHS[c] ? c : "?"));
    const n = Math.max(1, chars.length);
    // Glyph cell 6×9 (5×7 plus spacing); pick an integer scale that fits.
    const k = Math.max(2, Math.floor(Math.min((w * (1 - pad * 2)) / (n * 6), (h * (1 - pad * 2)) / 9)));
    const tw = n * 6 * k - k;
    const ox = Math.floor((w - tw) / 2);
    const oy = Math.floor((h - 7 * k) / 2);
    // Coverage mask.
    const mask = new Float32Array(w * h);
    chars.forEach((c, i) => {
        const bits = GLYPHS[c];
        for (let gy = 0; gy < 7; gy++)
            for (let gx = 0; gx < 5; gx++) {
                if (bits[gy * 5 + gx] !== "1") continue;
                const x0 = ox + (i * 6 + gx) * k;
                const y0 = oy + gy * k;
                for (let y = y0; y < y0 + k; y++)
                    for (let x = x0; x < x0 + k; x++) if (x >= 0 && y >= 0 && x < w && y < h) mask[y * w + x] = 1;
            }
    });
    // Box blur (separable, twice) then a soft threshold rounds the corners.
    const r = Math.max(1, Math.round(k * 0.45));
    const tmp = new Float32Array(w * h);
    const blur = (src, dst, dx, dy) => {
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                let s = 0;
                let c = 0;
                for (let t = -r; t <= r; t++) {
                    const xx = x + t * dx;
                    const yy = y + t * dy;
                    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                    s += src[yy * w + xx];
                    c++;
                }
                dst[y * w + x] = s / c;
            }
    };
    blur(mask, tmp, 1, 0);
    blur(tmp, mask, 0, 1);
    const data = new Uint8Array(w * h * 4);
    const F = hex(fg);
    const B = bg ? hex(bg) : null;
    for (let i = 0; i < w * h; i++) {
        const a = Math.min(1, Math.max(0, (mask[i] - 0.38) / 0.16));
        const o = i * 4;
        if (B) {
            data[o] = B[0] + (F[0] - B[0]) * a;
            data[o + 1] = B[1] + (F[1] - B[1]) * a;
            data[o + 2] = B[2] + (F[2] - B[2]) * a;
            data[o + 3] = 255;
        } else {
            data[o] = F[0];
            data[o + 1] = F[1];
            data[o + 2] = F[2];
            data[o + 3] = a * 255;
        }
    }
    // Rows were built top-down; textures sample bottom-up.
    const flipped = new Uint8Array(data.length);
    for (let y = 0; y < h; y++) flipped.set(data.subarray(y * w * 4, (y + 1) * w * 4), (h - 1 - y) * w * 4);
    const tex = new THREE.DataTexture(flipped, w, h, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
}

/** A pill-shaped nameplate texture with a coloured dot. */
export function plateTexture(text, dot = "#2f7bff") {
    const w = 256;
    const h = 64;
    const label = textTexture(text, { w: 200, h: 40, fg: "#ffffff", pad: 0.05 });
    const src = label.image.data;
    const data = new Uint8Array(w * h * 4);
    const D = hex(dot);
    const cx = 128;
    const half = 118;
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            // Rounded pill: distance to a horizontal segment.
            const qx = Math.max(Math.abs(x - cx) - (half - 22), 0);
            const qy = y - 32;
            const d = Math.hypot(qx, qy) - 22;
            const pill = Math.min(1, Math.max(0, 0.5 - d));
            let r = 20,
                g = 18,
                b = 40,
                a = pill * 0.75;
            const dd = Math.hypot(x - 24, y - 32) - 7;
            const dotA = Math.min(1, Math.max(0, 0.5 - dd));
            r += (D[0] - r) * dotA;
            g += (D[1] - g) * dotA;
            b += (D[2] - b) * dotA;
            a = Math.max(a, dotA);
            const lx = x - 44;
            const ly = y - 12;
            if (lx >= 0 && ly >= 0 && lx < 200 && ly < 40) {
                const so = ((39 - ly) * 200 + lx) * 4;
                const ta = src[so + 3] / 255;
                r += (255 - r) * ta;
                g += (255 - g) * ta;
                b += (255 - b) * ta;
                a = Math.max(a, ta);
            }
            data.set([r, g, b, a * 255], ((h - 1 - y) * w + x) * 4);
        }
    label.dispose();
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}

/** Checkerboard texture (finish line, banners). */
export function checkerTexture(cellsX = 16, cellsY = 2, px = 16) {
    const w = cellsX * px;
    const h = cellsY * px;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const on = (Math.floor(x / px) + Math.floor(y / px)) % 2;
            const v = on ? [29, 26, 46] : [255, 255, 255];
            data.set([...v, 255], (y * w + x) * 4);
        }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
}

/** Soft round blob (shadows). */
export function blobTexture(size = 64) {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
            const a = d > 1 ? 0 : d < 0.6 ? 0.55 - d * 0.5 : 0.25 * (1 - (d - 0.6) / 0.4);
            data.set([20, 30, 40, Math.max(0, a) * 255], (y * size + x) * 4);
        }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}
