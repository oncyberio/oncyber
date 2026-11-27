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
    Field,
    Shape,
    Vec3,
    capsule,
    displace,
    offset,
    ellipsoid,
    field,
    halfSpace,
    roundCone,
    sphere,
    stretch,
} from "../kernel/sdf";
import type { Rig } from "../rig";

/** Where trousers or a skirt close round the body; the shirt tucks in here. */
export interface Waist {
    /** Top of the waistband. */
    y: number;
    /** Half-width and half-depth at the waistband. */
    rx: number;
    rz: number;
    /** Centre of the waistband front to back. */
    z: number;
}

export interface ShirtStyle {
    cloth: string;
    /** The colour cloth takes in its folds. */
    shadow: string;
    button: string;
    /** Extra room around the body, in metres. */
    ease: number;
    /** How much of the forearm the sleeve covers: 1 reaches the wrist. */
    sleeve: number;
    /** A rolled, pushed-up cuff rather than a buttoned one. */
    rolled: boolean;
    /** Depth of the folds, 1 is the reference. */
    folds: number;
    /** How far the collar is undone: 0 buttoned to the top, 1 loose. */
    open: number;
    /** A patch pocket on the left chest. */
    pocket: boolean;
    /** How far the cloth pouches out over the waistband: 0 neat, 1 loose. */
    blouse: number;
}

export interface ShirtParts {
    mesh: MeshBuilder;
    /** The cloth as a shape, for things worn over it. */
    shape: Shape;
    /** Design-pose points other parts hang from. */
    anchors: {
        /** Where a tie's knot sits. */
        knot: Vec3;
        /** Top centre of the chest pocket, or where one would be. */
        pocket: Vec3;
        collarY: number;
    };
}

const along = (p: Vec3, a: Vec3, d: Vec3) =>
    (p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2];

/** March a point back along -Z onto a shape's surface. */
export function ontoFront(
    shape: Shape,
    x: number,
    y: number,
    lift = 0,
    from = 0.3
): Vec3 {
    let z = from;
    for (let i = 0; i < 60; i++) {
        const d = shape.eval(x, y, z) - lift;
        if (d < 0.0002) break;
        z -= d * 0.8;
    }
    return [x, y, z];
}

/**
 * A woven shirt worn loose: an oversized body bloused over the waistband,
 * dropped shoulders, roomy sleeves that bunch along the arm, a collar,
 * placket, buttons and pocket.
 *
 * The cloth is one distance field: a smooth garment shape pushed in and out
 * by a fold function, so creases are real geometry and shade themselves.
 */
