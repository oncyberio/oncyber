import { MeshBuilder, Rgb, mixRgb, rgb, spline } from "../kernel/build";
import { sheet } from "../kernel/sheet";
import { box, cylinder } from "../kernel/solids";
import { Shape, Vec3, euler, mulBasis } from "../kernel/sdf";
import { waistPoint } from "./belt";
import { ontoFront, Waist } from "./shirt";
import type { FaceSpec } from "./skinField";

type P3 = [number, number, number];

export interface GlassesStyle {
    frame: string;
    /** Lens radius in metres; round wire frames. */
    radius: number;
    wire: number;
    /** How far below the eye line the lenses are centred. */
    drop: number;
}

/**
 * Round wire glasses in reference head space: rims, bridge, pads and
 * temples hooked over the ears. Lenses are returned separately, for a
 * see-through material.
 */
export function buildGlasses(face: FaceSpec, style: GlassesStyle) {
    const frame = new MeshBuilder();
    const lenses = new MeshBuilder();
    const metal = rgb(style.frame);
    const bright: Rgb = [metal[0] * 1.5, metal[1] * 1.5, metal[2] * 1.5];
    const r = style.radius;
    const cx = face.eye[0] + 0.0015;
    const cy = face.eye[1] - style.drop;
    const cz = face.eye[2] + face.eyeRadius + 0.0125;
    for (const s of [1, -1]) {
        // The lens plane wraps back a little and tilts in at the bottom.
        const basis = mulBasis(euler(0, 0.1 * s, 0), euler(0.12, 0, 0));
        const on = (a: number, radius: number, depth = 0): P3 => {
            const lx = Math.cos(a) * radius;
            const ly = Math.sin(a) * radius;
            return [
                cx * s + basis[0] * lx + basis[1] * ly + basis[2] * depth,
                cy + basis[3] * lx + basis[4] * ly + basis[5] * depth,
                cz + basis[6] * lx + basis[7] * ly + basis[8] * depth,
            ];
        };
        const rim: P3[] = [];
        const count = 36;
        for (let i = 0; i <= count; i++)
            rim.push(on((i / count) * Math.PI * 2, r));
        frame.tube(
            rim,
            6,
            () => style.wire,
            (_t, angle) => (Math.sin(angle) > 0.3 ? bright : metal),
            {
                caps: false,
            }
        );
        // Lens: a shallow dome just inside the rim.
        const centre = lenses.vertex(
            on(0, 0, 0.0012),
            [basis[2], basis[5], basis[8]],
            [1, 1, 1]
        );
        const first = lenses.count;
        const rings = 2;
        for (let k = 1; k <= rings; k++)
            for (let i = 0; i < count; i++) {
                const a = (i / count) * Math.PI * 2;
                lenses.vertex(
                    on(a, (r * k) / rings, 0.0012 * (1 - (k / rings) ** 2)),
                    [basis[2], basis[5], basis[8]],
                    [1, 1, 1]
                );
            }
        for (let i = 0; i < count; i++) {
            const n = (i + 1) % count;
            lenses.tri(centre, first + i, first + n);
            lenses.quad(
                first + i,
                first + count + i,
                first + count + n,
                first + n
            );
        }
        // Temple: from the outer rim back over the ear, then down behind it.
        const hinge = on(s > 0 ? 0.25 : Math.PI - 0.25, r + style.wire);
        const ear: P3 = [
            (face.ear[0] + 0.004) * s,
            face.ear[1] + 0.014,
            face.ear[2] + 0.006,
        ];
        frame.tube(
            spline(
                [
                    hinge,
                    [hinge[0] + s * 0.006, hinge[1] + 0.001, hinge[2] - 0.012],
                    [ear[0] + s * 0.001, ear[1] + 0.002, ear[2] + 0.03],
                    ear,
                    [ear[0] - s * 0.002, ear[1] - 0.012, ear[2] - 0.014],
                    [ear[0] - s * 0.004, ear[1] - 0.03, ear[2] - 0.016],
                ],
                18
            ),
            5,
            () => style.wire * 0.9,
            () => metal,
            { caps: true }
        );
        // Nose pad on a little arm.
        const pad = on(s > 0 ? Math.PI + 0.75 : -0.75, r * 0.93, -0.008);
        frame.tube(
            [on(s > 0 ? Math.PI + 0.6 : -0.6, r), pad],
            4,
            () => style.wire * 0.7,
            () => metal,
            {
                caps: true,
            }
        );
        box(
            frame,
            pad,
            [0.0022, 0.0038, 0.0009],
            bright,
            euler(0, 0.5 * s, 0),
            0.0006
        );
    }
    // Bridge: an arc between the rims.
    const inner = (s: number): P3 => {
        const basis = mulBasis(euler(0, 0.1 * s, 0), euler(0.12, 0, 0));
        const a = s > 0 ? Math.PI - 0.5 : 0.5;
        const lx = Math.cos(a) * r;
        const ly = Math.sin(a) * r;
        return [
            cx * s + basis[0] * lx + basis[1] * ly,
            cy + basis[3] * lx + basis[4] * ly,
            cz + basis[6] * lx + basis[7] * ly,
        ];
    };
    const a = inner(-1);
    const b = inner(1);
    frame.tube(
        spline([a, [0, a[1] + 0.0035, a[2] + 0.0025], b], 9),
        5,
        () => style.wire,
        () => bright,
        { caps: true }
    );
    return { frame, lenses };
}

