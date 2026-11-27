import * as THREE from "three/webgpu";
import {
    Break,
    Discard,
    Fn,
    If,
    Loop,
    abs,
    atan,
    cameraPosition,
    clamp,
    cross,
    dot,
    exp,
    float as f32,
    fract,
    length,
    max,
    min,
    mix,
    mx_noise_float,
    normalize,
    positionWorld,
    pow,
    saturate,
    sin,
    smoothstep,
    sqrt,
    vec2,
    vec3,
    vec4,
} from "three/tsl";
import { rgb } from "./kernel/build";
import { Field, Shape, Vec3 } from "./kernel/sdf";
import type { Sculpt, SculptLayer, SculptMaterial } from "./sculpts/types";

/**
 * A character traced per pixel, the way Inigo Quilez paints his: the
 * sculpt is a distance field evaluated in the shader, so the surface, its
 * soft shadows, occlusion and the light scattered under skin are all exact,
 * and every feature (iris, lashes, brows, lips, strands of hair, the weave
 * of the cloth) is drawn with maths at the resolution of the screen.
 *
 * This is the reference for fidelity, not the avatar people wear: it costs
 * a full field evaluation per step per pixel. The same shapes feed the
 * mesher, which is how the look is brought to something affordable.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;

const v3 = (v: readonly number[]) => vec3(v[0], v[1], v[2]);

function smin(a: Node, b: Node, k: number): Node {
    if (k <= 0) return min(a, b);
    const h = max(f32(k).sub(abs(a.sub(b))), 0);
    return min(a, b).sub(h.mul(h).div(4 * k));
}

function smax(a: Node, b: Node, k: number): Node {
    if (k <= 0) return max(a, b);
    const h = max(f32(k).sub(abs(a.sub(b))), 0);
    return max(a, b).add(h.mul(h).div(4 * k));
}

/** A point in the frame of a row-major basis (its columns are the axes). */
function local(d: Node, m: readonly number[]): Node {
    return vec3(
        dot(d, vec3(m[0], m[3], m[6])),
        dot(d, vec3(m[1], m[4], m[7])),
        dot(d, vec3(m[2], m[5], m[8]))
    );
}

/**
 * Distance to an ellipse-sectioned lock from the offset `q` off its axis:
 * `r` wide, `r * flat` thick along `out`. The same estimate the kernel
 * makes, from the ellipse's implicit function and its gradient.
 */
function ribbonDistance(q: Node, out: Node, r: Node, flat: number): Node {
    const o = dot(q, out).toVar();
    const rest = q.sub(out.mul(o)).toVar();
    const wide2 = dot(rest, rest).toVar();
    const r2 = r.mul(r).toVar();
    const thin2 = r2.mul(flat * flat).toVar();
    const o2 = o.mul(o).toVar();
    const k0 = sqrt(wide2.div(r2).add(o2.div(thin2))).toVar();
    const k1 = sqrt(wide2.div(r2.mul(r2)).add(o2.div(thin2.mul(thin2))));
    return k0.mul(k0.sub(1)).div(k1.add(1e-4));
}

