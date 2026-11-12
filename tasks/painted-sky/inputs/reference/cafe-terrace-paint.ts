// The painting's hand, as shader building blocks: short directional dabs with
// dark contours, a cold ultramarine night against chrome-yellow gaslight, and
// one light model shared by the town, the props and the avatars.
import * as THREE from "three/webgpu";
import {
    abs,
    cameraPosition,
    clamp,
    cos,
    dot,
    float as f32,
    floor,
    Fn,
    fract,
    max,
    min,
    mix,
    normalize,
    normalWorld,
    positionWorld,
    select,
    sin,
    smoothstep,
    texture,
    uniform,
    vec2,
    vec3,
    vec4,
    step,
} from "three/tsl";
import type { Terrain } from "./terrain";

type Node = any;

/** Direction towards the moon (x east, y up, z south). */
export const MOON = vec3(-0.6, 0.5, 0.62);

export const hash11 = Fn(([n]: [Node]) =>
    fract(sin(n.mul(91.3458)).mul(47453.5453))
);
export const hash21 = Fn(([p]: [Node]) =>
    fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453))
);

/**
 * One layer of brush dabs over a 2D field in metres: staggered rows of
 * elongated cells. Returns (tone, hue, body, along): two random numbers per
 * dab, 0 at the dab's rim rising to 1 inside, and the position along it.
 */
export const strokeField = Fn(([p, size, angle]: [Node, Node, Node]) => {
    const c = cos(angle);
    const s = sin(angle);
    const qy = p.y.mul(c).sub(p.x.mul(s)).div(size.y);
    const row = floor(qy);
    const qx = p.x
        .mul(c)
        .add(p.y.mul(s))
        .div(size.x)
        .add(hash11(row).mul(0.83))
        .add(row.mul(0.5));
    const id = vec2(floor(qx), row);
    const fx = fract(qx);
    const fy = fract(qy);
    const body = smoothstep(0.0, 0.1, min(fx, fx.oneMinus())).mul(
        smoothstep(0.0, 0.24, min(fy, fy.oneMinus()))
    );
    return vec4(hash21(id), hash21(id.add(17.31)), body, fy);
});

/** Break a flat colour into paint: per-dab tone and hue shifts, dark rims, a ridge of impasto. */
export const applyPaint = Fn(([base, stroke, contour]: [Node, Node, Node]) => {
    const tone = stroke.x.mul(0.56).add(0.72);
    const level = max(base.r, max(base.g, base.b));
    const shift = vec3(
        stroke.y.sub(0.5).mul(0.16),
        stroke.y.sub(0.5).mul(-0.05),
        stroke.x.sub(0.5).mul(0.2)
    ).mul(level);
    const dab = base.mul(tone).add(shift).max(0.0);
    const ridge = smoothstep(0.62, 0.95, stroke.w).mul(stroke.z).mul(0.14);
    const rim = dab.mul(vec3(0.22, 0.27, 0.5));
    return mix(rim, dab.add(dab.mul(ridge)), mix(f32(1.0), stroke.z, contour));
});

/** World position flattened onto the surface's dominant plane, for dabs that stay put. */
export const surfacePlane = Fn(([position, normal]: [Node, Node]) => {
    const n = abs(normal);
    return select(
        n.y.greaterThan(0.6),
        position.xz,
        select(n.x.greaterThan(n.z), position.zy, position.xy)
    );
});

/** A hand-placed lamp. Its light stops at `ceiling` metres (an awning, a shop's fascia). */
export type HeroLight = {
    position: THREE.Vector3;
    radius: number;
    power: number;
    ceiling?: number;
};

