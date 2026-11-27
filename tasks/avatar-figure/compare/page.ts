/**
 * The page the compare tool opens: it draws a figure in a style from a
 * fixed set of views, or lays pictures out side by side. See ../compare.ts.
 */
import * as THREE from "three/webgpu";
import {
    dot,
    float as f32,
    mix,
    normalView,
    normalize,
    positionView,
    pow,
    saturate,
    select,
    smoothstep,
    texture,
    vec3,
} from "three/tsl";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
    FIGURE_STYLES,
    STAGEHAND_STYLE,
    loadFigure,
} from "../../../frontend/features/procedural-avatar/figure/index.ts";
import { EYE_VIEW, FACE_SPAN } from "./views.ts";

const params = new URLSearchParams(location.search);
const state = window as unknown as { __compare?: unknown };

/** Lines to measure a picture by. */
interface Grid {
    /** Where in the tile the count starts, and what it starts at. */
    origin: [number, number];
    from: [number, number];
    /** Pixels of the tile to one of what is counted. */
    unit: number;
    /** Which way the count goes up: 1 to the right, -1 to the left. */
    across: number;
    /** 1 if it goes up towards the top of the tile, -1 if down. */
    up: number;
    /** How far apart the lines are, and how many to each numbered one. */
    step: number;
    numbered: number;
    /** Decimal places in the numbers. */
    places: number;
}

function drawGrid(
    ctx: CanvasRenderingContext2D,
    grid: Grid,
    [x, y, w, h]: number[]
) {
    ctx.font = "13px sans-serif";
    ctx.lineWidth = 1;
    const lines = (
        start: number,
        size: number,
        origin: number,
        from: number,
        direction: number,
        draw: (at: number, value: number, style: string, name: boolean) => void
    ) => {
        // Every multiple of the step that falls inside the tile.
        const ends = [0, size].map(
            (edge) => from + ((edge - origin) * direction) / grid.unit
        );
        const first = Math.ceil(Math.min(...ends) / grid.step);
        const last = Math.floor(Math.max(...ends) / grid.step);
        for (let k = first; k <= last; k++) {
            const value = k * grid.step;
            const numbered = k % grid.numbered === 0;
            draw(
                start + origin + (value - from) * grid.unit * direction,
                value,
                !k
                    ? "rgba(255,0,255,0.9)"
                    : numbered
                    ? "rgba(0,255,255,0.75)"
                    : "rgba(0,255,255,0.3)",
                numbered
            );
        }
    };
    const stroke = (x0: number, y0: number, x1: number, y1: number) => {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
    };
    lines(
        x,
        w,
        grid.origin[0],
        grid.from[0],
        grid.across,
        (at, value, style, name) => {
            ctx.strokeStyle = style;
            stroke(at, y, at, y + h);
            ctx.fillStyle = "#ffff00";
            if (name)
                ctx.fillText(value.toFixed(grid.places), at + 3, y + h - 6);
        }
    );
    lines(
        y,
        h,
        grid.origin[1],
        grid.from[1],
        -grid.up,
        (at, value, style, name) => {
            ctx.strokeStyle = style;
            stroke(x, at, x + w, at);
            ctx.fillStyle = "#ffff00";
            if (name) ctx.fillText(value.toFixed(grid.places), x + 4, at - 3);
        }
    );
}

/** Pictures side by side on one canvas, with labels and measuring grids. */
async function sheet(spec: {
    width: number;
    height: number;
    tiles: {
        src: string;
        /** The part of the picture to show; all of it if left out. */
        crop?: [number, number, number, number];
        at: [number, number, number, number];
        label?: string;
        /** Lines over the tile to measure by. */
        grid?: Grid;
    }[];
}) {
    const canvas = document.createElement("canvas");
    canvas.width = spec.width;
    canvas.height = spec.height;
    document.body.append(canvas);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, spec.width, spec.height);
    ctx.imageSmoothingQuality = "high";
    const sizes: Record<string, [number, number]> = {};
    for (const tile of spec.tiles) {
        const image = new Image();
        image.src = tile.src;
        await image.decode();
        sizes[tile.src] = [image.naturalWidth, image.naturalHeight];
        const [x, y, w, h] = tile.at;
        const crop = tile.crop || [
            0,
            0,
            image.naturalWidth,
            image.naturalHeight,
        ];
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.drawImage(image, crop[0], crop[1], crop[2], crop[3], x, y, w, h);
        if (tile.grid) drawGrid(ctx, tile.grid, [x, y, w, h]);
        ctx.restore();
        if (tile.label) {
            ctx.fillStyle = "rgba(245,237,240,0.92)";
            ctx.fillRect(x, y, Math.min(w, 14 + tile.label.length * 11), 30);
            ctx.fillStyle = "#3c2832";
            ctx.font = "18px sans-serif";
            ctx.fillText(tile.label, x + 8, y + 21);
        }
    }
    return { sizes };
}

