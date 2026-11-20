import { createHandItems, type Hand, type GripOptions } from "./handItems";
import { createGazePose, type PupilSpan } from "./gazePose";
import { compactIndexedGeometry, retopologize } from "./retopology";
import {
    coatUVBase,
    surfaceGrain,
    finish,
    pupilUVBase,
    type Finish,
} from "./surfaces";
import * as T from "three/webgpu";
import * as N from "three/tsl";

export type Point = [number, number, number];
/** Matched end and start rings on two consecutive skinned cloth panels. */
export interface PanelJoin {
    top: number;
    bottom: number;
    ringStart?: number;
    stride?: number;
}
export interface PaintRun {
    start: number;
    count: number;
    bone: string;
    eyes: boolean;
    pupil?: boolean;
    familyPart?: string;
    gradient?: { top: number; bottom: number; from: string; to: string };
    crown?: boolean;
    drape: boolean;
    color: string;
}
export interface TemplateSource {
    points: Float32Array;
    runs: PaintRun[];
    geometry: T.BufferGeometry;
}
const vec = (p: Point) => new T.Vector3(...p);
const axisY = new T.Vector3(0, 1, 0);
const light = new T.Vector3(-0.68, 0.55, 0.68).normalize();

/** Reduce a whole strip with a shared set of cuts. Adjacent faces stay joined.
 * The largest 3D deviation across the strip controls each retained cut. */
export function stripCuts(
    count: number,
    width: number,
    point: (i: number, j: number) => Point,
    error: number,
    maxSpan: number
) {
    const keep = new Set([0, count - 1]);
    const visit = (a: number, b: number) => {
        if (b <= a + 1) return;
        let split = 0,
            worst = error * error;
        for (let j = 0; j < width; j++) {
            const p = point(a, j),
                q = point(b, j),
                dx = q[0] - p[0],
                dy = q[1] - p[1],
                dz = q[2] - p[2];
            const len = dx * dx + dy * dy + dz * dz;
            for (let k = a + 1; k < b; k++) {
                const v = point(k, j),
                    x = v[0] - p[0],
                    y = v[1] - p[1],
                    z = v[2] - p[2];
                const t =
                    len > 0
                        ? T.MathUtils.clamp(
                              (x * dx + y * dy + z * dz) / len,
                              0,
                              1
                          )
                        : 0;
                const dist =
                    (x - t * dx) ** 2 + (y - t * dy) ** 2 + (z - t * dz) ** 2;
                if (dist > worst) {
                    worst = dist;
                    split = k;
                }
            }
            if (!split && len > maxSpan * maxSpan) split = (a + b) >> 1;
        }
        if (split) {
            keep.add(split);
            visit(a, split);
            visit(split, b);
        }
    };
    visit(0, count - 1);
    return [...keep].sort((a, b) => a - b);
}
/** Author in centimetres, in front-view coordinates. Keep one indexed mesh and
 * a single material, including ink lines, clothing, eyes and accessories. */
export class Sculpt {
    scene = new T.Group();
    private frame = new T.Group();
    bones: T.Bone[] = [];
    private anchors = new Map<string, T.Vector3>();
    private ids = new Map<string, number>();
    private positions: number[] = [];
    coveredSkin?: number[];
    inspectWardrobe = false;
    coverage?: (x: number, y: number, z: number) => number;
    afterPose?: () => void;
    private layerEnds?: Map<string, number>;
    endLayer(layer: string) {
        (this.layerEnds ??= new Map()).set(layer, this.positions.length / 3);
    }
    private indices: number[] = [];
    private finishes = new Map<string, Finish>();
    private uvs: number[] = [];
    private colors: number[] = [];
    private eyeFrontal = new Map<number, number>();
    private featureErrors: number[] = [];
    pupilShift?: Point;
    cornealSurface = false;
    private hasCorneas = false;
    hasSkinCreases = false;
    private pupilSpans: PupilSpan[] = [];
    private smoothNormals = new Map<number, Point>();
    surfaceNormal?: (x: number, y: number, z: number) => Point;
    lined = false;
    coatShadow = false;
    illustrationInk = false;
    sculptedCartoon = false;
    inkedPortrait = false;
    sourcePaint = false;
    /** The study view can retain the source swatches for a same-topology comparison. */
    referenceColors?: number[];
    referenceSwatch?: string;
    paintMix?: {
        color: string;
        amount: (x: number, y: number, z: number, around: number) => number;
    };
    /** Error in metres and relative to the feature width, set by the authored detail style. */
    simplification = { error: 0.027, relative: 0.09, fraction: 0.4 };
    triangleBudget?: number;
    private joints: number[] = [];
    private weights: number[] = [];
    private space = new T.Matrix4();
    private joint = 0;
    referenceFrame?: T.Matrix4;
    occluded?: (x: number, y: number, z: number) => boolean;
    preserveVertex?: (x: number, y: number, z: number) => boolean;
    drape?: {
        name: string;
        matrix: T.Matrix4;
        start: number;
        end: number;
        weight?: (x: number, y: number, z: number) => number;
        fromTorso?: boolean;
    };
    paintBand?: { height: number; color: string };
    skinShadows: { center: Point; radii: Point; opacity: number }[] = [];

    private spineBlend?: { hip: number; height: number };
    torso(hip: number, height: number) {
        this.spineBlend = { hip, height };
    }
    endTorso() {
        this.spineBlend = undefined;
    }

    ambientByPaint: Record<string, number> = {};
    palette(colors: Record<string, Finish>) {
        this.finishes = new Map(Object.entries(colors));
    }

    constructor() {
        this.scene.add(this.frame);
    }

    bone(name: string, parent: string | null, anchor: Point, humanoid = true) {
        const bone = new T.Bone();
        bone.name = name;
        if (!humanoid) bone.userData.garment = true;
        const world = vec(anchor);
        this.anchors.set(name, world);
        bone.position.copy(world);
        if (parent) bone.position.sub(this.anchors.get(parent));
        bone.position.multiplyScalar(0.01);
        const holder = parent ? this.bones[this.ids.get(parent)] : this.frame;
        holder.add(bone);
        this.ids.set(name, this.bones.length);
        this.bones.push(bone);
        return bone;
    }

