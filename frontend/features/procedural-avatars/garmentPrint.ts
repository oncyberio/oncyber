import * as T from "three/webgpu";
import type { Section, XY } from "./drawing";

export type PrintPath = {
    color: string;
    outline: XY[];
    holes?: XY[][];
    rear?: boolean;
};
type Tile = [number, number, number, number];
const size = 512,
    atlasHeight = 736;
export const printTiles = {
    jersey: [0, 0, 512, 184],
    rightUpperArmSleeve: [0, 184, 256, 74],
    leftUpperArmSleeve: [256, 184, 256, 74],
    crosses: [0, 258, 256, 176],
    lettering: [256, 258, 256, 176],
    rightShort: [0, 434, 128, 78],
    leftShort: [128, 434, 128, 78],
    waist: [256, 434, 128, 78],
    rightSock: [384, 434, 32, 78],
    leftSock: [416, 434, 32, 78],
    rightCuff: [448, 434, 32, 78],
    leftCuff: [480, 434, 32, 78],
} satisfies Record<string, Tile>;
export type PrintName = keyof typeof printTiles;
const pixels = new Uint8Array(size * atlasHeight * 4);
const ready = new Set<PrintName>();
export const garmentInk = new T.DataTexture(pixels, size, atlasHeight);
garmentInk.userData.isShared = true;
garmentInk.colorSpace = T.SRGBColorSpace;
garmentInk.magFilter = T.LinearFilter;
garmentInk.minFilter = T.LinearMipmapLinearFilter;
garmentInk.generateMipmaps = true;
garmentInk.needsUpdate = true;

/** Even-odd scan conversion leaves counters in letters and gaps in silhouettes. */
function fill(rings: XY[][], color: string, [left, top, width, height]: Tile) {
    const rgb = Number.parseInt(color.slice(1), 16);
    const points = rings.flat();
    const low = Math.max(top, Math.floor(Math.min(...points.map((p) => p[1]))));
    const high = Math.min(
        top + height,
        Math.ceil(Math.max(...points.map((p) => p[1])))
    );
    for (let y = low; y < high; y++) {
        const hits: number[] = [];
        for (const ring of rings)
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const a = ring[j],
                    b = ring[i],
                    line = y + 0.5;
                if (a[1] > line !== b[1] > line)
                    hits.push(
                        a[0] + ((b[0] - a[0]) * (line - a[1])) / (b[1] - a[1])
                    );
            }
        hits.sort((a, b) => a - b);
        for (let i = 0; i + 1 < hits.length; i += 2) {
            const start = Math.max(left, Math.ceil(hits[i] - 0.5));
            const end = Math.min(left + width, Math.ceil(hits[i + 1] - 0.5));
            for (let x = start; x < end; x++) {
                const o = (y * size + x) * 4;
                pixels[o] = rgb >> 16;
                pixels[o + 1] = rgb >> 8;
                pixels[o + 2] = rgb;
                pixels[o + 3] = 255;
            }
        }
    }
}

/** Fit authored vector ink to the polar UV of the actual garment. The same
 * print tile serves every rig and every recolored instance of that garment. */