/**
 * Try another model's hair on: everything of the model's that is hair,
 * made the size of this head and set on it. It is shaded plainly, in one
 * colour, to judge its shape by.
 */
async function tryHair(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vrm: any,
    scene: THREE.Scene,
    colour: string
) {
    const loader = new GLTFLoader();
    loader.register((parser) => {
        const plugin = new VRMLoaderPlugin(parser);
        // As the lobby loads avatars: plain materials, which are
        // replaced below anyway.
        const toon = plugin.mtoonMaterialPlugin;
        toon.getMaterialType = () => null;
        toon.extendMaterialParams = async () => {};
        return plugin;
    });
    const donor = (await loader.loadAsync("/hair.vrm")).userData.vrm;
    VRMUtils.rotateVRM0(donor);
    const tint = new THREE.Color(colour);
    const key = normalize(vec3(-0.42, 0.56, 0.72));
    const made = new Map<THREE.Material, THREE.Material>();
    let triangles = 0;
    donor.scene.traverse((object: THREE.Object3D) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
        if (!materials.some((m) => /hair/i.test(m.name))) {
            mesh.visible = false;
            return;
        }
        triangles +=
            (mesh.geometry.index || mesh.geometry.attributes.position).count /
            3;
        const plain = (from: THREE.Material) => {
            if (made.has(from)) return made.get(from);
            const material = new THREE.MeshBasicNodeMaterial();
            material.side = THREE.DoubleSide;
            const eye = normalize(positionView.negate());
            const n = normalize(normalView);
            const facing = n.mul(
                select(dot(n, eye).lessThan(0), f32(-1), f32(1))
            );
            const map = (from as THREE.MeshBasicMaterial).map;
            // The model's own painted strands, as light and dark only.
            const strands = map
                ? saturate(dot(texture(map).rgb, vec3(0.3, 0.6, 0.1)).div(0.25))
                : f32(0.5);
            const scalp = /hairback/i.test(from.name);
            material.colorNode = vec3(tint.r, tint.g, tint.b)
                .mul(smoothstep(-0.4, 1, dot(facing, key)).mul(0.75).add(0.35))
                .mul(scalp ? f32(0.8) : mix(f32(0.75), f32(1.35), strands))
                .add(
                    vec3(0.5, 0.42, 0.4)
                        .mul(
                            pow(
                                saturate(dot(facing, normalize(key.add(eye)))),
                                6
                            )
                        )
                        .mul(scalp ? 0 : 0.18)
                );
            made.set(from, material);
            return material;
        };
        mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(plain)
            : plain(mesh.material);
    });
    scene.add(donor.scene);
    // The size of a head: how far its eye is from its joint.
    const at = (of: typeof vrm, bone: string) =>
        of.humanoid.getRawBoneNode(bone).getWorldPosition(new THREE.Vector3());
    donor.scene.updateMatrixWorld(true);
    const fit =
        at(vrm, "head").distanceTo(at(vrm, "leftEye")) /
        at(donor, "head").distanceTo(at(donor, "leftEye"));
    donor.scene.scale.setScalar(fit);
    donor.scene.updateMatrixWorld(true);
    donor.scene.position.add(at(vrm, "head").sub(at(donor, "head")));
    donor.scene.updateMatrixWorld(true);
    return { triangles, fit };
}

