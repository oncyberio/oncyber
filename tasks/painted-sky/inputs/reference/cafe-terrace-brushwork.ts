// The painting, laid into the town as real brushstrokes.
//
// Instead of projecting the canvas onto the walls and ground (which smears
// as soon as you step off the easel), every patch of the canvas becomes 3D
// strokes of paint lying on the surface Van Gogh was looking at: each one a
// small instanced quad wearing a bristle-streaked brush mark, turned the way
// his own strokes run on the canvas, coloured with the paint at that spot.
// From the easel they add up to the painting; walking among them they are
// dabs of paint on the stones and plaster, the way a Tilt Brush scene is.
//
// Placement uses one picture of the scene from the easel: how far away the
// first surface is under each patch of canvas. That gives the point, the
// surface's slope (from the neighbouring points), and how large the patch is
// on that surface. Patches too large for one stroke (far walls, the ground
// seen at a glancing angle) are covered with several, so no stroke is ever
// longer than a real brush could paint.
import * as THREE from "three/webgpu";
import {
    attribute,
    float as f32,
    mix,
    positionWorld,
    texture,
    uniform,
    uv,
    vec2,
    vec4,
} from "three/tsl";

/** Canvas resolution the strokes are cut from. */
const W = 1024;
const H = 1290;
/** One stroke per this many canvas pixels, each way. */
const STEP = 3;
/** The largest stroke, in metres: long and wide. */
const MAX_LONG = 0.32;
const MAX_WIDE = 0.13;
/** The smallest stroke, in metres. */
const MIN_LONG = 0.09;
const MIN_WIDE = 0.035;
/** Strokes are grouped in cells this wide, so off-screen ones are skipped. */
const CELL = 24;

export type BrushworkInput = {
    renderer: THREE.WebGPURenderer;
    scene: THREE.Scene;
    easel: THREE.PerspectiveCamera;
    /** The canvas image (painted-out, in the reference's frame). */
    canvasImage: CanvasImageSource & { width: number; height: number };
    /** Distances are stored divided by this. */
    range: number;
    /** Objects to leave out of the picture (people, furniture, glows). */
    hide: THREE.Object3D[];
};

