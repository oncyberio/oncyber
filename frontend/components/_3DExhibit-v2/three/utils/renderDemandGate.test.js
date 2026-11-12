/** @jest-environment jsdom */
import {
    BufferAttribute,
    BoxGeometry,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Scene,
    Texture,
} from "three";

import { createRenderDemand } from "./renderDemand";
import { createRenderGate } from "./renderDemandGate";

/**
 * A world loop in the order world3D.js runs it: the gate decides, matrices
 * update, the gate looks at the scene when it would skip, the frame draws,
 * the gate reads what the GPU received. The fake backend stands in for
 * the renderer's: a frame whose inputs changed calls its update methods,
 * as three's Bindings and Attributes do (`state.onDraw` does that).
 */
function world({ eligible = true, emitter = null, gsap = null } = {}) {
    let time = 0;
    const backend = {
        updateBinding: jest.fn(),
        updateAttribute: jest.fn(),
        updateTexture: jest.fn(),
    };
    const renderer = {
        backend,
        info: { render: { drawCalls: 0 } },
        domElement: { width: 800, height: 600 },
    };
    const demand = createRenderDemand();
    const gate = createRenderGate({
        demand,
        renderer,
        emitter,
        frameEvents: ["pre_update", "update"],
        gsap,
        now: () => time,
    });
    gate.install();
    const scene = new Scene();
    const box = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    scene.add(box);
    const camera = new PerspectiveCamera();
    camera.position.set(0, 1, 5);
    const state = {
        eligible,
        uniformAnimating: false,
        onDraw: null,
        onUpdate: null,
    };
    const draws = [];

    function frame() {
        // the update work (PRE_UPDATE listeners) runs before the draw
        state.onUpdate?.(backend);
        let draw = gate.begin(state.eligible);
        scene.updateMatrixWorld();
        camera.updateMatrixWorld();
        if (!draw) draw = gate.confirm(scene, camera);
        renderer.info.render.drawCalls = 0;
        if (draw) {
            renderer.info.render.drawCalls = scene.children.filter(
                (child) => child.visible
            ).length;
            if (state.uniformAnimating) backend.updateBinding({});
            state.onDraw?.(backend);
        }
        gate.end();
        draws.push(draw);
        time += 1000 / 60;
        return draw;
    }

    function run(seconds) {
        let drawn = 0;
        for (let i = 0; i < seconds * 60; i++) if (frame()) drawn++;
        return drawn;
    }

    return { gate, demand, scene, box, camera, state, run, frame, draws };
}

let current;
afterEach(() => {
    current?.gate.dispose();
    current = null;
});
const make = (options) => (current = world(options));

/** A video element as three's VideoTexture holds it. */
function fakeVideo(playing) {
    return {
        tagName: "VIDEO",
        paused: !playing,
        ended: false,
        readyState: 4,
        videoWidth: 640,
    };
}

test("a still world stops drawing: the grace, then one probe a second", () => {
    const { run } = make();
    const drawn = run(10);
    // 500 ms of grace at 60 fps, then nine or ten probes
    expect(drawn).toBeGreaterThanOrEqual(35);
    expect(drawn).toBeLessThanOrEqual(45);
});

test("a playing video keeps every frame drawn; a paused one does not", () => {
    const { run } = make();
    const playing = new Texture(fakeVideo(true));
    playing.needsUpdate = true;
    expect(run(10)).toBe(600);

    playing.image.paused = true;
    expect(run(10)).toBeLessThan(45);
});

test("a playing <video> in the page keeps it drawing", () => {
    const { run } = make();
    const video = document.createElement("video");
    Object.defineProperty(video, "paused", { value: false });
    Object.defineProperty(video, "readyState", { value: 4 });
    document.body.appendChild(video);
    try {
        expect(run(5)).toBe(300);
    } finally {
        video.remove();
    }
});

test("an animation that changes uniforms in place keeps drawing", () => {
    const { run, state } = make();
    state.uniformAnimating = true;
    expect(run(10)).toBe(600);
    state.uniformAnimating = false;
    expect(run(10)).toBeLessThan(45);
});

test.each([
    ["the camera moves", ({ camera }) => camera.position.x++],
    [
        "the camera zooms",
        ({ camera }) => camera.updateProjectionMatrix((camera.fov = 30)),
    ],
    ["an object moves", ({ box }) => box.position.y++],
    ["an object is hidden", ({ box }) => (box.visible = false)],
    ["an object is added", ({ scene }) => scene.add(new Mesh())],
    [
        "a material is swapped",
        ({ box }) => (box.material = new MeshBasicMaterial()),
    ],
    [
        "a texture is marked for upload",
        () => (new Texture().needsUpdate = true),
    ],
    [
        "a buffer is marked for upload",
        () => (new BufferAttribute(new Float32Array(3), 3).needsUpdate = true),
    ],
    [
        "the visitor presses a key",
        () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" })),
    ],
    ["the pointer moves", () => window.dispatchEvent(new Event("pointermove"))],
    ["something asks for a frame", ({ gate }) => gate.invalidate()],
])("an idle world draws at once when %s", (_name, change) => {
    const w = make();
    w.run(3);
    expect(w.frame()).toBe(false);
    change(w);
    expect(w.frame()).toBe(true);
});

