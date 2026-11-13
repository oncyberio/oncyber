/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { createLobbyScene, type LobbySceneBackend } from "./createLobbyScene";
import type { LobbySceneProps } from "./sceneTypes";

// The real scene on a stub backend, to see what it would draw during travel.
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let frames: FrameRequestCallback[];
let rendered: THREE.Scene | undefined;
let getContext: jest.SpyInstance;
let now: number;

function backend() {
    const floor = () => {
        const material = new THREE.MeshBasicMaterial();
        material.userData.lobbyBrightness = { value: 1 };
        return material;
    };
    return {
        three: THREE,
        createAvatar: async () => ({
            root: new THREE.Group(),
            height: 1.8,
            update() {},
            dispose() {},
        }),
        defaultAvatarUrl: "/avatars/default.vrm",
        createRenderer: () => ({
            setPixelRatio() {},
            setSize() {},
            dispose() {},
        }),
        createCrowd: () => ({
            create: jest.fn(),
            flush() {},
            dispose() {},
            stats: {},
        }),
        createFloorMaterial: floor,
        lightScale: 1,
        name: () => "stub",
        render: (_renderer: unknown, scene: THREE.Scene) => {
            rendered = scene;
        },
        compile: () => undefined,
        stats: () => ({ draws: 0, triangles: 0 }),
    } as unknown as LobbySceneBackend;
}
async function frame(count = 1) {
    for (let index = 0; index < count; index++)
        await act(async () => {
            const pending = frames;
            frames = [];
            // A refresh advances the browser clock, even when the test runs
            // much faster than a real display (or rendering caps the rate).
            now += 1000 / 60;
            pending.forEach((callback) => callback(now));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (window as any).ResizeObserver = class {
        observe() {}
        disconnect() {}
    };
    window.matchMedia = (() => ({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
    })) as any;
    getContext = jest
        .spyOn(HTMLCanvasElement.prototype, "getContext")
        .mockReturnValue(null);
    frames = [];
    rendered = undefined;
    now = 10000;
    jest.spyOn(performance, "now").mockImplementation(() => now);
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
        frames.push(callback)
    );
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
        frames = [];
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

test("travel draws the halo and its loading band, and no words", async () => {
    const Scene = createLobbyScene(backend());
    const onTravelStatusVisible = jest.fn();
    const onError = jest.fn();
    const props: LobbySceneProps = {
        active: true,
        participants: [],
        avatarUrl: "/avatars/default.vrm",
        initialPosition: { x: 0, z: 0 },
        onMove() {},
        onReady() {},
        onError,
        onTravelStatusVisible,
    };
    await act(async () => root.render(<Scene {...props} />));
    await frame(2);
    const canvasesBefore = getContext.mock.calls.length;
    const fonts = jest.fn();
    (window as any).FontFace = fonts;
    await act(async () =>
        root.render(
            <Scene
                {...props}
                travel={{
                    phase: "charge",
                    startedAt: performance.now() - 6000,
                    partyIds: [],
                    reducedMotion: true,
                    // Words from an earlier caller are accepted and ignored.
                    status: { title: "First space", detail: "Opening…" },
                    label: {
                        progress: 0.4,
                        title: "First space",
                        status: "Opening your world",
                    },
                }}
            />
        )
    );
    await frame(3);
    expect(onError).not.toHaveBeenCalled();
    const halo = rendered.getObjectByName("lobby-travel-halo");
    expect(halo.visible).toBe(true);
    const names: string[] = [];
    halo.traverse((object) => names.push(object.name));
    expect(names).toEqual([
        "lobby-travel-halo",
        "lobby-travel-glow",
        "lobby-travel-halo-text",
        "lobby-travel-halo-progress",
    ]);
    // The band is lit to the reported progress; nothing was typeset for it.
    const band = halo.getObjectByName(
        "lobby-travel-halo-progress"
    ) as THREE.Mesh;
    expect(band.parent.visible).toBe(true);
    expect((band.material as THREE.MeshBasicMaterial).map).toBeNull();
    expect(band.geometry.getAttribute("color").array[3]).toBe(1);
    expect(getContext.mock.calls.length).toBe(canvasesBefore);
    expect(fonts).not.toHaveBeenCalled();
    expect(onTravelStatusVisible).not.toHaveBeenCalled();
    delete (window as any).FontFace;
});