/** Rebuild a kernel shape as shader code evaluating it at `p`. */
export function emit(shape: Shape, p: Node): Node {
    if (shape instanceof Field) {
        let d: Node;
        for (const step of shape.steps) {
            const v = emit(step.shape, p).toVar();
            d = !d
                ? v
                : step.kind === 0
                ? smin(d, v, step.k)
                : step.kind === 1
                ? smax(d, v.negate(), step.k)
                : smax(d, v, step.k);
            d = d.toVar();
        }
        return d || f32(1);
    }
    const desc = shape.desc;
    if (!desc) throw new Error("This shape cannot be traced in a shader");
    switch (desc.type) {
        case "sphere":
            return length(p.sub(v3(desc.c))).sub(desc.r);
        case "ellipsoid": {
            const q = local(p.sub(v3(desc.c)).toVar(), desc.basis)
                .div(v3(desc.r))
                .toVar();
            const k0 = length(q);
            const k1 = length(q.div(v3(desc.r)));
            return k0.mul(k0.sub(1)).div(k1.add(1e-6));
        }
        case "roundCone": {
            const ba: Vec3 = [
                desc.b[0] - desc.a[0],
                desc.b[1] - desc.a[1],
                desc.b[2] - desc.a[2],
            ];
            const l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2] || 1e-9;
            const pa = p.sub(v3(desc.a)).toVar();
            const h = clamp(dot(pa, v3(ba)).div(l2), 0, 1).toVar();
            return length(pa.sub(v3(ba).mul(h))).sub(
                mix(f32(desc.ra), f32(desc.rb), h)
            );
        }
        case "ribbonCone": {
            const ba: Vec3 = [
                desc.b[0] - desc.a[0],
                desc.b[1] - desc.a[1],
                desc.b[2] - desc.a[2],
            ];
            const l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2] || 1e-9;
            const pa = p.sub(v3(desc.a)).toVar();
            const h = clamp(dot(pa, v3(ba)).div(l2), 0, 1).toVar();
            const q = pa.sub(v3(ba).mul(h)).toVar();
            const out = normalize(mix(v3(desc.out), v3(desc.outEnd), h));
            return ribbonDistance(
                q,
                out,
                mix(f32(desc.ra), f32(desc.rb), h),
                desc.flat
            );
        }
        case "roundBox": {
            const q = abs(local(p.sub(v3(desc.c)).toVar(), desc.basis))
                .sub(
                    vec3(
                        desc.half[0] - desc.radius,
                        desc.half[1] - desc.radius,
                        desc.half[2] - desc.radius
                    )
                )
                .toVar();
            return length(max(q, 0))
                .add(min(max(q.x, max(q.y, q.z)), 0))
                .sub(desc.radius);
        }
        case "torus": {
            const l = local(p.sub(v3(desc.c)).toVar(), desc.basis).toVar();
            const q = length(vec2(l.x, l.z)).sub(desc.major);
            return length(vec2(q, l.y)).sub(desc.minor);
        }
        case "halfSpace": {
            const l = Math.hypot(desc.n[0], desc.n[1], desc.n[2]) || 1;
            const n: Vec3 = [desc.n[0] / l, desc.n[1] / l, desc.n[2] / l];
            return dot(p, v3(n)).sub(
                desc.p[0] * n[0] + desc.p[1] * n[1] + desc.p[2] * n[2]
            );
        }
        case "symmetric":
            return emit(desc.source, vec3(abs(p.x), p.y, p.z).toVar());
        case "offset":
            return emit(desc.source, p).sub(desc.amount);
        case "place": {
            const q = p
                .sub(v3(desc.to))
                .div(desc.scale)
                .add(v3(desc.from))
                .toVar();
            return emit(desc.source, q).mul(desc.scale);
        }
    }
}

// The light of the character sheet: a broad key from the front, a little
// to his right and above; a cool fill from the other side; warm light
// coming back up off the floor.
const KEY = vec3(-0.4, 0.62, 0.675);
const FILL = vec3(0.78, 0.22, 0.58);
const BACK = vec3(0.3, 0.5, -0.81);
// The sheet is lit evenly from every side: a second, weaker key behind.
const REAR = vec3(0.32, 0.55, -0.77);
const SUN = vec3(1.0, 0.95, 0.9);
const SKY = vec3(0.72, 0.76, 0.9);
const BOUNCE = vec3(0.95, 0.72, 0.62);

/** Width of the unit the across-the-lock coordinate is counted in. */
const HAIR_STRAND = 0.001;

const floatOf = (name: string, inputs: [string, string][]) => ({
    name,
    type: "float",
    inputs: inputs.map(([n, type]) => ({ name: n, type })),
});

/**
 * A cheap, smooth wobble between -1 and 1: sines bent by each other. It is
 * evaluated at every step of every ray, where real noise would cost too
 * much.
 */
function wobble(p: Node): Node {
    return sin(p.x.add(sin(p.z.mul(1.31).add(p.y.mul(0.7))).mul(1.4))).mul(
        sin(p.y.add(sin(p.x.mul(1.17).add(1.3)).mul(1.3)).add(p.z.mul(0.6)))
    );
}

/** The most `relief` moves a surface, so far-off points can skip it. */
const RELIEF_REACH = 0.012;

