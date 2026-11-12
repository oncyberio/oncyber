/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import LobbyRenderer, { preloadLobbyRendererAvatar } from "./LobbyRenderer";

let mockSceneProps: any;
const mockPreload = jest.fn();
jest.mock("./webgpu/avatarAdapter", () => ({
    preloadLobbyAvatar: (...args) => mockPreload(...args),
}));
jest.mock("./createLobbyScene", () => ({
    createLobbyScene: (backend) => (props) => {
        mockSceneProps = props;
        return <div data-testid={`${backend.mode}-scene`} />;
    },
}));
jest.mock("./webgpu/backend", () => ({
    createWebGPUBackend: (forceWebGL) => ({
        mode: forceWebGL ? "webgl2" : "webgpu",
    }),
}));
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const props = () => ({
    active: true,
    participants: [],
    onMove: jest.fn(),
    onReady: jest.fn(),
    onError: jest.fn(),
});
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
});

test("auto starts on WebGPU and recovers on the WebGL2 backend", async () => {
    const callbacks = props();
    await act(async () => root.render(<LobbyRenderer {...callbacks} />));
    expect(
        container.querySelector('[data-testid="webgpu-scene"]')
    ).not.toBeNull();
    await act(async () => mockSceneProps.onError("device lost", "renderer"));
    expect(
        container.querySelector('[data-testid="webgl2-scene"]')
    ).not.toBeNull();
    expect(callbacks.onError).not.toHaveBeenCalled();
    // One fallback only: a failure on WebGL2 is reported, as before.
    act(() => mockSceneProps.onError("fallback failed", "renderer"));
    expect(callbacks.onError).toHaveBeenCalledWith(
        "fallback failed",
        "renderer"
    );
    expect(
        container.querySelector('[data-testid="webgl2-scene"]')
    ).not.toBeNull();
});

test("a failed file such as an avatar is reported and never switches renderer", async () => {
    const callbacks = props();
    await act(async () => root.render(<LobbyRenderer {...callbacks} />));
    const scene = container.querySelector('[data-testid="webgpu-scene"]');
    await act(async () =>
        mockSceneProps.onError("Your avatar couldn’t load.", "asset")
    );
    expect(container.querySelector('[data-testid="webgpu-scene"]')).toBe(scene);
    expect(container.querySelector('[data-testid="webgl2-scene"]')).toBeNull();
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onError).toHaveBeenCalledWith(
        "Your avatar couldn’t load.",
        "asset"
    );
    // The renderer fallback is still available afterwards.
    await act(async () => mockSceneProps.onError("device lost", "renderer"));
    expect(
        container.querySelector('[data-testid="webgl2-scene"]')
    ).not.toBeNull();
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
});

test("an error with no kind is reported, not treated as a renderer failure", async () => {
    const callbacks = props();
    await act(async () => root.render(<LobbyRenderer {...callbacks} />));
    await act(async () => mockSceneProps.onError("unclassified"));
    expect(container.querySelector('[data-testid="webgl2-scene"]')).toBeNull();
    expect(callbacks.onError).toHaveBeenCalledWith("unclassified", undefined);
});

test("explicit backend comparisons report errors rather than silently switching renderers", async () => {
    const callbacks = props();
    await act(async () =>
        root.render(<LobbyRenderer {...callbacks} renderer="webgpu" />)
    );
    act(() => mockSceneProps.onError("shader failed", "renderer"));
    expect(callbacks.onError).toHaveBeenCalledWith("shader failed", "renderer");
    expect(
        container.querySelector('[data-testid="webgpu-scene"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="webgl2-scene"]')).toBeNull();
});

test("prewarming resolves the saved avatar outside the GPU graph and loads only its URL", async () => {
    await preloadLobbyRendererAvatar({ vrmUrl: "/avatars/custom.glb" });
    expect(mockPreload).toHaveBeenCalledWith("/avatars/custom.glb");
    expect(container.querySelector("canvas")).toBeNull();
});
