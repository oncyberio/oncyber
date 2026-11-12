/** @jest-environment jsdom */
import * as THREE from "three/webgpu";
import { createWebGPUBackend } from "./backend";
import { createLobbyFloorDissolve } from "../lobbyFloorDissolve";

const mockRenderers: any[] = [];
let mockInit: (renderer: any) => Promise<void>;
jest.mock("three/webgpu", () => ({
    ...jest.requireActual("three/webgpu"),
    WebGPURenderer: jest.fn().mockImplementation(() => {
        const device = new EventTarget() as EventTarget & {
            destroy: jest.Mock;
        };
        const nativeDispose = jest.fn();
        const renderer: any = {
            backend: { isWebGPUBackend: true, device },
            info: {},
            dispose: nativeDispose,
            nativeDispose,
            init: jest.fn(() => mockInit(renderer)),
        };
        device.destroy = jest.fn(() =>
            Promise.resolve().then(() => renderer.onDeviceLost())
        );
        jest.spyOn(device, "addEventListener");
        jest.spyOn(device, "removeEventListener");
        mockRenderers.push(renderer);
        return renderer;
    }),
}));
jest.mock("./avatarAdapter", () => ({
    createAvatar: jest.fn(),
    DEFAULT_LOBBY_AVATAR_URL: "/avatar.glb",
}));
jest.mock("./avatarCrowd", () => ({ LobbyAvatarCrowd: jest.fn() }));

function gpuError(device: EventTarget) {
    const event = new Event("uncapturederror");
    Object.defineProperty(event, "error", {
        value: { message: "invalid pipeline" },
    });
    device.dispatchEvent(event);
}

beforeEach(() => {
    mockRenderers.length = 0;
    mockInit = async () => undefined;
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test("disposal removes error handlers and destroys only the owned device exactly once", async () => {
    const canvas = document.createElement("canvas");
    const loss = jest.fn();
    canvas.addEventListener("lobbycontextlost", loss);
    const pending = createWebGPUBackend().createRenderer(canvas);
    const renderer = await pending;
    const device = mockRenderers[0].backend.device;
    const staleDeviceLost = (renderer as any).onDeviceLost;
    const staleValidation = device.addEventListener.mock.calls[0][1];
    renderer.dispose();
    renderer.dispose();
    await Promise.resolve();
    staleDeviceLost();
    staleValidation({ error: { message: "late error" } });
    gpuError(device);
    expect(device.removeEventListener).toHaveBeenCalledWith(
        "uncapturederror",
        staleValidation
    );
    expect(device.destroy).toHaveBeenCalledTimes(1);
    expect(mockRenderers[0].nativeDispose).toHaveBeenCalledTimes(1);
    // The constructor's original disposer was replaced before returning its promise.
    expect((THREE.WebGPURenderer as jest.Mock).mock.results.at(-1).value).toBe(
        renderer
    );
    expect(loss).not.toHaveBeenCalled();
});

test("validation and device loss report once before disposal", async () => {
    const canvas = document.createElement("canvas");
    const loss = jest.fn();
    canvas.addEventListener("lobbycontextlost", loss);
    const renderer = await createWebGPUBackend().createRenderer(canvas);
    const device = mockRenderers[0].backend.device;
    gpuError(device);
    gpuError(device);
    (renderer as any).onDeviceLost();
    expect(loss).toHaveBeenCalledTimes(1);
    renderer.dispose();
    await Promise.resolve();
    expect(loss).toHaveBeenCalledTimes(1);
});

test("failed initialization releases a partially created device", async () => {
    mockInit = async () => {
        throw new Error("context configuration failed");
    };
    await expect(
        createWebGPUBackend().createRenderer(document.createElement("canvas"))
    ).rejects.toThrow("context configuration failed");
    expect(mockRenderers[0].backend.device.destroy).toHaveBeenCalledTimes(1);
});

test("initialization that switches to WebGL still releases the abandoned owned GPU device", async () => {
    let abandoned: any;
    mockInit = async (renderer) => {
        abandoned = renderer.backend.device;
        renderer.backend = { isWebGLBackend: true };
    };
    const renderer = await createWebGPUBackend().createRenderer(
        document.createElement("canvas")
    );
    renderer.dispose();
    expect(abandoned.destroy).toHaveBeenCalledTimes(1);
});

test("a normal WebGL backend needs no GPU device and cleans up normally", async () => {
    mockInit = async (renderer) => {
        // Model a forceWebGL renderer: no GPU device was allocated.
        delete renderer.backend.device;
        delete renderer.backend.isWebGPUBackend;
        renderer.backend.isWebGLBackend = true;
    };
    const renderer = await createWebGPUBackend(true).createRenderer(
        document.createElement("canvas")
    );
    expect(() => renderer.dispose()).not.toThrow();
});

test("device loss during initialization rejects entry instead of losing the event before scene mounting", async () => {
    mockInit = async (renderer) => renderer.onDeviceLost();
    await expect(
        createWebGPUBackend().createRenderer(document.createElement("canvas"))
    ).rejects.toThrow("lost during initialization");
    expect(mockRenderers[0].backend.device.destroy).toHaveBeenCalledTimes(1);
});

test("modern floor shades the same real tile surface and glow attributes with opaque depth testing", () => {
    const floor = createWebGPUBackend().createFloorMaterial(
        undefined,
        true
    ) as unknown as THREE.MeshBasicNodeMaterial;
    const attributes = new Set<string>();
    floor.colorNode.traverse((node: any) => {
        if (node._attributeName) attributes.add(node._attributeName);
    });
    expect(attributes).toEqual(new Set(["lobbyFloorSurface", "lobbyTileGlow"]));
    const brightness = floor.userData.lobbyBrightness;
    expect(brightness.value).toBe(1);
    let usesBrightness = false;
    floor.colorNode.traverse((node: any) => {
        if (node === brightness) usesBrightness = true;
    });
    expect(usesBrightness).toBe(true);
    brightness.value = 0;
    expect(floor.userData.lobbyBrightness.value).toBe(0);
    expect(floor.depthTest).toBe(true);
    expect(floor.depthWrite).toBe(true);
    expect(floor.transparent).toBe(false);
    expect(floor.side).toBe(THREE.FrontSide);
    floor.dispose();
});

test("modern floor reverse faces share dynamic buffers and use an owned neutral texture", () => {
    const front = createWebGPUBackend().createFloorMaterial(undefined, true);
    const effect = createLobbyFloorDissolve(THREE, front);
    effect.setProgress(0.5, { x: 0, z: 0 }, "reveal");
    const back = effect.mesh.getObjectByName("lobby-tile-backs") as THREE.Mesh;
    const material = back.material as THREE.MeshBasicMaterial;
    expect(back.geometry).toBe(effect.mesh.geometry);
    expect(material.side).toBe(THREE.BackSide);
    expect(material.map).toBeInstanceOf(THREE.DataTexture);
    expect(material.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(back.geometry.getAttribute("uv").count).toBe(
        back.geometry.getAttribute("position").count
    );
    const disposeMap = jest.spyOn(material.map, "dispose");
    effect.dispose();
    effect.dispose();
    expect(disposeMap).toHaveBeenCalledTimes(1);
    front.dispose();
});