/** The brush: four bristle marks, each a tapered stroke with streaks. */
function paintBrushAtlas() {
    const SIZE = 256;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE * 4;
    canvas.height = SIZE;
    const g = canvas.getContext("2d");
    let seed = 7;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    for (let k = 0; k < 4; k++) {
        const x0 = k * SIZE;
        // The stroke's body: thickest a third of the way in, tapering to a
        // ragged tail. u runs along it, v across.
        const image = g.createImageData(SIZE, SIZE);
        const streaks = Array.from({ length: 22 }, () => ({
            v: random(),
            light: 0.72 + random() * 0.4,
            stop: 0.72 + random() * 0.28,
        }));
        for (let y = 0; y < SIZE; y++)
            for (let x = 0; x < SIZE; x++) {
                const u = x / SIZE;
                const v = y / SIZE;
                const half =
                    0.44 *
                    Math.sin(Math.PI * Math.min(1, u * 1.35 + 0.04)) ** 0.6 *
                    (1 - 0.25 * u);
                const across = Math.abs(v - 0.5) / Math.max(half, 0.001);
                // The nearest bristle streak sets this pixel's light.
                let light = 1;
                let stop = 1;
                let best = 1;
                for (const s of streaks) {
                    const d = Math.abs(v - s.v);
                    if (d < best) {
                        best = d;
                        light = s.light;
                        stop = s.stop;
                    }
                }
                const edge = 1 - across;
                const tail = u < stop ? 1 : Math.max(0, 1 - (u - stop) * 14);
                const alpha =
                    edge > 0
                        ? Math.min(1, edge * 5) * tail * (u > 0.02 ? 1 : 0)
                        : 0;
                const i = (y * SIZE + x) * 4;
                // Grey carries the streaks' light; alpha the mark's shape.
                const grain = 0.9 + 0.1 * Math.sin(u * 90 + v * 7 + k);
                const value = Math.round(
                    255 *
                        Math.min(
                            1,
                            (light * grain * (0.82 + 0.18 * edge)) / 1.2
                        )
                );
                image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
                image.data[i + 3] = Math.round(
                    255 * Math.max(0, Math.min(1, alpha))
                );
            }
        g.putImageData(image, x0, 0);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.NoColorSpace;
    map.anisotropy = 8;
    return map;
}

/** Directions of the paint on the canvas: the way each stroke runs. */
function strokeFlow(grey: Float32Array) {
    const gxx = new Float32Array(W * H);
    const gyy = new Float32Array(W * H);
    const gxy = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++)
        for (let x = 1; x < W - 1; x++) {
            const i = y * W + x;
            const gx =
                grey[i + 1 - W] +
                2 * grey[i + 1] +
                grey[i + 1 + W] -
                grey[i - 1 - W] -
                2 * grey[i - 1] -
                grey[i - 1 + W];
            const gy =
                grey[i + W - 1] +
                2 * grey[i + W] +
                grey[i + W + 1] -
                grey[i - W - 1] -
                2 * grey[i - W] -
                grey[i - W + 1];
            gxx[i] = gx * gx;
            gyy[i] = gy * gy;
            gxy[i] = gx * gy;
        }
    // Smooth the tensor so each stroke follows the flow around it.
    const blur = (a: Float32Array, r: number) => {
        const t = new Float32Array(W * H);
        const o = new Float32Array(W * H);
        for (let y = 0; y < H; y++) {
            let sum = 0;
            for (let x = -r; x <= r; x++) sum += a[y * W + Math.max(0, x)];
            for (let x = 0; x < W; x++) {
                t[y * W + x] = sum / (2 * r + 1);
                sum +=
                    a[y * W + Math.min(W - 1, x + r + 1)] -
                    a[y * W + Math.max(0, x - r)];
            }
        }
        for (let x = 0; x < W; x++) {
            let sum = 0;
            for (let y = -r; y <= r; y++) sum += t[Math.max(0, y) * W + x];
            for (let y = 0; y < H; y++) {
                o[y * W + x] = sum / (2 * r + 1);
                sum +=
                    t[Math.min(H - 1, y + r + 1) * W + x] -
                    t[Math.max(0, y - r) * W + x];
            }
        }
        return o;
    };
    const xx = blur(gxx, 5);
    const yy = blur(gyy, 5);
    const xy = blur(gxy, 5);
    // The stroke runs across the gradient: along the edges the brush left.
    return (i: number) =>
        0.5 * Math.atan2(2 * xy[i], xx[i] - yy[i]) + Math.PI / 2;
}

