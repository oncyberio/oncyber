import * as T from "three/webgpu";
import * as N from "three/tsl";

// IDs order coincident boundaries. The three hair regions share a lighter inner pen.
export const inkPart = {
    skin: 1,
    head: 2,
    denim: 3,
    tee: 4,
    spikes: 5,
    crown: 6,
    locks: 7,
} as const;
export type InkPart = (typeof inkPart)[keyof typeof inkPart];

export function inkAttribute(
    parts: { start: number; part: InkPart }[],
    kept: number[]
) {
    let range = 0;
    const ids = Float32Array.from(kept, (original) => {
        while (range + 1 < parts.length && parts[range + 1].start <= original)
            range++;
        return parts[range].part;
    });
    return new T.BufferAttribute(ids, 1);
}

// The pinned renderer exports the renamed PostProcessing API ahead of @types/three.
const { RenderPipeline } = T as typeof T & {
    RenderPipeline: typeof T.PostProcessing;
};
const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    ...[-1, 1].flatMap((x) =>
        [-1, 1].map((y) => [x * Math.SQRT1_2, y * Math.SQRT1_2])
    ),
];

/** Write visible part, depth and coverage with the color draw. Resolve the pen
 * on the visible side of a boundary, with a bounded width in display pixels. */
export class StreetInkPass {
    private pipeline?: T.PostProcessing;
    private pass?: ReturnType<typeof N.pass>;
    private readonly texel = N.uniform(new T.Vector2());
    private readonly drawingBuffer = new T.Vector2();
    private readonly pen = N.uniform(1);
    private readonly maximum = N.uniform(3);
    private readonly perspective = N.uniform(0);

    private setup(
        renderer: T.WebGPURenderer,
        scene: T.Scene,
        camera: T.Camera
    ) {
        this.dispose();
        const pass = N.pass(scene, camera, { stencilBuffer: renderer.stencil });
        const mark = N.Fn((builder) => {
            const z = N.max(0.001, N.positionView.z.negate());
            // The log scale keeps enough separation at both portrait and room distances.
            const depth = N.log2(z.add(1)).div(10).min(1);
            if (!builder.hasGeometryAttribute("streetInk"))
                return N.vec4(0, 0, 0, depth);
            const id = N.attribute("streetInk", "float");
            const signature = N.varying(
                N.mod(N.floor(N.vec3(id, id.div(2), id.div(4))), 2)
            );
            return N.vec4(signature, depth);
        })();
        const targets = N.mrt({ output: N.output, streetInk: mark });
        (
            targets as typeof targets & {
                setClearColor(
                    name: string,
                    color: T.Color,
                    alpha: number
                ): void;
            }
        ).setClearColor("streetInk", new T.Color(0), 1);
        pass.setMRT(targets);
        const mask = pass.getTextureNode("streetInk");
        const attachment = pass.getTexture("streetInk");
        attachment.type = T.UnsignedByteType;
        attachment.minFilter = attachment.magFilter = T.LinearFilter;
        const color = pass.getTextureNode();
        const resolve = N.Fn(() => {
            const center = mask.sample(N.screenUV).toVar();
            const edge = N.float(0).toVar();
            const coverage = N.max(center.r, N.max(center.g, center.b));
            N.If(coverage.greaterThan(0.015), () => {
                const z = N.exp2(center.a.mul(10)).sub(1).max(0.001);
                const projected = this.pen.div(N.mix(1, z, this.perspective));
                // Keep a one-pixel stroke on a standing figure. Let it taper
                // below a pixel as the whole figure recedes into the crowd.
                const minimum = this.maximum.mul(
                    N.mix(
                        0.18,
                        0.43,
                        N.smoothstep(0.06, 0.24, projected.div(this.maximum))
                    )
                );
                const radius = N.clamp(projected, minimum, this.maximum);
                const step = this.texel.mul(radius);
                const priority = N.vec3(1, 2, 4);
                const id = N.dot(center.rgb, priority);
                for (const [x, y] of directions) {
                    const tap = mask.sample(
                        N.screenUV.add(step.mul(N.vec2(x, y)))
                    );
                    const other = (
                        tap as typeof tap & Pick<typeof mask, "level">
                    ).level(N.float(0));
                    const delta = center.rgb.sub(other.rgb);
                    const difference = N.max(
                        N.abs(delta.r),
                        N.max(N.abs(delta.g), N.abs(delta.b))
                    );
                    const dz = other.a.sub(center.a);
                    const owns = N.smoothstep(0, 0.15, N.dot(delta, priority));
                    const hairJoin = N.smoothstep(
                        4.25,
                        5,
                        N.min(id, N.dot(other.rgb, priority))
                    );
                    // The larger region ID owns a contact seam. Suppress the stroke
                    // on a distant avatar immediately behind a foreground object.
                    const gap = dz.div(N.max(0.08, difference));
                    const visible = N.smoothstep(-0.012, -0.003, gap);
                    const seam = difference
                        .mul(owns)
                        .mul(N.mix(1, 0.58, hairJoin));
                    // Disjoint instances may share a signature. Only compare depth
                    // on fully covered, matching pixels, away from mixed MSAA edges.
                    const same = N.float(1).sub(
                        N.smoothstep(0.002, 0.016, difference)
                    );
                    const overlap = N.smoothstep(0.019, 0.038, dz).mul(same);
                    edge.assign(N.max(edge, N.max(seam.mul(visible), overlap)));
                }
            });
            const pigment = N.min(color.rgb, N.vec3(0.028, 0.017, 0.012));
            return N.vec4(
                N.mix(color.rgb, pigment, edge.mul(coverage)),
                color.a
            );
        })();
        this.pass = pass;
        this.pipeline = new RenderPipeline(renderer, resolve);
    }

    render(
        renderer: T.WebGPURenderer,
        scene: T.Scene,
        camera: T.Camera,
        enabled: boolean
    ) {
        if (!enabled) {
            renderer.render(scene, camera);
            return;
        }
        if (this.pass?.scene !== scene || this.pass.camera !== camera)
            this.setup(renderer, scene, camera);
        const { x, y } = renderer.getDrawingBufferSize(this.drawingBuffer);
        this.texel.value.set(1 / x, 1 / y);
        this.maximum.value = 2.65 * renderer.getPixelRatio();
        this.pen.value =
            (0.00235 * y * camera.projectionMatrix.elements[5]) / 2;
        this.perspective.value = (camera as T.PerspectiveCamera)
            .isPerspectiveCamera
            ? 1
            : 0;
        // Room bloom/color filters consume linear color in their scene target.
        // The final canvas uses the renderer's display transform.
        const display = renderer.getRenderTarget() === null;
        if (this.pipeline.outputColorTransform !== display) {
            this.pipeline.outputColorTransform = display;
            this.pipeline.needsUpdate = true;
        }
        this.pipeline.render();
    }

    dispose() {
        this.pipeline?.dispose();
        this.pass?.dispose();
        this.pipeline = undefined;
        this.pass = undefined;
    }
}
