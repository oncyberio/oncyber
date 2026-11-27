import {
    If,
    abs,
    atan,
    clamp,
    cross,
    dot,
    float as f32,
    fract,
    length,
    max,
    min,
    mix,
    mx_noise_float,
    normalize,
    pow,
    saturate,
    sin,
    smoothstep,
    sqrt,
    vec2,
    vec3,
} from "three/tsl";
import { rgb } from "./kernel/build";
import type { Vec3 } from "./kernel/sdf";
import type { Sculpt, SculptMaterial } from "./sculpts/types";

/**
 * How each surface of a sculpt is coloured and lit: the painted face, the
 * drawn iris, strands along each lock of hair, cloth with tinted shadows.
 * It only needs to know where on the figure a point is, which way the
 * surface faces and how open it is to the light, so the same code shades a
 * point found by tracing the sculpt and a point on a mesh cut from it.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;

export const v3 = (v: readonly number[]) => vec3(v[0], v[1], v[2]);

// The light of the character sheet: a broad key from the front, a little
// to his right and above; a cool fill from the other side; warm light
// coming back up off the floor.
export const KEY = vec3(-0.4, 0.62, 0.675);
export const FILL = vec3(0.78, 0.22, 0.58);
export const BACK = vec3(0.3, 0.5, -0.81);
// The sheet is lit evenly from every side: a second, weaker key behind.
export const REAR = vec3(0.32, 0.55, -0.77);
export const SUN = vec3(1.0, 0.95, 0.9);
export const SKY = vec3(0.72, 0.76, 0.9);
export const BOUNCE = vec3(0.95, 0.72, 0.62);

/** Width of the unit the across-the-lock coordinate is counted in. */
export const HAIR_STRAND = 0.001;

/** The order materials are numbered in when one is passed as a number. */
export const MATERIAL_ORDER: SculptMaterial[] = [
    "skin",
    "eye",
    "hair",
    "cotton",
    "tie",
    "wool",
    "knit",
    "black",
    "badge",
];

export interface SurfaceContext {
    /** The point, in the figure's rest pose. */
    pos: Node;
    /** Which way the surface faces, for lighting. */
    n: Node;
    /** The same in the figure's own frame, for paint that faces forwards. */
    paintNormal: Node;
    /** From the eye to the point. */
    rd: Node;
    /** 1 in the key light, 0 in its shadow; a variable, it is refined. */
    shadow: Node;
    /** 1 in the open, 0 buried in a crease. */
    open: Node;
    /** What the surface is made of: a name, or a number chosen per pixel. */
    kind: SculptMaterial | Node;
    /**
     * For hair: the lock's direction (x, y, and the sign of z folded into
     * w), the coordinate across it, and how far along it the point is.
     */
    hair: () => Node;
}

