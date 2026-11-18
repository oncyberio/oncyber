import { boneIndex, type ToonBone } from "../skeleton";
import {
    blob,
    ellipse,
    hexToLinear,
    tube,
    type BlobOptions,
    type Rgb,
    type Station,
    type TubeOptions,
    type VertexStyle,
    type Weights,
} from "./builder";
import { torsoSection, torsoWeights } from "./body";
import { chainWeights, rigid, type ToonContext } from "./context";
import { cap, curtain, hairline, spike, tail, type CapOptions } from "./hair";
import type { FaceLayout, HeadShape } from "./head";
import type { Vec3 } from "./vec";

/**
 * What an authored avatar's own code builds with: the mesh so far, every
 * measurement of this body, the skull as a function, and the same shape
 * helpers the standard parts use. Anything the sliders can't express is
 * written against this.
 */
export type AvatarKit = ToonContext & {
    head: HeadShape;
    face: FaceLayout;
    /** `#rrggbb` to the linear colour the mesh stores. */
    hex(color: string): Rgb;
    /** Fully follow one bone. */
    rigid(bone: ToonBone): Weights;
    /** Blend between bones: `[bone, weight]` pairs. */
    mix(...pairs: [ToonBone, number][]): Weights;
    chainWeights: typeof chainWeights;
    /** Rest position of a bone, in metres. */
    joint(bone: ToonBone): Vec3;
    /** Torso cross-section at `t`: 0 at the crotch, 1 at the base of the neck. */
    torso(t: number): { center: Vec3; width: number; depth: number };
    /** A point on the torso surface. Angle 0 is the front, a quarter turn the left side. */
    torsoPoint(t: number, angle: number, grow?: number): Vec3;
    /** Skinning for something worn on the torso at `t`. */
    torsoWeights(t: number): Weights;
    tube(stations: Station[], options?: TubeOptions): void;
    /** A closed band through `points`: belts, straps, collars, bracelets. */
    ring(
        points: Vec3[],
        style: VertexStyle & { ru: number; rv?: number }
    ): void;
    blob(options: BlobOptions): void;
    ellipse: typeof ellipse;
    /** A layer hugging the skull from an edge line up: hair, hoods, bands. */
    cap(options: CapOptions): void;
    hairline: typeof hairline;
    spike(
        latitude: number,
        longitude: number,
        length: number,
        radius: number,
        bend?: Vec3,
        weights?: Weights
    ): void;
    tail(root: Vec3, away: Vec3, length: number, radius: number): void;
    curtain(bottomY: number, offset: number, curl: number): void;
};

export function createKit(
    ctx: ToonContext,
    head: HeadShape,
    face: FaceLayout
): AvatarKit {
    return {
        ...ctx,
        head,
        face,
        hex: hexToLinear,
        rigid,
        mix: (...pairs) => pairs.map(([bone, w]) => [boneIndex(bone), w]),
        chainWeights,
        joint: (bone) => ctx.layout.joints[bone],
        torso: (t) => torsoSection(ctx, t),
        torsoPoint: (t, angle, grow = 1) => {
            const { center, width, depth } = torsoSection(ctx, t);
            const round = (c: number) =>
                Math.sign(c) * Math.pow(Math.abs(c), 2 / 2.35);
            return [
                center[0] + round(Math.sin(angle)) * width * grow,
                center[1],
                center[2] + round(Math.cos(angle)) * depth * grow,
            ];
        },
        torsoWeights,
        tube: (stations, options) => tube(ctx.builder, stations, options),
        ring: (points, style) =>
            tube(
                ctx.builder,
                [...points, points[0], points[1]].map((at) => ({
                    ...style,
                    at,
                })),
                { segments: 8, start: "open", end: "open" }
            ),
        blob: (options) => blob(ctx.builder, options),
        ellipse,
        cap: (options) => cap(ctx, head, options),
        hairline,
        spike: (...args) => spike(ctx, head, ...args),
        tail: (...args) => tail(ctx, ...args),
        curtain: (...args) => curtain(ctx, head, ...args),
    };
}