export type Paint = {
    lightMap: THREE.DataTexture;
    /** 0 in the dark, 1 under a lamp, above 1 right at the café lantern. */
    warmth: (position?: Node, normal?: Node) => Node;
    /** Which way the gaslight comes from, over the ground (unit, mostly up). */
    lampDirection: (position?: Node) => Node;
    /** Albedo → the night's colour for that much gaslight. */
    shade: (albedo: Node, warmth: Node, night?: Node, normal?: Node) => Node;
    /** Night air: distance sinks into blue haze, warmed a little where lamps are. */
    haze: (color: Node, position?: Node) => Node;
    /** 1 in the open, falling towards 0.4 on the ground at the foot of a wall. */
    openness: (position?: Node) => Node;
    /** Brushwork from the canvas: sample one of the painted textures. */
    brush: (name: BrushName, at: Node) => Node;
    /** The same brushwork as a multiplier around 1, to paint any flat colour with. */
    relief: (at: Node) => Node;
    /** 0 on the side turned from the moon, 1 facing it. */
    moonlit: (normal?: Node) => Node;
    /** Lay the painting itself over `color` wherever the easel saw this surface. */
    canvas: (color: Node, position?: Node, normal?: Node) => Node;
    canvasSky: (color: Node, direction: Node) => Node;
    /** Filled once by the world: distance from the easel to the first surface. */
    easelDepth: THREE.RenderTarget;
    /** 1 while the camera stands at the easel, 0 once it has walked off. */
    atEasel: Node;
    /** What the easel's depth map stores for this fragment. */
    easelDistance: Node;
    /**
     * 1 to project the canvas onto surfaces; 0 once the brushwork (real
     * strokes, see brushwork.ts) has been laid on them instead.
     */
    projection: { value: number };
    brushes: Brushes;
    /** Dabs for a world-space surface. */
    dabs: (
        size: [number, number],
        angle?: Node | number,
        position?: Node,
        normal?: Node
    ) => Node;
    heroLights: HeroLight[];
    time: Node;
    dispose(): void;
};

const MAP_SIZE = 1024;
export const MAP_EXTENT = 1024; // metres covered by the light map, centred on the square

/**
 * The town's gaslight baked top-down: red is lamp light at street level,
 * green the ground height (so walls know how far above the street they are).
 */
export const BRUSH_NAMES = [
    "sky",
    "cobbleCool",
    "cobbleWarm",
    "wallLit",
    "wallViolet",
    "wallBlue",
    "wallNight",
    "wallDeep",
    "foliage",
    "awning",
    "floor",
    "pier",
    "shutter",
    "flame",
] as const;
export type BrushName = (typeof BRUSH_NAMES)[number];

/** A person, table or chair cut out of the canvas (see build-textures.cjs). */
export type CardSource = {
    name: string;
    kind: "table" | "patrons" | "figure";
    on: "street" | "terrace";
    /** In the canvas, as fractions from its top-left: x0, y0, x1, y1. */
    box: [number, number, number, number];
    foot: [number, number];
    /** In the cut-out atlas, as fractions: x, y, width, height. */
    atlas: [number, number, number, number];
};

/** Everything painted: built by scripts/cafe-terrace/build-textures.cjs. */
export type Brushes = Record<BrushName, THREE.Texture> & {
    /** The whole painting, in the easel camera's frame. */
    canvas: THREE.Texture;
    /** Red: where the canvas may be projected. Green: its sky. Blue: the heart of that sky. */
    masks: THREE.Texture;
    cardSources: CardSource[];
};

export async function loadBrushes(base: string): Promise<Brushes> {
    const loader = new THREE.TextureLoader();
    const load = async (file: string, tiled: boolean, colour = true) => {
        const map = await loader.loadAsync(`${base}/${file}`);
        map.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        // The tiles are built to repeat without a seam.
        map.wrapS = map.wrapT = tiled
            ? THREE.RepeatWrapping
            : THREE.ClampToEdgeWrapping;
        map.anisotropy = 8;
        return map;
    };
    const [tiles, canvas, masks, cardSources] = await Promise.all([
        Promise.all(
            BRUSH_NAMES.map(
                async (name) =>
                    [name, await load(`${name}.webp`, true)] as const
            )
        ),
        load("canvas.webp", false),
        load("masks.png", false, false),
        fetch(`${base}/cards.json`).then((response) => {
            if (!response.ok)
                throw new Error(`Cut-outs: HTTP ${response.status}`);
            return response.json() as Promise<CardSource[]>;
        }),
    ]);
    return {
        ...(Object.fromEntries(tiles) as Record<BrushName, THREE.Texture>),
        canvas,
        masks,
        cardSources,
    };
}