export function buildShirt(
    rig: Rig,
    body: Shape,
    waist: Waist,
    style: ShirtStyle,
    detail = 1
): ShirtParts {
    const b = rig.body;
    const sy = b.upperArm[1];
    const sx = b.upperArm[0];
    const ease = style.ease;
    const cloth = rgb(style.cloth);
    const shadow = rgb(style.shadow);

    const arms = (["left", "right"] as const).map((side) => {
        const s = side === "left" ? 1 : -1;
        const upper = rig.joint(`${side}UpperArm`);
        const elbow = rig.joint(`${side}LowerArm`);
        const wrist = rig.joint(`${side}Hand`);
        const forearm = b.hand[0] - b.lowerArm[0];
        const cuffAt = forearm * style.sleeve - (style.rolled ? 0 : 0.012);
        const cuff = rig.at(`${side}LowerArm`, [cuffAt * s, 0, 0]);
        const dUpper = rig.direction(`${side}UpperArm`, [s, 0, 0]);
        const dLower = rig.direction(`${side}LowerArm`, [s, 0, 0]);
        return {
            side,
            s,
            upper,
            elbow,
            wrist,
            cuff,
            cuffAt,
            dUpper,
            dLower,
            forearm,
        };
    });

    // The garment, smooth. Cloth hangs: sleeves rest on top of the arm and
    // carry their slack underneath.
    const smooth = field();
    const chestRx = sx + 0.004 + ease * 0.85;
    const chestRz = 0.09 + ease * 0.8;
    smooth.add(ellipsoid([0, sy - 0.15, -0.004], [chestRx, 0.175, chestRz]));
    smooth.add(
        ellipsoid(
            [0, waist.y + 0.075, waist.z + 0.004],
            [
                waist.rx + 0.004 + (0.012 + ease) * style.blouse,
                0.085,
                waist.rz + 0.004 + (0.01 + ease) * style.blouse,
            ]
        ),
        0.06
    );
    // The yoke follows the slope of the shoulders out from the neck.
    for (const s of [1, -1])
        smooth.add(
            roundCone(
                [0.03 * s, sy + 0.016, -0.016],
                [(sx + 0.012 + ease * 0.3) * s, sy - 0.002, -0.014],
                0.04,
                0.048
            ),
            0.045
        );
    // Tucked: the cloth gathers into the waistband and ends below it.
    smooth.add(
        stretch(
            roundCone(
                [0, waist.y + 0.03, waist.z],
                [0, waist.y - 0.05, waist.z],
                waist.rx + 0.012,
                waist.rx - 0.014
            ),
            [0, waist.y, waist.z],
            [1, 1, waist.rz / waist.rx]
        ),
        0.035
    );
    const sag = (p: Vec3, radius: number): Vec3 => [
        p[0],
        p[1] - Math.max(0, radius - 0.04),
        p[2],
    ];
    for (const arm of arms) {
        const r0 = 0.041 + ease * 0.5;
        const r1 = 0.04 + ease * 0.55;
        const r2 = style.rolled ? 0.041 + ease * 0.2 : 0.031 + ease * 0.12;
        const head: Vec3 = [
            arm.upper[0] + arm.dUpper[0] * 0.03,
            arm.upper[1] + arm.dUpper[1] * 0.03,
            arm.upper[2],
        ];
        smooth.add(
            sphere(
                [arm.upper[0], arm.upper[1] + 0.002, arm.upper[2]],
                0.046 + ease * 0.25
            ),
            0.04
        );
        smooth.add(roundCone(sag(head, r0), sag(arm.elbow, r1), r0, r1), 0.045);
        smooth.add(
            roundCone(sag(arm.elbow, r1), sag(arm.cuff, r2), r1, r2),
            0.03
        );
        if (style.rolled) {
            // Cloth pushed up the arm piles above the cuff.
            const pile: Vec3 = [
                arm.cuff[0] - arm.dLower[0] * 0.055,
                arm.cuff[1] - arm.dLower[1] * 0.055,
                arm.cuff[2] - arm.dLower[2] * 0.055,
            ];
            smooth.add(sphere(sag(pile, r1 + 0.004), r1 + 0.004), 0.03);
        }
    }

    // Folds: creases across the arms where the sleeve bunches, long soft
    // drape on the body, and gathers fanning up from the waistband.
    const amplitude = 0.0058 * style.folds;
    const ridged = (n: number) => 1 - Math.abs(2 * n - 1);
    const folds = (x: number, y: number, z: number) => {
        const p: Vec3 = [x, y, z];
        let out = 0;
        let onArm = 0;
        for (const arm of arms) {
            if (x * arm.s < 0.04) continue;
            const su = along(p, arm.upper, arm.dUpper);
            const sl = along(p, arm.elbow, arm.dLower);
            const upperLength = b.lowerArm[0] - b.upperArm[0];
            const t = Math.min(upperLength, Math.max(0, su));
            const ax = arm.upper[0] + arm.dUpper[0] * t;
            const ay = arm.upper[1] + arm.dUpper[1] * t;
            const az = arm.upper[2] + arm.dUpper[2] * t;
            const dUp = Math.hypot(x - ax, y - ay, z - az);
            const t2 = Math.min(arm.cuffAt, Math.max(0, sl));
            const bx = arm.elbow[0] + arm.dLower[0] * t2;
            const by = arm.elbow[1] + arm.dLower[1] * t2;
            const bz = arm.elbow[2] + arm.dLower[2] * t2;
            const dLow = Math.hypot(x - bx, y - by, z - bz);
            const near = smoothstep(0.14, 0.085, Math.min(dUp, dLow));
            if (near <= 0) continue;
            const lower = sl > 0;
            const s = lower ? upperLength + sl : su;
            const total = upperLength + arm.cuffAt;
            // Coordinates round the arm, so creases can run across it.
            const rx = lower ? x - bx : x - ax;
            const ry = lower ? y - by : y - ay;
            const rz = lower ? z - bz : z - az;
            const tightness = style.rolled ? 1 : 0.75;
            const a = noise3(
                s * 46 * tightness + rz * 11,
                rx * 8 + 3,
                ry * 8 + rz * 8
            );
            const c = noise3(
                s * 21 * tightness + 11 + ry * 9,
                rx * 6,
                rz * 6 + 5
            );
            const crease = (ridged(a) - 0.55) * 1.3 + (ridged(c) - 0.5) * 0.9;
            const envelope =
                smoothstep(0.02, 0.1, s) *
                (0.5 + 0.7 * smoothstep(0.08, total, s)) *
                smoothstep(total + 0.004, total - 0.025, s);
            out += crease * envelope * near;
            onArm = Math.max(onArm, near * smoothstep(0.0, 0.08, s));
        }
        const bodyPart = 1 - onArm;
        if (bodyPart > 0) {
            // Long soft folds falling from the shoulders and chest.
            const drape =
                (ridged(noise3(x * 9 + 3, y * 2.8, z * 9)) - 0.5) * 0.9 +
                (fbm(x * 5, y * 4 + 7, z * 5, 2) - 0.5) * 1.1;
            // Gathers: pleats round the waist that fade as they rise.
            const angle = Math.atan2(x, z);
            const gather =
                Math.sin(angle * 17 + noise3(x * 6, y * 9, z * 6) * 5) *
                smoothstep(waist.y + 0.14, waist.y + 0.03, y);
            // Everything lies flat where the waistband holds it.
            const held = smoothstep(waist.y - 0.012, waist.y + 0.03, y);
            out += (drape * 0.75 + gather * 0.6) * bodyPart * held;
        }
        return out * amplitude;
    };
    const garment = field().add(displace(smooth, folds, amplitude * 2));
    // Wherever the wearer would show through, the cloth lies on the body.
    garment.add(
        field().add(offset(body, 0.0075)).clip(offset(smooth, 0.006)),
        0.012
    );

    // Openings: neck and cuffs. Below the waistband the cloth just ends.
    // The neck hole is cut wide and clean; the collar's band and leaves
    // sit over its edge.
    const neckR = 0.046 + ease * 0.1;
    const neckline = roundCone(
        [0, sy - 0.004, -0.01],
        [0, sy + 0.14, 0.002],
        neckR + 0.004 + 0.009 * style.open,
        neckR + 0.011 + 0.009 * style.open
    );
    garment.carve(neckline, 0.006);
    for (const arm of arms) {
        const from: Vec3 = [
            arm.cuff[0] - arm.dLower[0] * 0.03,
            arm.cuff[1] - arm.dLower[1] * 0.03,
            arm.cuff[2] - arm.dLower[2] * 0.03,
        ];
        const to: Vec3 = [
            arm.cuff[0] + arm.dLower[0] * 0.1,
            arm.cuff[1] + arm.dLower[1] * 0.1,
            arm.cuff[2] + arm.dLower[2] * 0.1,
        ];
        garment.carve(capsule(from, to, style.rolled ? 0.036 : 0.029), 0.003);
        // End the sleeve in a clean cut, just inside its cuff band.
        garment.clip(
            halfSpace(
                [
                    arm.cuff[0] - arm.dLower[0] * 0.008,
                    arm.cuff[1] - arm.dLower[1] * 0.008,
                    arm.cuff[2] - arm.dLower[2] * 0.008,
                ],
                arm.dLower
            ),
            0.002
        );
    }
    garment.clip(halfSpace([0, waist.y - 0.02, 0], [0, -1, 0]));

    const local = localise(garment, 0.016, 0.027);
    const paint = (p: Vec3, n: Vec3): Rgb => {
        const near = local(p[0], p[1], p[2]);
        const open = occlusion(near, p, n, 0.026, 2);
        const tight = occlusion(near, p, n, 0.008, 1);
        const ao = Math.min(1, 0.45 * open + 0.55 * Math.min(open, tight));
        // A woven, slightly uneven surface.
        const weave = 0.965 + 0.07 * fbm(p[0] * 55, p[1] * 55, p[2] * 55, 2);
        // The collar shades the cloth it lies on.
        const round = Math.hypot(p[0], p[2] + 0.01);
        const under =
            p[1] > sy - 0.07
                ? 0.5 +
                  0.5 *
                      smoothstep(
                          0.075,
                          0.118,
                          round + (sy + 0.03 - p[1]) * 0.35
                      )
                : 1;
        const lit = mixRgb(shadow, cloth, smoothstep(0.3, 1, ao) * under);
        const sky = skyShade(n, 0.3);
        const k = weave * (0.8 + 0.2 * under);
        // Shade leans towards the shadow colour rather than plain grey.
        return [
            lit[0] * k * (sky + (1 - sky) * shadow[0]),
            lit[1] * k * (sky + (1 - sky) * shadow[1]),
            lit[2] * k * (sky + (1 - sky) * shadow[2]),
        ];
    };

    const mesh = new MeshBuilder();
    const reach = Math.max(...arms.map((arm) => Math.abs(arm.cuff[0]))) + 0.09;
    const lowest = Math.min(
        waist.y - 0.05,
        ...arms.map((arm) => arm.cuff[1] - 0.09)
    );
    mesh.addRaw(
        meshField(garment, {
            min: [-reach, lowest, -0.2],
            max: [reach, sy + 0.1, 0.24],
            cell: 0.0082 / detail,
        }),
        paint
    );

    // Cuffs: a firm band closing each sleeve.
    for (const arm of arms) {
        const r2 = style.rolled ? 0.041 + ease * 0.2 : 0.031 + ease * 0.12;
        const length = style.rolled ? 0.042 : 0.05;
        const centre: Vec3 = [
            arm.cuff[0] - arm.dLower[0] * (length / 2 - 0.004),
            arm.cuff[1] -
                arm.dLower[1] * (length / 2 - 0.004) -
                Math.max(0, r2 - 0.04),
            arm.cuff[2] - arm.dLower[2] * (length / 2 - 0.004),
        ];
        band(mesh, centre, arm.dLower, {
            radius: r2 + (style.rolled ? 0.0095 : 0.004),
            inner: style.rolled ? 0.034 : 0.028,
            length,
            colour: cloth,
            shade: shadow,
            lumps: style.rolled ? 0.0022 : 0.0006,
        });
    }

    const front = (x: number, y: number, lift = 0) =>
        ontoFront(garment, x, y, lift);
    const collarY = sy + 0.052;
    collar(mesh, rig, garment, style, cloth, shadow, neckR, collarY);

    // Placket and buttons down the centre front.
    const top = sy - 0.004 - 0.045 * style.open;
    const bottom = waist.y + 0.008;
    const half = 0.0155;
    sheet(
        mesh,
        3,
        22,
        (u, v) => {
            const y = top + (bottom - top) * v;
            const p = front((u - 0.5) * 2 * half, y, 0.0012);
            return {
                p,
                colour: [cloth[0] * 0.97, cloth[1] * 0.97, cloth[2] * 0.97],
            };
        },
        0.0016,
        true
    );
    const button = rgb(style.button);
    const buttons = Math.max(3, Math.round((top - bottom) / 0.075));
    for (let i = 0; i < buttons; i++) {
        const y = top - 0.02 - ((top - bottom - 0.035) * i) / (buttons - 1);
        disc(mesh, front(0, y, 0.0032), [0, 0, 1], 0.0052, 0.0014, button);
    }
    for (const arm of arms)
        if (!style.rolled) {
            // A cuff button on the outside of the wrist.
            const p: Vec3 = [
                arm.cuff[0] - arm.dLower[0] * 0.014,
                arm.cuff[1] - arm.dLower[1] * 0.014,
                arm.cuff[2] - arm.dLower[2] * 0.014,
            ];
            const outwards = rig.direction(`${arm.side}LowerArm`, [0, 0.2, -1]);
            const q: [number, number, number] = [p[0], p[1], p[2]];
            for (let i = 0; i < 30; i++) {
                const d = garment.eval(q[0], q[1], q[2]);
                if (d > 0.0025) break;
                q[0] += outwards[0] * 0.003;
                q[1] += outwards[1] * 0.003;
                q[2] += outwards[2] * 0.003;
            }
            disc(mesh, q, outwards, 0.0048, 0.0014, button);
        }

    // Chest pocket on the wearer's left.
    const pocketX = chestRx * 0.47;
    const pocketTop = sy - 0.105;
    if (style.pocket) {
        const w = 0.039;
        const h = 0.082;
        sheet(
            mesh,
            7,
            9,
            (u, v) => {
                // A rounded-off point at the bottom.
                const drop =
                    v > 0.85
                        ? Math.abs(u - 0.5) * 0.02 * ((v - 0.85) / 0.15)
                        : 0;
                const p = front(
                    pocketX + (u - 0.5) * 2 * w,
                    pocketTop - h * v + drop,
                    0.0013
                );
                const hem = v < 0.14 ? 0.94 : 0.985;
                return {
                    p,
                    colour: [cloth[0] * hem, cloth[1] * hem, cloth[2] * hem],
                };
            },
            0.0018,
            true
        );
    }

    return {
        mesh,
        shape: garment,
        anchors: {
            knot: front(0, sy - 0.006 - 0.04 * style.open, 0.004),
            pocket: front(pocketX, pocketTop, 0.003),
            collarY,
        },
    };
}

