import { BoundPart, SkinFn, bindPart, followBody, rigid } from "./assemble";
import type { CharacterSpec } from "./characters";
import { Look, MeshBuilder, PartMesh, rgb } from "./kernel/build";
import type { Vec3 } from "./kernel/sdf";
import type { Colour3, StudioSurface } from "./materials";
import { PaintedTexture, faceTinter, paintFace } from "./paint/faceTexture";
import {
    buildBadge,
    buildEarpiece,
    buildEarrings,
    buildGlasses,
    buildHeadphones,
    buildRadio,
    buildRing,
} from "./parts/accessories";
import { buildTrousers } from "./parts/trousers";
import { buildBelt } from "./parts/belt";
import { buildFaceDetails } from "./parts/face";
import { Groom, hairCollider, hairlineDepth } from "./parts/hair";
import { sculptHair } from "./parts/hairSculpt";
import { growHair } from "./parts/hairStyles";
import { buildShirt } from "./parts/shirt";
import { buildShoes } from "./parts/shoes";
import { buildSkin } from "./parts/skin";
import { HEAD_ORIGIN, skinField } from "./parts/skinField";
import { buildSkirt, skirtSkin } from "./parts/skirt";
import { buildSocks } from "./parts/socks";
import { buildTie, tieTexture } from "./parts/tie";
import { BoneDef, Influence, Proportions, Rig } from "./rig";

/**
 * Everything needed to put an avatar on screen, as plain data: no three.js
 * objects, so it can be built in a worker and handed across.
 */
export interface AvatarData {
    id: string;
    bones: BoneDef[];
    /** Design-pose rotations: bone name to [axis, radians]. */
    pose: Record<string, [number, number]>;
    parts: PartData[];
    springs: SpringSpec[];
    /** Milliseconds spent on each stage, for tuning. */
    timings: Record<string, number>;
}

export type MaterialSpec =
    | { kind: "vertex" }
    | { kind: "studio"; options: StudioSurface }
    | { kind: "textured"; texture: PaintedTexture; repeat: boolean }
    | { kind: "glass"; colour: number; opacity: number };

export interface PartData extends BoundPart {
    name: string;
    material: MaterialSpec;
}

/** A chain of bones that swings behind the body: a ponytail. */
export interface SpringSpec {
    bones: string[];
    /** Where the last bone's tip rests, relative to that bone. */
    tip: Vec3;
    stiffness: number;
    drag: number;
    gravity: number;
}

export interface GenerateOptions {
    /** Mesh density; 1 is the default, lower is lighter. */
    detail?: number;
}

const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();

const headPoint = (body: Proportions, p: Vec3): [number, number, number] => [
    body.head[0] + (p[0] - HEAD_ORIGIN[0]) * body.headScale,
    body.head[1] + (p[1] - HEAD_ORIGIN[1]) * body.headScale,
    body.head[2] + (p[2] - HEAD_ORIGIN[2]) * body.headScale,
];

/** Bones beyond the humanoid set that a character's hair needs. */
function hairBones(spec: CharacterSpec): {
    bones: BoneDef[];
    spring?: SpringSpec;
} {
    const style = spec.hair.style;
    if (style.kind !== "ponytail") return { bones: [] };
    const c = style.hairline.centre;
    const l = Math.hypot(style.tie[0], style.tie[1], style.tie[2]) || 1;
    const tie = headPoint(spec.proportions, [
        c[0] + (style.tie[0] / l) * 0.1,
        c[1] + (style.tie[1] / l) * 0.1,
        c[2] + (style.tie[2] / l) * 0.1,
    ]);
    const span =
        ((style.tailLength[0] + style.tailLength[1]) / 2) *
        spec.proportions.headScale;
    const step = span / 3;
    const names = ["hairTail1", "hairTail2", "hairTail3"];
    return {
        bones: names.map((name, i) => ({
            name,
            parent: i === 0 ? "head" : names[i - 1],
            position: [tie[0], tie[1] - step * i, tie[2] - 0.012 * i] as Vec3,
        })),
        spring: {
            bones: names,
            tip: [0, -step, -0.01],
            stiffness: 0.55,
            drag: 0.42,
            gravity: 0.6,
        },
    };
}