/** The colour of a point of a sculpt's surface. Call inside a `Fn`. */
export function surfaceColour(sculpt: Sculpt, ctx: SurfaceContext): Node {
    const { pos, n, rd, shadow, open } = ctx;
    const pn = ctx.paintNormal;
    const face = sculpt.face;
    const C = (name: keyof Sculpt["palette"]) => v3(rgb(sculpt.palette[name]));
    /** Run `body` where the surface is of this material. */
    const when = (name: SculptMaterial, body: () => void) => {
        if (typeof ctx.kind === "string") {
            if (ctx.kind === name) body();
        } else
            If(
                abs(ctx.kind.sub(MATERIAL_ORDER.indexOf(name))).lessThan(0.5),
                body
            );
    };

    // The rear key casts no shadows of its own.
    const rear = saturate(dot(n, REAR)).mul(0.9).toVar();
    const ndl = max(dot(n, KEY), rear).toVar();
    shadow.assign(max(shadow, smoothstep(0, 0.4, rear)));
    const sky = n.y.mul(0.5).add(0.5).toVar();
    const bounce = saturate(f32(0.3).sub(n.y.mul(0.7))).toVar();
    const fill = saturate(dot(n, FILL).mul(0.5).add(0.5)).toVar();
    const back = saturate(dot(n, BACK).mul(0.65).add(0.35)).toVar();
    const fresnel = pow(saturate(f32(1).add(dot(n, rd))), 4).toVar();
    const halfway = normalize(KEY.sub(rd)).toVar();
    const nh = saturate(dot(n, halfway)).toVar();
    const hx = abs(pos.x).toVar();
    const colour = vec3(0).toVar();

    /** A broad two-tone: lit colour over a tinted shadow colour. */
    const twoTone = (base: Node, shadeOf: Node, soft: number, grain: Node) => {
        const lit = smoothstep(
            0.5 - soft,
            0.5 + soft,
            ndl.mul(0.5).add(0.5).add(grain)
        ).mul(mix(0.45, 1, shadow));
        const tint = shadeOf.div(base);
        const light = mix(tint.mul(0.95), SUN, lit)
            .add(SKY.mul(sky).mul(0.1))
            .add(BOUNCE.mul(bounce).mul(0.08));
        return base.mul(light).mul(mix(tint, vec3(1), open));
    };

    // --- Skin, with the face painted on.
    when("skin", () => {
        const base = C("skin");
        const tintTo = (name: keyof Sculpt["palette"]) => {
            const c = rgb(sculpt.palette[name]);
            const s = rgb(sculpt.palette.skin);
            return vec3(c[0] / s[0], c[1] / s[1], c[2] / s[2]);
        };
        const frontZ = face.brow.frontZ;
        const facing = smoothstep(frontZ - 0.02, frontZ, pos.z);
        const blob = (c: Vec3, r: Vec3) =>
            saturate(
                f32(1).sub(
                    length(
                        vec3(
                            hx.sub(c[0]).div(r[0]),
                            pos.y.sub(c[1]).div(r[1]),
                            pos.z.sub(c[2]).div(r[2])
                        )
                    )
                )
            );
        const flush = max(
            max(
                pow(blob(face.cheek, [0.03, 0.02, 0.04]), 1.3),
                blob(face.noseTip, [0.014, 0.014, 0.02]).mul(0.5)
            ),
            blob(face.ear, [0.03, 0.035, 0.03]).mul(0.45)
        );
        // The neck stands in the shade of the jaw.
        const neck = smoothstep(
            face.chinY + 0.006,
            face.chinY - 0.008,
            pos.y
        ).mul(smoothstep(0.12, 0.09, hx));
        let albedo: Node = base
            .mul(mix(vec3(1), tintTo("blush"), flush))
            .mul(mix(vec3(1), tintTo("skinShade"), neck.mul(0.8)));
        // Lips: barely tinted, with a firm line between them that
        // turns down at the corners.
        const mouth = face.mouth;
        const w = mouth.halfWidth;
        const lobe = (cx: number, cy: number, rx: number, ry: number) => {
            const dx = hx.sub(cx).div(rx);
            const dy = pos.y.sub(cy).div(ry);
            return f32(1).sub(smoothstep(0.6, 1.1, dx.mul(dx).add(dy.mul(dy))));
        };
        const onMouth = smoothstep(mouth.z - 0.02, mouth.z - 0.01, pos.z);
        const lipMask = max(
            lobe(0.006, mouth.y + 0.0032, 0.012, 0.0036),
            lobe(0, mouth.y - 0.0046, 0.0128, 0.0048)
        ).mul(onMouth);
        const sag = hx.div(w).mul(hx.div(w)).mul(0.0021);
        const lipLine = f32(1)
            .sub(
                smoothstep(
                    0.0006,
                    0.0013,
                    abs(pos.y.sub(f32(mouth.y).sub(sag)))
                )
            )
            .mul(onMouth)
            .mul(smoothstep(w + 0.0012, w - 0.002, hx));
        albedo = albedo
            .mul(mix(vec3(1), tintTo("lip"), lipMask.mul(0.15)))
            .mul(mix(vec3(1), tintTo("lipLine"), lipLine))
            // The shadows a drawn face keeps: under the lower lip and
            // under the tip of the nose.
            .mul(
                mix(
                    vec3(1),
                    tintTo("skinShade"),
                    max(
                        blob(
                            [0, mouth.y - 0.0125, mouth.z],
                            [0.013, 0.0042, 0.02]
                        ).mul(0.4),
                        smoothstep(-0.3, -0.85, pn.y)
                            .mul(0.5)
                            .mul(
                                smoothstep(
                                    0.018,
                                    0.01,
                                    length(
                                        vec3(
                                            hx,
                                            pos.y.sub(face.noseTip[1] - 0.006),
                                            pos.z.sub(face.noseTip[2] - 0.008)
                                        )
                                    )
                                )
                            )
                    )
                )
            );
        // Brows: a thick tapered stroke through the brow's points.
        const pts = face.brow.path;
        let browD: Node = f32(1);
        for (let i = 0; i + 1 < pts.length; i++) {
            const a = pts[i];
            const c = pts[i + 1];
            const ba = [c[0] - a[0], c[1] - a[1]];
            const l2 = ba[0] * ba[0] + ba[1] * ba[1];
            const pa = vec2(hx.sub(a[0]), pos.y.sub(a[1]));
            const k = clamp(dot(pa, vec2(ba[0], ba[1])).div(l2), 0, 1);
            const halfWidth = mix(
                f32(face.brow.width[i] / 2),
                f32(face.brow.width[i + 1] / 2),
                k
            );
            browD = min(
                browD,
                length(pa.sub(vec2(ba[0], ba[1]).mul(k))).sub(halfWidth)
            );
        }
        // Only where the face looks forwards: the stroke is projected
        // from the front and would smear back along the temple.
        const brow = smoothstep(0.0005, -0.0003, browD)
            .mul(smoothstep(pts[0][0] - 0.0028, pts[0][0] - 0.0014, hx))
            .mul(facing)
            .mul(smoothstep(0.02, 0.25, pn.z));
        albedo = mix(albedo, C("brow"), brow);
        // Lash lines: the rims of the lids, the upper one thick.
        const el = vec3(
            hx.sub(face.eye[0]),
            pos.y.sub(face.eye[1]),
            pos.z.sub(face.eye[2])
        ).toVar();
        // The lash line is a thin dark line along the lid's edge,
        // a little heavier towards the temple; the lower lid is a
        // fainter line round the bottom of the eye's outline.
        const across = dot(el, v3(face.upperLid.across)).toVar();
        const aboveEdge = dot(el, v3(face.upperLid.normal)).negate();
        const band = mix(
            f32(0.0013),
            f32(0.0024),
            smoothstep(-0.014, 0.014, across)
        );
        // Only on skin that faces forwards: not down the wall of the
        // opening, nor round onto the temple.
        const front = smoothstep(0.012, 0.02, el.z).mul(
            smoothstep(0.35, 0.6, pn.z)
        );
        const upper = smoothstep(band, band.sub(0.0007), abs(aboveEdge))
            .mul(front)
            // From the inner corner to a short wing past the outer one.
            .mul(smoothstep(face.opening.rx + 0.0022, face.opening.rx, across))
            .mul(
                smoothstep(
                    -face.opening.rx - 0.0015,
                    -face.opening.rx + 0.001,
                    across
                )
            );
        const rise = vec2(-face.upperLid.across[1], face.upperLid.across[0]);
        const below = dot(vec2(el.x, el.y), rise);
        const rim = length(
            vec2(across.div(face.opening.rx), below.div(face.opening.ry))
        );
        const lower = smoothstep(0.06, 0.02, abs(rim.sub(0.93)))
            .mul(smoothstep(0.001, -0.002, below))
            .mul(front)
            .mul(0.32);
        albedo = mix(albedo, C("lash"), max(upper, lower));

        // Soft wrap light, shadows that turn red at their edges, and
        // a warm rim.
        const wrap = vec3(0.65, 0.44, 0.34);
        const lit = saturate(vec3(ndl).add(wrap).div(wrap.add(1)));
        // A drawn face is barely shaded: cast shadows only tint it.
        // The neck, though, sits in the shadow of the jaw.
        const cast = mix(
            f32(0.75),
            f32(0.1),
            smoothstep(face.chinY - 0.012, face.chinY + 0.012, pos.y)
        );
        const scattered = pow(
            vec3(shadow.mul(cast).add(f32(1).sub(cast))),
            vec3(1.0, 1.4, 1.8)
        );
        const shadeTint = tintTo("skinShade");
        const direct = lit.mul(scattered);
        const light = mix(shadeTint.mul(0.82), SUN.mul(1.04), direct)
            .add(SKY.mul(sky).mul(0.07))
            .add(BOUNCE.mul(bounce).mul(0.1))
            .add(vec3(0.74, 0.82, 1.0).mul(fill).mul(0.05));
        colour.assign(
            albedo
                .mul(light)
                .mul(mix(vec3(0.82, 0.6, 0.54), vec3(1), open))
                .add(
                    pow(nh, 50)
                        .mul(0.09)
                        .mul(shadow)
                        .mul(open)
                        .mul(f32(1).sub(brow))
                )
                .add(
                    fresnel
                        .mul(back)
                        .mul(vec3(1.0, 0.72, 0.56))
                        .mul(0.28)
                        .mul(open)
                )
        );
    });

    // --- Eyes: iris and pupil drawn round the line of sight.
    when("eye", () => {
        const yaw = (face.gaze[0] * Math.PI) / 180;
        const pitch = (face.gaze[1] * Math.PI) / 180;
        const gaze = vec3(
            Math.sin(yaw) * Math.cos(pitch),
            -Math.sin(pitch),
            Math.cos(yaw) * Math.cos(pitch)
        );
        const ev = normalize(
            vec3(
                hx.sub(face.eye[0]),
                pos.y.sub(face.eye[1]),
                pos.z.sub(face.eye[2])
            )
        ).toVar();
        const cosA = dot(ev, gaze);
        const off = ev.sub(gaze.mul(cosA)).toVar();
        const r = length(off)
            .mul(face.eyeRadius / face.irisRadius)
            .add(smoothstep(0.1, -0.1, cosA).mul(10))
            .toVar();
        const dir = off.div(max(length(off), 0.0001));
        const fibres = mx_noise_float(
            vec3(dir.x.mul(7), dir.y.mul(7), r.mul(1.5))
        );
        const tone = smoothstep(0.6, 0.95, r)
            .mul(0.2)
            .add(fibres.mul(0.2))
            .add(
                smoothstep(0.1, -0.9, dir.y)
                    .mul(0.45)
                    .mul(smoothstep(0.5, 0.85, r))
            );
        const iris = mix(C("iris"), C("irisLight"), saturate(tone)).mul(
            f32(1).sub(smoothstep(0.82, 1, r).mul(0.6))
        );
        // The lid lays a soft shadow across the top of the eye.
        const underLid = smoothstep(
            0,
            0.0055,
            dot(
                vec3(
                    hx.sub(face.eye[0]),
                    pos.y.sub(face.eye[1]),
                    pos.z.sub(face.eye[2])
                ),
                v3(face.upperLid.normal)
            )
        );
        const albedo = mix(
            mix(iris, vec3(0.012, 0.008, 0.007), smoothstep(0.52, 0.42, r)),
            C("white").mul(f32(1).sub(smoothstep(1, 3.5, r).mul(0.16))),
            smoothstep(0.97, 1.04, r)
        ).mul(mix(0.78, 1, underLid));
        colour.assign(
            albedo
                .mul(mix(0.85, 1, shadow).mul(mix(0.8, 1, open)))
                .add(pow(nh, 260).mul(0.9).mul(shadow))
                .add(
                    pow(saturate(dot(n, normalize(FILL.sub(rd)))), 160).mul(
                        0.25
                    )
                )
        );
    });

    // --- Hair: strands drawn along each lock, lit along their length.
    when("hair", () => {
        const info = ctx.hair().toVar();
        const back = info.w.greaterThan(1.5);
        const run = info.w.sub(back.select(2, 0)).toVar();
        const tz = sqrt(
            max(f32(1).sub(info.x.mul(info.x)).sub(info.y.mul(info.y)), 0)
        );
        const tangent = vec3(info.x, info.y, back.select(tz.negate(), tz));
        const c = info.z;
        // Strands half a millimetre wide gathered into ribbons of a
        // few millimetres.
        const fine = mx_noise_float(vec2(c.mul(1.9), 0.5));
        const broad = mx_noise_float(vec2(c.mul(0.33), 3.7));
        const strand = fine.mul(0.5).add(broad.mul(0.5)).toVar();
        // Grooves between strands tip the normal round the lock.
        const side = normalize(cross(tangent, n));
        const groove = sin(c.mul(2.6).add(broad.mul(4)))
            .mul(0.07)
            .add(sin(c.mul(0.62).add(broad.mul(2))).mul(0.13));
        const nn = normalize(n.add(side.mul(groove))).toVar();
        const lobeAt = (shift: number, exponent: number) => {
            const tt = normalize(
                tangent.add(nn.mul(strand.mul(0.2).add(shift)))
            );
            const d = dot(tt, halfway);
            // Along the strand, and only where the lock's surface
            // turns towards the light: a streak down its crest.
            return pow(sqrt(max(f32(1).sub(d.mul(d)), 0)), exponent).mul(
                pow(saturate(dot(nn, halfway)), 2.5)
            );
        };
        const tl = dot(tangent, KEY);
        const diffuse = mix(
            sqrt(max(f32(1).sub(tl.mul(tl)), 0)),
            saturate(
                max(dot(nn, KEY), dot(nn, REAR).mul(0.9)).mul(0.6).add(0.4)
            ),
            0.6
        ).mul(mix(0.4, 1, shadow));
        // Darker at the root, lighter towards the tip; and across every
        // lock, a third of the way along, a streaky band of light: the
        // locks line up, so the bands join into a ring round the head.
        const base = C("hair")
            .mul(strand.mul(0.12).add(1))
            .mul(mix(0.82, 1.3, run));
        const sheen = C("hairSheen");
        const glossy = strand.mul(0.3).add(0.7);
        const along = run.add(fine.mul(0.07));
        const band = smoothstep(0.12, 0.3, along).mul(
            smoothstep(0.58, 0.36, along)
        );
        // Locks lie close together; do not let that blacken them.
        const air = mix(0.4, 1, open);
        const facingLight = saturate(ndl.mul(0.8).add(0.4));
        colour.assign(
            base
                .mul(
                    SUN.mul(diffuse)
                        .mul(0.8)
                        .add(SKY.mul(sky).mul(0.32))
                        .add(BOUNCE.mul(bounce).mul(0.12))
                )
                .mul(air)
                .add(
                    sheen
                        .mul(band)
                        .mul(glossy)
                        .mul(pow(facingLight, 1.5))
                        .mul(0.34)
                        .mul(mix(0.5, 1, shadow))
                        .mul(air)
                )
                .add(
                    sheen
                        .mul(lobeAt(-0.1, 8))
                        .mul(glossy)
                        .mul(facingLight)
                        .mul(0.4)
                        .mul(mix(0.45, 1, shadow))
                        .mul(air)
                )
                .add(
                    vec3(1.0, 0.93, 0.88)
                        .mul(lobeAt(0.1, 50))
                        .mul(glossy)
                        .mul(facingLight)
                        .mul(0.14)
                        .mul(shadow)
                        .mul(air)
                )
                .add(sheen.mul(fresnel).mul(0.8).mul(air))
        );
    });

    // --- Shirt: white cotton, its shadows a brushed lavender.
    when("cotton", () => {
        const brush = mx_noise_float(pos.mul(vec3(22, 7, 22))).mul(0.14);
        colour.assign(
            twoTone(C("cotton"), C("cottonShade"), 0.34, brush).add(
                fresnel.mul(0.05)
            )
        );
    });

    // --- Tie: pairs of thin light stripes on the diagonal.
    when("tie", () => {
        const stripe = fract(pos.x.add(pos.y).mul(1 / 0.034));
        const stripes = max(
            smoothstep(0.05, 0.03, abs(stripe.sub(0.4))),
            smoothstep(0.05, 0.03, abs(stripe.sub(0.6)))
        );
        const weave = mx_noise_float(pos.mul(vec3(700, 700, 60))).mul(0.04);
        const cloth = mix(C("tie"), C("tieStripe"), stripes).mul(weave.add(1));
        colour.assign(
            twoTone(cloth, cloth.mul(0.5), 0.3, f32(0)).add(fresnel.mul(0.12))
        );
    });

    // --- Trousers: dark wool, flecked, with a soft bloom at the edges.
    when("wool", () => {
        const fleck = mx_noise_float(pos.mul(520)).mul(0.11);
        const brush = mx_noise_float(pos.mul(vec3(18, 5, 18))).mul(0.12);
        colour.assign(
            twoTone(
                C("wool").mul(fleck.add(1)),
                C("woolShade"),
                0.32,
                brush
            ).add(vec3(0.5, 0.48, 0.6).mul(fresnel).mul(0.1).mul(open))
        );
    });

    // --- Socks: white, ribbed.
    when("knit", () => {
        const rib = sin(atan(pos.z, hx.sub(0.137)).mul(30));
        colour.assign(
            twoTone(
                C("knit").mul(rib.mul(0.035).add(0.965)),
                C("cottonShade"),
                0.25,
                rib.mul(0.03)
            )
        );
    });

    // --- Leather and plastic: black, with a sheen; the buckle is steel.
    when("black", () => {
        const b = sculpt.buckle;
        const edge = max(
            hx.sub(b.half[0]),
            abs(pos.y.sub(b.centre[1])).sub(b.half[1])
        );
        const frame = smoothstep(0.001, 0, edge)
            .mul(smoothstep(-0.0065, -0.0045, edge))
            .mul(smoothstep(b.centre[2] - 0.02, b.centre[2] - 0.01, pos.z));
        const base = mix(C("black"), C("metal"), frame);
        const lit = saturate(ndl.mul(0.5).add(0.5)).mul(mix(0.4, 1, shadow));
        const mirror = SKY.mul(smoothstep(-0.2, 0.6, n.y.sub(rd.y)));
        colour.assign(
            base
                .mul(SUN.mul(lit).mul(0.9).add(SKY.mul(sky).mul(0.3)))
                .mul(mix(0.35, 1, open))
                .add(pow(nh, 46).mul(0.22).mul(shadow))
                .add(pow(nh, 8).mul(0.05))
                .add(mirror.mul(fresnel).mul(0.5).mul(open))
        );
    });

    // --- The ID badge: a card with a photo and three ruled lines.
    when("badge", () => {
        const b = sculpt.badge;
        const u = pos.x.sub(b.centre[0]).div(b.half[0]).toVar();
        const v = pos.y.sub(b.centre[1]).div(b.half[1]).toVar();
        const box = (cu: number, cv: number, hu: number, hv: number) =>
            smoothstep(
                0.04,
                0,
                max(abs(u.sub(cu)).sub(hu), abs(v.sub(cv)).sub(hv))
            );
        const disc = (cu: number, cv: number, sv: number, r: number) =>
            smoothstep(
                0.04,
                0,
                length(vec2(u.sub(cu), v.sub(cv).mul(sv))).sub(r)
            );
        const photo = box(-0.48, 0.02, 0.3, 0.52);
        let lines: Node = f32(0);
        for (const y of [0.42, 0.08, -0.26])
            lines = max(lines, box(0.36, y, 0.42, 0.085));
        let card: Node = mix(C("card"), C("cardInk"), lines);
        card = mix(card, vec3(0.62, 0.66, 0.74), photo);
        card = mix(card, C("cotton"), disc(-0.48, -0.5, 1.4, 0.3).mul(photo));
        card = mix(card, C("skin"), disc(-0.48, 0.1, 0.9, 0.17).mul(photo));
        card = mix(
            card,
            C("hair"),
            disc(-0.48, 0.26, 1.5, 0.2).mul(smoothstep(0.1, 0.16, v)).mul(photo)
        );
        const facingOut = smoothstep(0.2, 0.6, pn.z);
        colour.assign(
            mix(C("card").mul(0.8), card, facingOut)
                .mul(mix(0.55, 1, shadow).mul(mix(0.6, 1, open)))
                .add(pow(nh, 30).mul(0.1))
        );
    });

    return colour;
}
