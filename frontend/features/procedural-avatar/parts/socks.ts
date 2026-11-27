import { MeshBuilder, Rgb, mixRgb, rgb } from "../kernel/build";
import { noise3, smoothstep } from "../kernel/noise";
import type { Shape } from "../kernel/sdf";
import type { Rig } from "../rig";

export interface SockStyle {
    colour: string;
    shadow: string;
    /** Height of the top edge above the ground, in metres. */
    top: number;
    /** 0 pulled up straight, 1 bunched down the calf. */
    slouch: number;
    ribs: number;
    thickness: number;
}

/**
 * Ribbed socks. Each ring is fitted to the leg by tracing the body's
 * surface, then thickened; slouch adds rolls that settle towards the ankle.
 */
export function buildSocks(rig: Rig, body: Shape, style: SockStyle) {
    const out = new MeshBuilder();
    const colour = rgb(style.colour);
    const shadow = rgb(style.shadow);
    const b = rig.body;
    const bottom = b.foot[1] - 0.03;
    const columns = style.ribs * 3;
    const rows = Math.max(14, Math.round((style.top - bottom) / 0.0075));
    for (const s of [1, -1]) {
        const axis = (y: number): [number, number] => {
            const t = (y - b.foot[1]) / (b.lowerLeg[1] - b.foot[1]);
            return [
                (b.foot[0] + (b.lowerLeg[0] - b.foot[0]) * t) * s,
                b.foot[2] + (b.lowerLeg[2] - b.foot[2]) * t - 0.004 * (1 - t),
            ];
        };
        const legRadius = (y: number, angle: number) => {
            const [cx, cz] = axis(y);
            const dx = Math.sin(angle);
            const dz = Math.cos(angle);
            let r = 0.11;
            for (let i = 0; i < 24; i++) {
                const d = body.eval(cx + dx * r, y, cz + dz * r);
                if (d < 0.0003) break;
                r -= d * 0.85;
            }
            return r;
        };
        const phase = s * 1.7;
        out.grid(
            rows + 3,
            columns,
            true,
            (row, column) => {
                // The last rows fold over the top edge and back down inside.
                const inside = row > rows;
                const v = Math.min(1, row / rows);
                const y =
                    bottom +
                    (style.top - bottom) * v -
                    (inside ? (row - rows) * 0.004 : 0);
                const angle = (column / columns) * Math.PI * 2;
                const rib = Math.cos(angle * style.ribs);
                // Rolls: broad, uneven, heavier low on the leg.
                const roll =
                    style.slouch *
                    (0.0075 *
                        Math.pow(
                            0.5 +
                                0.5 *
                                    Math.sin(
                                        v * 19 +
                                            phase +
                                            2.4 *
                                                noise3(
                                                    Math.cos(angle) * 1.2,
                                                    v * 3,
                                                    Math.sin(angle) * 1.2 +
                                                        phase
                                                )
                                    ),
                            1.6
                        ) *
                        smoothstep(0.02, 0.3, v) *
                        (1.15 - 0.55 * v) +
                        0.004 * smoothstep(0.05, 0.4, v) * (1 - v));
                const cuff = smoothstep(0.86, 0.93, v) * 0.0012;
                const r =
                    legRadius(y, angle) +
                    (inside
                        ? -0.0002
                        : style.thickness + roll + cuff + rib * 0.00075);
                const [cx, cz] = axis(y);
                const groove = 0.86 + 0.14 * smoothstep(-0.9, 0.4, rib);
                const fold =
                    style.slouch > 0
                        ? 0.72 +
                          0.28 *
                              smoothstep(
                                  0.0,
                                  0.006 * style.slouch,
                                  roll -
                                      0.004 *
                                          style.slouch *
                                          smoothstep(0.05, 0.4, v) *
                                          (1 - v)
                              )
                        : 1;
                const lit = Math.min(1, groove * fold);
                const c: Rgb = inside
                    ? shadow
                    : mixRgb(shadow, colour, smoothstep(0.55, 1, lit));
                return {
                    p: [cx + Math.sin(angle) * r, y, cz + Math.cos(angle) * r],
                    color: c,
                };
            },
            false
        );
    }
    return out;
}