export async function createBrushwork(input: BrushworkInput) {
    const { renderer, scene, easel, range } = input;

    // ---- what the easel sees: distance to the first surface, per pixel ----
    const target = new THREE.RenderTarget(W, H, {
        type: THREE.FloatType,
        magFilter: THREE.NearestFilter,
        minFilter: THREE.NearestFilter,
        depthBuffer: true,
    });
    const distance = new THREE.MeshBasicNodeMaterial();
    // Distance in world space from the easel (as world.ts's depth pass).
    distance.colorNode = vec4(
        positionWorld.sub(uniform(easel.position.clone())).length().div(range),
        0.0,
        0.0,
        1.0
    );
    distance.side = THREE.DoubleSide;
    distance.fog = false;
    const hidden = input.hide.filter((object) => object.visible);
    hidden.forEach((object) => (object.visible = false));
    const swapped: Array<[THREE.Mesh, THREE.Material]> = [];
    scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || !mesh.visible) return;
        const own = mesh.material as THREE.Material;
        swapped.push([mesh, own]);
        mesh.material = own?.userData?.easelDepth ?? distance;
    });
    renderer.setClearColor(0xffffff, 1);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, easel);
    renderer.setRenderTarget(null);
    swapped.forEach(([mesh, own]) => (mesh.material = own));
    hidden.forEach((object) => (object.visible = true));
    const raw = (await renderer.readRenderTargetPixelsAsync(
        target,
        0,
        0,
        W,
        H
    )) as Float32Array;
    target.dispose();
    distance.dispose();
    const depthRaw = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) depthRaw[i] = raw[i * 4];
    // Which way up the rows come back differs by backend: the top row of
    // the view is sky (far), the bottom row is the street at the easel's feet.
    const rowMean = (y: number) => {
        let s = 0;
        for (let x = 0; x < W; x += 8) s += depthRaw[y * W + x];
        return s;
    };
    const flip = rowMean(2) < rowMean(H - 3);
    const depth = (x: number, y: number) =>
        depthRaw[(flip ? H - 1 - y : y) * W + x] * range;

    // ---- the paint: colour and stroke direction per pixel ----
    const paint = document.createElement("canvas");
    paint.width = W;
    paint.height = H;
    const pg = paint.getContext("2d", { willReadFrequently: true });
    pg.drawImage(input.canvasImage, 0, 0, W, H);
    const pixels = pg.getImageData(0, 0, W, H).data;
    const grey = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++)
        grey[i] =
            (0.3 * pixels[i * 4] +
                0.59 * pixels[i * 4 + 1] +
                0.11 * pixels[i * 4 + 2]) /
            255;
    const flow = strokeFlow(grey);

    // ---- the strokes ----
    easel.updateMatrixWorld(true);
    const origin = easel.position.clone();
    const ray = (px: number, py: number, out: THREE.Vector3) =>
        out
            .set((px / W) * 2 - 1, 1 - (py / H) * 2, 0.5)
            .unproject(easel)
            .sub(origin)
            .normalize();
    const point = (px: number, py: number, out: THREE.Vector3) => {
        const x = Math.max(0, Math.min(W - 1, Math.round(px)));
        const y = Math.max(0, Math.min(H - 1, Math.round(py)));
        return ray(px, py, out).multiplyScalar(depth(x, y)).add(origin);
    };
    const linear = (v: number) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };

    type Stroke = { m: number[]; c: [number, number, number]; k: number };
    const cells = new Map<string, Stroke[]>();
    let seed = 1888;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const P = new THREE.Vector3();
    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    const N = new THREE.Vector3();
    const R = new THREE.Vector3();
    const U = new THREE.Vector3();
    const V = new THREE.Vector3();
    const Q = new THREE.Vector3();
    /** Where a ray through (px, py) meets the plane through P with normal N. */
    const onPlane = (px: number, py: number, out: THREE.Vector3) => {
        ray(px, py, R);
        const denom = R.dot(N);
        if (Math.abs(denom) < 1e-4) return false;
        const t = P.clone().sub(origin).dot(N) / denom;
        if (t <= 0) return false;
        out.copy(R).multiplyScalar(t).add(origin);
        return true;
    };
    let count = 0;
    for (let py = STEP / 2; py < H; py += STEP)
        for (let px = STEP / 2; px < W; px += STEP) {
            const jx = Math.min(
                W - 1,
                Math.round(px + (random() - 0.5) * STEP)
            );
            const jy = Math.min(
                H - 1,
                Math.round(py + (random() - 0.5) * STEP)
            );
            const d = depth(jx, jy);
            if (!(d > 0.3) || d > range * 0.97) continue;
            point(jx, jy, P);
            // The surface's slope, from the points two pixels around.
            const near = (dx: number, dy: number, out: THREE.Vector3) => {
                const x = Math.max(0, Math.min(W - 1, jx + dx));
                const y = Math.max(0, Math.min(H - 1, jy + dy));
                const dd = depth(x, y);
                // Across an edge (a wall in front of the street) the
                // neighbour belongs to something else: don't use it.
                if (Math.abs(dd - d) > d * 0.06 + 0.15) return false;
                point(x, y, out);
                return true;
            };
            const right = near(2, 0, A)
                ? A.clone().sub(P)
                : near(-2, 0, A)
                ? P.clone().sub(A)
                : null;
            const down = near(0, 2, B)
                ? B.clone().sub(P)
                : near(0, -2, B)
                ? P.clone().sub(B)
                : null;
            if (right && down) N.crossVectors(down, right).normalize();
            // A sliver (a railing, a twig) has no surface to lay paint on.
            else continue;
            if (N.dot(ray(jx, jy, R)) > 0) N.negate();
            // The stroke's patch of canvas: long along the paint's flow.
            const theta = flow(jy * W + jx) + (random() - 0.5) * 0.35;
            const long = STEP * (2.2 + random() * 0.8);
            const wide = STEP * (1.15 + random() * 0.3);
            const cx = Math.cos(theta);
            const cy = Math.sin(theta);
            if (!onPlane(jx + cx * long * 0.5, jy + cy * long * 0.5, A))
                continue;
            if (!onPlane(jx - cy * wide * 0.5, jy + cx * wide * 0.5, B))
                continue;
            U.copy(A).sub(P).multiplyScalar(2);
            V.copy(B).sub(P).multiplyScalar(2);
            // Never smaller than a brush makes: near the easel a canvas
            // pixel is millimetres, and dabs that small read as grain.
            if (U.length() < MIN_LONG) U.setLength(MIN_LONG);
            if (V.length() < MIN_WIDE) V.setLength(MIN_WIDE);
            // Too big for one brush: cover the patch with several strokes.
            const nu = Math.min(
                6,
                Math.max(1, Math.ceil(U.length() / MAX_LONG))
            );
            const nv = Math.min(
                6,
                Math.max(1, Math.ceil(V.length() / MAX_WIDE))
            );
            const i = (jy * W + jx) * 4;
            const colour: [number, number, number] = [
                linear(pixels[i]),
                linear(pixels[i + 1]),
                linear(pixels[i + 2]),
            ];
            // Paint stands a little proud of the surface; nearer the easel less.
            const lift = 0.004 + d * 0.0007;
            for (let a = 0; a < nu; a++)
                for (let b = 0; b < nv; b++) {
                    Q.copy(P)
                        .addScaledVector(
                            U,
                            (a + 0.5) / nu - 0.5 + ((random() - 0.5) * 0.3) / nu
                        )
                        .addScaledVector(
                            V,
                            (b + 0.5) / nv - 0.5 + ((random() - 0.5) * 0.3) / nv
                        )
                        .addScaledVector(N, lift);
                    const u = U.clone().multiplyScalar(1.25 / nu);
                    const v = V.clone().multiplyScalar(1.3 / nv);
                    const n = N.clone().multiplyScalar(0.01);
                    // Column-major 4×4: the quad's x along u, y along v, z out.
                    const m = [
                        u.x,
                        u.y,
                        u.z,
                        0,
                        v.x,
                        v.y,
                        v.z,
                        0,
                        n.x,
                        n.y,
                        n.z,
                        0,
                        Q.x,
                        Q.y,
                        Q.z,
                        1,
                    ];
                    const key = `${Math.floor(Q.x / CELL)},${Math.floor(
                        Q.z / CELL
                    )}`;
                    let list = cells.get(key);
                    if (!list) cells.set(key, (list = []));
                    list.push({ m, c: colour, k: Math.floor(random() * 4) });
                    count++;
                }
        }

    // ---- one instanced mesh per cell ----
    const atlas = paintBrushAtlas();
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const material = new THREE.MeshBasicNodeMaterial();
    const colour = attribute("strokeColour", "vec3");
    const kind = attribute("strokeKind", "float");
    const mark = texture(atlas, vec2(uv().x.add(kind).div(4.0), uv().y));
    // Each stroke's colour, lightened and darkened along its bristles.
    material.colorNode = colour.mul(mix(f32(0.86), f32(1.12), mark.r));
    material.opacityNode = mark.a;
    material.alphaTest = 0.5;
    material.side = THREE.DoubleSide;
    material.fog = false;
    const group = new THREE.Group();
    group.name = "Brushwork";
    const matrix = new THREE.Matrix4();
    for (const strokes of cells.values()) {
        const mesh = new THREE.InstancedMesh(
            geometry,
            material,
            strokes.length
        );
        const colours = new Float32Array(strokes.length * 3);
        const kinds = new Float32Array(strokes.length);
        strokes.forEach((stroke, i) => {
            matrix.fromArray(stroke.m);
            mesh.setMatrixAt(i, matrix);
            colours.set(stroke.c, i * 3);
            kinds[i] = stroke.k;
        });
        const own = geometry.clone();
        own.setAttribute(
            "strokeColour",
            new THREE.InstancedBufferAttribute(colours, 3)
        );
        own.setAttribute(
            "strokeKind",
            new THREE.InstancedBufferAttribute(kinds, 1)
        );
        mesh.geometry = own;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.matrixAutoUpdate = false;
        mesh.name = "Strokes";
        group.add(mesh);
    }
    return {
        group,
        count,
        dispose() {
            group.children.forEach((mesh) =>
                (mesh as THREE.InstancedMesh).geometry.dispose()
            );
            geometry.dispose();
            material.dispose();
            atlas.dispose();
        },
    };
}
