import { localise, rgb } from "../kernel/build";
import { smoothstep } from "../kernel/noise";
import { FACE_UV } from "../parts/skin";
import { SkinField, lidFrame, lipShapes } from "../parts/skinField";
import { Hairline, hairlineDepth } from "../parts/hair";
import { fbm } from "../kernel/noise";

export interface FacePaint {
    lip: string;
    lipLine: string;
    /** Cheek and nose flush: colour and strength 0..1. */
    blush: string;
    blushStrength: number;
    /** Hatched strokes across the cheeks, 0..1. */
    hatch: number;
    /** Soft shadow around the eyes. */
    eyeShade: string;
    eyeShadeStrength: number;
    freckle: string;
    /** How many freckles, 0..1. */
    freckles: number;
}

export interface PaintedTexture {
    data: Uint8Array;
    width: number;
    height: number;
}

const toSrgb = (c: number) =>
    c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

const SRGB = new Uint8Array(1025);
for (let i = 0; i <= 1024; i++) SRGB[i] = Math.round(toSrgb(i / 1024) * 255);
const encode = (c: number) =>
    SRGB[Math.round(Math.min(1, Math.max(0, c)) * 1024)];

function hash2(x: number, y: number) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Paint the face as a tint over the skin: lips, flush, shadow, freckles.
 *
 * The texture is laid out by angle round the head and height (see
 * `faceUv`), one half of the face mirrored onto the other. Each texel is
 * traced onto the sculpted surface first, so paint is placed in 3D: lip
 * colour follows the sculpted lips, and the lid crease follows the eyelid.
 */