/** Folds and creases pressed into a layer, in metres. */
function relief(material: SculptMaterial, p: Node): Node | null {
    const hx = abs(p.x);
    if (material === "cotton") {
        // Sleeves wrinkle across the arm; the body drapes from the
        // shoulders and gathers at the belt.
        const sleeve = smoothstep(0.17, 0.3, hx);
        const warp = wobble(p.mul(vec3(7, 11, 11))).toVar();
        const across = sin(
            hx.mul(38).add(p.y.mul(30)).add(warp.mul(2.2)).add(p.z.mul(8))
        ).mul(0.0024);
        // Long folds falling from the shoulder towards the waist.
        const body = sin(
            hx.mul(26).sub(p.y.mul(13)).add(warp.mul(1.6)).add(p.z.mul(6))
        ).mul(0.0022);
        const gather = sin(p.x.mul(70).add(warp.mul(2)))
            .mul(0.0022)
            .mul(smoothstep(1.22, 1.14, p.y));
        return mix(body.add(gather), across.add(warp.mul(0.0016)), sleeve).mul(
            // Keep the collar and cuffs crisp.
            smoothstep(1.47, 1.44, p.y).mul(smoothstep(0.61, 0.58, hx))
        );
    }
    if (material === "wool") {
        // A pressed crease down the front and back of each leg, and two
        // pleats opening from the waistband.
        const centre = mix(f32(0.14), f32(0.066), smoothstep(0.25, 1.08, p.y));
        const crease = exp(abs(hx.sub(centre)).div(-0.005)).mul(0.0042);
        const pleats = sin(hx.mul(150).add(0.6))
            .mul(0.0032)
            .mul(smoothstep(0.82, 1.08, p.y))
            .mul(smoothstep(0.0, 0.05, p.z));
        const drape = wobble(vec3(p.x.mul(10), p.y.mul(3.2), p.z.mul(10))).mul(
            0.004
        );
        return crease.add(pleats).add(drape);
    }
    return null;
}