/** A small flat disc: a button. */
export function disc(
    out: MeshBuilder,
    centre: Vec3,
    normal: Vec3,
    radius: number,
    height: number,
    colour: Rgb,
    segments = 12
) {
    const l = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    const n: Vec3 = [normal[0] / l, normal[1] / l, normal[2] / l];
    const ref: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let tx: Vec3 = [
        ref[1] * n[2] - ref[2] * n[1],
        ref[2] * n[0] - ref[0] * n[2],
        ref[0] * n[1] - ref[1] * n[0],
    ];
    const tl = Math.hypot(tx[0], tx[1], tx[2]) || 1;
    tx = [tx[0] / tl, tx[1] / tl, tx[2] / tl];
    const ty: Vec3 = [
        n[1] * tx[2] - n[2] * tx[1],
        n[2] * tx[0] - n[0] * tx[2],
        n[0] * tx[1] - n[1] * tx[0],
    ];
    const top: Vec3 = [
        centre[0] + n[0] * height,
        centre[1] + n[1] * height,
        centre[2] + n[2] * height,
    ];
    const mid = out.vertex(top, n, colour);
    const rim = out.count;
    const dark: Rgb = [colour[0] * 0.7, colour[1] * 0.7, colour[2] * 0.7];
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const dx = tx[0] * Math.cos(a) + ty[0] * Math.sin(a);
        const dy = tx[1] * Math.cos(a) + ty[1] * Math.sin(a);
        const dz = tx[2] * Math.cos(a) + ty[2] * Math.sin(a);
        out.vertex(
            [
                top[0] + dx * radius * 0.85,
                top[1] + dy * radius * 0.85,
                top[2] + dz * radius * 0.85,
            ],
            n,
            colour
        );
        out.vertex(
            [
                centre[0] + dx * radius,
                centre[1] + dy * radius,
                centre[2] + dz * radius,
            ],
            [dx, dy, dz],
            dark
        );
    }
    for (let i = 0; i < segments; i++) {
        const a = rim + i * 2;
        const b = rim + ((i + 1) % segments) * 2;
        out.tri(mid, a, b);
        out.quad(a, a + 1, b + 1, b);
    }
}