export function paintFace(
    skin: SkinField,
    paint: FacePaint,
    skinBase: string,
    /** Paints the roots along the hairline so hair grows out of the skin. */
    hair?: { line: Hairline; colour: string },
    width = 384,
    height = 768
): PaintedTexture {
    const face = skin.face;
    const local = localise(skin.head, 0.02, 0.03);
    // A coarse map of where each texel lands on the head.
    const gu = 72;
    const gv = 132;
    const grid = new Float32Array((gu + 1) * (gv + 1));
    for (let j = 0; j <= gv; j++) {
        const y = FACE_UV.minY + (j / gv) * (FACE_UV.maxY - FACE_UV.minY);
        for (let i = 0; i <= gu; i++) {
            const angle = (i / gu) * FACE_UV.maxAngle;
            const sx = Math.sin(angle);
            const sz = Math.cos(angle);
            let rho = 0.15;
            for (let step = 0; step < 40; step++) {
                const x = sx * rho;
                const z = FACE_UV.axisZ + sz * rho;
                const d = local(x, y, z).eval(x, y, z);
                if (d < 0.0001) break;
                rho -= d * 0.9;
                if (rho < 0.02) break;
            }
            grid[i + j * (gu + 1)] = rho;
        }
    }

    const base = rgb(skinBase);
    const tint = (hex: string) => {
        const c = rgb(hex);
        return [
            Math.min(1, c[0] / base[0]),
            Math.min(1, c[1] / base[1]),
            Math.min(1, c[2] / base[2]),
        ];
    };
    const lip = tint(paint.lip);
    const lipLine = tint(paint.lipLine);
    const blush = tint(paint.blush);
    const eyeShade = tint(paint.eyeShade);
    const freckle = tint(paint.freckle);
    const roots = hair ? tint(hair.colour).map((c) => c * 0.75) : undefined;
    const lips = lipShapes(face);
    const upperLid = lidFrame(face, 1, true);
    const eye = face.eye;
    const tip = face.noseTip;
    const my = face.mouthY;

    const data = new Uint8Array(width * height * 4);
    const colour = [1, 1, 1];
    const apply = (c: number[], amount: number) => {
        if (amount <= 0) return;
        const a = Math.min(1, amount);
        colour[0] *= 1 + (c[0] - 1) * a;
        colour[1] *= 1 + (c[1] - 1) * a;
        colour[2] *= 1 + (c[2] - 1) * a;
    };
    for (let py = 0; py < height; py++) {
        const v = (py + 0.5) / height;
        const y = FACE_UV.minY + v * (FACE_UV.maxY - FACE_UV.minY);
        const gy = Math.min(gv - 1e-4, v * gv);
        const j = Math.floor(gy);
        const fy = gy - j;
        for (let px = 0; px < width; px++) {
            const at = (px + py * width) * 4;
            data[at] = data[at + 1] = data[at + 2] = data[at + 3] = 255;
            const u = (px + 0.5) / width;
            const gx = Math.min(gu - 1e-4, u * gu);
            const i = Math.floor(gx);
            const fx = gx - i;
            const k = i + j * (gu + 1);
            const rho =
                (grid[k] * (1 - fx) + grid[k + 1] * fx) * (1 - fy) +
                (grid[k + gu + 1] * (1 - fx) + grid[k + gu + 2] * fx) * fy;
            const angle = u * FACE_UV.maxAngle;
            const x = Math.sin(angle) * rho;
            const z = FACE_UV.axisZ + Math.cos(angle) * rho;
            colour[0] = colour[1] = colour[2] = 1;

            // Flush across cheeks and nose, with a few hatched strokes.
            if (y < eye[1] + 0.012) {
                const cheek =
                    x < 0.085
                        ? Math.exp(
                              -(
                                  ((x - 0.037) / 0.019) ** 2 +
                                  ((y - (eye[1] - 0.031)) / 0.0125) ** 2
                              )
                          )
                        : 0;
                const nose =
                    x < 0.03
                        ? Math.exp(
                              -(
                                  (x / 0.0105) ** 2 +
                                  ((y - (tip[1] + 0.004)) / 0.0105) ** 2
                              )
                          )
                        : 0;
                const chin =
                    x < 0.03
                        ? 0.3 *
                          Math.exp(
                              -(
                                  (x / 0.012) ** 2 +
                                  ((y - face.chinY - 0.006) / 0.008) ** 2
                              )
                          )
                        : 0;
                let earFlush = 0;
                if (x > 0.05) {
                    const earD = Math.hypot(
                        x - face.ear[0],
                        y - face.ear[1] + 0.005,
                        z - face.ear[2]
                    );
                    earFlush = 0.55 * smoothstep(0.03, 0.012, earD);
                }
                let flush = Math.max(cheek * 0.95, nose * 0.8, chin, earFlush);
                if (paint.hatch > 0 && cheek > 0.25) {
                    const stroke = Math.sin((x * 0.82 + y * 0.57) * 2300);
                    flush +=
                        paint.hatch *
                        cheek *
                        smoothstep(0.55, 0.95, stroke) *
                        0.6;
                }
                if (flush > 0.004) apply(blush, flush * paint.blushStrength);
            }

            // Shadow in the eye socket and a crease above the lid.
            const ex = x - eye[0];
            const ey = y - eye[1];
            const ez = z - eye[2];
            if (Math.abs(ex) < 0.05 && Math.abs(ey - 0.009) < 0.02) {
                const socket = Math.exp(
                    -((ex / 0.022) ** 2 + ((ey - 0.009) / 0.008) ** 2)
                );
                apply(eyeShade, socket * paint.eyeShadeStrength);
            }
            const er =
                Math.abs(ex) < 0.03 && Math.abs(ey) < 0.03
                    ? Math.hypot(ex, ey, ez)
                    : 1;
            if (er < face.lidRadius + 0.004 && er > 0.001) {
                // Elevation above the lid edge, measured round the eyeball.
                const up =
                    -(
                        ex * upperLid.normal[0] +
                        ey * upperLid.normal[1] +
                        ez * upperLid.normal[2]
                    ) / er;
                const side =
                    (ex * upperLid.across[0] +
                        ey * upperLid.across[1] +
                        ez * upperLid.across[2]) /
                    er;
                const crease =
                    smoothstep(
                        0.075,
                        0.03,
                        Math.abs(up - 0.4 + 0.12 * side * side)
                    ) * smoothstep(0.92, 0.6, Math.abs(side));
                apply(eyeShade, crease * 0.75);
                // The lid itself sits a touch darker, like a wash of shadow.
                apply(
                    eyeShade,
                    smoothstep(0, 0.12, up) * smoothstep(0.5, 0.32, up) * 0.5
                );
            }

            // Lips: colour from the sculpted lip shapes, darker along the parting.
            if (
                Math.abs(y - my) < 0.016 &&
                x < face.mouthWidth + 0.006 &&
                z > 0.05
            ) {
                const dUpper = Math.min(
                    lips[0].eval(x, y, z),
                    lips[1].eval(x, y, z)
                );
                const dLower = lips[2].eval(x, y, z);
                const d = Math.min(dUpper, dLower);
                const fade = smoothstep(
                    face.mouthWidth + 0.0015,
                    face.mouthWidth - 0.004,
                    x
                );
                const mask = smoothstep(0.0011, -0.0002, d) * fade;
                const upperness = dUpper < dLower ? 1 : 0;
                apply(lip, mask * (0.78 + 0.16 * upperness));
                // Fuller in the middle of the lower lip: let more skin through.
                const sag = 0.0009 * (x / face.mouthWidth) ** 2;
                const line = Math.abs(y - (my - 0.0003 - sag));
                apply(
                    lipLine,
                    smoothstep(0.00075, 0.00015, line) *
                        smoothstep(
                            face.mouthWidth + 0.0012,
                            face.mouthWidth - 0.002,
                            x
                        ) *
                        0.9
                );
            }

            // Freckles over the nose and cheeks.
            if (paint.freckles > 0) {
                const zone =
                    Math.exp(
                        -(
                            (x / 0.05) ** 2 +
                            ((y - (eye[1] - 0.024)) / 0.013) ** 2
                        )
                    ) * smoothstep(0.03, 0.06, z);
                if (zone > 0.2) {
                    const size = 0.0026;
                    const cx = Math.floor(x / size);
                    const cy = Math.floor(y / size);
                    const r = hash2(cx, cy);
                    if (r < paint.freckles * zone) {
                        const fx2 =
                            (cx + 0.25 + 0.5 * hash2(cx + 91, cy)) * size;
                        const fy2 =
                            (cy + 0.25 + 0.5 * hash2(cx, cy + 57)) * size;
                        const fr = 0.00028 + 0.00035 * hash2(cx + 13, cy + 7);
                        apply(
                            freckle,
                            smoothstep(
                                fr,
                                fr * 0.45,
                                Math.hypot(x - fx2, y - fy2)
                            ) * 0.7
                        );
                    }
                }
            }

            // Roots: the skin darkens into hair along a ragged edge, with fine
            // streaks running the way the hair is combed.
            if (roots) {
                const depth = hairlineDepth(hair.line, [x, y, z]);
                if (depth > 0.014) apply(roots, 1);
                else if (depth > -0.013) {
                    const ragged =
                        (fbm(angle * 260, y * 30, 3.1, 2) - 0.5) * 0.012 +
                        (fbm(angle * 40, y * 60, 7.7, 2) - 0.5) * 0.006;
                    apply(roots, smoothstep(-0.0035, 0.0045, depth + ragged));
                    apply(roots, smoothstep(-0.012, 0.002, depth) * 0.16);
                }
            }

            if (colour[0] === 1 && colour[1] === 1 && colour[2] === 1) continue;
            data[at] = encode(colour[0]);
            data[at + 1] = encode(colour[1]);
            data[at + 2] = encode(colour[2]);
        }
    }
    return { data, width, height };
}