/** The easel's depth map stores distance / this, so it fits a half float. */
export const EASEL_DEPTH_RANGE = 200;

/** Van Gogh's viewpoint, for projecting his canvas back onto the scene. */
export type EaselView = {
    position: THREE.Vector3;
    /** Projection × view of the easel camera. */
    matrix: THREE.Matrix4;
};

export function createPaint(
    terrain: Terrain,
    lamps: number[][],
    heroLights: HeroLight[],
    footprints: number[][],
    brushes: Brushes,
    easel: EaselView,
    /** WebGPU stores render targets top row first; WebGL bottom row first. */
    topDown = true
): Paint {
    const data = new Uint8Array(MAP_SIZE * MAP_SIZE * 4);
    const light = new Float32Array(MAP_SIZE * MAP_SIZE);
    const scale = MAP_SIZE / MAP_EXTENT;
    const REACH = 15;
    for (const [x, z] of lamps) {
        // The painting's own corner is lit by its hand-placed lamps only.
        if (
            heroLights.length &&
            Math.hypot(
                x - heroLights[0].position.x,
                z - heroLights[0].position.z
            ) < 24
        )
            continue;
        const cx = (x + MAP_EXTENT / 2) * scale;
        const cz = (z + MAP_EXTENT / 2) * scale;
        const r = Math.ceil(REACH * scale);
        for (
            let j = Math.max(0, Math.floor(cz - r));
            j <= Math.min(MAP_SIZE - 1, cz + r);
            j++
        )
            for (
                let i = Math.max(0, Math.floor(cx - r));
                i <= Math.min(MAP_SIZE - 1, cx + r);
                i++
            ) {
                const d =
                    Math.hypot(i + 0.5 - cx, j + 0.5 - cz) / scale / REACH;
                if (d >= 1) continue;
                const fall = ((1 - d * d) ** 2 / (1 + 9 * d * d)) * 1.15;
                light[j * MAP_SIZE + i] += fall;
            }
    }
    for (let j = 0; j < MAP_SIZE; j++)
        for (let i = 0; i < MAP_SIZE; i++) {
            const o = (j * MAP_SIZE + i) * 4;
            const x = (i + 0.5) / scale - MAP_EXTENT / 2;
            const z = (j + 0.5) / scale - MAP_EXTENT / 2;
            data[o] = Math.min(
                255,
                Math.round(Math.min(1, light[j * MAP_SIZE + i]) * 255)
            );
            data[o + 1] = Math.max(
                0,
                Math.min(255, Math.round((terrain.height(x, z) + 20) * 5))
            );
            data[o + 3] = 255;
        }
    // Blue: how built-up the spot is (footprints, blurred over three metres),
    // which the ground reads as the soft shadow at the foot of every wall.
    const built = new Float32Array(MAP_SIZE * MAP_SIZE);
    for (const ring of footprints) {
        let x0 = Infinity;
        let x1 = -Infinity;
        let z0 = Infinity;
        let z1 = -Infinity;
        for (let i = 0; i < ring.length; i += 2) {
            x0 = Math.min(x0, ring[i]);
            x1 = Math.max(x1, ring[i]);
            z0 = Math.min(z0, ring[i + 1]);
            z1 = Math.max(z1, ring[i + 1]);
        }
        const i0 = Math.max(0, Math.floor((x0 + MAP_EXTENT / 2) * scale));
        const i1 = Math.min(
            MAP_SIZE - 1,
            Math.ceil((x1 + MAP_EXTENT / 2) * scale)
        );
        const j0 = Math.max(0, Math.floor((z0 + MAP_EXTENT / 2) * scale));
        const j1 = Math.min(
            MAP_SIZE - 1,
            Math.ceil((z1 + MAP_EXTENT / 2) * scale)
        );
        for (let j = j0; j <= j1; j++)
            for (let i = i0; i <= i1; i++) {
                const x = (i + 0.5) / scale - MAP_EXTENT / 2;
                const z = (j + 0.5) / scale - MAP_EXTENT / 2;
                let hit = false;
                for (
                    let a = 0, b = ring.length - 2;
                    a < ring.length;
                    b = a, a += 2
                ) {
                    const za = ring[a + 1];
                    const zb = ring[b + 1];
                    if (
                        za > z !== zb > z &&
                        x <
                            ((ring[b] - ring[a]) * (z - za)) / (zb - za) +
                                ring[a]
                    )
                        hit = !hit;
                }
                if (hit) built[j * MAP_SIZE + i] = 1;
            }
    }
    const BLUR = 3;
    const pass = new Float32Array(MAP_SIZE * MAP_SIZE);
    for (const [source, target, stride] of [
        [built, pass, 1],
        [pass, built, MAP_SIZE],
    ] as Array<[Float32Array, Float32Array, number]>)
        for (let j = 0; j < MAP_SIZE; j++)
            for (let i = 0; i < MAP_SIZE; i++) {
                let sum = 0;
                const along = stride === 1 ? i : j;
                for (let k = -BLUR; k <= BLUR; k++) {
                    const at = Math.max(0, Math.min(MAP_SIZE - 1, along + k));
                    sum +=
                        source[
                            stride === 1 ? j * MAP_SIZE + at : at * MAP_SIZE + i
                        ];
                }
                target[j * MAP_SIZE + i] = sum / (BLUR * 2 + 1);
            }
    for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++)
        data[i * 4 + 2] = Math.round(built[i] * 255);

    const lightMap = new THREE.DataTexture(
        data,
        MAP_SIZE,
        MAP_SIZE,
        THREE.RGBAFormat
    );
    lightMap.magFilter = THREE.LinearFilter;
    lightMap.minFilter = THREE.LinearFilter;
    lightMap.colorSpace = THREE.NoColorSpace;
    lightMap.needsUpdate = true;

    const time = uniform(0);
    const heroUniforms = heroLights.map((hero) => ({
        position: uniform(hero.position),
        radius: uniform(hero.radius),
        power: uniform(hero.power),
    }));

    const warmth = (
        position: Node = positionWorld,
        normal: Node = normalWorld
    ) => {
        const at = position.xz.add(normal.xz.mul(0.9));
        const sample = texture(lightMap, at.div(MAP_EXTENT).add(0.5));
        const street = sample.g.mul(51.0).sub(20.0);
        // Lamps hang at about 3.7 m: light fades up the wall and dies on the roofs.
        const above = position.y.sub(street);
        const reach = smoothstep(12.0, 2.5, above);
        let total: Node = sample.r.mul(reach);
        heroUniforms.forEach((hero, i) => {
            const to = hero.position.sub(position);
            const d = to.length().div(hero.radius);
            // Surfaces turned away from the flame keep only its bounce.
            const facing = dot(normal, to.normalize())
                .mul(0.5)
                .add(0.5)
                .mul(0.75)
                .add(0.25);
            const under = smoothstep(
                (heroLights[i].ceiling ?? 50) + 0.9,
                (heroLights[i].ceiling ?? 50) - 0.2,
                position.y.sub(street)
            );
            total = total.add(
                hero.power
                    .div(d.mul(d).mul(d).mul(d).add(1.0))
                    .mul(facing)
                    .mul(under)
            );
        });
        // Steady light: a flicker here made whole strokes of the floor blink.
        return total;
    };
    const lampDirection = (position: Node = positionWorld) => {
        // Towards where the light map is brighter: the nearest lamps.
        const at = position.xz.div(MAP_EXTENT).add(0.5);
        const step = 1.5 / MAP_EXTENT;
        const gx = texture(lightMap, at.add(vec2(step, 0.0))).r.sub(
            texture(lightMap, at.sub(vec2(step, 0.0))).r
        );
        const gz = texture(lightMap, at.add(vec2(0.0, step))).r.sub(
            texture(lightMap, at.sub(vec2(0.0, step))).r
        );
        return normalize(vec3(gx.mul(6.0), 0.35, gz.mul(6.0)));
    };

    // `night` is what darkness does to a colour: deep blue for stone and
    // plaster, greener for leaves.
    const shade = (
        albedo: Node,
        warm: Node,
        night: Node = vec3(0.024, 0.055, 0.19),
        normal: Node = normalWorld
    ) => {
        // A moon low in the south-west gives every volume a light side and a
        // dark side; what faces the sky keeps a little more.
        const moon = dot(normal, MOON)
            .max(0.0)
            .mul(1.05)
            .add(normal.y.max(0.0).mul(0.2))
            .add(0.5);
        const cool = albedo
            .mul(night)
            .mul(moon)
            .add(vec3(0.0015, 0.004, 0.016));
        const lit = albedo.mul(vec3(1.1, 0.78, 0.12));
        const glow = albedo.mul(vec3(1.16, 0.88, 0.17));
        const w = clamp(warm, 0.0, 2.0);
        return mix(
            mix(cool, lit, smoothstep(0.0, 0.85, w)),
            glow,
            smoothstep(0.9, 1.9, w)
        );
    };

    const openness = (position: Node = positionWorld) =>
        smoothstep(
            0.03,
            0.55,
            texture(lightMap, position.xz.div(MAP_EXTENT).add(0.5)).b
        )
            .mul(0.6)
            .oneMinus();

    const haze = (color: Node, position: Node = positionWorld) => {
        const distance = position.sub(cameraPosition).length();
        const fog = distance.mul(-0.0017).exp().oneMinus();
        const lamps = texture(lightMap, position.xz.div(MAP_EXTENT).add(0.5)).r;
        const air = vec3(0.012, 0.034, 0.115).add(
            vec3(0.11, 0.065, 0.012).mul(lamps)
        );
        return mix(color, air, fog.mul(0.62));
    };

    const brush = (name: BrushName, at: Node) => texture(brushes[name], at).rgb;
    // The awning's strokes, as light and dark only: brush relief for any colour.
    const relief = (at: Node) =>
        dot(texture(brushes.awning, at).rgb, vec3(0.3, 0.5, 0.2))
            .div(0.66)
            .clamp(0.45, 1.5);
    const moonlit = (normal: Node = normalWorld) =>
        smoothstep(0.05, 0.8, dot(normal, MOON));

    // ---- the painting, projected from the easel ----
    // What the easel sees first along each ray, so the canvas only lands on
    // surfaces Van Gogh could see. The world renders into it once at start.
    const easelDepth = new THREE.RenderTarget(2048, 2580, {
        type: THREE.HalfFloatType,
        magFilter: THREE.NearestFilter,
        minFilter: THREE.NearestFilter,
        depthBuffer: true,
    });
    const easelMatrix = uniform(easel.matrix);
    const easelPosition = uniform(easel.position);
    const atEasel = uniform(1);
    const projection = uniform(1);
    const easelDistance = positionWorld
        .sub(easelPosition)
        .length()
        .div(EASEL_DEPTH_RANGE);
    const onCanvas = (position: Node) => {
        const clip = easelMatrix.mul(vec4(position, 1.0));
        const at = clip.xy.div(clip.w.max(0.001)).mul(0.5).add(0.5);
        // Feather the frame, so the canvas melts into the grown textures.
        const frame = smoothstep(0.0, 0.025, at.x)
            .mul(smoothstep(1.0, 0.975, at.x))
            .mul(smoothstep(0.0, 0.025, at.y))
            .mul(smoothstep(1.0, 0.975, at.y))
            .mul(step(0.05, clip.w));
        return { at, frame };
    };
    const DEPTH_TEXEL = [1 / 2048, 1 / 2580];
    const depthAt = (at: Node) =>
        topDown ? vec2(at.x, at.y.oneMinus()) : vec2(at.x, at.y);
    const seenFromEasel = (position: Node, at: Node) => {
        const distance = position.sub(easelPosition).length();
        // The farthest of five neighbouring samples forgives the map's
        // stair-stepped silhouettes.
        const flipped = depthAt(at);
        let first: Node = texture(easelDepth.texture, flipped).r;
        for (const [dx, dy] of [
            [1.5, 0],
            [-1.5, 0],
            [0, 1.5],
            [0, -1.5],
        ])
            first = first.max(
                texture(
                    easelDepth.texture,
                    flipped.add(vec2(dx * DEPTH_TEXEL[0], dy * DEPTH_TEXEL[1]))
                ).r
            );
        const slack = distance.mul(0.02).add(0.3);
        return smoothstep(
            slack.add(0.5),
            slack,
            distance.sub(first.mul(EASEL_DEPTH_RANGE))
        );
    };
    const canvas = (
        color: Node,
        position: Node = positionWorld,
        normal: Node = normalWorld
    ) => {
        const { at, frame } = onCanvas(position);
        const toEasel = easelPosition.sub(position);
        const distance = toEasel.length();
        const near = smoothstep(95.0, 60.0, distance);
        const masks = texture(brushes.masks, at);
        // From the easel, every surface in the frame is the painting. Once
        // you walk, paint that was only glanced along a surface (far ground,
        // the far end of a wall) would show as smears, and roofs that poke
        // into the painted sky would be sky blue: those go back to their own
        // textures.
        const square = abs(dot(normal, toEasel.div(distance))).max(0.02);
        // Also any surface the easel saw almost edge-on, however near: its
        // paint is a few canvas pixels smeared across it.
        const crisp = smoothstep(240.0, 110.0, distance.div(square)).mul(
            smoothstep(0.07, 0.16, square)
        );
        const walking = crisp.mul(masks.g.oneMinus());
        // The painting's people and furniture are real 3D now, so the canvas
        // is never drawn under them (masks.r), from the easel or anywhere.
        const weight = frame
            .mul(projection)
            .mul(masks.r)
            .mul(seenFromEasel(position, at))
            .mul(near)
            .mul(mix(walking, f32(1.0), atEasel));
        return mix(color, texture(brushes.canvas, at).rgb, weight);
    };
    /** For the sky dome: the canvas wherever the easel sees nothing nearer. */
    const canvasSky = (color: Node, direction: Node) => {
        const { at, frame } = onCanvas(
            easelPosition.add(direction.mul(1000.0))
        );
        const open = step(0.6, texture(easelDepth.texture, depthAt(at)).r);
        // From the easel everything in the frame is the painting; walking
        // away, only what is truly sky stays on the dome.
        const sky = mix(texture(brushes.masks, at).b, f32(1.0), atEasel);
        return mix(
            color,
            texture(brushes.canvas, at).rgb,
            frame.mul(open).mul(sky)
        );
    };

    const dabs = (
        size: [number, number],
        angle: Node | number = 0.35,
        position: Node = positionWorld,
        normal: Node = normalWorld
    ) =>
        strokeField(
            surfacePlane(position, normal),
            vec2(size[0], size[1]),
            f32(angle as any)
        );

    return {
        lightMap,
        warmth,
        lampDirection,
        shade,
        haze,
        openness,
        dabs,
        brush,
        relief,
        moonlit,
        canvas,
        canvasSky,
        easelDepth,
        atEasel,
        easelDistance,
        projection,
        brushes,
        heroLights,
        time,
        dispose() {
            lightMap.dispose();
            easelDepth.dispose();
            Object.values(brushes).forEach((map) =>
                (map as THREE.Texture).dispose?.()
            );
        },
    };
}

/** A basic (unlit) node material whose colour is entirely ours. */
export function paintMaterial(
    colorNode: Node,
    options: Partial<THREE.MeshBasicNodeMaterial> = {}
) {
    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = colorNode;
    material.fog = false;
    Object.assign(material, options);
    return material;
}
