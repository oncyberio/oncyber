/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { createLobbyScene, type LobbySceneBackend } from "./createLobbyScene";
import type { LobbySceneProps } from "./sceneTypes";

// The real scene on a stub backend: only the renderer and the avatar loader
// are faked, so these pin what the scene itself reports when one of them fails.
const DEFAULT_AVATAR = "/avatars/default.vrm";
const SAVED_AVATAR = "/avatars/saved.vrm";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let frames: FrameRequestCallback[];
let broken: Set<string>;
let createAvatar: jest.Mock;
let callbacks: {
    onError: jest.Mock;
    onReady: jest.Mock;
    onAvatarStatus: jest.Mock;
    onMove: jest.Mock;
};

function backend(overrides: Partial<LobbySceneBackend> = {}) {
    const floor = () => {
        const material = new THREE.MeshBasicMaterial();
        material.userData.lobbyBrightness = { value: 1 };
        return material;
    };
    return {
        three: THREE,
        createAvatar,
        defaultAvatarUrl: DEFAULT_AVATAR,
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
        render: jest.fn(),
        compile: () => undefined,
        stats: () => ({ draws: 0, triangles: 0 }),
        ...overrides,
    } as unknown as LobbySceneBackend;
}

async function mount(
    sceneBackend: LobbySceneBackend,
    props: Partial<LobbySceneProps> = {}
) {
    const Scene = createLobbyScene(sceneBackend);
    const render = (next: Partial<LobbySceneProps> = {}) =>
        act(async () =>
            root.render(
                <Scene
                    active
                    participants={[]}
                    avatarUrl={SAVED_AVATAR}
                    initialPosition={{ x: 0, z: 0 }}
                    {...callbacks}
                    {...props}
                    {...next}
                />
            )
        );
    await render();
    return render;
}
let frameTime = performance.now();
/** Runs the frames the scene has asked for, then lets avatar loads settle. */
async function frame(count = 1) {
    for (let index = 0; index < count; index++)
        await act(async () => {
            const pending = frames;
            frames = [];
            // A display refresh apart, so the 60 fps cap draws each one.
            frameTime += 20;
            pending.forEach((callback) => callback(frameTime));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
}
const statuses = () =>
    callbacks.onAvatarStatus.mock.calls.map(([state]) => state);
const loads = () => createAvatar.mock.calls.map(([url]) => url);

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
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    jest.spyOn(console, "error").mockImplementation(() => {});
    frames = [];
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) =>
        frames.push(callback)
    );
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
        frames = [];
    });
    broken = new Set();
    createAvatar = jest.fn(async (url: string) => {
        if (broken.has(url)) throw new Error(`404 ${url}`);
        return {
            root: new THREE.Group(),
            height: 1.8,
            update: jest.fn(),
            dispose: jest.fn(),
        };
    });
    callbacks = {
        onError: jest.fn(),
        onReady: jest.fn(),
        onAvatarStatus: jest.fn(),
        onMove: jest.fn(),
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

test("a renderer that cannot start is a renderer failure", async () => {
    await mount(
        backend({
            createRenderer: () => Promise.reject(new Error("no adapter")),
        })
    );
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(
        expect.stringContaining("could not open the 3D lobby"),
        "renderer"
    );
    expect(createAvatar).not.toHaveBeenCalled();
});

test("a lost graphics context is a renderer failure", async () => {
    await mount(backend());
    await frame(2);
    expect(callbacks.onReady).toHaveBeenCalledTimes(1);
    act(() => {
        container
            .querySelector("canvas")
            .dispatchEvent(new Event("webglcontextlost"));
    });
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(
        expect.stringContaining("lost its graphics connection"),
        "renderer"
    );
});

test("the visitor's own avatar failing shows the default avatar and reports no scene error", async () => {
    broken.add(SAVED_AVATAR);
    await mount(backend());
    await frame(4);
    expect(loads()).toEqual([SAVED_AVATAR, DEFAULT_AVATAR]);
    expect(statuses()).toEqual([
        { url: SAVED_AVATAR, status: "loading" },
        { url: SAVED_AVATAR, status: "error", fallbackUrl: DEFAULT_AVATAR },
        { url: DEFAULT_AVATAR, status: "loading" },
        { url: DEFAULT_AVATAR, status: "ready" },
    ]);
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(callbacks.onReady).toHaveBeenCalledTimes(1);
    // Still asked for the failed avatar: no retry storm, the default stays.
    await frame(6);
    expect(createAvatar).toHaveBeenCalledTimes(2);
});

test("when the default avatar fails too it is an asset failure, never a renderer one", async () => {
    broken.add(SAVED_AVATAR).add(DEFAULT_AVATAR);
    await mount(backend());
    await frame(6);
    expect(loads()).toEqual([SAVED_AVATAR, DEFAULT_AVATAR]);
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(
        expect.stringContaining("avatar couldn’t load"),
        "asset"
    );
    expect(callbacks.onReady).not.toHaveBeenCalled();
});

test("a failed change of avatar keeps the one on screen, and choosing the failed avatar again retries it", async () => {
    const render = await mount(backend(), { avatarUrl: DEFAULT_AVATAR });
    await frame(2);
    expect(callbacks.onReady).toHaveBeenCalledTimes(1);
    broken.add(SAVED_AVATAR);
    await render({ avatarUrl: SAVED_AVATAR });
    await frame(3);
    expect(statuses().at(-1)).toEqual({ url: SAVED_AVATAR, status: "error" });
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(loads()).toEqual([DEFAULT_AVATAR, SAVED_AVATAR]);
    // The parent follows the fallback, then the visitor picks the avatar again.
    await render({ avatarUrl: DEFAULT_AVATAR });
    await frame(2);
    broken.clear();
    await render({ avatarUrl: SAVED_AVATAR });
    await frame(3);
    expect(statuses().at(-1)).toEqual({ url: SAVED_AVATAR, status: "ready" });
    expect(callbacks.onError).not.toHaveBeenCalled();
});