    private referenceItem?: { side: Hand; firstVertex: number };
    beginReferenceItem(side: Hand) {
        this.referenceItem = { side, firstVertex: this.positions.length / 3 };
    }
    record?: { points: number[]; runs: PaintRun[] };
    detail: "full" | "crowd" = "full";
    blend?: { with: string; from: number; to: number };
    tone?: (x: number, y: number, z: number) => number;
    sectionLight?: [number, number];
    printUV?: (x: number, y: number, angle: number) => [number, number];
    eyeSample?: (
        x: number,
        y: number,
        z: number
    ) => [number, number, number, number, number?, number?];
    gradient?: { top: number; bottom: number; from: string; to: string };
    eyes = false;
    pupil = false;
    eyeStroke = false;
    penOutline = false;
    thinSkinOutline = false;
    orbSurface = false;
    paintedOrb = false;
    orbContact?: (x: number, y: number, z: number) => [number, number];
    familyPart?: string;
    crown = false;
    fineDetail = false;
    transform?: (
        p: Point,
        head: boolean,
        eyes: boolean,
        crown?: boolean,
        pupil?: boolean,
        part?: string
    ) => Point;
    colorsByPaint: Record<string, string> = {};
    cheeks: {
        x: number;
        y: number;
        rx: number;
        ry: number;
        strength?: number;
    }[] = [];
    drawingSpace(joint: string, matrix: T.Matrix4) {
        this.drape = undefined;
        this.joint = this.ids.get(joint);
        this.space.copy(matrix);
    }