/** Square stud earrings on the lobes, in reference head space. */
export function buildEarrings(face: FaceSpec, colour: string, size: number) {
    const out = new MeshBuilder();
    const gold = rgb(colour);
    for (const s of [1, -1]) {
        const lobe: P3 = [
            (face.ear[0] + 0.0035) * s,
            face.ear[1] - 0.0305,
            face.ear[2] + 0.0065,
        ];
        box(
            out,
            lobe,
            [0.0016, size / 2, size / 2],
            (n) =>
                Math.abs(n[0]) > 0.5
                    ? mixRgb(gold, [1, 0.95, 0.75], 0.25)
                    : gold,
            euler(0, -0.25 * s, 0),
            0.0008
        );
    }
    return out;
}

export interface BadgeStyle {
    card: string;
    holder: string;
    ink: string;
    accent: string;
    clip: string;
    /** A photo on the card. */
    photo: boolean;
}

/**
 * An ID card in a clear holder, clipped by a strap at `anchor` and hanging
 * down the chest, in the design pose.
 */
export function buildBadge(shirt: Shape, anchor: Vec3, style: BadgeStyle) {
    const out = new MeshBuilder();
    const card = rgb(style.card);
    const holder = rgb(style.holder);
    const ink = rgb(style.ink);
    const accent = rgb(style.accent);
    const clip = rgb(style.clip);
    const w = 0.0275;
    const h = 0.041;
    const top = anchor[1] - 0.02;
    const centreY = top - h;
    // The card hangs nearly flat against the cloth, tipped out at the top.
    const z = ontoFront(shirt, anchor[0], centreY, 0.0045)[2];
    const tilt = euler(-0.08, 0.1, 0.05);
    const at = (x: number, y: number, depth: number): P3 => [
        anchor[0] + tilt[0] * x + tilt[1] * y + tilt[2] * depth,
        centreY + tilt[3] * x + tilt[4] * y + tilt[5] * depth,
        z + tilt[6] * x + tilt[7] * y + tilt[8] * depth,
    ];
    box(out, at(0, 0, 0), [w + 0.003, h + 0.004, 0.0011], holder, tilt, 0.001);
    box(out, at(0, -0.001, 0.0012), [w, h - 0.002, 0.0006], card, tilt, 0.0004);
    // Print: a header bar, a photo, and lines of text.
    const print = (x: number, y: number, hw: number, hh: number, colour: Rgb) =>
        box(out, at(x, y, 0.002), [hw, hh, 0.00035], colour, tilt, 0.0001);
    print(0, h * 0.72, w * 0.82, 0.0042, accent);
    if (style.photo)
        print(-w * 0.45, h * 0.12, w * 0.36, h * 0.3, mixRgb(ink, card, 0.45));
    const left = style.photo ? w * 0.12 : -w * 0.78;
    for (let i = 0; i < 5; i++) {
        const length = (w * 0.84 - left) * (i % 2 ? 0.7 : 1) * 0.5;
        print(
            left + length,
            h * 0.38 - i * 0.0085,
            length,
            0.0011,
            i === 0 ? ink : mixRgb(ink, card, 0.4)
        );
    }
    for (let i = 0; i < 3; i++)
        print(
            -w * 0.2 * (i % 2 ? 1.6 : 1),
            -h * 0.5 - i * 0.008,
            w * (i % 2 ? 0.46 : 0.62),
            0.001,
            mixRgb(ink, card, 0.5)
        );
    // Strap and clip up to the anchor.
    const strapTop = ontoFront(shirt, anchor[0], anchor[1] + 0.004, 0.004);
    sheet(
        out,
        2,
        4,
        (u, v) => {
            const a = at((u - 0.5) * 0.011, h + 0.002, 0.001);
            return {
                p: [
                    a[0] + (strapTop[0] + (u - 0.5) * 0.011 - a[0]) * v,
                    a[1] + (strapTop[1] - a[1]) * v,
                    a[2] +
                        (strapTop[2] - a[2]) * v +
                        0.002 * Math.sin(v * Math.PI),
                ],
                colour: accent,
            };
        },
        0.0012,
        true
    );
    box(
        out,
        [strapTop[0], strapTop[1] - 0.002, strapTop[2] + 0.001],
        [0.0065, 0.0085, 0.0024],
        clip,
        euler(-0.1, 0, 0),
        0.0008
    );
    return out;
}