export function garmentMapping(
    name: PrintName,
    sections: Section[],
    horizontal: boolean,
    paths: () => PrintPath[],
    wearer: Section[] = sections
) {
    const tile = printTiles[name];
    const [left, top, width, height] = tile;
    const first = sections[0][0],
        span = sections[sections.length - 1][0] - first;
    if (!ready.has(name)) {
        for (const path of paths()) {
            const rings = [path.outline, ...(path.holes ?? [])].map((ring) => {
                const result: XY[] = [];
                for (let i = 0; i < ring.length; i++) {
                    const a = ring[i],
                        b = ring[(i + 1) % ring.length];
                    const steps = Math.max(
                        1,
                        Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4)
                    );
                    for (let k = 0; k < steps; k++) {
                        const x = T.MathUtils.lerp(a[0], b[0], k / steps),
                            y = T.MathUtils.lerp(a[1], b[1], k / steps);
                        const along = horizontal ? x : y,
                            across = horizontal ? y : x;
                        let j = 1;
                        while (
                            j < sections.length - 1 &&
                            sections[j][0] < along
                        )
                            j++;
                        const l = sections[j - 1],
                            r = sections[j],
                            f = T.MathUtils.clamp(
                                (along - l[0]) / (r[0] - l[0]),
                                0,
                                1
                            );
                        const lo = T.MathUtils.lerp(l[1], r[1], f),
                            hi = T.MathUtils.lerp(l[2], r[2], f);
                        const angle = Math.asin(
                            T.MathUtils.clamp(
                                (2 * across - lo - hi) /
                                    Math.max(0.01, hi - lo),
                                -1,
                                1
                            )
                        );
                        const u =
                            (path.rear ? Math.PI - angle : angle) /
                            (2 * Math.PI);
                        result.push([
                            left + 1.5 + u * (width - 3),
                            top + 1.5 + ((along - first) / span) * (height - 3),
                        ]);
                    }
                }
                return result;
            });
            fill(rings, path.color, tile);
            if (!path.rear)
                fill(
                    rings.map((r) => r.map(([x, y]): XY => [x + width - 3, y])),
                    path.color,
                    tile
                );
        }
        garmentInk.needsUpdate = true;
        ready.add(name);
    }
    const start = wearer[0][0],
        length = wearer[wearer.length - 1][0] - start;
    return (x: number, y: number, angle: number): XY => [
        4 + (left + 1.5 + angle * (width - 3)) / size,
        (top + 1.5 + (((horizontal ? x : y) - start) / length) * (height - 3)) /
            atlasHeight,
    ];
}

// Planar projection is only bound to the visible relief of the eyes and mouth.
// Each shape keeps its silhouette and shading while tiny ink islands cost no triangles.
const portraits = {
    rick: { tile: [0, 512, 176, 192], bounds: [598, 23, 700, 164] },
    morty: { tile: [176, 512, 174, 192], bounds: [80, 209, 205, 332] },
    summer: { tile: [350, 512, 162, 192], bounds: [334, 145, 425, 271] },
} as const;
const drawn = new Set<string>();
export function portraitInk(id: keyof typeof portraits) {
    const { tile, bounds } = portraits[id],
        [left, top, w, h] = tile,
        [x0, y0, x1, y1] = bounds;
    const project = (x: number, y: number): XY => [
        left + 2 + ((x - x0) / (x1 - x0)) * (w - 4),
        top + 2 + ((y - y0) / (y1 - y0)) * (h - 4),
    ];
    return {
        uv(x: number, y: number): XY {
            const [u, v] = project(x, y);
            return [
                6 + T.MathUtils.clamp(u, left + 0.5, left + w - 0.5) / size,
                T.MathUtils.clamp(v, top + 0.5, top + h - 0.5) / atlasHeight,
            ];
        },
        polygon(points: XY[], color: string, holes: XY[][] = []) {
            if (!drawn.has(id))
                fill(
                    [points, ...holes].map((r) =>
                        r.map(([x, y]) => project(x, y))
                    ),
                    color,
                    [...tile]
                );
        },
        finish() {
            if (!drawn.has(id)) {
                drawn.add(id);
                garmentInk.needsUpdate = true;
            }
        },
    };
}

const bandTiles = {
    armor: [0, 704, 144, 32],
    lens: [144, 704, 96, 32],
    barrel: [240, 704, 144, 32],
    vest: [384, 704, 128, 32],
} satisfies Record<string, Tile>;
const bands = new Set<string>();
/** Small shared pigment strips for repeating bands and hardware. */
export function paintStrip(
    name: keyof typeof bandTiles,
    sample: (u: number, v: number) => string | undefined
) {
    const [x, y, w, h] = bandTiles[name];
    if (!bands.has(name)) {
        for (let j = 0; j < h; j++)
            for (let i = 0; i < w; i++) {
                const shade = sample((i + 0.5) / w, (j + 0.5) / h);
                if (shade) {
                    const rgb = parseInt(shade.slice(1), 16),
                        k = 4 * ((y + j) * size + x + i);
                    pixels[k] = rgb >> 16;
                    pixels[k + 1] = rgb >> 8;
                    pixels[k + 2] = rgb;
                    pixels[k + 3] = 255;
                }
            }
        bands.add(name);
        garmentInk.needsUpdate = true;
    }
    return (u: number, v = 0.5): XY => [
        6 + (x + 0.5 + T.MathUtils.clamp(u, 0, 1) * (w - 1)) / size,
        (y + 0.5 + T.MathUtils.clamp(v, 0, 1) * (h - 1)) / atlasHeight,
    ];
}
