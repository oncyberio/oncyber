import { BoundPart, SkinFn, bindPart, followBody, rigid } from "./assemble";
import type { CharacterSpec } from "./characters";
import type { MeshBuilder, PartMesh } from "./kernel/build";
import type { Vec3 } from "./kernel/sdf";
import { PaintedTexture, paintFace } from "./paint/faceTexture";
import {
    buildBadge,
    buildEarpiece,
    buildEarrings,
    buildGlasses,
    buildRadio,
} from "./parts/accessories";
import { buildBelt } from "./parts/belt";
import { buildFaceDetails } from "./parts/face";
import { Groom, hairCollider } from "./parts/hair";
import { growPonytail } from "./parts/hairStyles";
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
    const detail = options.detail ?? 1;
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

    const skinMeshes = buildSkin(skin, spec.skin, detail);
    yield lap("skin");
    add("Body", skinMeshes.body, body);
    add("Head", skinMeshes.head, body, {
        kind: "textured",
        repeat: false,
        texture: paintFace(skin, spec.facePaint, spec.skin.base, {
            line: spec.hair.style.hairline,
            colour: spec.hair.palette.base,
        }),
    });
    add("Face", buildFaceDetails(skin, spec.eyes, spec.brows), rigid(head));
    yield lap("face");

    const shirt = buildShirt(rig, skin.body, spec.waist, spec.shirt, detail);
    add("Shirt", shirt.mesh, followBody(rig, { loose: 0.012 }));
    yield lap("shirt");

    add(
        "Skirt",
        buildSkirt(spec.waist, spec.bottom),
        skirtSkin(rig, spec.waist, spec.bottom.hemY)
    );
    add("Belt", buildBelt(spec.waist, spec.belt), chest);
    add(
        "Tie",
        buildTie(shirt.shape, shirt.anchors.knot, spec.waist, spec.tie),
        chest,
        {
            kind: "textured",
            repeat: true,
            texture: tieTexture(spec.tie),
        }
    );
    add("Socks", buildSocks(rig, skin.body, spec.socks), body);
    yield lap("outfit");
    add("Shoes", buildShoes(rig, spec.shoes, detail), body);
    yield lap("shoes");

    add(
        "Badge",
        buildBadge(shirt.shape, shirt.anchors.pocket, spec.badge),
        chest
    );
    if (spec.radio) {
        const beltY = spec.waist.y - 0.006 - spec.belt.height / 2;
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
    const grown = growPonytail(groom, spec.hair.style);
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
    add("Hair", toAvatar(groom.out, skin.toHead), hairSkin);
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
            part.skinWeight.buffer as ArrayBuffer
        );
        if (part.material.kind === "textured")
            out.push(part.material.texture.data.buffer as ArrayBuffer);
    }
    return out;
}
