/** @jest-environment node */
import { gzipSync } from "zlib";
import {
    InstancedBufferGeometry,
    Mesh,
    NodeMaterial,
    SphereGeometry,
} from "three/webgpu";
import { RenderDemand } from "@components/_3DExhibit-v2/three/utils/renderDemand";
import { loadStrokeSet, paintSkyBackground } from "./paintedSky";
import { encodeStrokes, type StrokeSet } from "./strokeFormat";

/** The background BackgroundFactory.get makes from a sky image. */
function sharpSphere() {
    const material = new NodeMaterial();
    material.name = "BackgroundSharpMaterial";
    return new Mesh(new SphereGeometry(2, 8, 8), material);
}

/** Six one-row layers, one stroke each (the real file's layer count). */
function tinySet(): StrokeSet {
    const layer = (thetaMin: number) => ({
        thetaMin,
        thetaMax: thetaMin + 0.2,
        length: 0.05,
        width: 0.02,
        rowCells: [3],
    });
    return {
        palette: Uint8Array.from([20, 40, 160]),
        layers: [0.1, 0.4, 0.7, 1.0, 1.3, 1.6].map(layer),
        // cell 0 of each layer's three
        occupancy: Uint8Array.from([0b01001001, 0b10010010, 0b00000000]),
        angle: Uint8Array.from([1, 2, 3, 4, 5, 6]),
        shape: Uint8Array.from([0x33, 0x33, 0x33, 0x33, 0x33, 0x33]),
        colour: Uint8Array.from([0, 0, 0, 0, 0, 0]),
    };
}

const FILE = "/world-mods/test/sky.bin";

// what the browser has and this test environment lacks
const { DecompressionStream, ReadableStream } = require("stream/web");
Object.assign(globalThis, { DecompressionStream, ReadableStream });

/** A fetch answering with these bytes, or with an HTTP status. */
const serve = (body: Uint8Array | number) =>
    jest.fn(
        async () =>
            ({
                ok: typeof body !== "number",
                status: typeof body === "number" ? body : 200,
                arrayBuffer: async () =>
                    typeof body === "number"
                        ? new ArrayBuffer(0)
                        : Uint8Array.from(body).buffer,
            } as Response)
    );

beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("paintSkyBackground", () => {
    test("keeps the sky image when the stroke file fails to load", async () => {
        const sphere = sharpSphere();
        const painted = await paintSkyBackground(sphere, FILE, {
            load: () => Promise.reject(new Error("offline")),
        });
        expect(painted).toBe(false);
        expect((sphere.material as NodeMaterial).visible).toBe(true);
        expect(sphere.children).toHaveLength(0);
        expect(console.warn).toHaveBeenCalled();
    });

    test("keeps the sky image when the file is not found", async () => {
        const sphere = sharpSphere();
        const fetcher = serve(404);
        const painted = await paintSkyBackground(sphere, FILE, {
            load: (url) => loadStrokeSet(url, fetcher),
        });
        expect(fetcher).toHaveBeenCalledWith(FILE);
        expect(painted).toBe(false);
        expect(String((console.warn as jest.Mock).mock.calls[0][1])).toMatch(
            /HTTP 404/
        );
        expect((sphere.material as NodeMaterial).visible).toBe(true);
        expect(sphere.children).toHaveLength(0);
    });

    test("keeps the sky image when the file does not decode", async () => {
        const sphere = sharpSphere();
        const broken = encodeStrokes(tinySet()).slice(0, 20);
        const fetcher = serve(new Uint8Array(gzipSync(broken)));
        const painted = await paintSkyBackground(sphere, FILE, {
            load: (url) => loadStrokeSet(url, fetcher),
        });
        expect(painted).toBe(false);
        expect((sphere.material as NodeMaterial).visible).toBe(true);
        expect(sphere.children).toHaveLength(0);
        expect(String((console.warn as jest.Mock).mock.calls[0][1])).toMatch(
            /truncated/
        );
    });

    test("leaves other backgrounds alone", async () => {
        const load = jest.fn(async () => tinySet());
        const cube = new Mesh(new SphereGeometry(), new NodeMaterial());
        expect(await paintSkyBackground(cube, FILE, { load })).toBe(false);
        expect(await paintSkyBackground(null, FILE, { load })).toBe(false);
        expect(load).not.toHaveBeenCalled();
    });

    test("swaps the sphere's own draw for the strokes once ready", async () => {
        const invalidate = jest.spyOn(RenderDemand, "invalidate");
        const sphere = sharpSphere();
        const fetcher = serve(
            new Uint8Array(gzipSync(encodeStrokes(tinySet())))
        );
        const painted = await paintSkyBackground(sphere, FILE, {
            load: (url) => loadStrokeSet(url, fetcher),
        });
        expect(painted).toBe(true);
        // the sphere stays in the scene; only its own draw stops
        expect((sphere.material as NodeMaterial).visible).toBe(false);
        const strokes = sphere.getObjectByName("paintedSky") as Mesh;
        const backstop = sphere.getObjectByName("paintedSkyBackstop");
        expect(backstop).toBeDefined();
        expect(
            (strokes.geometry as InstancedBufferGeometry).instanceCount
        ).toBe(6);
        expect(strokes.renderOrder).toBeGreaterThan(backstop.renderOrder);
        expect(invalidate).toHaveBeenCalled();
    });

    test("draws fewer layers on phones", async () => {
        const sphere = sharpSphere();
        await paintSkyBackground(sphere, FILE, {
            mobile: true,
            load: async () => tinySet(),
        });
        const strokes = sphere.getObjectByName("paintedSky") as Mesh;
        expect(
            (strokes.geometry as InstancedBufferGeometry).instanceCount
        ).toBe(5);
    });

    test("does nothing when the space is gone before the file arrives", async () => {
        const sphere = sharpSphere();
        let arrive: (set: StrokeSet) => void;
        const pending = paintSkyBackground(sphere, FILE, {
            load: () => new Promise((resolve) => (arrive = resolve)),
        });
        (sphere.material as NodeMaterial).dispose();
        arrive(tinySet());
        expect(await pending).toBe(false);
        expect(sphere.children).toHaveLength(0);
    });
});
