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
    length,
    max,
    min,
    mix,
    normalize,
    positionWorld,
    saturate,
    sin,
    smoothstep,
    sqrt,
    vec2,
    vec3,
    vec4,
} from "three/tsl";
import { Field, Shape, Vec3 } from "./kernel/sdf";
import type { Sculpt, SculptLayer, SculptMaterial } from "./sculpts/types";
import { HAIR_STRAND, KEY, MATERIAL_ORDER, surfaceColour, v3 } from "./shading";

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
    /** Distance to the nearest layer, and what that layer is made of. */
    const map = Fn(([p]: Node[]) => {
        const nearest = f32(1e3).toVar();
        const material = f32(0).toVar();
        for (const { layer, fn } of layers) {
            const d = fn(p).toVar();
            If(d.lessThan(nearest), () => {
                nearest.assign(d);
                material.assign(MATERIAL_ORDER.indexOf(layer.material));
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
        const cloth = abs(material.sub(MATERIAL_ORDER.indexOf("cotton")))
            .lessThan(0.5)
            .or(
                abs(material.sub(MATERIAL_ORDER.indexOf("wool"))).lessThan(0.5)
            );
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

        return surfaceColour(sculpt, {
            pos,
            n,
            paintNormal: n,
            rd,
            shadow,
            open,
            kind: material,
            hair: () => hairInfo(pos, n),
        });
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
        focus: [0, sculpt.face.eye.centre[1], 0] as Vec3,
        dispose() {
            mesh.geometry.dispose();
            material.dispose();
        },
    };
}