export interface RadioStyle {
    body: string;
    detail: string;
    cable: string;
    /** Angle round the waist where it is worn; negative is the right hip. */
    angle: number;
}

/** A hand-held radio in a belt holster, in the design pose. */
export function buildRadio(waist: Waist, beltY: number, style: RadioStyle) {
    const out = new MeshBuilder();
    const body = rgb(style.body);
    const detail = rgb(style.detail);
    const angle = style.angle;
    const basis = euler(0, angle, 0);
    // Slung low from the belt, clear of the shirt bloused above it.
    const base = waistPoint(waist, angle, beltY - 0.03, 0.034);
    const at = (x: number, y: number, depth: number): P3 => [
        base[0] + basis[0] * x + basis[2] * depth,
        base[1] + y,
        base[2] + basis[6] * x + basis[8] * depth,
    ];
    const shade = (n: readonly number[]) =>
        n[1] > 0.5 ? mixRgb(body, [1, 1, 1], 0.12) : body;
    box(out, at(0, 0, 0), [0.028, 0.052, 0.016], shade, basis, 0.004);
    // Speaker grille, a screen, a side key.
    for (let i = 0; i < 5; i++)
        box(
            out,
            at(0, -0.012 - i * 0.007, 0.0165),
            [0.017, 0.0014, 0.0006],
            detail,
            basis,
            0.0003
        );
    box(
        out,
        at(0, 0.024, 0.0165),
        [0.017, 0.011, 0.0007],
        mixRgb(detail, [0.2, 0.3, 0.32], 0.5),
        basis,
        0.0004
    );
    box(
        out,
        at(-0.0285, 0.012, 0),
        [0.0012, 0.014, 0.007],
        detail,
        basis,
        0.0005
    );
    // Antenna and channel knob on top.
    cylinder(out, at(-0.016, 0.05, 0), at(-0.016, 0.066, 0), 0.0075, detail);
    cylinder(out, at(-0.016, 0.066, 0), at(-0.016, 0.158, 0), 0.0052, body, {
        endRadius: 0.0042,
    });
    cylinder(out, at(0.012, 0.05, 0), at(0.012, 0.064, 0), 0.0068, detail, {
        segments: 12,
    });
    // Holster: a strap round the body and a loop over the belt.
    box(
        out,
        at(0, -0.012, 0),
        [0.03, 0.02, 0.018],
        mixRgb(body, [0, 0, 0], 0.35),
        basis,
        0.003
    );
    box(
        out,
        at(0, -0.03, -0.019),
        [0.012, 0.03, 0.004],
        mixRgb(body, [0, 0, 0], 0.35),
        basis,
        0.002
    );
    return {
        mesh: out,
        top: at(0.012, 0.064, 0),
        jack: at(0.02, 0.052, 0.004),
    };
}

/**
 * A cable resting on the cloth between points: it is traced over the shirt
 * front and sags between its pins.
 */
export function cablePath(
    shirt: Shape,
    pins: Vec3[],
    samples: number,
    lift = 0.004
): P3[] {
    return spline(pins, samples).map((p) => {
        const on = ontoFront(shirt, p[0], p[1], lift);
        return [p[0], p[1], Math.max(p[2], on[2])] as P3;
    });
}

/**
 * An earpiece worn loose round the collar: a wire behind the neck, a bud
 * resting on each side of the chest, and a lead down to a radio.
 */