    private add(g: T.BufferGeometry, color: string, keepNormals = false) {
        const kind = this.finishes.get(color) ?? finish.enamel;
        const local = g.getAttribute("position");
        const normals = g.getAttribute("normal");
        // Keep the geometric normals before replacing them with pupil offsets.
        const cornea = this.cornealSurface ? normals.clone() : undefined;
        if (cornea) {
            if (this.referenceFrame)
                cornea.applyNormalMatrix(
                    new T.Matrix3().getNormalMatrix(this.referenceFrame)
                );
            cornea.applyNormalMatrix(
                new T.Matrix3().getNormalMatrix(this.space)
            );
            this.hasCorneas = true;
        }
        if (this.surfaceNormal) {
            const v = new T.Vector3();
            for (let i = 0; i < local.count; i++) {
                v.set(
                    ...this.surfaceNormal(
                        local.getX(i),
                        local.getY(i),
                        local.getZ(i)
                    )
                ).normalize();
                normals.setXYZ(i, v.x, v.y, v.z);
            }
        }
        if (this.occluded && g.index) {
            const inside = Array.from({ length: local.count }, (_, i) =>
                this.occluded(local.getX(i), local.getY(i), local.getZ(i))
            );
            const index: number[] = [];
            for (let i = 0; i < g.index.count; i += 3) {
                const a = g.index.getX(i),
                    b = g.index.getX(i + 1),
                    c = g.index.getX(i + 2);
                if (
                    inside[a] &&
                    inside[b] &&
                    inside[c] &&
                    this.occluded(
                        (local.getX(a) + local.getX(b) + local.getX(c)) / 3,
                        (local.getY(a) + local.getY(b) + local.getY(c)) / 3,
                        (local.getZ(a) + local.getZ(b) + local.getZ(c)) / 3
                    )
                )
                    continue;
                index.push(a, b, c);
            }
            g.setIndex(index);
        }
        g.computeBoundingBox();
        const dims = g.boundingBox.getSize(new T.Vector3());
        const extent = Math.max(dims.x, dims.y, dims.z);
        // A pupil and an earring cannot spend the same geometric error as a sleeve.
        const error = Math.max(
            0.00028,
            extent *
                0.0028 *
                (this.eyeSample
                    ? 0.065
                    : this.eyes || this.fineDetail
                    ? this.sculptedCartoon && this.detail === "full"
                        ? 0.03
                        : 0.064
                    : this.simplification.relative *
                      (this.detail === "full" ? 1 : 1.63))
        );
        for (let i = 0; i < local.count; i++)
            this.featureErrors.push(
                g.attributes.stitch?.getX(i) ||
                    this.preserveVertex?.(
                        local.getX(i),
                        local.getY(i),
                        local.getZ(i)
                    )
                    ? 0
                    : error * error
            );
        const band = this.paintBand;
        const lowerColor = band
            ? new T.Color(this.colorsByPaint[band.color] ?? band.color)
            : null;
        const bandMask = band
            ? Array.from(
                  { length: local.count },
                  (_, i) => local.getY(i) >= band.height
              )
            : null;
        const horizontal = this.blend
            ? Float32Array.from({ length: local.count }, (_, i) =>
                  local.getX(i)
              )
            : null;
        const blush: number[] = [];
        const paintHeight = this.gradient
            ? Float32Array.from({ length: local.count }, (_, i) =>
                  local.getY(i)
              )
            : null;
        const firstPaint = this.gradient
            ? new T.Color(
                  this.colorsByPaint[this.gradient.from] ?? this.gradient.from
              )
            : null;
        const lastPaint = this.gradient
            ? new T.Color(
                  this.colorsByPaint[this.gradient.to] ?? this.gradient.to
              )
            : null;
        const paintedNormals = g.getAttribute("normal").clone();
        if (kind === finish.skin && this.bones[this.joint].name === "head") {
            for (let i = 0; i < local.count; i++) {
                const x = local.getX(i),
                    y = local.getY(i);
                blush.push(
                    Math.max(
                        0,
                        ...this.cheeks.map(
                            (c) =>
                                (c.strength ?? 1) *
                                Math.exp(
                                    -(
                                        ((x - c.x) / c.rx) ** 2 +
                                        ((y - c.y) / c.ry) ** 2
                                    )
                                )
                        )
                    ) * Math.min(1, Math.max(0, local.getZ(i) / 18))
                );
            }
        }
        const contact =
            kind === finish.skin && this.skinShadows.length
                ? Float32Array.from({ length: local.count }, (_, i) => {
                      let shade = 1;
                      for (const { center, radii, opacity } of this
                          .skinShadows) {
                          const x = (local.getX(i) - center[0]) / radii[0],
                              y = (local.getY(i) - center[1]) / radii[1],
                              z = (local.getZ(i) - center[2]) / radii[2];
                          const dist = x * x + y * y + z * z;
                          if (dist < 6)
                              shade *= 1 - opacity * Math.exp(-dist * 1.45);
                      }
                      return Math.max(0.48, shade);
                  })
                : null;
        const drapeWeights = this.drape
            ? Float32Array.from({ length: local.count }, (_, i) =>
                  this.drape.weight
                      ? this.drape.weight(
                            local.getX(i),
                            local.getY(i),
                            local.getZ(i)
                        )
                      : T.MathUtils.smoothstep(
                            local.getY(i),
                            this.drape.start,
                            this.drape.end
                        )
              )
            : null;
        const tones = this.tone
            ? Float32Array.from({ length: local.count }, (_, i) =>
                  this.tone(local.getX(i), local.getY(i), local.getZ(i))
              )
            : null;
        const uv = g.getAttribute("uv");
        const mix = this.paintMix;
        const wash = mix ? new T.Color(mix.color) : undefined;
        const coverage = mix
            ? Float32Array.from({ length: local.count }, (_, i) =>
                  mix.amount(
                      local.getX(i),
                      local.getY(i),
                      local.getZ(i),
                      uv?.getY(i) ?? 0
                  )
              )
            : undefined;
        if (this.referenceColors) {
            const raw = new T.Color(this.referenceSwatch ?? color);
            for (let i = 0; i < local.count; i++)
                this.referenceColors.push(raw.r, raw.g, raw.b);
        }
        const eyeSamples =
            this.eyeSample &&
            Array.from({ length: local.count }, (_, i) =>
                this.eyeSample(local.getX(i), local.getY(i), local.getZ(i))
            );
        const printedUV =
            this.printUV && uv
                ? Array.from({ length: local.count }, (_, i) =>
                      this.printUV(local.getX(i), local.getY(i), uv.getY(i))
                  )
                : null;
        if (this.coveredSkin) {
            for (let i = 0; i < local.count; i++)
                this.coveredSkin.push(
                    this.coverage?.(
                        local.getX(i),
                        local.getY(i),
                        local.getZ(i)
                    ) ?? 0
                );
        }
        if (this.referenceFrame) g.applyMatrix4(this.referenceFrame);
        if (this.record) {
            this.record.runs.push({
                start: this.record.points.length / 3,
                count: local.count,
                bone: this.bones[this.joint].name,
                eyes: this.eyes,
                ...(this.gradient && { gradient: this.gradient }),
                ...(this.familyPart && { familyPart: this.familyPart }),
                ...(this.pupil && { pupil: true }),
                crown: this.crown,
                drape: !!this.drape,
                color,
            });
            for (let i = 0; i < local.count; i++)
                this.record.points.push(
                    local.getX(i),
                    local.getY(i),
                    local.getZ(i)
                );
        }
        if (this.transform) {
            const head = this.bones[this.joint].name === "head";
            for (let i = 0; i < local.count; i++)
                local.setXYZ(
                    i,
                    ...this.transform(
                        [local.getX(i), local.getY(i), local.getZ(i)],
                        head,
                        this.eyes,
                        this.crown,
                        this.pupil,
                        this.familyPart ?? this.bones[this.joint].name
                    )
                );
        }
        if (this.drape) {
            const a = new T.Vector3(),
                b = new T.Vector3();
            for (let i = 0; i < local.count; i++) {
                a.fromBufferAttribute(local, i);
                b.copy(a).applyMatrix4(this.drape.matrix);
                a.applyMatrix4(this.space).lerp(b, drapeWeights[i]);
                local.setXYZ(i, a.x, a.y, a.z);
            }
        } else g.applyMatrix4(this.space);
        const pos = g.getAttribute("position");
        const base = this.positions.length / 3,
            tint = new T.Color(this.colorsByPaint[color] ?? color);
        if (this.pupilShift) {
            const delta = vec(this.pupilShift);
            const length = delta.length();
            if (this.referenceFrame)
                delta.applyNormalMatrix(
                    new T.Matrix3().getNormalMatrix(this.referenceFrame)
                );
            delta
                .applyNormalMatrix(new T.Matrix3().getNormalMatrix(this.space))
                .multiplyScalar(length);
            this.pupilSpans.push({
                start: base,
                count: pos.count,
                shift: delta.toArray(),
            });
        }
        const baseTint = tint.clone();
        const normal = new T.Vector3();
        for (let i = 0; i < pos.count; i++) {
            if (this.surfaceNormal || keepNormals)
                this.smoothNormals.set(base + i, [
                    normals.getX(i),
                    normals.getY(i),
                    normals.getZ(i),
                ]);
            this.positions.push(
                pos.getX(i) * 0.01,
                pos.getY(i) * 0.01,
                pos.getZ(i) * 0.01
            );
            // Soft cel shading in the palette itself keeps facial ink legible in any world.
            normal.fromBufferAttribute(paintedNormals, i);
            normal.y *= -1;
            const diffuse = normal.dot(light);
            const ambient =
                this.ambientByPaint[color] ??
                (kind === finish.skin ? 0.66 : 0.64);
            const k =
                ambient +
                (1 - ambient) * Math.max(0, diffuse) +
                0.06 * Math.max(0, -diffuse);
            const highlight =
                kind === finish.skin
                    ? 0.021 *
                      Math.pow(
                          Math.max(
                              0,
                              normal.x * -0.21 +
                                  normal.y * 0.33 +
                                  normal.z * 0.92
                          ),
                          12
                      )
                    : 0;
            if (
                this.gradient &&
                (!this.colorsByPaint[color] ||
                    (this.colorsByPaint[this.gradient.from] &&
                        this.colorsByPaint[this.gradient.to]))
            ) {
                tint.copy(firstPaint).lerp(
                    lastPaint,
                    T.MathUtils.smoothstep(
                        paintHeight[i],
                        this.gradient.top,
                        this.gradient.bottom
                    )
                );
            }
            if (band) tint.copy(bandMask[i] ? lowerColor : baseTint);
            if (coverage)
                tint.copy(baseTint).lerp(
                    wash,
                    T.MathUtils.clamp(coverage[i], 0, 1)
                );
            const warmth = blush[i] || 0;
            const ao = contact ? contact[i] : 1;
            // A front drawing samples the top and bottom at 16% and 84%
            // through a round limb. Their vertical normal components are ±0.68.
            const roll = this.sectionLight
                ? T.MathUtils.lerp(
                      1,
                      this.sectionLight[normal.y >= 0 ? 0 : 1],
                      Math.min(1, Math.abs(normal.y) / 0.68)
                  )
                : 1;
            const tone = (tones ? tones[i] : 1) * ao * roll;
            if (eyeSamples?.[i][4] != null) {
                this.eyeFrontal.set(this.colors.length / 3, eyeSamples[i][5]);
                this.colors.push(
                    eyeSamples[i][2],
                    eyeSamples[i][3],
                    eyeSamples[i][4]
                );
            } else if (cornea) {
                // Octahedral encoding leaves the green channel for lid clearance.
                const x = cornea.getX(i),
                    y = cornea.getY(i),
                    z = cornea.getZ(i);
                const len = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
                const u =
                    z < 0
                        ? (1 - Math.abs(y) / len) * (x < 0 ? -1 : 1)
                        : x / len;
                const v =
                    z < 0
                        ? (1 - Math.abs(x) / len) * (y < 0 ? -1 : 1)
                        : y / len;
                this.colors.push(
                    0.5 + 0.44 * u,
                    eyeSamples[i][3],
                    0.5 + 0.44 * v
                );
            } else if (eyeSamples)
                this.colors.push(eyeSamples[i][2], eyeSamples[i][3], 1);
            else if (this.paintedOrb)
                this.colors.push(tone * tint.r, tone * tint.g, tone * tint.b);
            else
                this.colors.push(
                    (tone + (1 - ao) * 0.09) *
                        tint.r *
                        (k + 0.08 * (1 - k)) *
                        (1 + 0.06 * warmth) +
                        highlight,
                    tone * tint.g * k * (1 - 0.32 * warmth) + highlight * 0.75,
                    tone * tint.b * (k - 0.05 * (1 - k)) * (1 - 0.2 * warmth) +
                        highlight * 0.57
                );
            if (eyeSamples)
                this.uvs.push(pupilUVBase + eyeSamples[i][0], eyeSamples[i][1]);
            else if (printedUV) this.uvs.push(...printedUV[i]);
            else
                this.uvs.push(
                    (this.lined ? 5 : kind) + 0.005 + 0.99 * (uv?.getX(i) ?? 0),
                    uv?.getY(i) ?? 0
                );
            if (!eyeSamples) {
                if (this.orbSurface)
                    this.uvs[this.uvs.length - 2] -=
                        (this.orbContact ? 72 : 64) +
                        (this.paintedOrb ? 16 : 0);
                else if (this.eyeStroke) this.uvs[this.uvs.length - 2] -= 8;
                else if (
                    ((this.inkedPortrait && this.fineDetail) ||
                        this.thinSkinOutline) &&
                    !printedUV &&
                    (kind === finish.skin || kind === finish.fiber)
                )
                    this.uvs[this.uvs.length - 2] += 56;
                else if (this.sculptedCartoon)
                    this.uvs[this.uvs.length - 2] +=
                        this.fineDetail && kind === finish.skin
                            ? 32
                            : this.penOutline
                            ? -24
                            : 24;
                else if (this.coatShadow)
                    this.uvs[this.uvs.length - 2] += coatUVBase - finish.cloth;
                else if (this.sourcePaint)
                    this.uvs[this.uvs.length - 2] += this.penOutline ? -32 : 16;
                else if (this.illustrationInk)
                    this.uvs[this.uvs.length - 2] += 8;
            }
            const jointPair = g.getAttribute("jointPair");
            if (jointPair) {
                this.joints.push(jointPair.getX(i), jointPair.getY(i), 0, 0);
                this.weights.push(
                    1 - jointPair.getZ(i),
                    jointPair.getZ(i),
                    0,
                    0
                );
            } else if (this.drape && !this.drape.fromTorso) {
                this.joints.push(
                    this.joint,
                    this.ids.get(this.drape.name),
                    0,
                    0
                );
                this.weights.push(1 - drapeWeights[i], drapeWeights[i], 0, 0);
            } else if (this.blend) {
                const t = T.MathUtils.smoothstep(
                    (horizontal[i] - this.blend.from) /
                        (this.blend.to - this.blend.from),
                    0,
                    1
                );
                this.joints.push(
                    this.ids.get(this.blend.with),
                    this.joint,
                    0,
                    0
                );
                this.weights.push(1 - t, t, 0, 0);
            } else if (this.spineBlend) {
                const y =
                    (pos.getY(i) - this.spineBlend.hip) /
                    this.spineBlend.height;
                const lower = y < 0.34;
                const weight = T.MathUtils.clamp(
                    lower ? y / 0.34 : (y - 0.34) / 0.42,
                    0,
                    1
                );
                const arm = this.drape?.fromTorso ? drapeWeights[i] : 0;
                this.joints.push(
                    this.ids.get(lower ? "hips" : "spine"),
                    this.ids.get(lower ? "spine" : "chest"),
                    arm ? this.ids.get(this.drape.name) : 0,
                    0
                );
                this.weights.push(
                    (1 - arm) * (1 - weight),
                    (1 - arm) * weight,
                    arm,
                    0
                );
            } else {
                this.joints.push(this.joint, 0, 0, 0);
                this.weights.push(1, 0, 0, 0);
            }
        }
        for (let i = 0; i < (g.index?.count ?? pos.count); i++) {
            const j = i % 3 === 0 ? i : i % 3 === 1 ? i + 1 : i - 1;
            this.indices.push(base + (g.index ? g.index.getX(j) : j));
        }
        g.dispose();
    }

