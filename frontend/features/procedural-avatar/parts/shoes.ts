import {
    Look,
    MeshBuilder,
    Rgb,
    localise,
    mixRgb,
    occlusion,
    rgb,
} from "../kernel/build";
import { meshField } from "../kernel/mesher";
import { smoothstep } from "../kernel/noise";
import {
    Vec3,
    capsule,
    displace,
    ellipsoid,
    field,
    halfSpace,
    roundCone,
    stretch,
} from "../kernel/sdf";
import type { Rig } from "../rig";

export interface ShoeStyle {
    leather: string;
    /** Colour of the highlights polished leather picks up. */
    shine: string;
    sole: string;
    lace: string;
    /** Sole thickness at the ball of the foot, in metres. */
    sole_height: number;
    /** 1 is a chunky lug sole, 0 a flat dress sole. */
    chunk: number;
    /** Overall size relative to the reference foot. */
    size: number;
}

/**
 * Lace-up derby shoes: a rounded toe, a low heel counter, a welted sole
 * with a separate heel, and laces over the tongue. One shoe is sculpted
 * and mirrored for the other foot.
 */
export function buildShoes(
    rig: Rig,
    style: ShoeStyle,
    detail = 1,
    look: Look = "painted"
) {
    const b = rig.body;
    const k = style.size;
    const x = b.foot[0];
    const az = b.foot[2];
    const h = style.sole_height;
    const heel = h + 0.006 + 0.004 * style.chunk;
    const welt = 0.003 + 0.0025 * style.chunk;
    const back = az - 0.074 * k;
    const toe = az + 0.178 * k;
    const ankle = b.foot[1];

    // The upper sits on the sole like a dome: every part is widest where
    // it meets the welt.
    const upper = field();
    upper.add(
        ellipsoid(
            [x + 0.002, h + 0.008 * k, az + 0.108 * k],
            [0.047 * k, 0.05 * k, 0.067 * k]
        )
    );
    upper.add(
        stretch(
            roundCone(
                [x + 0.002, h + 0.016 * k, az + 0.085 * k],
                [x, h + 0.03 * k, az - 0.014 * k],
                0.042 * k,
                0.038 * k
            ),
            [x, h, az],
            [1, 1.5, 1]
        ),
        0.02
    );
    upper.add(
        ellipsoid(
            [x, h + 0.02 * k, az - 0.032 * k],
            [0.038 * k, 0.074 * k, 0.04 * k]
        ),
        0.018
    );
    // Tongue and the raised facings the laces run through.
    upper.add(
        roundCone(
            [x, h + 0.064 * k, az + 0.062 * k],
            [x, ankle + 0.012, az + 0.016 * k],
            0.024 * k,
            0.027 * k
        ),
        0.012
    );
    for (const s of [1, -1])
        upper.add(
            roundCone(
                [x + s * 0.02 * k, h + 0.056 * k, az + 0.07 * k],
                [x + s * 0.027 * k, ankle + 0.004, az + 0.004],
                0.012 * k,
                0.013 * k
            ),
            0.008
        );
    upper.clip(halfSpace([0, h - 0.007, 0], [0, -1, 0]), 0.002);
    // The opening the leg comes out of.
    upper.carve(
        capsule(
            [x, ankle - 0.012, az - 0.012],
            [x, ankle + 0.2, az - 0.012],
            0.0335
        ),
        0.005
    );
    upper.clip(halfSpace([0, ankle + 0.016, 0], [0, 1, 0.12]), 0.004);

    // Sole: a plan-shaped slab with a stepped heel and a lugged edge.
    const slab = stretch(
        roundCone(
            [x, 0, back + 0.044 * k],
            [x + 0.003, 0, toe - 0.05 * k],
            0.039 * k + welt,
            0.048 * k + welt
        ),
        [x, 0, az],
        [1, 8, 1]
    );
    const lugs = (px: number, py: number, pz: number) =>
        py < h - 0.004
            ? style.chunk * 0.0016 * (Math.sin(pz * 150) > 0.2 ? 1 : -0.6)
            : 0;
    const sole = field()
        .add(style.chunk > 0 ? displace(slab, lugs, 0.002) : slab)
        .clip(halfSpace([0, h + 0.001, 0], [0, 1, 0]), 0.0025)
        .clip(halfSpace([0, 0, 0], [0, -1, 0]), 0.0015);
    // Lift the arch off the ground so the heel reads as a block.
    sole.carve(
        ellipsoid(
            [x, -0.004, az + 0.03 * k],
            [0.08, 0.008 + 0.006 * style.chunk, 0.03 * k]
        ),
        0.004
    );
    const heelBlock = field()
        .add(
            stretch(
                roundCone(
                    [x, 0, back + 0.044 * k],
                    [x, 0, az + 0.002],
                    0.039 * k + welt,
                    0.04 * k + welt
                ),
                [x, 0, az],
                [1, 8, 1]
            )
        )
        .clip(halfSpace([0, heel, 0], [0, 1, 0]), 0.002)
        .clip(halfSpace([0, 0, 0], [0, -1, 0]), 0.0015)
        .clip(halfSpace([0, 0, az + 0.004], [0, 0, 1]), 0.002);

    const shoe = field().add(upper).add(sole, 0.0015).add(heelBlock, 0.0015);
    const leather = rgb(style.leather);
    const shine = rgb(style.shine);
    const soleColour = rgb(style.sole);
    const local = localise(shoe, 0.03, 0.02);
    const light: Vec3 = [0.35, 0.8, 0.5];
    const paint = (p: Vec3, n: Vec3): Rgb => {
        const ao = occlusion(local(p[0], p[1], p[2]), p, n, 0.014, 3);
        if (p[1] < h + 0.0015 || (p[1] < heel + 0.001 && p[2] < az + 0.006)) {
            if (look === "studio") {
                one.auxNext[0] = ao;
                one.auxNext[3] = 0.12;
                return soleColour;
            }
            return mixRgb([0, 0, 0], soleColour, 0.5 + 0.5 * ao);
        }
        if (look === "studio") {
            // The shader supplies the polish; leave the leather plain.
            one.auxNext[0] = ao;
            one.auxNext[3] = 1;
            return leather;
        }
        // Polish: a broad sheen on top, a tight glint on the toe.
        const d = Math.max(
            0,
            (n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / 1.006
        );
        const gloss = 0.5 * Math.pow(d, 5) + 0.9 * Math.pow(d, 40);
        const rim =
            0.18 * Math.pow(1 - Math.abs(n[2]), 3) * smoothstep(0, 0.6, n[1]);
        const c = mixRgb([0, 0, 0], leather, 0.35 + 0.65 * ao);
        return [
            c[0] + shine[0] * (gloss + rim) * ao,
            c[1] + shine[1] * (gloss + rim) * ao,
            c[2] + shine[2] * (gloss + rim) * ao,
        ];
    };
    const one = new MeshBuilder();
    one.addRaw(
        meshField(shoe, {
            min: [x - 0.07 * k - welt, -0.004, back - 0.012],
            max: [x + 0.07 * k + welt, ankle + 0.03, toe + 0.012],
            cell: 0.0045 / detail,
        }),
        paint
    );
    // Laces: bars across the facings, and a bow.
    const lace = rgb(style.lace);
    const rows = 4;
    for (let i = 0; i < rows; i++) {
        const t = i / (rows - 1);
        const z = az + (0.066 - 0.05 * t) * k;
        const y = h + (0.064 + 0.02 * t) * k + (ankle - 0.066 - h) * 0.0;
        const lift = (px: number): Vec3 => {
            let py = y + 0.03;
            for (let n = 0; n < 30; n++) {
                const d = shoe.eval(px, py, z);
                if (d < 0.0012) break;
                py -= d * 0.8;
            }
            return [px, py, z];
        };
        const span = (0.019 + 0.006 * t) * k;
        const path: Vec3[] = [];
        for (let n = 0; n <= 6; n++)
            path.push(lift(x - span + (2 * span * n) / 6));
        one.tube(
            path,
            5,
            () => 0.0015,
            () => lace,
            { caps: true }
        );
        if (i > 0) {
            // The crossing down to the previous row.
            const z2 = az + (0.066 - (0.05 * (i - 1)) / (rows - 1)) * k;
            for (const s of [1, -1]) {
                const a = lift(x + s * span * 0.9);
                const c: Vec3 = [x - s * span * 0.8, a[1] - 0.004, z2];
                one.tube(
                    [a, [(a[0] + c[0]) / 2, a[1] + 0.001, (z + z2) / 2], c],
                    4,
                    () => 0.0012,
                    () => lace,
                    { caps: true }
                );
            }
        }
    }
    const knotZ = az + 0.014 * k;
    let knotY = ankle + 0.03;
    for (let n = 0; n < 30; n++) {
        const d = shoe.eval(x, knotY, knotZ + 0.004);
        if (d < 0.002) break;
        knotY -= d * 0.8;
    }
    for (const s of [1, -1]) {
        const loop: Vec3[] = [];
        for (let n = 0; n <= 8; n++) {
            const a = (n / 8) * Math.PI * 2;
            loop.push([
                x + s * (0.003 + 0.011 * (1 - Math.cos(a)) * 0.5) * k * 1.6,
                knotY + 0.0035 * Math.sin(a) + 0.001,
                knotZ + 0.004 + 0.006 * Math.sin(a) * 0.6,
            ]);
        }
        one.tube(
            loop,
            4,
            () => 0.0013,
            () => lace,
            { caps: false }
        );
        one.tube(
            [
                [x + s * 0.003, knotY, knotZ + 0.005],
                [x + s * 0.012 * k, knotY - 0.006, knotZ + 0.016],
                [x + s * 0.017 * k, knotY - 0.016, knotZ + 0.024],
            ],
            4,
            () => 0.0012,
            () => lace,
            { caps: true }
        );
    }
    const out = new MeshBuilder();
    out.append(one);
    out.append(one, true);
    return out;
}