test("a new per-frame listener wakes it (an animation starting)", () => {
    const emitter = { _events: { pre_update: [() => {}], update: () => {} } };
    const w = make({ emitter });
    w.run(3);
    expect(w.frame()).toBe(false);
    emitter._events.pre_update = [...emitter._events.pre_update, () => {}];
    expect(w.frame()).toBe(true);
    // and quiets again once nothing else changes
    expect(w.run(3)).toBeLessThan(40);
});

test("a gsap tween in progress keeps it drawing", () => {
    const tweens = [];
    const gsap = { globalTimeline: { getChildren: () => tweens } };
    const w = make({ gsap });
    w.run(3);
    tweens.push({ isActive: () => true, paused: () => false });
    expect(w.run(2)).toBe(120);
    tweens.pop();
    expect(w.run(3)).toBeLessThan(40);
});

test("the editor, XR, recordings and transitions always draw", () => {
    const w = make({ eligible: false });
    expect(w.run(10)).toBe(600);
});

test("dispose gives three's setters and the backend back", () => {
    const before = Object.getOwnPropertyDescriptor(
        Texture.prototype,
        "needsUpdate"
    );
    const w = make();
    const metered = w.gate;
    expect(
        Object.getOwnPropertyDescriptor(Texture.prototype, "needsUpdate").set
    ).not.toBe(before.set);
    metered.dispose();
    expect(
        Object.getOwnPropertyDescriptor(Texture.prototype, "needsUpdate").set
    ).toBe(before.set);
    current = null;
});

test("a texture upload still bumps its version", () => {
    make();
    const texture = new Texture();
    const version = texture.version;
    texture.needsUpdate = true;
    expect(texture.version).toBe(version + 1);
});

describe("buffers re-uploaded every frame", () => {
    test("the same content is not a change: the world idles", () => {
        const w = make();
        const offsets = new BufferAttribute(new Float32Array(64), 4);
        // the artwork frames: marked and re-uploaded on every drawn frame
        w.state.onDraw = (backend) => {
            offsets.needsUpdate = true;
            backend.updateAttribute(offsets);
        };
        expect(w.run(10)).toBeLessThan(45);
    });

    test("new content is: the world keeps drawing while it moves", () => {
        const w = make();
        const offsets = new BufferAttribute(new Float32Array(64), 4);
        let step = 0;
        w.state.onDraw = (backend) => {
            offsets.array[0] = step++;
            offsets.needsUpdate = true;
            backend.updateAttribute(offsets);
        };
        expect(w.run(5)).toBe(300);
    });

    test("only the ranges three uploads are compared", () => {
        const w = make();
        const offsets = new BufferAttribute(new Float32Array(64), 4);
        let step = 0;
        w.state.onDraw = (backend) => {
            // a change outside the uploaded range never reaches the GPU
            offsets.array[63] = step++;
            offsets.clearUpdateRanges();
            offsets.addUpdateRange(0, 8);
            backend.updateAttribute(offsets);
        };
        expect(w.run(10)).toBeLessThan(45);
    });

    test("name tags re-marked every frame with the same content idle", () => {
        const w = make();
        const tags = new BufferAttribute(new Float32Array(16), 4);
        let marked = false;
        // marked by the update work, uploaded by the next drawn frame
        w.state.onUpdate = () => {
            tags.needsUpdate = true;
            marked = true;
        };
        w.state.onDraw = (backend) => {
            if (marked) backend.updateAttribute(tags);
            marked = false;
        };
        expect(w.run(10)).toBeLessThan(45);
        // and moving one wakes it on the frame it moves
        expect(w.frame()).toBe(false);
        w.state.onUpdate = () => {
            tags.array[1] += 1;
            tags.needsUpdate = true;
            marked = true;
        };
        expect(w.frame()).toBe(true);
        expect(w.run(2)).toBe(120);
    });

    test("a buffer marked between frames wakes an idle world", () => {
        const w = make();
        const offsets = new BufferAttribute(new Float32Array(4), 4);
        w.run(3);
        expect(w.frame()).toBe(false);
        offsets.needsUpdate = true;
        expect(w.frame()).toBe(true);
    });
});