/**
 * A hollow band round an axis: a cuff, a sock top, a belt loop. It has an
 * outer wall, an inner wall and both rims, so it reads as a thick edge.
 */
export function band(
    out: MeshBuilder,
    centre: Vec3,
    axis: Vec3,
    options: {
        radius: number;
        inner: number;
        length: number;
        colour: Rgb;
        shade: Rgb;
        /** Unevenness of the outer wall, in metres. */
        lumps?: number;
        segments?: number;
    }
) {
    const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
    const t: Vec3 = [axis[0] / l, axis[1] / l, axis[2] / l];
    const ref: Vec3 = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u: Vec3 = [
        ref[1] * t[2] - ref[2] * t[1],
        ref[2] * t[0] - ref[0] * t[2],
        ref[0] * t[1] - ref[1] * t[0],
    ];
    const ul = Math.hypot(u[0], u[1], u[2]) || 1;
    u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const v: Vec3 = [
        t[1] * u[2] - t[2] * u[1],
        t[2] * u[0] - t[0] * u[2],
        t[0] * u[1] - t[1] * u[0],
    ];
    const segments = options.segments ?? 24;
    const lumps = options.lumps ?? 0;
    // Profile from the inner wall, over the far rim, along the outside, back.
    const half = options.length / 2;
    const profile: [number, number, number][] = [
        [-half, options.inner, 0.45],
        [half, options.inner, 0.5],
        [half + 0.0015, (options.inner + options.radius) / 2, 0.8],
        [half, options.radius, 1],
        [half * 0.4, options.radius + 0.001, 1],
        [-half * 0.4, options.radius + 0.001, 1],
        [-half, options.radius, 0.95],
        [-half - 0.0015, (options.inner + options.radius) / 2, 0.75],
    ];
    out.grid(
        profile.length + 1,
        segments,
        true,
        (row, column) => {
            const [a, r, light] = profile[row % profile.length];
            const angle = (column / segments) * Math.PI * 2;
            const wobble =
                r > options.inner + 0.0005
                    ? lumps *
                      (noise3(
                          Math.cos(angle) * 3 + centre[0] * 40,
                          Math.sin(angle) * 3,
                          a * 60
                      ) -
                          0.5) *
                      2
                    : 0;
            const radius = r + wobble;
            const cx = Math.cos(angle) * radius;
            const cy = Math.sin(angle) * radius;
            return {
                p: [
                    centre[0] + t[0] * a + u[0] * cx + v[0] * cy,
                    centre[1] + t[1] * a + u[1] * cx + v[1] * cy,
                    centre[2] + t[2] * a + u[2] * cx + v[2] * cy,
                ],
                color: mixRgb(options.shade, options.colour, light),
            };
        },
        true
    );
}

