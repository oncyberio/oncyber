/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { createLobbyScene, type LobbySceneBackend } from "./createLobbyScene";

async function withScene(check: (scene: any) => void) {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const callbacks = new Map<number, FrameRequestCallback>();
    let id = 0;
    let time = 0;
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(
        (callback) => {
            callbacks.set(++id, callback);
            return id;
        }
    );
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation((frame) => {
        callbacks.delete(frame);
    });
    const oldResize = globalThis.ResizeObserver;
    const oldMatchMedia = window.matchMedia;
    globalThis.ResizeObserver = class {
        observe() {}
        disconnect() {}
    } as any;
    window.matchMedia = jest.fn(() => ({ matches: false })) as any;
    Object.defineProperty(document, "hidden", {
        configurable: true,
        value: false,
    });
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        createRadialGradient: () => ({ addColorStop: jest.fn() }),
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        fillText: jest.fn(),
        measureText: () => ({ width: 100 }),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        stroke: jest.fn(),
    } as any);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const motions: any[] = [];
    const onError = jest.fn();
    const advanceMovement = jest.fn(() => null);
    const renderScene = jest.fn();
    const renderer = {
        setPixelRatio: jest.fn(),
        setSize: jest.fn(),
        dispose: jest.fn(),
    };
    const Scene = createLobbyScene({
        three: THREE,
        createRenderer: () => renderer,
        createAvatar: async () => ({
            root: new THREE.Group(),
            height: 1.8,
            update: (_dt, _animation, motion) => motions.push({ ...motion }),
            dispose: jest.fn(),
        }),
        defaultAvatarUrl: "/avatar.vrm",
        createCrowd: () => ({ flush: jest.fn(), dispose: jest.fn() }),
        createFloorMaterial: () => {
            const material = new THREE.MeshBasicMaterial();
            material.userData.lobbyBrightness = { value: 1 };
            return material;
        },
        lightScale: 1,
        compile: jest.fn(),
        name: () => "test",
        render: renderScene,
    } as unknown as LobbySceneBackend);
    const frame = (count = 1) => {
        for (let n = 0; n < count; n++) {
            time += 1000 / 60;
            const pending = [...callbacks.values()];
            callbacks.clear();
            act(() => pending.forEach((callback) => callback(time)));
        }
    };
    const tap = () => {
        for (const type of ["keydown", "keyup"])
            window.dispatchEvent(
                new KeyboardEvent(type, {
                    code: "Space",
                    bubbles: true,
                    cancelable: true,
                })
            );
    };
    try {
        await act(async () =>
            root.render(
                <Scene
                    active
                    avatarUrl="/avatar.vrm"
                    participants={[]}
                    advanceMovement={advanceMovement}
                    onMove={jest.fn()}
                    onReady={jest.fn()}
                    onError={onError}
                />
            )
        );
        frame();
        await act(async () => {
            await Promise.resolve();
        });
        frame(4);
        expect(onError).not.toHaveBeenCalled();
        expect(motions.length).toBeGreaterThan(0);
        check({ container, frame, tap, advanceMovement, motions, renderScene });
    } finally {
        act(() => root.unmount());
        container.remove();
        globalThis.ResizeObserver = oldResize;
        window.matchMedia = oldMatchMedia;
        jest.restoreAllMocks();
    }
}

test("an unavailable network controller still plays both jumps and resets on landing", async () => {
    await withScene(({ tap, frame, advanceMovement, motions }) => {
        // Queue both down/up pairs before rendering: neither press may disappear.
        tap();
        tap();
        frame(8);
        expect(advanceMovement).toHaveBeenCalled();
        expect(motions.some((m) => !m.grounded && m.jumpCount === 1)).toBe(
            true
        );
        expect(motions.some((m) => !m.grounded && m.jumpCount === 2)).toBe(
            true
        );
        frame(90);
        expect(motions.at(-1)).toMatchObject({ grounded: true, jumpCount: 0 });
        tap();
        frame(4);
        expect(motions.at(-1)).toMatchObject({ grounded: false, jumpCount: 1 });
    });
});

test("canvas wheel scroll tilts the view both ways without scrolling the page or intercepting pinch zoom", async () => {
    await withScene(({ container, frame, renderScene }) => {
        const canvas = container.querySelector("canvas");
        const camera = () =>
            renderScene.mock.calls.at(-1)[2] as THREE.PerspectiveCamera;
        const wheel = (deltaY: number, options = {}) => {
            const event = new WheelEvent("wheel", {
                deltaY,
                bubbles: true,
                cancelable: true,
                ...options,
            });
            act(() => canvas.dispatchEvent(event));
            frame(30);
            return event;
        };
        frame(30);
        const initial = camera().quaternion.clone();
        expect(wheel(100).defaultPrevented).toBe(true);
        const down = camera().quaternion.clone();
        expect(initial.angleTo(down)).toBeGreaterThan(0.01);
        expect(wheel(-100).defaultPrevented).toBe(true);
        expect(initial.angleTo(camera().quaternion)).toBeLessThan(
            initial.angleTo(down)
        );
        const beforePinch = camera().quaternion.clone();
        expect(wheel(100, { ctrlKey: true }).defaultPrevented).toBe(false);
        expect(beforePinch.angleTo(camera().quaternion)).toBeLessThan(0.001);
        // Scrolling elsewhere (including menus) is still owned by that element.
        const elsewhere = new WheelEvent("wheel", {
            deltaY: 100,
            bubbles: true,
            cancelable: true,
        });
        container.dispatchEvent(elsewhere);
        expect(elsewhere.defaultPrevented).toBe(false);
    });
});