/** A raymarched character, drawn on a box that encloses it. */
export function createRaymarchedAvatar(sculpt: Sculpt) {
    const C = (name: keyof Sculpt["palette"]) => v3(rgb(sculpt.palette[name]));
    const face = sculpt.face;

    // Each layer is a function of its own. Outside the box that holds it,
    // the distance to the box stands in for it, so a ray only pays for the
    // layers it is near.
    const layerFn = (layer: SculptLayer, index: number) => {
        const centre = layer.min.map((v, i) => (v + layer.max[i]) / 2);
        const half = layer.min.map((v, i) => (layer.max[i] - v) / 2);
        return Fn(([p]: Node[]) => {
            const q = abs(p.sub(v3(centre)))
                .sub(v3(half))
                .toVar();
            const outside = length(max(q, 0)).add(
                min(max(q.x, max(q.y, q.z)), 0)
            );
            const d = f32(0).toVar();
            If(outside.greaterThan(0.03), () => {
                d.assign(outside);
            }).Else(() => {
                d.assign(emit(layer.shape, p));
                // Folds only matter near the cloth: within reach of the
                // samples that shade it.
                if (relief(layer.material, p))
                    If(d.lessThan(0.05), () => {
                        d.subAssign(relief(layer.material, p));
                    }).Else(() => {
                        d.subAssign(RELIEF_REACH);
                    });
            });
            return d;
        }).setLayout(floatOf(`layer${index}`, [["p", "vec3"]]));
    };
    const layers = sculpt.layers.map((layer, i) => ({
        layer,
        fn: layerFn(layer, i),
    }));
    const order: SculptMaterial[] = [
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
    /** Distance to the nearest layer, and what that layer is made of. */
    const map = Fn(([p]: Node[]) => {
        const nearest = f32(1e3).toVar();
        const material = f32(0).toVar();
        for (const { layer, fn } of layers) {
            const d = fn(p).toVar();
            If(d.lessThan(nearest), () => {
                nearest.assign(d);
                material.assign(order.indexOf(layer.material));
            });
        }
        return vec2(nearest, material);
    }).setLayout({
        name: "mapAll",
        type: "vec2",
        inputs: [{ name: "p", type: "vec3" }],
    });

    // Hair: which lock a point is on, which way it runs, and where round
    // the lock the point sits, so strands can be drawn along it.
    const hairInfo = Fn(([p, n]: Node[]) => {
        const best = f32(1e3).toVar();
        const tangent = vec3(0, -1, 0).toVar();
        const coord = f32(0).toVar();
        const run = f32(0.5).toVar();
        for (const seg of sculpt.hair.segments) {
            const ba: Vec3 = [
                seg.b[0] - seg.a[0],
                seg.b[1] - seg.a[1],
                seg.b[2] - seg.a[2],
            ];
            const l = Math.hypot(ba[0], ba[1], ba[2]) || 1e-6;
            const pa = p.sub(v3(seg.a)).toVar();
            const k = clamp(dot(pa, v3(ba)).div(l * l), 0, 1).toVar();
            const q = pa.sub(v3(ba).mul(k)).toVar();
            const out = normalize(mix(v3(seg.out), v3(seg.outEnd), k));
            const d = ribbonDistance(
                q,
                out,
                mix(f32(seg.ra), f32(seg.rb), k),
                seg.flat
            );
            If(d.lessThan(best), () => {
                best.assign(d);
                // The lock's direction turns smoothly along the piece.
                tangent.assign(normalize(mix(v3(seg.ta), v3(seg.tb), k)));
                // "Across" turns smoothly along the piece and matches the
                // next piece's at the joint, so strands run through it.
                coord.assign(
                    dot(q, normalize(mix(v3(seg.sa), v3(seg.sb), k)))
                        .div(HAIR_STRAND)
                        .add(seg.lock * 37.7)
                );
                run.assign(mix(f32(seg.va), f32(seg.vb), k));
            });
        }
        // The undercoat is combed straight down.
        If(emit(sculpt.hair.cap, p).lessThan(best.sub(0.0005)), () => {
            tangent.assign(normalize(cross(n, cross(n, vec3(0, 1, 0)))));
            coord.assign(atan(p.x, p.z).mul(0.085 / HAIR_STRAND));
            run.assign(0.9);
        });
        // Packed into four numbers: the lock's direction (its z only by
        // sign, folded into the last), the strand coordinate, and how far
        // along the lock the point is.
        return vec4(
            tangent.x,
            tangent.y,
            coord,
            run.add(tangent.z.lessThan(0).select(2, 0))
        );
    }).setLayout({
        name: "hairInfo",
        type: "vec4",
        inputs: [
            { name: "p", type: "vec3" },
            { name: "n", type: "vec3" },
        ],
    });

    const shade = Fn(() => {
        const ro = cameraPosition;
        const rd = normalize(positionWorld.sub(cameraPosition)).toVar();
        const t = length(positionWorld.sub(cameraPosition)).toVar();
        const far = t.add(2.2).toVar();
        const hit = f32(0).toVar();
        const material = f32(0).toVar();
        Loop(150, () => {
            const res = map(ro.add(rd.mul(t))).toVar();
            If(res.x.lessThan(0.00028), () => {
                hit.assign(1);
                material.assign(res.y);
                Break();
            });
            t.addAssign(res.x.mul(0.85));
            If(t.greaterThan(far), () => {
                Break();
            });
        });
        If(hit.lessThan(0.5), () => {
            Discard();
        });
        const pos = ro.add(rd.mul(t)).toVar();
        // Everything else the surface needs from the field is gathered in
        // one loop, so the field is only written out twice in the shader:
        // four samples for the normal (the gradient, by tetrahedral
        // differences), then a walk towards the key light for a soft
        // shadow, then a few steps along the normal for occlusion.
        const n = vec3(0, 1, 0).toVar();
        const gradient = vec3(0).toVar();
        const shadow = f32(1).toVar();
        // Cloth leaves its own folds to the occlusion term: a shadow ray
        // started among them only draws bands.
        const cloth = abs(material.sub(order.indexOf("cotton")))
            .lessThan(0.5)
            .or(abs(material.sub(order.indexOf("wool"))).lessThan(0.5));
        const st = f32(0.012).toVar();
        If(cloth, () => {
            st.assign(0.04);
        });
        const before = f32(1e3).toVar();
        const occ = f32(0).toVar();
        const weight = f32(1).toVar();
        const NORMAL = 4;
        const SHADOW = 30;
        const OCCLUSION = 5;
        Loop(NORMAL + SHADOW + OCCLUSION, ({ i }: { i: Node }) => {
            const q = vec3(0).toVar();
            const corner = vec3(1, 1, 1).toVar();
            const reach = f32(0).toVar();
            If(i.lessThan(NORMAL), () => {
                If(i.equal(0), () => {
                    corner.assign(vec3(1, -1, -1));
                });
                If(i.equal(1), () => {
                    corner.assign(vec3(-1, -1, 1));
                });
                If(i.equal(2), () => {
                    corner.assign(vec3(-1, 1, -1));
                });
                q.assign(pos.add(corner.mul(0.0006)));
            })
                .ElseIf(i.lessThan(NORMAL + SHADOW), () => {
                    q.assign(pos.add(n.mul(0.003)).add(KEY.mul(st)));
                })
                .Else(() => {
                    reach.assign(
                        f32(i.sub(NORMAL + SHADOW))
                            .mul(0.009)
                            .add(0.004)
                    );
                    q.assign(pos.add(n.mul(reach)));
                });
            const d = map(q).x.toVar();
            If(i.lessThan(NORMAL), () => {
                gradient.addAssign(corner.mul(d));
                If(i.equal(NORMAL - 1), () => {
                    n.assign(normalize(gradient));
                });
            })
                .ElseIf(i.lessThan(NORMAL + SHADOW), () => {
                    // Estimate how near the ray passed between this sample
                    // and the last, so the penumbra has no bands.
                    const y = d.mul(d).div(before.mul(2));
                    const near = sqrt(max(d.mul(d).sub(y.mul(y)), 0));
                    shadow.assign(
                        min(shadow, near.mul(6).div(max(st.sub(y), 0.0001)))
                    );
                    before.assign(d);
                    st.addAssign(clamp(d, 0.005, 0.04));
                })
                .Else(() => {
                    occ.addAssign(reach.sub(d).mul(weight));
                    weight.mulAssign(0.8);
                });
        });
        shadow.assign(saturate(shadow));
        shadow.assign(shadow.mul(shadow).mul(shadow.mul(-2).add(3)));
        const open = saturate(f32(1).sub(occ.mul(20))).toVar();

        const is = (name: SculptMaterial) =>
            abs(material.sub(order.indexOf(name))).lessThan(0.5);

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
        const twoTone = (
            base: Node,
            shadeOf: Node,
            soft: number,
            grain: Node
        ) => {
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
        If(is("skin"), () => {
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
                return f32(1).sub(
                    smoothstep(0.6, 1.1, dx.mul(dx).add(dy.mul(dy)))
                );
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
                            blob(
                                [
                                    0,
                                    face.noseTip[1] - 0.0085,
                                    face.noseTip[2] - 0.008,
                                ],
                                [0.0095, 0.0042, 0.012]
                            ).mul(0.75)
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
                .mul(smoothstep(0.3, 0.55, n.z));
            albedo = mix(albedo, C("brow"), brow);
            // Lash lines: the rims of the lids, the upper one thick.
            const el = vec3(
                hx.sub(face.eye[0]),
                pos.y.sub(face.eye[1]),
                pos.z.sub(face.eye[2])
            ).toVar();
            const onLid = smoothstep(
                0.004,
                0.0015,
                abs(length(el).sub(face.lidRadius))
            )
                .mul(smoothstep(0.6, 0.76, el.z.div(face.lidRadius)))
                .mul(smoothstep(0.025, 0.021, length(vec2(el.x, el.y))));
            // The upper lash line is a heavy band on the lid above its
            // edge, thinner towards the nose; the lower lid is only a
            // thin line round the bottom of the eye's outline.
            const across = dot(el, v3(face.upperLid.across)).toVar();
            const aboveEdge = dot(el, v3(face.upperLid.normal)).negate();
            const band = mix(
                f32(0.0038),
                f32(0.005),
                smoothstep(-0.016, 0.004, across)
            );
            const upper = smoothstep(band, band.sub(0.0012), abs(aboveEdge))
                .mul(onLid)
                .mul(smoothstep(-0.002, 0.002, el.y.add(el.x.mul(0.2))));
            const rise = vec2(
                -face.upperLid.across[1],
                face.upperLid.across[0]
            );
            const below = dot(vec2(el.x, el.y), rise);
            const rim = length(
                vec2(across.div(face.opening.rx), below.div(face.opening.ry))
            );
            const lower = smoothstep(0.07, 0.02, abs(rim.sub(0.97)))
                .mul(smoothstep(0.001, -0.002, below))
                .mul(smoothstep(0.012, 0.02, el.z))
                .mul(0.45);
            albedo = mix(albedo, C("lash"), max(upper, lower));

            // Soft wrap light, shadows that turn red at their edges, and
            // a warm rim.
            const wrap = vec3(0.65, 0.44, 0.34);
            const lit = saturate(vec3(ndl).add(wrap).div(wrap.add(1)));
            // A drawn face is barely shaded: cast shadows only tint it.
            // The neck, though, sits in the shadow of the jaw.
            const cast = mix(
                f32(0.75),
                f32(0.22),
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
        If(is("eye"), () => {
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
                mix(iris, vec3(0.01, 0.007, 0.006), smoothstep(0.62, 0.55, r)),
                C("white").mul(f32(1).sub(smoothstep(1, 3.5, r).mul(0.16))),
                smoothstep(0.97, 1.04, r)
            ).mul(mix(0.62, 1, underLid));
            colour.assign(
                albedo
                    .mul(mix(0.7, 1, shadow).mul(mix(0.7, 1, open)).mul(0.98))
                    .add(pow(nh, 260).mul(0.9).mul(shadow))
                    .add(
                        pow(saturate(dot(n, normalize(FILL.sub(rd)))), 160).mul(
                            0.25
                        )
                    )
            );
        });

        // --- Hair: strands drawn along each lock, lit along their length.
        If(is("hair"), () => {
            const info = hairInfo(pos, n).toVar();
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
        If(is("cotton"), () => {
            const brush = mx_noise_float(pos.mul(vec3(22, 7, 22))).mul(0.14);
            colour.assign(
                twoTone(C("cotton"), C("cottonShade"), 0.34, brush).add(
                    fresnel.mul(0.05)
                )
            );
        });

        // --- Tie: pairs of thin light stripes on the diagonal.
        If(is("tie"), () => {
            const stripe = fract(pos.x.add(pos.y).mul(1 / 0.034));
            const stripes = max(
                smoothstep(0.05, 0.03, abs(stripe.sub(0.4))),
                smoothstep(0.05, 0.03, abs(stripe.sub(0.6)))
            );
            const weave = mx_noise_float(pos.mul(vec3(700, 700, 60))).mul(0.04);
            const cloth = mix(C("tie"), C("tieStripe"), stripes).mul(
                weave.add(1)
            );
            colour.assign(
                twoTone(cloth, cloth.mul(0.5), 0.3, f32(0)).add(
                    fresnel.mul(0.12)
                )
            );
        });

        // --- Trousers: dark wool, flecked, with a soft bloom at the edges.
        If(is("wool"), () => {
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
        If(is("knit"), () => {
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
        If(is("black"), () => {
            const b = sculpt.buckle;
            const edge = max(
                hx.sub(b.half[0]),
                abs(pos.y.sub(b.centre[1])).sub(b.half[1])
            );
            const frame = smoothstep(0.001, 0, edge)
                .mul(smoothstep(-0.0065, -0.0045, edge))
                .mul(smoothstep(b.centre[2] - 0.02, b.centre[2] - 0.01, pos.z));
            const base = mix(C("black"), C("metal"), frame);
            const lit = saturate(ndl.mul(0.5).add(0.5)).mul(
                mix(0.4, 1, shadow)
            );
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
        If(is("badge"), () => {
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
            card = mix(
                card,
                C("cotton"),
                disc(-0.48, -0.5, 1.4, 0.3).mul(photo)
            );
            card = mix(card, C("skin"), disc(-0.48, 0.1, 0.9, 0.17).mul(photo));
            card = mix(
                card,
                C("hair"),
                disc(-0.48, 0.26, 1.5, 0.2)
                    .mul(smoothstep(0.1, 0.16, v))
                    .mul(photo)
            );
            const facingOut = smoothstep(0.2, 0.6, n.z);
            colour.assign(
                mix(C("card").mul(0.8), card, facingOut)
                    .mul(mix(0.55, 1, shadow).mul(mix(0.6, 1, open)))
                    .add(pow(nh, 30).mul(0.1))
            );
        });

        return colour;
    });

    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = shade();
    // The box only says where to trace; the ray starts on its near faces.
    const height = sculpt.height + 0.02;
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.84, height, 0.56),
        material
    );
    mesh.position.set(0, height / 2 - 0.004, 0.03);
    mesh.name = `raymarched-${sculpt.id}`;
    return {
        mesh,
        /** Where the face is, for framing a camera. */
        focus: [0, face.eye[1], 0] as Vec3,
        dispose() {
            mesh.geometry.dispose();
            material.dispose();
        },
    };
}