/** A figure in a style, seen from one of the fixed views. */
async function figure() {
    const style = JSON.parse(
        JSON.stringify(
            FIGURE_STYLES[params.get("style") || ""] || STAGEHAND_STYLE
        )
    );
    // Changes to try without editing the style: `eyes.radius=0.25`.
    for (const change of params.getAll("set")) {
        const [path, value] = [
            change.slice(0, change.indexOf("=")),
            change.slice(change.indexOf("=") + 1),
        ];
        const keys = path.split(".");
        let at = style;
        for (const key of keys.slice(0, -1)) at = at[key];
        at[keys[keys.length - 1]] = JSON.parse(value);
    }
    const renderer = new THREE.WebGPURenderer({
        antialias: true,
        forceWebGL: params.get("renderer") !== "webgpu",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    document.body.append(renderer.domElement);
    await renderer.init();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f5edf0");
    const { vrm, figure: styled } = await loadFigure("/figure.vrm", style);
    scene.add(vrm.scene);
    const expression = params.get("expression");
    if (expression) {
        for (const part of expression.split(",")) {
            const [name, weight] = part.split(":");
            vrm.expressionManager.setValue(name, Number(weight ?? 1));
        }
        vrm.expressionManager.update();
    }
    vrm.scene.updateMatrixWorld(true);
    const hair = params.get("hair")
        ? await tryHair(vrm, scene, params.get("hair"))
        : null;

    // Where its eyes are as the viewer sees them: the model was turned
    // to face the camera, so its own left is on the viewer's right.
    const { corners } = styled.frames;
    const eyes = {
        right: {
            x: -corners.left.x,
            y: corners.left.y,
            width: corners.left.width,
        },
        left: {
            x: -corners.right.x,
            y: corners.right.y,
            width: corners.right.width,
        },
    };
    const eyeLine = (eyes.left.y + eyes.right.y) / 2;
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const view = params.get("view") || "face";
    // Focused on the plane the eyes lie in, so that lengths in the face
    // are to scale.
    const eyeDepth =
        -(
            styled.frames.eyes.left.centre[2] +
            styled.frames.eyes.right.centre[2]
        ) / 2;
    let target = new THREE.Vector3(0, eyeLine + 0.003, eyeDepth);
    let span = Number(params.get("span")) || FACE_SPAN;
    let yaw = 0;
    if (view === "three-quarter") {
        yaw = 35;
        target.z = 0.03;
    } else if (view === "side") {
        yaw = 90;
        target.z = 0;
    } else if (view === "back") {
        yaw = 180;
        target.z = 0;
    } else if (view === "body" || view === "body-back") {
        target = new THREE.Vector3(0, (box.min.y + box.max.y) / 2, 0);
        span = (box.max.y - box.min.y) * 1.08;
        yaw = view === "body" ? 0 : 180;
    } else if (view === "eye-left" || view === "eye-right") {
        const eye = view === "eye-left" ? eyes.left : eyes.right;
        const out = Math.sign(eye.x);
        span = (EYE_VIEW.up + EYE_VIEW.down) * eye.width;
        target = new THREE.Vector3(
            eye.x +
                (out * (EYE_VIEW.outwards - EYE_VIEW.inwards) * eye.width) / 2,
            eye.y + ((EYE_VIEW.up - EYE_VIEW.down) * eye.width) / 2,
            eyeDepth
        );
    }
    // A long lens, as a character sheet is drawn.
    const fov = 8;
    const distance = span / 2 / Math.tan((fov * Math.PI) / 360);
    const camera = new THREE.PerspectiveCamera(
        fov,
        innerWidth / innerHeight,
        0.05,
        100
    );
    const turn = (yaw * Math.PI) / 180;
    camera.position.set(
        target.x + Math.sin(turn) * distance,
        target.y,
        target.z + Math.cos(turn) * distance
    );
    camera.lookAt(target);
    // Twice: the first draw compiles the materials.
    for (let frame = 0; frame < 2; frame++) {
        renderer.render(scene, camera);
        await new Promise((done) => setTimeout(done, 300));
    }
    return {
        style: style.id,
        triangles: styled.triangles,
        hair,
        // The head in eye widths: its levels, and half its width at
        // each half an eye width below the eyes.
        head: styled.head && {
            levels: styled.head.levels,
            widths: [0, 0.5, 1, 1.5, 2, 2.5].map((down) => [
                down,
                styled.head.halfWidth(down),
            ]),
        },
        eyes,
        eyeLine,
        height: box.max.y - box.min.y,
    };
}

(params.get("sheet") ? sheet(JSON.parse(params.get("sheet"))) : figure())
    .then((result) => {
        state.__compare = { status: "ready", ...result };
    })
    .catch((error) => {
        state.__compare = {
            status: "error",
            message: String(error?.stack || error),
        };
    });
