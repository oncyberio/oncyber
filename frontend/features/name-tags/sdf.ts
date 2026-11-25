/**
 * Signed distance fields from a glyph's coverage, for text that stays sharp
 * at any size in 3D. The glyph is drawn once by the browser (so it uses the
 * site's own font), then each texel stores how far it is from the outline.
 * The shader cuts at 0.5 and anti-aliases over one screen pixel, so a small
 * texture gives clean edges at every distance, in VR too.
 *
 * Exact Euclidean distance transform (Felzenszwalb and Huttenlocher), with
 * the sub-pixel edge estimate from anti-aliased coverage.
 */

const INF = 1e20;

/** 1D squared distance transform of `grid` in place, along one row or column. */
function edt1d(
    grid: Float64Array,
    offset: number,
    stride: number,
    length: number,
    f: Float64Array,
    v: Uint16Array,
    z: Float64Array
) {
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    f[0] = grid[offset];
    for (let q = 1, k = 0, s = 0; q < length; q++) {
        f[q] = grid[offset + q * stride];
        const q2 = q * q;
        do {
            const r = v[k];
            s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
        } while (s <= z[k] && --k > -1);
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
    }
    for (let q = 0, k = 0; q < length; q++) {
        while (z[k + 1] < q) k++;
        const r = v[k];
        const qr = q - r;
        grid[offset + q * stride] = f[r] + qr * qr;
    }
}

function edt(grid: Float64Array, width: number, height: number) {
    const size = Math.max(width, height);
    const f = new Float64Array(size);
    const v = new Uint16Array(size);
    const z = new Float64Array(size + 1);
    for (let x = 0; x < width; x++) edt1d(grid, x, width, height, f, v, z);
    for (let y = 0; y < height; y++) edt1d(grid, y * width, 1, width, f, v, z);
}

/**
 * Distance field of `alpha` (0 to 255 coverage, row major). Returns one byte
 * per texel: 128 on the outline, higher inside, lower outside, reaching 255
 * and 0 at `radius` texels from it.
 */
export function coverageToSdf(
    alpha: ArrayLike<number>,
    width: number,
    height: number,
    radius: number
) {
    const length = width * height;
    const outer = new Float64Array(length);
    const inner = new Float64Array(length);
    for (let i = 0; i < length; i++) {
        const a = alpha[i] / 255;
        if (a <= 0) {
            outer[i] = INF;
            inner[i] = 0;
        } else if (a >= 1) {
            outer[i] = 0;
            inner[i] = INF;
        } else {
            // Anti-aliased edge texel: the outline is about (0.5 - a) away.
            const d = 0.5 - a;
            outer[i] = d > 0 ? d * d : 0;
            inner[i] = d < 0 ? d * d : 0;
        }
    }
    edt(outer, width, height);
    edt(inner, width, height);
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        // Positive inside the glyph.
        const d = Math.sqrt(inner[i]) - Math.sqrt(outer[i]);
        const value = Math.round(128 + (127 * d) / radius);
        out[i] = value < 0 ? 0 : value > 255 ? 255 : value;
    }
    return out;
}