export function buildEarpiece(
    shirt: Shape,
    collarY: number,
    shoulderY: number,
    plug: Vec3,
    colour: string
) {
    const out = new MeshBuilder();
    const black = rgb(colour);
    const sheen: Rgb = [black[0] * 2.4, black[1] * 2.4, black[2] * 2.6];
    const wire = (path: Vec3[], radius: number) =>
        out.tube(
            path,
            5,
            () => radius,
            (_t, angle) => (Math.sin(angle) > 0.5 ? sheen : black),
            {
                caps: true,
            }
        );
    // Round the back of the neck, lying on the collar.
    const loop: P3[] = [];
    for (let i = 0; i <= 14; i++) {
        const a = -2.25 + (4.5 * i) / 14;
        const back = Math.cos(a) < 0 ? 1 : 0;
        loop.push([
            Math.sin(a) * (0.062 + 0.004 * back),
            collarY - 0.012 - 0.012 * Math.cos(a) + 0.004 * back,
            -0.012 + Math.cos(a) * 0.064,
        ]);
    }
    wire(spline(loop, 30), 0.0016);
    const ends: P3[] = [];
    for (const s of [1, -1]) {
        const start = loop[s > 0 ? loop.length - 1 : 0];
        const bud = ontoFront(shirt, s * 0.058, shoulderY - 0.062, 0.008);
        const lead = cablePath(
            shirt,
            [
                start,
                [s * 0.064, shoulderY - 0.012, start[2] + 0.02],
                [s * 0.061, shoulderY - 0.04, bud[2]],
                bud,
            ],
            10,
            0.004
        );
        wire(lead, 0.0016);
        // The bud: a small capsule with a clip and a rubber tip.
        const tip: P3 = [bud[0] - s * 0.004, bud[1] - 0.026, bud[2] + 0.003];
        out.tube(
            [
                bud,
                [(bud[0] + tip[0]) / 2, (bud[1] + tip[1]) / 2, bud[2] + 0.006],
                tip,
            ],
            8,
            (t) => 0.0062 - 0.0012 * Math.abs(t - 0.4),
            (_t, angle) => (Math.sin(angle) > 0.4 ? sheen : black),
            { caps: true }
        );
        box(
            out,
            [bud[0] + s * 0.004, bud[1] - 0.006, bud[2] + 0.001],
            [0.0028, 0.011, 0.0045],
            black,
            euler(0, 0, 0.1 * s),
            0.001
        );
        ends.push(tip);
    }
    // The lead from the right-hand bud down to the radio, hanging in a
    // loose curve against the shirt.
    const from = ends[1];
    const lead: P3[] = [];
    const steps = 26;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = from[1] + (plug[1] - from[1]) * t;
        const slack = Math.sin(Math.PI * Math.pow(t, 0.8));
        const x = from[0] + (plug[0] - from[0]) * t * t - 0.03 * slack;
        const surface = ontoFront(shirt, x, y, 0.0045)[2];
        // Near the plug the cable leaves the cloth and runs into the radio.
        const k = Math.pow(t, 6);
        lead.push([x, y - 0.012 * slack, surface + (plug[2] - surface) * k]);
    }
    wire(lead, 0.0015);
    return out;
}

export interface HeadphoneStyle {
    shell: string;
    cushion: string;
    cable: string;
    /** Angle round the waist of the player the cable runs to. */
    player: number;
}

/**
 * Headphones worn round the neck: a band behind it, a cup resting on each
 * side of the chest, and a lead to a small player clipped to the belt.
 */