/**
 * The collar: a band standing round the neck with leaves folded down over
 * it, longer at the front points. Worn open, the points spread apart.
 */
function collar(
    out: MeshBuilder,
    rig: Rig,
    garment: Field,
    style: ShirtStyle,
    cloth: Rgb,
    shadow: Rgb,
    neckR: number,
    foldY: number
) {
    const sy = rig.body.upperArm[1];
    const open = style.open;
    // Angle round the neck from the front centre where each side ends; an
    // undone collar stops short and falls open.
    const gap = 0.1 + 0.34 * open;
    const centreZ = -0.01;
    const ring = (
        angle: number,
        radius: number,
        y: number
    ): [number, number, number] => [
        Math.sin(angle) * radius,
        y,
        centreZ + Math.cos(angle) * radius * 1.06,
    ];
    // Lay a point on the cloth: down onto the shoulders from above, and
    // forward onto the chest from in front.
    const rest = (p: [number, number, number], lift: number) => {
        let y = sy + 0.09;
        let hit = false;
        for (let i = 0; i < 40; i++) {
            const d = garment.eval(p[0], y, p[2]);
            if (d < 0.0005) {
                hit = true;
                break;
            }
            y -= d * 0.8;
            if (y < p[1] - 0.02) break;
        }
        if (hit && y + lift > p[1]) p[1] = y + lift;
        if (p[2] > 0.02) {
            const z = ontoFront(garment, p[0], p[1], lift)[2];
            if (z > p[2] && z < p[2] + 0.05) p[2] = z;
        }
        return p;
    };
    const fold = (frontness: number) =>
        foldY - 0.02 * frontness - 0.006 * open * frontness;
    for (const s of [1, -1]) {
        // Leaf: from the fold line down and out to its edge.
        sheet(
            out,
            17,
            6,
            (u, v) => {
                // u: back centre to the front point. v: fold line to leaf edge.
                const frontness = smoothstep(0.15, 1, u);
                const angle = s * (Math.PI - u * (Math.PI - gap));
                const length = 0.036 + 0.05 * Math.pow(frontness, 2);
                const r =
                    neckR +
                    0.01 +
                    (0.022 + 0.01 * open * frontness) *
                        Math.sin((v * Math.PI) / 2);
                // The leaf rolls over the fold, then hangs.
                const y =
                    fold(frontness) +
                    0.004 * Math.sin(v * Math.PI) -
                    length * v * v * 0.2 -
                    length * v * 0.8;
                const p = rest(ring(angle, r, y), 0.0045);
                const shade = v > 0.88 ? 0.8 : 1;
                return {
                    p,
                    colour: [
                        cloth[0] * shade,
                        cloth[1] * shade,
                        cloth[2] * shade,
                    ],
                    under: mixRgb(shadow, cloth, 0.35),
                };
            },
            0.0022,
            s < 0
        );
        // Stand: the band the leaf folds over, seen at the open throat.
        sheet(
            out,
            17,
            3,
            (u, v) => {
                const frontness = smoothstep(0.15, 1, u);
                const angle = s * (Math.PI - u * (Math.PI - gap * 0.7));
                // The band narrows to nothing where it falls open at the front.
                const taper = 1 - smoothstep(0.8, 1, u);
                const base = sy - 0.006 - 0.012 * frontness;
                const r = neckR + 0.0085 - 0.002 * v;
                return {
                    p: ring(
                        angle,
                        r,
                        base + (fold(frontness) + 0.002 - base) * v * taper
                    ),
                    colour: mixRgb(shadow, cloth, 0.6),
                    under: mixRgb(shadow, cloth, 0.3),
                };
            },
            0.002,
            s < 0
        );
    }
}
