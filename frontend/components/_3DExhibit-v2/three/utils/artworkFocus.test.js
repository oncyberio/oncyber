import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from "three";
import Scene from "@3scene";
import Cache from "../modules/cache";
import Highlight from "../factory/highlightartwork";
import InstancedPipelineMesh from "../abstract/instancedpipelinemesh";

jest.mock("@3scene", () => ({
    __esModule: true,
    default: new (require("three").Scene)(),
}), { virtual: true });
jest.mock("@3constants", () => ({ PIPE_LINE_STATE: {}, DEBUG: false, FBO_DEBUG: false }), { virtual: true });
jest.mock("@3emitter", () => ({ __esModule: true, default: { on: jest.fn(), off: jest.fn() } }), { virtual: true });
jest.mock("@3events", () => ({ __esModule: true, default: {} }), { virtual: true });
jest.mock("@3camera", () => ({ __esModule: true, default: { current: {} } }), { virtual: true });
jest.mock("@3renderer", () => ({ __esModule: true, default: {} }), { virtual: true });
jest.mock("@3gl/globals/fbohelper.js", () => ({ __esModule: true, default: {} }), { virtual: true });
jest.mock("@3gl/globals/triangle", () => ({ __esModule: true, default: new (require("three").PlaneGeometry)() }), { virtual: true });
jest.mock("@3utils/mediatype", () => ({ IMAGE_MEDIA: "image", VIDEO_MEDIA: "video", MODEL_MEDIA: "model", HTML_MEDIA: "html" }), { virtual: true });
jest.mock("../abstract/pipelinemesh", () => ({ __esModule: true, default: class {} }));
jest.mock("../abstract/instancemeshwrapper", () => ({ __esModule: true, default: class {} }));
jest.mock("../factory/highlightartwork/rendermaterial", () => ({
    __esModule: true,
    default: class extends require("three").MeshBasicMaterial {},
}));
jest.mock("@3factory/particles/emitter.js", () => ({
    __esModule: true,
    default: class {
        constructor() {
            const { Mesh, BoxGeometry, MeshBasicMaterial } = require("three");
            this.mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
            this.mesh.geometry.setColor = jest.fn();
        }
        play() {}
        stop() {}
    },
}), { virtual: true });
jest.mock("gsap", () => ({
    __esModule: true,
    default: {
        to: jest.fn((target, { duration, ease, onComplete, ...values }) => {
            Object.assign(target, values);
            onComplete?.();
            return { kill: jest.fn() };
        }),
    },
}));

let selected;
beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    selected = null;
});
afterEach(async () => {
    if (selected?.highlightInfos) await Highlight.restore(selected);
    await Cache.hide();
    Scene.clear();
    jest.restoreAllMocks();
});

function sortedBorder(distance) {
    const batch = {
        instances: [{}],
        geometry: {
            _maxInstanceCount: 1,
            _closestDistance: distance,
            transparencySorting: true,
            sort: jest.fn(),
        },
        renderOrder: 0,
    };
    InstancedPipelineMesh.prototype.sort.call(batch, {});
    return batch;
}

test("near and far frame batches stay beneath the live artwork-focus veil", async () => {
    await Cache.show(0.8, 1);
    for (const distance of [0, 1, 50, 10000]) {
        expect(sortedBorder(distance).renderOrder).toBeLessThan(Cache.renderOrder);
    }
    expect(sortedBorder(1).renderOrder).toBeGreaterThan(sortedBorder(50).renderOrder);
    expect(Scene.children).toContain(Cache);
    expect(Cache.alpha).toBe(0.8);
    expect(Cache.material.transparent).toBe(true);
    expect(Cache.material.depthTest).toBe(false);
    expect(Cache.material.depthWrite).toBe(false);
});

test("the selected 2D artwork and its particles stay bright while its original frame is hidden, then restore", async () => {
    selected = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    selected.mediaType = "image";
    selected.renderOrder = 7;
    selected.scale.set(2, 3, 1);
    Scene.add(selected);
    selected.updateMatrixWorld(true);
    const border = { visible: true };
    await Cache.show(0.8, 1);
    Highlight.get({ renderMesh: selected, instancedBorder: border });
    await Promise.resolve();
    expect(border.visible).toBe(false);
    expect(Highlight.lines.mesh.renderOrder).toBeGreaterThan(Cache.renderOrder);
    expect(selected.renderOrder).toBeGreaterThan(Highlight.lines.mesh.renderOrder);
    expect(selected.material.depthTest).toBe(false);
    await Highlight.restore(selected);
    expect(selected.renderOrder).toBe(7);
    expect(selected.scale.toArray()).toEqual([2, 3, 1]);
    expect(selected.material.depthTest).toBe(true);
    expect(selected.material.transparent).toBe(false);
    expect(border.visible).toBe(true);
    expect(Scene.children).not.toContain(Highlight.lines.mesh);
});

test("all selected model meshes remain above the dimmed frames and restore their own drawing order", async () => {
    selected = new Group();
    selected.mediaType = "model";
    const meshes = [17, 23].map((renderOrder) => {
        const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
        mesh.renderOrder = renderOrder;
        selected.add(mesh);
        return mesh;
    });
    Scene.add(selected);
    selected.updateMatrixWorld(true);
    Highlight.get({ renderMesh: selected });
    await Promise.resolve();
    for (const mesh of meshes) {
        expect(mesh.renderOrder).toBeGreaterThan(Cache.renderOrder);
        expect(mesh.material.transparent).toBe(true);
    }
    await Highlight.restore(selected);
    expect(meshes.map((mesh) => mesh.renderOrder)).toEqual([17, 23]);
    expect(meshes.every((mesh) => !mesh.material.transparent)).toBe(true);
});