export function buildHeadphones(
    shirt: Shape,
    collarY: number,
    shoulderY: number,
    waist: Waist,
    beltY: number,
    style: HeadphoneStyle
) {
    const out = new MeshBuilder();
    const shell = rgb(style.shell);
    const cushion = rgb(style.cushion);
    const sheen: Rgb = [shell[0] * 2.6, shell[1] * 2.6, shell[2] * 2.8];
    const lit = (_t: number, angle: number): Rgb =>
        Math.sin(angle) > 0.45 ? sheen : shell;
    const cups: Vec3[] = [];
    for (const s of [1, -1]) {
        const centre = ontoFront(shirt, s * 0.07, shoulderY - 0.05, 0.02);
        const axis: P3 = [0.5 * s, -0.12, 0.86];
        const l = Math.hypot(axis[0], axis[1], axis[2]);
        const a: P3 = [axis[0] / l, axis[1] / l, axis[2] / l];
        const along = (d: number): P3 => [
            centre[0] + a[0] * d,
            centre[1] + a[1] * d,
            centre[2] + a[2] * d,
        ];
        // Cushion against the chest, then the shell and its cap.
        cylinder(out, along(-0.016), along(-0.002), 0.034, cushion, {
            segments: 20,
        });
        cylinder(out, along(-0.004), along(0.012), 0.037, shell, {
            segments: 20,
            endRadius: 0.034,
        });
        cylinder(out, along(0.012), along(0.017), 0.027, sheen, {
            segments: 20,
            endRadius: 0.022,
        });
        cups.push(centre);
        // The arm from the cup up to the band.
        const top: P3 = [s * 0.072, collarY - 0.006, 0.012];
        out.tube(
            spline(
                [
                    along(0.004),
                    [
                        centre[0] + s * 0.012,
                        centre[1] + 0.03,
                        centre[2] - 0.008,
                    ],
                    top,
                ],
                8
            ),
            6,
            () => 0.0042,
            lit,
            { caps: true }
        );
    }
    // The band, lying round the back of the neck.
    const band: P3[] = [];
    for (let i = 0; i <= 16; i++) {
        const angle = Math.PI * 0.5 + (Math.PI * i) / 16;
        band.push([
            Math.cos(angle - Math.PI / 2) * -0.072 * (i <= 8 ? 1 : 1),
            collarY - 0.006 + 0.012 * Math.sin((Math.PI * i) / 16),
            0.012 - Math.sin((Math.PI * i) / 16) * 0.105,
        ]);
    }
    for (let i = 0; i <= 16; i++)
        band[i][0] = 0.072 * Math.cos((Math.PI * i) / 16);
    out.tube(spline(band, 26), 8, () => 0.0085, lit, {
        flatten: 0.55,
        caps: true,
    });
    // The player on the belt, and the lead down to it from the left cup.
    const basis = euler(0, style.player, 0);
    const puck = waistPoint(waist, style.player, beltY - 0.004, 0.02);
    const face: P3 = [basis[2], 0, basis[8]];
    cylinder(
        out,
        [puck[0] - face[0] * 0.006, puck[1], puck[2] - face[2] * 0.006],
        [puck[0] + face[0] * 0.01, puck[1], puck[2] + face[2] * 0.01],
        0.03,
        shell,
        { segments: 22, endRadius: 0.027 }
    );
    cylinder(
        out,
        [puck[0] + face[0] * 0.01, puck[1], puck[2] + face[2] * 0.01],
        [puck[0] + face[0] * 0.013, puck[1], puck[2] + face[2] * 0.013],
        0.017,
        sheen,
        { segments: 18, endRadius: 0.014 }
    );
    const from = cups[0];
    const plug: Vec3 = [puck[0], puck[1] + 0.03, puck[2] + 0.004];
    const lead: Vec3[] = [];
    const steps = 26;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = from[1] - 0.03 + (plug[1] - from[1] + 0.03) * t;
        const slack = Math.sin(Math.PI * Math.pow(t, 0.8));
        const x = from[0] + (plug[0] - from[0]) * t * t + 0.016 * slack;
        const surface = ontoFront(shirt, x, y, 0.0045)[2];
        const k = Math.pow(t, 6);
        lead.push([x, y - 0.008 * slack, surface + (plug[2] - surface) * k]);
    }
    out.tube(lead, 5, () => 0.0016, lit, { caps: true });
    return out;
}

/** A plain band ring: a torus round a finger, in the design pose. */
export function buildRing(
    from: Vec3,
    to: Vec3,
    radius: number,
    colour: string
) {
    const out = new MeshBuilder();
    const metal = rgb(colour);
    const mid: P3 = [
        from[0] + (to[0] - from[0]) * 0.42,
        from[1] + (to[1] - from[1]) * 0.42,
        from[2] + (to[2] - from[2]) * 0.42,
    ];
    const axis: P3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
    const t: P3 = [axis[0] / l, axis[1] / l, axis[2] / l];
    const ref: P3 = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u: P3 = [
        ref[1] * t[2] - ref[2] * t[1],
        ref[2] * t[0] - ref[0] * t[2],
        ref[0] * t[1] - ref[1] * t[0],
    ];
    const ul = Math.hypot(u[0], u[1], u[2]) || 1;
    u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const v: P3 = [
        t[1] * u[2] - t[2] * u[1],
        t[2] * u[0] - t[0] * u[2],
        t[0] * u[1] - t[1] * u[0],
    ];
    const ring: P3[] = [];
    for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        ring.push([
            mid[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * radius,
            mid[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * radius,
            mid[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * radius,
        ]);
    }
    out.tube(
        ring,
        6,
        () => 0.0024,
        (_s, angle) =>
            Math.sin(angle) > 0.4
                ? [metal[0] * 3, metal[1] * 3, metal[2] * 3.2]
                : metal,
        { flatten: 0.55, caps: false }
    );
    return out;
}