    oval(p: Point, radii: Point, color: string, tilt = 0, minSegments = 0) {
        const radius = Math.max(...radii);
        const near = this.detail === "full";
        const segments = T.MathUtils.clamp(
            Math.ceil(Math.PI * Math.sqrt(radius / (near ? 2.2 : 5))),
            Math.max(
                near ? 6 : 5,
                near ? minSegments : Math.ceil(minSegments * 0.67)
            ),
            near ? 22 : 14
        );
        // Smaller latitude rings share fewer edges near the poles. The retained
        // cardinal vertices describe the same front and profile silhouette.
        const rings = Math.max(4, Math.ceil(segments * 0.47)),
            xyz: number[] = [],
            uv: number[] = [],
            index: number[] = [];
        // The orb has procedural grain in its own coordinates. A wrapped
        // longitude UV would split the front meridian before simplification.
        const wrap = this.orbSurface ? new Map<number, number>() : undefined;
        let prev = 0,
            oldCount = 0;
        for (let r = 0; r <= rings; r++) {
            const theta = (r * Math.PI) / rings,
                rad = Math.sin(theta);
            const count =
                r === 0 || r === rings
                    ? 0
                    : Math.max(4, Math.round((rad * segments) / 4) * 4);
            const first = xyz.length / 3;
            for (let j = 0; j <= count; j++) {
                const u = count ? j / count : 0.5,
                    a = 2 * Math.PI * u;
                xyz.push(rad * Math.sin(a), Math.cos(theta), rad * Math.cos(a));
                if (this.orbContact)
                    uv.push(
                        ...this.orbContact(
                            rad * Math.sin(a),
                            Math.cos(theta),
                            rad * Math.cos(a)
                        )
                    );
                else
                    uv.push(
                        wrap ? (1 + rad * Math.sin(a)) / 2 : u,
                        1 - r / rings
                    );
            }
            if (wrap && count) wrap.set(first + count, first);
            if (r) {
                let a = 0,
                    b = 0;
                while (a < oldCount || b < count) {
                    if (
                        b < count &&
                        (a === oldCount ||
                            (b + 1) / count <= (a + 1) / oldCount)
                    ) {
                        index.push(prev + a, first + b, first + b + 1);
                        b++;
                    } else {
                        index.push(prev + a, first + b, prev + a + 1);
                        a++;
                    }
                }
            }
            prev = first;
            oldCount = count;
        }
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(xyz, 3));
        g.setAttribute("normal", new T.Float32BufferAttribute(xyz, 3));
        g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        g.setIndex(wrap ? index.map((i) => wrap.get(i) ?? i) : index);
        g.scale(...radii)
            .rotateZ(tilt)
            .translate(...p);
        this.add(g, color);
    }

    /** A continuous tapered sweep. Joint rings share positions and weights
     * across knuckles so bending a digit never exposes an inner cap. */
    sweep(
        path: Point[],
        radii: number[],
        color: string,
        sides = 7,
        bones?: string[],
        roundNormals = false
    ) {
        const pts = path.map(vec),
            xyz: number[] = [],
            uv: number[] = [],
            normals: number[] = [],
            skin: number[] = [],
            indices: number[] = [];
        let axis: T.Vector3;
        pts.forEach((p, i) => {
            const tangent = pts[Math.min(i + 1, pts.length - 1)]
                .clone()
                .sub(pts[Math.max(0, i - 1)])
                .normalize();
            if (!axis)
                axis =
                    Math.abs(tangent.z) < 0.9
                        ? new T.Vector3(0, 0, 1)
                        : new T.Vector3(0, 1, 0);
            axis.addScaledVector(tangent, -axis.dot(tangent)).normalize();
            const other = tangent.clone().cross(axis);
            const first = Math.max(0, i - 1),
                last = Math.min(pts.length - 1, i + 1);
            const slope = roundNormals
                ? (radii[last] - radii[first]) /
                  Math.max(0.0001, pts[first].distanceTo(pts[last]))
                : 0;
            for (let j = 0; j < sides; j++) {
                const angle = (2 * Math.PI * j) / sides;
                xyz.push(
                    ...p
                        .clone()
                        .addScaledVector(axis, radii[i] * Math.cos(angle))
                        .addScaledVector(other, radii[i] * Math.sin(angle))
                        .toArray()
                );
                if (roundNormals) {
                    const n =
                        radii[i] === 0
                            ? tangent
                            : axis
                                  .clone()
                                  .multiplyScalar(Math.cos(angle))
                                  .addScaledVector(other, Math.sin(angle))
                                  .addScaledVector(tangent, -slope)
                                  .normalize();
                    normals.push(n.x, n.y, n.z);
                }
                uv.push(j / sides, i / (pts.length - 1));
                if (bones) {
                    const next = Math.min(i, bones.length - 1),
                        prev = Math.min(Math.max(0, i - 1), bones.length - 1);
                    skin.push(
                        this.ids.get(bones[prev]),
                        this.ids.get(bones[next]),
                        next === prev ? 0 : 0.5
                    );
                }
                if (i > 0) {
                    const a = (i - 1) * sides + j,
                        b = (i - 1) * sides + ((j + 1) % sides);
                    if (radii[i - 1] > 0) indices.push(a, b, a + sides);
                    if (radii[i] > 0) indices.push(b, b + sides, a + sides);
                }
            }
        });
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(xyz, 3));
        g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        if (bones)
            g.setAttribute("jointPair", new T.Float32BufferAttribute(skin, 3));
        g.setIndex(indices);
        if (roundNormals)
            g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
        else g.computeVertexNormals();
        this.add(g, color, roundNormals);
    }
    tube(
        a: Point,
        b: Point,
        r1: number,
        r2: number,
        color: string,
        sides = 12
    ) {
        const from = vec(a),
            to = vec(b),
            dir = to.clone().sub(from);
        const g = new T.CylinderGeometry(
            r2,
            r1,
            dir.length(),
            Math.min(
                sides,
                Math.max(
                    5,
                    Math.ceil(
                        Math.PI *
                            Math.sqrt(
                                Math.max(r1, r2) /
                                    (this.detail === "full" ? 1.8 : 4)
                            )
                    )
                )
            )
        );
        g.applyQuaternion(
            new T.Quaternion().setFromUnitVectors(axisY, dir.normalize())
        );
        g.translate(...(from.lerp(to, 0.5).toArray() as Point));
        this.add(g, color);
    }

    /** Ink lying on a surface only needs a pair of edges. */
    ribbon(points: Point[], radius: number, color: string) {
        const rows = points.map((p, i) => {
            const a = points[Math.max(0, i - 1)],
                b = points[Math.min(points.length - 1, i + 1)];
            const dx = b[0] - a[0],
                dy = b[1] - a[1],
                len = Math.max(0.0001, Math.hypot(dx, dy));
            return [-1, 1].map(
                (k) =>
                    [
                        p[0] - (k * radius * dy) / len,
                        p[1] + (k * radius * dx) / len,
                        p[2],
                    ] as Point
            );
        });
        this.surface(rows, color, true);
    }

    line(points: Point[], radius: number, color: string, precision?: number) {
        if (this.detail === "crowd" && radius < 0.62) return;
        const sides = this.detail === "crowd" || radius < 2.25 ? 3 : 5;
        const cuts = stripCuts(
            points.length,
            1,
            (i) => points[i],
            precision ?? (this.detail === "full" ? 0.42 : 1.25),
            80
        );
        const samples = cuts.map((i) => vec(points[i]));
        const rows = samples.map((v, i) => {
            const tangent = samples[Math.min(i + 1, samples.length - 1)]
                .clone()
                .sub(samples[Math.max(0, i - 1)])
                .normalize();
            const toward =
                Math.abs(tangent.z) > 0.93 ? axisY : new T.Vector3(0, 0, 1);
            const u = tangent.clone().cross(toward).normalize();
            const w = tangent.clone().cross(u);
            return Array.from({ length: sides + 1 }, (_, k) => {
                const a = (k * Math.PI * 2) / sides;
                return v
                    .clone()
                    .addScaledVector(u, radius * Math.cos(a))
                    .addScaledVector(w, radius * Math.sin(a))
                    .toArray() as Point;
            });
        });
        this.surface(rows, color, !!precision, undefined, precision);
    }

    surface(
        rows: Point[][],
        color: string,
        keepCorners = false,
        stitch:
            | "start"
            | "end"
            | "both"
            | "sides"
            | "perimeter"
            | undefined = undefined,
        sampleError?: number,
        panel?: PanelJoin
    ) {
        const near = this.detail === "full";
        const rowCount = rows.length,
            colCount = rows[0].length;
        const columns =
            stitch && stitch !== "sides"
                ? rows[0].map((_, i) => i)
                : stripCuts(
                      colCount,
                      rowCount,
                      (i, j) => rows[j][i],
                      sampleError ??
                          (keepCorners ? (near ? 0.45 : 1) : near ? 1.05 : 2.5),
                      near ? 48 : 75
                  );
        // Front and rear patches with different paint must keep identical
        // meridians as well as matching lid rings.
        const rowsKept =
            stitch === "perimeter" || stitch === "sides"
                ? rows.map((_, i) => i)
                : stripCuts(
                      rowCount,
                      columns.length,
                      (i, j) => rows[i][columns[j]],
                      sampleError ?? (near ? 0.95 : 2.4),
                      near ? 46 : 80
                  );
        if (this.paintBand) {
            for (let i = 1; i < rows.length; i++) {
                if (
                    rows[i][0][1] >= this.paintBand.height !==
                    rows[i - 1][0][1] >= this.paintBand.height
                ) {
                    if (!rowsKept.includes(i - 1)) rowsKept.push(i - 1);
                    if (!rowsKept.includes(i)) rowsKept.push(i);
                }
            }
            rowsKept.sort((a, b) => a - b);
        }
        rows = rowsKept.map((i) => columns.map((j) => rows[i][j]));
        const g = new T.BufferGeometry(),
            indices: number[] = [];
        const stride = rows[0].length;
        const distinct = (a: Point, b: Point) =>
            a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2];
        for (let row = 0; row < rows.length - 1; row++)
            for (let i = 0; i < stride - 1; i++) {
                const a = row * stride + i;
                const ul = rows[row][i],
                    ur = rows[row][i + 1];
                const ll = rows[row + 1][i],
                    lr = rows[row + 1][i + 1];
                // Rings can collapse to a point at a cap, hem or patch center.
                if (!distinct(ur, ll)) continue;
                if (distinct(ul, ur) && distinct(ul, ll))
                    indices.push(a, a + 1, a + stride);
                if (distinct(ll, lr) && distinct(ur, lr))
                    indices.push(a + 1, a + stride + 1, a + stride);
            }
        g.setAttribute(
            "position",
            new T.Float32BufferAttribute(rows.flat(2), 3)
        );
        const uv: number[] = [];
        for (let row = 0; row < rows.length; row++)
            for (let i = 0; i < stride; i++)
                uv.push(
                    panel
                        ? T.MathUtils.clamp(
                              (rows[row][i][1] - panel.top) /
                                  (panel.bottom - panel.top),
                              0,
                              1
                          )
                        : rowsKept[row] / (rowCount - 1),
                    columns[i] / (colCount - 1)
                );
        g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        if (stitch) {
            const protectedRings = new Set<number>();
            if (stitch !== "end" && stitch !== "sides") protectedRings.add(0);
            if (stitch !== "start" && stitch !== "sides")
                protectedRings.add(rows.length - 1);
            g.setAttribute(
                "stitch",
                new T.Uint8BufferAttribute(
                    rows.flatMap((row, j) =>
                        row.map((_, i) =>
                            Number(
                                protectedRings.has(j) ||
                                    ((stitch === "perimeter" ||
                                        stitch === "sides") &&
                                        (i === 0 || i === stride - 1))
                            )
                        )
                    ),
                    1
                )
            );
        }
        // Weld wrapped contours and collapsed poles before edge collapse. A pole
        // per triangle allows the decimator to open a fan down its center.
        // Printed surfaces retain separate UVs at their wrap and pin the seam.
        const reuse = (a: number, b: number) => {
            const p = rows[Math.floor(a / stride)][a % stride];
            const q = rows[Math.floor(b / stride)][b % stride];
            return p.every((v, i) => Math.abs(v - q[i]) < 1e-6);
        };
        const aliases = Array.from(
            { length: rows.length * stride },
            (_, i) => i
        );
        const seam = new Set<number>();
        const join = (i: number, j: number) => {
            if (this.printUV) {
                seam.add(i);
                seam.add(j);
            } else aliases[i] = aliases[j];
        };
        for (let r = 0; r < rows.length; r++) {
            const first = r * stride;
            for (let c = 1; c < stride; c++) {
                const i = first + c;
                if (reuse(i, first)) join(i, first);
                if (r === rows.length - 1 && reuse(i, c)) join(i, c);
            }
            if (r === rows.length - 1 && reuse(first, 0)) join(first, 0);
        }
        if (seam.size) {
            const locked =
                g.getAttribute("stitch") ??
                new T.Uint8BufferAttribute(new Uint8Array(aliases.length), 1);
            for (const i of seam) locked.setX(i, 1);
            g.setAttribute("stitch", locked);
        }
        g.setIndex(indices.map((i) => aliases[i]));
        g.computeVertexNormals();
        const base = this.positions.length / 3,
            firstIndex = this.indices.length;
        this.add(g, color);
        if (panel && stitch === "end") {
            panel.ringStart = base + (rows.length - 1) * stride;
            panel.stride = stride;
        } else if (
            panel &&
            stitch === "start" &&
            panel.ringStart !== undefined &&
            panel.stride === stride
        ) {
            // Both panels bind this ring entirely to the thigh. Share its
            // indices so normals, vertex paint and fabric coordinates meet.
            for (let i = firstIndex; i < this.indices.length; i++) {
                const column = this.indices[i] - base;
                if (column < stride) this.indices[i] = panel.ringStart + column;
            }
            for (let i = 0; i < stride * 3; i++) {
                const j = panel.ringStart * 3 + i;
                this.colors[j] =
                    (this.colors[j] + this.colors[base * 3 + i]) / 2;
            }
        }
        return rows;
    }

    triangles(points: Point[], color: string) {
        const vertices: number[] = [],
            indices: number[] = [],
            known = new Map<string, number>();
        for (const point of points) {
            const key = point.join(",");
            let i = known.get(key);
            if (i === undefined) {
                i = vertices.length / 3;
                known.set(key, i);
                vertices.push(...point);
            }
            indices.push(i);
        }
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
        g.setIndex(indices);
        g.computeVertexNormals();
        this.add(g, color);
    }

    geometry() {
        const g = new T.BufferGeometry();
        g.setAttribute(
            "position",
            new T.Float32BufferAttribute(this.positions, 3)
        );
        g.setAttribute("uv", new T.Float32BufferAttribute(this.uvs, 2));
        if (this.eyeFrontal.size) {
            const rgba = new Float32Array((this.colors.length / 3) * 4);
            for (let i = 0; i < rgba.length / 4; i++) {
                for (let c = 0; c < 3; c++)
                    rgba[4 * i + c] = this.colors[3 * i + c];
                rgba[4 * i + 3] = this.eyeFrontal.get(i) ?? 1;
            }
            g.setAttribute("color", new T.BufferAttribute(rgba, 4));
        } else
            g.setAttribute(
                "color",
                new T.Float32BufferAttribute(this.colors, 3)
            );
        g.setAttribute(
            "skinIndex",
            new T.Uint16BufferAttribute(this.joints, 4)
        );
        g.setAttribute(
            "skinWeight",
            new T.Float32BufferAttribute(this.weights, 4)
        );
        g.setIndex(this.indices);
        g.computeVertexNormals();
        // Joined pigment boundaries still belong to the same smooth globe.
        // Preserve its analytic normals through the final mesh compaction.
        for (const [i, n] of this.smoothNormals)
            g.attributes.normal.setXYZ(i, ...n);
        let kept = retopologize(
            g,
            this.simplification.fraction * (this.detail === "full" ? 1 : 0.74),
            this.simplification.error * (this.detail === "full" ? 1 : 1.55),
            this.featureErrors,
            this.sourcePaint ? 72 : 16,
            this.triangleBudget
                ? {
                      triangles: this.triangleBudget,
                      bodyJoints: new Set(
                          this.bones.flatMap((bone, i) =>
                              /^(hips|spine|chest|upperChest|(left|right)(UpperArm|LowerArm|UpperLeg|LowerLeg|Foot|Toes))$/.test(
                                  bone.name
                              )
                                  ? [i]
                                  : []
                          )
                      ),
                  }
                : undefined,
            this.sculptedCartoon
        );
        if (this.layerEnds && this.coveredSkin) {
            const labels = kept.map((i) => this.coveredSkin[i]);
            const index = g.index,
                bodyEnd = this.layerEnds.get("body"),
                bottomsEnd = this.layerEnds.get("bottoms");
            const body: number[] = [],
                bottoms: number[] = [],
                dressed: number[] = [];
            for (let i = 0; i < index.count; i += 3) {
                const a = index.getX(i),
                    b = index.getX(i + 1),
                    c = index.getX(i + 2);
                const first = kept[a],
                    covered = Math.min(labels[a], labels[b], labels[c]);
                if (first < bodyEnd && this.inspectWardrobe) body.push(a, b, c);
                if (first < bottomsEnd && covered < 2 && this.inspectWardrobe)
                    bottoms.push(a, b, c);
                if (covered < 1) dressed.push(a, b, c);
            }
            if (this.inspectWardrobe) {
                // Concatenate alternative draws once. Revealing a layer changes only the draw range.
                g.setAttribute(
                    "coveredSkin",
                    new T.Float32BufferAttribute(labels, 1)
                );
                g.setIndex([...dressed, ...body, ...bottoms]);
                g.userData.wardrobe = {
                    dressed: { start: 0, count: dressed.length },
                    body: { start: dressed.length, count: body.length },
                    bottoms: {
                        start: dressed.length + body.length,
                        count: bottoms.length,
                    },
                };
                g.setDrawRange(0, dressed.length);
            } else {
                const visible = compactIndexedGeometry(g, dressed);
                kept = visible.map((i) => kept[i]);
            }
        }
        if (this.hasCorneas) g.userData.hasCorneas = true;
        if (this.hasSkinCreases) g.userData.hasSkinCreases = true;
        if (this.pupilSpans.length) {
            const spans: PupilSpan[] = [];
            for (const span of this.pupilSpans) {
                const start = kept.findIndex((i) => i >= span.start);
                if (start < 0) continue;
                let end = start;
                while (end < kept.length && kept[end] < span.start + span.count)
                    end++;
                if (end > start)
                    spans.push({ ...span, start, count: end - start });
            }
            if (spans.length) g.userData.pupilSpans = spans;
        }
        if (this.referenceColors) {
            const raw = this.referenceColors,
                compact = new Float32Array(kept.length * 3);
            kept.forEach((i, j) =>
                compact.set(raw.slice(i * 3, i * 3 + 3), j * 3)
            );
            g.userData.referencePaint = new T.BufferAttribute(compact, 3);
        }
        if (this.referenceItem) {
            const first = kept.findIndex(
                (i) => i >= this.referenceItem.firstVertex
            );
            const start = g.index.array.findIndex((v) => v >= first);
            if (first >= 0 && start >= 0)
                g.userData.referenceItem = {
                    side: this.referenceItem.side,
                    start,
                };
        }
        if (this.record) {
            const old = this.record,
                points: number[] = [],
                runs: PaintRun[] = [];
            let j = 0;
            for (const run of old.runs) {
                const start = j;
                while (j < kept.length && kept[j] < run.start + run.count) {
                    const o = kept[j++] * 3;
                    points.push(
                        old.points[o],
                        old.points[o + 1],
                        old.points[o + 2]
                    );
                }
                if (j > start) runs.push({ ...run, start, count: j - start });
            }
            this.record = { points, runs };
        }
        return g;
    }
    finish(g = this.geometry()) {
        const mesh = new T.SkinnedMesh(
            g,
            new T.MeshBasicNodeMaterial({
                vertexColors: true,
                side: T.DoubleSide,
                colorNode: surfaceGrain(
                    g.userData.hasCorneas || g.userData.hasSkinCreases
                        ? (normal) =>
                              N.cameraViewMatrix.mul(
                                  N.objectWorldMatrix(
                                      this.bones[this.ids.get("head")]
                                  ).mul(N.vec4(normal, 0))
                              ).xyz
                        : undefined
                ),
            })
        );
        this.frame.add(mesh);
        this.frame.updateMatrixWorld(true);
        mesh.bind(new T.Skeleton(this.bones));
        // Mixamo tracks target the front-view T-pose; the lobby faces local -Z.
        this.frame.rotation.y = Math.PI;
        this.scene.updateMatrixWorld(true);
        const { bones, ids } = this;
        const humanBones = bones.filter((node) => !node.userData.garment);
        const capture = () =>
            humanBones.map((b) => ({
                position: b.position.clone(),
                rotation: b.quaternion.clone(),
            }));
        const rest = capture();
        const restore = (pose: ReturnType<typeof capture>) => {
            humanBones.forEach((b, i) => {
                b.position.copy(pose[i].position);
                b.quaternion.copy(pose[i].rotation);
            });
            this.afterPose?.();
        };
        let items: ReturnType<typeof createHandItems>;
        const equipItem = (
            side: Hand,
            item: T.Object3D | null,
            options?: GripOptions
        ) => {
            if (!item) {
                items?.release(side);
                return;
            }
            items ??= createHandItems(
                new Map(bones.map((b) => [b.name, b])),
                mesh
            );
            items.equip(side, item, options);
        };
        return {
            meta: { metaVersion: "1" },
            scene: this.scene,
            humanoid: {
                getNormalizedBoneNode: (name: string) =>
                    bones[ids.get(name)]?.userData.garment
                        ? null
                        : bones[ids.get(name)] ?? null,
                rawHumanBones: Object.fromEntries(
                    humanBones.map((node) => [node.name, { node }])
                ),
                getRawPose: capture,
                setRawPose: restore,
                update: () => {},
                getNormalizedPose: capture,
                resetNormalizedPose: () => restore(rest),
                setNormalizedPose: restore,
            },
            setGazePose: createGazePose(g),
            equipItem,
            releaseItems: () => items?.clear(),
            update: () => {
                this.afterPose?.();
                items?.update();
            },
        };
    }
}
