import {
    BufferAttribute,
    DoubleSide,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    Mesh,
    NodeMaterial,
    PlaneGeometry,
    SphereGeometry,
    type Camera,
    type Object3D,
} from "three/webgpu";
import { attribute, modelViewProjection } from "three/tsl";
import { RenderDemand } from "@components/_3DExhibit-v2/three/utils/renderDemand";
import {
    backstopColours,
    decodeStrokes,
    strokeInstances,
    strokesPerLayer,
    type StrokeInstances,
    type StrokeSet,
} from "./strokeFormat";
import { createStrokeMaterial } from "./strokeMaterial";
import { STARRY_NIGHT_STROKES } from "./strokeFile";

/**
 * Painted skies: destinations whose 360° sky image has been repainted
 * offline as brush strokes (tasks/painted-sky). The strokes replace what the
 * background sphere draws; the image itself still lights the world (PMREM)
 * and colours its fog.
 */
const PAINTED_SKIES: Record<string, { url: string }> = {
    thestarrynight_skydome: STARRY_NIGHT_STROKES,
};

/** Phones and tablets skip the finest layer (the accents). */
const MOBILE_LAYERS = 4;

export function paintedSkyFor(slug: string | null | undefined) {
    if (typeof slug !== "string") return null;
    return PAINTED_SKIES[slug.toLowerCase()] ?? null;
}

/** Fetches and decodes a stroke file (gzipped on disk, see strokeFormat). */
export async function loadStrokeSet(
    url: string,
    fetcher: typeof fetch = fetch
): Promise<StrokeSet> {
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    if (typeof DecompressionStream === "undefined")
        throw new Error("this browser cannot gunzip");
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    return decodeStrokes(bytes);
}

/** Centred on the camera every frame, as the sharp sphere is. */
function followCamera(mesh: Mesh) {
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    mesh.onBeforeRender = (_renderer, _scene, camera: Camera) => {
        mesh.matrixWorld.copyPosition(camera.matrixWorld);
    };
}

/**
 * A plain low-resolution sphere in the sky's own colours (from the coarse
 * strokes), drawn first: where no stroke happens to cover a pixel, it shows
 * the colour that belongs there instead of the clear colour. One cheap pass.
 */
export function createBackstop(instances: StrokeInstances, coarse: number) {
    const columns = 72;
    const rows = 36;
    const geometry = new SphereGeometry(1, columns, rows);
    // the sharp sphere's mapping has z mirrored (its scale.z is -1)
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++)
        position.setZ(i, -position.getZ(i));
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("uv");
    geometry.setAttribute(
        "color",
        new BufferAttribute(
            backstopColours(instances, coarse, columns, rows),
            3
        )
    );
    const material = new NodeMaterial();
    material.name = "PaintedSkyBackstopMaterial";
    material.side = DoubleSide;
    material.fog = false;
    material.transparent = true;
    material.depthWrite = false;
    material.vertexNode = modelViewProjection.setZ(modelViewProjection.w);
    material.colorNode = attribute("color", "vec3");
    const mesh = new Mesh(geometry, material);
    mesh.name = "paintedSkyBackstop";
    followCamera(mesh);
    return mesh;
}

/** All the strokes in one instanced draw, coarse to fine. */
export function createStrokeMesh(instances: StrokeInstances) {
    const quad = new PlaneGeometry(1, 1, 6, 1);
    const geometry = new InstancedBufferGeometry();
    geometry.setIndex(quad.getIndex());
    geometry.setAttribute("position", quad.getAttribute("position"));
    geometry.setAttribute("uv", quad.getAttribute("uv"));
    geometry.setAttribute(
        "strokeCentre",
        new InstancedBufferAttribute(instances.centre, 4)
    );
    geometry.setAttribute(
        "strokeAxis",
        new InstancedBufferAttribute(instances.axis, 4)
    );
    geometry.setAttribute(
        "strokeColour",
        new InstancedBufferAttribute(instances.colour, 4)
    );
    geometry.instanceCount = instances.count;
    const mesh = new Mesh(geometry, createStrokeMaterial());
    mesh.name = "paintedSky";
    followCamera(mesh);
    return mesh;
}

type PaintOptions = {
    /** Draw the lighter layer set. */
    mobile?: boolean;
    load?: (url: string) => Promise<StrokeSet>;
};

/**
 * Repaints a destination's sky as brush strokes, if it has a stroke file.
 * `background` is what BackgroundFactory.get returned. Only the sharp sky
 * sphere is replaced; it keeps drawing until the strokes are ready, and for
 * good if the file fails to load or decode. The strokes become the sphere's
 * child, so they follow it into mirrors, out of the occlusion pass and into
 * disposal. Resolves to whether the sky is now painted. Never rejects.
 */
export async function paintSkyBackground(
    background: Object3D | null,
    slug: string | null | undefined,
    { mobile = false, load = (url) => loadStrokeSet(url) }: PaintOptions = {}
): Promise<boolean> {
    const sky = paintedSkyFor(slug);
    const sphere = background as Mesh | null;
    const material = sphere?.material as Mesh["material"] & { name?: string };
    if (!sky || !sphere || material?.name !== "BackgroundSharpMaterial")
        return false;
    let disposed = false;
    const onDispose = () => (disposed = true);
    material.addEventListener("dispose", onDispose);
    try {
        const set = await load(sky.url);
        if (disposed) return false;
        const layers = mobile
            ? Math.min(MOBILE_LAYERS, set.layers.length)
            : set.layers.length;
        const instances = strokeInstances(set, layers);
        if (instances.count === 0) throw new Error("no strokes");
        const [ground, underpaint] = strokesPerLayer(set);
        const backstop = createBackstop(instances, ground + underpaint);
        const strokes = createStrokeMesh(instances);
        // after the backstop (transparent objects draw by renderOrder)
        backstop.renderOrder = sphere.renderOrder;
        strokes.renderOrder = sphere.renderOrder + 1;
        sphere.add(backstop, strokes);
        // the sphere stays (mirrors, disposal and pipeline passes see it);
        // only its own draw stops
        material.visible = false;
        RenderDemand.invalidate();
        return true;
    } catch (error) {
        console.warn("Painted sky unavailable, keeping the sky image", error);
        return false;
    } finally {
        material.removeEventListener("dispose", onDispose);
    }
}
