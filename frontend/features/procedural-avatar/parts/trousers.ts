import {
    MeshBuilder,
    Rgb,
    localise,
    mixRgb,
    occlusion,
    rgb,
    skyShade,
} from "../kernel/build";
import { meshField } from "../kernel/mesher";
import { fbm, noise3, smoothstep } from "../kernel/noise";
import { sheet } from "../kernel/sheet";
import {
    Shape,
    Vec3,
    displace,
    ellipsoid,
    field,
    halfSpace,
    offset,
    roundCone,
    stretch,
} from "../kernel/sdf";
import type { Rig } from "../rig";
import type { Waist } from "./shirt";

export interface TrouserStyle {
    kind: "trousers";
    cloth: string;
    shadow: string;
    /** Colour along the pressed creases. */
    edge: string;
    hemY: number;
    /** Half-width of a leg at the hem, side to side and front to back. */
    hem: [number, number];
    /** How far apart the legs hang at the hem, centre to centre. */
    stance: number;
    folds: number;
}

/**
 * Wide-leg pleated trousers: a high waist, a pleat and a pressed crease
 * down each leg, and a cropped open hem. Sculpted as one cloth field over
 * the body, like the shirt.
 */
export function buildTrousers(
    rig: Rig,
    body: Shape,
    waist: Waist,
    style: TrouserStyle,
    detail = 1
) {
    const b = rig.body;
    const cloth = rgb(style.cloth);
    const shadow = rgb(style.shadow);
    const edge = rgb(style.edge);
    const hipY = b.upperLeg[1];
    const crotch = hipY - 0.085;
    const [hx, hz] = style.hem;
    const legX = (y: number) => {
        const t = smoothstep(hipY, style.hemY, y);
        return (
            b.upperLeg[0] +
            0.012 +
            (style.stance / 2 - b.upperLeg[0] - 0.012) * t
        );
    };

    const smooth = field();
    // Seat and waist.
    smooth.add(
        stretch(
            roundCone(
                [0, waist.y + 0.005, waist.z],
                [0, hipY - 0.03, -0.006],
                waist.rx + 0.002,
                waist.rx + 0.03
            ),
            [0, hipY, 0],
            [1, 1, (waist.rz + 0.012) / waist.rx]
        )
    );
    for (const s of [1, -1]) {
        const top: Vec3 = [(b.upperLeg[0] + 0.012) * s, hipY - 0.01, -0.004];
        const knee: Vec3 = [legX(b.lowerLeg[1]) * s, b.lowerLeg[1], 0];
        const hem: Vec3 = [(style.stance / 2) * s, style.hemY + 0.02, 0.004];
        const k = hz / hx;
        smooth.add(
            stretch(
                roundCone(top, knee, hx * 0.86, hx * 0.93),
                [knee[0], 0, 0],
                [1, 1, k]
            ),
            0.04
        );
        smooth.add(
            stretch(
                roundCone(knee, hem, hx * 0.93, hx),
                [hem[0], 0, hem[2]],
                [1, 1, k]
            ),
            0.03
        );
    }
    // Between the legs the cloth parts below the rise.
    smooth.carve(
        stretch(
            roundCone(
                [0, crotch - 0.02, 0],
                [0, style.hemY - 0.1, 0],
                0.012,
                0.03
            ),
            [0, 0, 0],
            [1, 1, 6]
        ),
        0.03
    );

    const amplitude = 0.0055 * style.folds;
    const folds = (x: number, y: number, z: number) => {
        const side = x > 0 ? 1 : -1;
        const cx = legX(y) * side;
        const fall = smoothstep(waist.y - 0.02, style.hemY, y);
        // Pressed crease front and back: a sharp ridge down the leg's middle.
        const lateral = x - cx - 0.012 * side * (1 - fall);
        const crease =
            Math.exp(-((lateral / 0.007) ** 2)) *
            smoothstep(0.02, 0.12, fall) *
            (y < crotch + 0.12 ? 1 : 0.6);
        // The pleat: a tuck opening from the waistband towards the crease.
        const pleat =
            z > 0
                ? -Math.exp(-(((lateral + 0.012 * side) / 0.006) ** 2)) *
                  smoothstep(0.3, 0.02, fall) *
                  0.8
                : 0;
        // Soft lengthwise drape, and a little breaking at the knee.
        const drape =
            (fbm(x * 9, y * 2.2, z * 9 + 4, 2) - 0.5) * 1.3 +
            (1 - Math.abs(2 * noise3(x * 6 + 9, y * 3.5, z * 6) - 1) - 0.5) *
                0.5;
        return (
            (crease * 0.9 + pleat + drape * 0.7 * smoothstep(0.05, 0.3, fall)) *
            amplitude
        );
    };
    const garment = field().add(displace(smooth, folds, amplitude * 2.2));
    garment.add(
        field().add(offset(body, 0.007)).clip(offset(smooth, 0.006)),
        0.01
    );
    // The hems are cut flat; their undersides are painted as the dark
    // inside of the leg, which is all that is ever seen of it.
    garment.clip(halfSpace([0, style.hemY, 0], [0, -1, 0]));
    garment.clip(halfSpace([0, waist.y + 0.004, 0], [0, 1, 0]), 0.002);

    const local = localise(garment, 0.02, 0.03);
    const paint = (p: Vec3, n: Vec3): Rgb => {
        const near = local(p[0], p[1], p[2]);
        const open = occlusion(near, p, n, 0.028, 2);
        const tight = occlusion(near, p, n, 0.008, 1);
        const ao = Math.min(1, 0.45 * open + 0.55 * Math.min(open, tight));
        const side = p[0] > 0 ? 1 : -1;
        const fall = smoothstep(waist.y - 0.02, style.hemY, p[1]);
        const lateral = p[0] - legX(p[1]) * side - 0.012 * side * (1 - fall);
        // The crease catches light along its edge.
        const line =
            Math.exp(-((lateral / 0.004) ** 2)) * smoothstep(0.04, 0.14, fall);
        const inside = n[1] < -0.6 && p[1] < style.hemY + 0.02 ? 0.35 : 1;
        const weave = 0.9 + 0.2 * fbm(p[0] * 80, p[1] * 80, p[2] * 80, 2);
        const base = mixRgb(
            mixRgb(shadow, cloth, smoothstep(0.2, 0.95, ao)),
            edge,
            line * 0.5
        );
        const k = weave * inside * skyShade(n, 0.3);
        return [base[0] * k, base[1] * k, base[2] * k];
    };
    const mesh = new MeshBuilder();
    const reach = style.stance / 2 + hx + 0.03;
    mesh.addRaw(
        meshField(garment, {
            min: [-reach, style.hemY - 0.01, -hz - 0.08],
            max: [reach, waist.y + 0.012, hz + 0.08],
            cell: 0.0092 / detail,
        }),
        paint
    );
    // Welt pockets across the seat: two dark slits.
    for (const s of [1, -1])
        sheet(
            mesh,
            5,
            2,
            (u, v) => {
                const x = s * (0.045 + 0.075 * u);
                const y = waist.y - 0.075 - 0.008 * u - v * 0.005;
                let z = -0.3;
                for (let i = 0; i < 50; i++) {
                    const d = garment.eval(x, y, z) - 0.0012;
                    if (d < 0.0002) break;
                    z += d * 0.8;
                }
                return {
                    p: [x, y, z],
                    colour: [shadow[0] * 0.5, shadow[1] * 0.5, shadow[2] * 0.5],
                };
            },
            0.0012,
            s > 0
        );
    return { mesh, shape: garment as Shape };
}