/** Carry a head-space mesh onto the avatar's head. */
function toAvatar(
    mesh: MeshBuilder,
    toHead: (p: [number, number, number]) => [number, number, number]
) {
    for (let i = 0; i < mesh.positions.length; i += 3) {
        const p = toHead([
            mesh.positions[i],
            mesh.positions[i + 1],
            mesh.positions[i + 2],
        ]);
        mesh.positions[i] = p[0];
        mesh.positions[i + 1] = p[1];
        mesh.positions[i + 2] = p[2];
    }
    return mesh;
}

/**
 * Build a character step by step. Each `yield` is a point where the caller
 * may pause (to keep a page responsive); the return value is the avatar.
 */
export function* generateSteps(
    spec: CharacterSpec,
    options: GenerateOptions = {}
): Generator<string, AvatarData> {
    // Density applies in full where the eye rests (face, hands, hair,
    // shirt) and in part to what is mostly hidden or simple.
    const coarse = options.detail ?? 1;
    const detail = coarse * (spec.density ?? 1);
    const medium = coarse * Math.sqrt(spec.density ?? 1);
    const studio = spec.look === "studio";
    const look: Look = studio ? "studio" : "painted";
    // In the studio look every part names the shader that lights it.
    const surface = (
        painted: MaterialSpec,
        shaded: StudioSurface
    ): MaterialSpec => (studio ? { kind: "studio", options: shaded } : painted);
    const plain: MaterialSpec = { kind: "vertex" };
    /** A cloth's shadow colour as a multiplier over its lit colour. */
    const shadowOf = (cloth: string, shadow: string): Colour3 => {
        const a = rgb(cloth);
        const b = rgb(shadow);
        return [
            Math.min(1, b[0] / a[0]),
            Math.min(1, b[1] / a[1]),
            Math.min(1, b[2] / a[2]),
        ];
    };
    const leather: StudioSurface = {
        surface: "gloss",
        spec: 0.55,
        tight: 70,
        mirror: 0.6,
    };
    const timings: Record<string, number> = {};
    let mark = now();
    const lap = (name: string) => {
        const t = now();
        timings[name] = Math.round(t - mark);
        mark = t;
        return name;
    };
    const extra = hairBones(spec);
    const rig = new Rig(spec.proportions, extra.bones);
    const skin = skinField(rig, spec.build, spec.face);
    const parts: PartData[] = [];
    const add = (
        name: string,
        part: PartMesh,
        skinFn: SkinFn,
        material: MaterialSpec = { kind: "vertex" }
    ) => {
        if (!part.indices.length) return;
        parts.push({ name, material, ...bindPart(rig, part, skinFn) });
    };
    const head = rig.index.head;
    const body = followBody(rig);
    const chest = followBody(rig, { arms: 0 });

    const roots = {
        line: spec.hair.style.hairline,
        colour: spec.hair.palette.base,
    };
    const skinMeshes = buildSkin(
        skin,
        spec.skin,
        [coarse, detail],
        studio
            ? { tint: faceTinter(skin, spec.facePaint, spec.skin.base, roots) }
            : undefined
    );
    yield lap("skin");
    const skinSurface: StudioSurface = { surface: "skin", scatter: 1 };
    add("Body", skinMeshes.body, body, surface(plain, skinSurface));
    add(
        "Head",
        skinMeshes.head,
        body,
        studio
            ? { kind: "studio", options: skinSurface }
            : {
                  kind: "textured",
                  repeat: false,
                  texture: paintFace(
                      skin,
                      spec.facePaint,
                      spec.skin.base,
                      roots
                  ),
              }
    );
    if (studio) {
        add(
            "Eyes",
            buildFaceDetails(skin, spec.eyes, spec.brows, "eyes", true),
            rigid(head),
            { kind: "studio", options: { surface: "eye" } }
        );
        add(
            "Brows",
            buildFaceDetails(skin, spec.eyes, spec.brows, "hairs", true),
            rigid(head),
            {
                kind: "studio",
                options: {
                    surface: "cloth",
                    shadow: [0.5, 0.5, 0.55],
                    sheen: 0.4,
                    rim: 0,
                    grain: 0,
                    brush: 0,
                },
            }
        );
    } else
        add("Face", buildFaceDetails(skin, spec.eyes, spec.brows), rigid(head));
    yield lap("face");

    const shirt = buildShirt(
        rig,
        skin.body,
        spec.waist,
        spec.shirt,
        detail,
        look
    );
    add(
        "Shirt",
        shirt.mesh,
        body,
        surface(plain, {
            surface: "cloth",
            shadow: shadowOf(spec.shirt.cloth, spec.shirt.shadow),
            sheen: 0.22,
            rim: 0.22,
            grain: 0.025,
            brush: 0.12,
        })
    );
    yield lap("shirt");

    if (spec.bottom.kind === "skirt")
        add(
            "Skirt",
            buildSkirt(spec.waist, spec.bottom),
            skirtSkin(rig, spec.waist, spec.bottom.hemY)
        );
    else
        add(
            "Trousers",
            buildTrousers(rig, skin.body, spec.waist, spec.bottom, medium, look)
                .mesh,
            chest,
            surface(plain, {
                surface: "cloth",
                shadow: shadowOf(spec.bottom.cloth, spec.bottom.shadow),
                sheen: 0.5,
                rim: 0.55,
                grain: 0.16,
                brush: 0.03,
            })
        );
    add(
        "Belt",
        buildBelt(spec.waist, spec.belt),
        chest,
        surface(plain, leather)
    );
    add(
        "Tie",
        buildTie(shirt.shape, shirt.anchors.knot, spec.waist, spec.tie, studio),
        chest,
        studio
            ? {
                  kind: "studio",
                  options: {
                      surface: "cloth",
                      shadow: [0.5, 0.52, 0.72],
                      sheen: 0.7,
                      rim: 0.2,
                      grain: 0.03,
                      brush: 0,
                      stripes: {
                          colour: rgb(spec.tie.stripe),
                          paired: spec.tie.paired,
                      },
                  },
              }
            : { kind: "textured", repeat: true, texture: tieTexture(spec.tie) }
    );
    add(
        "Socks",
        buildSocks(rig, skin.body, spec.socks),
        body,
        surface(plain, {
            surface: "cloth",
            shadow: shadowOf(spec.socks.colour, spec.socks.shadow),
            sheen: 0.15,
            rim: 0.15,
            grain: 0.04,
            brush: 0,
        })
    );
    yield lap("outfit");
    add(
        "Shoes",
        buildShoes(rig, spec.shoes, medium, look),
        body,
        surface(plain, {
            surface: "gloss",
            spec: 0.8,
            tight: 110,
            mirror: 0.28,
        })
    );
    yield lap("shoes");

    add(
        "Badge",
        buildBadge(shirt.shape, shirt.anchors.pocket, spec.badge),
        chest,
        surface(plain, { surface: "gloss", spec: 0.3, tight: 40, mirror: 0.2 })
    );
    const beltY = spec.waist.y - 0.006 - spec.belt.height / 2;
    if (spec.headphones)
        add(
            "Headphones",
            buildHeadphones(
                shirt.shape,
                shirt.anchors.collarY,
                rig.body.upperArm[1],
                spec.waist,
                beltY,
                spec.headphones
            ),
            chest,
            surface(plain, leather)
        );
    if (spec.ring) {
        const finger = rig.finger("right", "Ring");
        add(
            "Ring",
            buildRing(
                finger.points[0],
                finger.points[1],
                finger.radius[0] + 0.0012,
                spec.ring
            ),
            rigid(finger.bones[0]),
            surface(plain, {
                surface: "gloss",
                spec: 0.9,
                tight: 90,
                mirror: 0.9,
            })
        );
    }
    if (spec.radio) {
        const radio = buildRadio(spec.waist, beltY, spec.radio);
        add("Radio", radio.mesh, rigid(rig.index.hips));
        add(
            "Earpiece",
            buildEarpiece(
                shirt.shape,
                shirt.anchors.collarY,
                rig.body.upperArm[1],
                radio.jack,
                spec.radio.cable
            ),
            chest
        );
    }
    if (spec.glasses) {
        const glasses = buildGlasses(skin.face, spec.glasses);
        add("Glasses", toAvatar(glasses.frame, skin.toHead), rigid(head));
        add("Lenses", toAvatar(glasses.lenses, skin.toHead), rigid(head), {
            kind: "glass",
            colour: 0xdfe9f2,
            opacity: 0.16,
        });
    }
    if (spec.earrings)
        add(
            "Earrings",
            toAvatar(
                buildEarrings(
                    skin.face,
                    spec.earrings.colour,
                    spec.earrings.size
                ),
                skin.toHead
            ),
            rigid(head)
        );
    yield lap("accessories");

    // Hair is grown in reference head space, then set on this head.
    const groom = new Groom(
        hairCollider(skin, [shirt.shape]),
        spec.hair.palette,
        spec.hair.seed
    );
    // The studio look sculpts the locks into one mass; strays stay strands.
    if (studio) groom.sculpt = [];
    const grown = growHair(groom, spec.hair.style);
    yield lap("groom");
    if (groom.sculpt && groom.sculpt.length) {
        const line = spec.hair.style.hairline;
        const min: [number, number, number] = [Infinity, Infinity, Infinity];
        const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
        for (const lock of groom.sculpt)
            for (const p of lock.path)
                for (let k = 0; k < 3; k++) {
                    min[k] = Math.min(min[k], p[k] - 0.02);
                    max[k] = Math.max(max[k], p[k] + 0.02);
                }
        const sculpted = sculptHair(groom.sculpt, {
            head: skin.head,
            // Hair grows inside the hairline and leaves the ears clear.
            hairline: (p) =>
                Math.min(
                    hairlineDepth(line, p),
                    Math.hypot(
                        Math.abs(p[0]) - skin.face.ear[0],
                        p[1] - skin.face.ear[1],
                        p[2] - skin.face.ear[2]
                    ) - 0.03
                ),
            base: rgb(spec.hair.palette.base),
            tip: rgb(spec.hair.palette.tip),
            cell: 0.0034 / detail,
            min,
            max,
        });
        groom.out.append(sculpted);
    }
    let hairSkin: SkinFn = rigid(head);
    if (grown.tie && extra.spring) {
        // Hair hanging below the tie swings on its own bones.
        const tie = skin.toHead(grown.tie);
        const tail = extra.spring.bones.map((name) => rig.index[name]);
        const step = -extra.spring.tip[1];
        const scale = rig.body.headScale;
        const smooth = (a: number, b: number, x: number) => {
            const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
            return t * t * (3 - 2 * t);
        };
        hairSkin = (x, y, z, out: Influence) => {
            out.clear();
            const below = tie[1] - y;
            const behind =
                z < tie[2] + 0.03 * scale && Math.abs(x) < 0.1 * scale;
            if (!behind || below < -0.004) {
                out.add(head, 1).finish();
                return;
            }
            const w1 = smooth(-0.004, 0.02, below);
            const w2 = smooth(step * 0.6, step * 1.4, below);
            const w3 = smooth(step * 1.6, step * 2.4, below);
            out.add(head, 1 - w1)
                .add(tail[0], w1 * (1 - w2))
                .add(tail[1], w1 * w2 * (1 - w3))
                .add(tail[2], w1 * w2 * w3)
                .finish();
        };
    }
    add(
        "Hair",
        toAvatar(groom.out, skin.toHead),
        hairSkin,
        surface(plain, {
            surface: "hair",
            sheen: rgb(spec.hair.palette.sheen),
            glint: 0.16,
        })
    );
    lap("hair");

    return {
        id: spec.id,
        bones: rig.bones,
        pose: rig.pose,
        parts,
        springs: extra.spring ? [extra.spring] : [],
        timings,
    };
}

/** Build a character in one go. */
export function generateAvatar(
    spec: CharacterSpec,
    options: GenerateOptions = {}
): AvatarData {
    const steps = generateSteps(spec, options);
    for (;;) {
        const next = steps.next();
        if (next.done) return next.value;
    }
}

/** The buffers of an avatar, for handing it across threads without a copy. */
export function transferables(data: AvatarData): ArrayBuffer[] {
    const out: ArrayBuffer[] = [];
    for (const part of data.parts) {
        out.push(
            part.positions.buffer as ArrayBuffer,
            part.normals.buffer as ArrayBuffer,
            part.colors.buffer as ArrayBuffer,
            part.uvs.buffer as ArrayBuffer,
            part.indices.buffer as ArrayBuffer,
            part.skinIndex.buffer as ArrayBuffer,
            part.skinWeight.buffer as ArrayBuffer,
            part.aux.buffer as ArrayBuffer,
            part.tangents.buffer as ArrayBuffer
        );
        if (part.material.kind === "textured")
            out.push(part.material.texture.data.buffer as ArrayBuffer);
    }
    return out;
}
