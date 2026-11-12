/** @jest-environment jsdom */
import * as THREE from "three";
import { createFlashPresentation, loadFlashTexture } from "./flashPresentation";
import { createFlashFrame } from "./flashFrame";

jest.mock("./flashFrame", () => ({
    flashFrameLayout: jest.requireActual("./flashFrame").flashFrameLayout,
    createFlashFrame: jest.fn((three) => ({
        group: new three.Group(),
        setArtwork: jest.fn(),
        setPresentation: jest.fn(),
        dispose: jest.fn(),
    })),
}));
const deferred = <T>() => {
    let resolve: (value: T) => void, reject: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve: resolve!, reject: reject! };
};
const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
const art = (nonce = "flash-one") => ({
    id: "chain:contract:1",
    title: "A real selection",
    imageUrl: "/api/proxyv2?url=https%3A%2F%2Fexample.com%2Fart.png",
    nonce,
    startedAt: 1000,
});
const avatar = () => ({
    root: new THREE.Group(),
    height: 1.8,
    prepareFlash: jest.fn(async () => {}),
    playFlash: jest.fn(async () => {}),
    stopFlash: jest.fn(),
});
beforeEach(() => jest.clearAllMocks());

test("waits for both the image and pointing gesture before revealing and publishing", async () => {
    const media = deferred<any>(),
        motion = deferred<void>();
    const rig = avatar();
    rig.prepareFlash.mockReturnValue(motion.promise);
    const onReady = jest.fn();
    const texture = new THREE.Texture();
    const presenter = createFlashPresentation(THREE, {
        loadTexture: jest.fn(() => media.promise),
        onReady,
    });
    const actor = {
        id: "self",
        avatar: rig as any,
        parent: new THREE.Group(),
        flash: art(),
        local: true,
    };
    presenter.beginFrame();
    presenter.sync(actor);
    media.resolve({ texture, aspect: 1.6 });
    await flush();
    expect(onReady).not.toHaveBeenCalled();
    expect(rig.playFlash).not.toHaveBeenCalled();
    motion.resolve();
    await flush();
    expect(rig.playFlash).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(actor.flash);
    presenter.finishFrame(0.25);
    const frame = (createFlashFrame as jest.Mock).mock.results[0].value;
    expect(frame.setArtwork).toHaveBeenCalledWith(texture, 1.6);
    // The frame waits for the hands to rise, then pops in.
    expect(frame.setPresentation).toHaveBeenLastCalledWith(0);
    presenter.finishFrame(0.25);
    presenter.finishFrame(1);
    expect(frame.setPresentation).toHaveBeenLastCalledWith(1);
    presenter.beginFrame();
    presenter.sync(actor);
    expect(rig.prepareFlash).toHaveBeenCalledTimes(1);
    presenter.dispose();
});

test("replacement disposes late textures without replaying or publishing the old selection", async () => {
    const old = deferred<any>(),
        next = deferred<any>();
    const onReady = jest.fn();
    const loadTexture = jest
        .fn()
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(next.promise);
    const presenter = createFlashPresentation(THREE, { loadTexture, onReady });
    const rig = avatar(),
        parent = new THREE.Group();
    presenter.beginFrame();
    presenter.sync({
        id: "self",
        avatar: rig as any,
        parent,
        flash: art(),
        local: true,
    });
    presenter.sync({
        id: "self",
        avatar: rig as any,
        parent,
        flash: art("flash-two"),
        local: true,
    });
    const texture = new THREE.Texture();
    const dispose = jest.spyOn(texture, "dispose");
    old.resolve({ texture, aspect: 1 });
    await flush();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(rig.playFlash).not.toHaveBeenCalled();
    expect(loadTexture.mock.calls[0][2].aborted).toBe(true);
    next.resolve({ texture: new THREE.Texture(), aspect: 1 });
    await flush();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady.mock.calls[0][0].nonce).toBe("flash-two");
    expect(parent.children).toHaveLength(1);
    presenter.dispose();
});

test("a preparation failure releases its image and lets the local UI report the failure", async () => {
    const motion = deferred<void>();
    const texture = new THREE.Texture();
    const dispose = jest.spyOn(texture, "dispose");
    const rig = avatar();
    rig.prepareFlash.mockReturnValue(motion.promise);
    const onError = jest.fn(),
        onReady = jest.fn();
    const presenter = createFlashPresentation(THREE, {
        loadTexture: jest.fn(async () => ({ texture, aspect: 1 })),
        onReady,
        onError,
    });
    presenter.beginFrame();
    presenter.sync({
        id: "self",
        avatar: rig as any,
        parent: new THREE.Group(),
        flash: art(),
        local: true,
    });
    await flush();
    motion.reject(new Error("Pointing could not load"));
    await flush();
    presenter.finishFrame(0.25);
    expect(onError).toHaveBeenCalledWith(art(), "Pointing could not load");
    expect(onReady).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(presenter.count).toBe(0);
    presenter.dispose();
});

test("dismissed actors stop immediately and release the frame after its brief exit", async () => {
    const texture = new THREE.Texture();
    const dispose = jest.spyOn(texture, "dispose");
    const rig = avatar(),
        parent = new THREE.Group();
    const presenter = createFlashPresentation(THREE, {
        loadTexture: jest.fn(async () => ({ texture, aspect: 1 })),
    });
    presenter.beginFrame();
    presenter.sync({ id: "peer", avatar: rig as any, parent, flash: art() });
    await flush();
    presenter.finishFrame(0.3);
    presenter.finishFrame(0.25);
    presenter.beginFrame();
    presenter.finishFrame(0.05);
    expect(rig.stopFlash).toHaveBeenCalled();
    expect(parent.children).toHaveLength(1);
    presenter.finishFrame(0.5);
    expect(parent.children).toHaveLength(0);
    expect(dispose).toHaveBeenCalledTimes(1);
    presenter.dispose();
});

test("reduced motion samples the held pose and appears without scale animation", async () => {
    const rig = avatar();
    const presenter = createFlashPresentation(THREE, {
        loadTexture: jest.fn(async () => ({
            texture: new THREE.Texture(),
            aspect: 1,
        })),
    });
    presenter.beginFrame();
    presenter.sync({
        id: "self",
        avatar: rig as any,
        parent: new THREE.Group(),
        flash: art(),
        reducedMotion: true,
    });
    await flush();
    presenter.finishFrame(0, true);
    expect(rig.playFlash).toHaveBeenCalledWith({ reducedMotion: true });
    expect(
        (createFlashFrame as jest.Mock).mock.results[0].value.setPresentation
    ).toHaveBeenLastCalledWith(1);
    presenter.dispose();
});

test("disposal invalidates an unfinished load and owns all frames", async () => {
    const media = deferred<any>();
    const onReady = jest.fn(),
        onError = jest.fn();
    const presenter = createFlashPresentation(THREE, {
        loadTexture: jest.fn(() => media.promise),
        onReady,
        onError,
    });
    const parent = new THREE.Group();
    presenter.beginFrame();
    presenter.sync({
        id: "self",
        avatar: avatar() as any,
        parent,
        flash: art(),
        local: true,
    });
    presenter.dispose();
    const texture = new THREE.Texture();
    const dispose = jest.spyOn(texture, "dispose");
    media.resolve({ texture, aspect: 1 });
    await flush();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(parent.children).toHaveLength(0);
    expect(onReady).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
});

test.each(["image", "preparation"])(
    "a failed remote %s does not retry on subsequent frames",
    async (failure) => {
        const rig = avatar();
        const texture = new THREE.Texture();
        const dispose = jest.spyOn(texture, "dispose");
        const loadTexture = jest.fn(async () => {
            if (failure === "image") throw new Error("Broken poster");
            return { texture, aspect: 1 };
        });
        if (failure === "preparation")
            rig.prepareFlash.mockRejectedValue(new Error("Broken gesture"));
        const presenter = createFlashPresentation(THREE, { loadTexture });
        const actor = {
            id: "peer",
            avatar: rig as any,
            parent: new THREE.Group(),
            flash: art(),
        };
        presenter.beginFrame();
        presenter.sync(actor);
        await flush();
        // Cover both sync-before-cleanup and frames after failed resources leave.
        for (let i = 0; i < 5; i++) {
            presenter.beginFrame();
            presenter.sync(actor);
            presenter.finishFrame(0.25);
            await flush();
        }
        expect(loadTexture).toHaveBeenCalledTimes(1);
        expect(rig.prepareFlash).toHaveBeenCalledTimes(1);
        expect(createFlashFrame).toHaveBeenCalledTimes(1);
        expect(actor.parent.children).toHaveLength(0);
        expect(presenter.count).toBe(0);
        expect(dispose).toHaveBeenCalledTimes(
            failure === "preparation" ? 1 : 0
        );
        presenter.dispose();
    }
);

test.each(["nonce", "avatar", "absence", "clear"])(
    "a failed selection may retry after %s changes",
    async (change) => {
        const texture = new THREE.Texture();
        const loadTexture = jest
            .fn()
            .mockRejectedValueOnce(new Error("Unavailable"))
            .mockResolvedValue({ texture, aspect: 1 });
        const presenter = createFlashPresentation(THREE, { loadTexture });
        const actor = {
            id: "peer",
            avatar: avatar() as any,
            parent: new THREE.Group(),
            flash: art(),
        };
        presenter.beginFrame();
        presenter.sync(actor);
        await flush();
        presenter.finishFrame(0.25);
        if (change === "nonce") actor.flash = art("another-selection");
        if (change === "avatar") actor.avatar = avatar();
        if (change === "absence") {
            presenter.beginFrame();
            presenter.finishFrame(0.25);
        }
        if (change === "clear") presenter.clear();
        presenter.beginFrame();
        presenter.sync(actor);
        await flush();
        presenter.finishFrame(0.25);
        expect(loadTexture).toHaveBeenCalledTimes(2);
        expect(actor.avatar.playFlash).toHaveBeenCalledTimes(1);
        expect(actor.parent.children).toHaveLength(1);
        presenter.dispose();
    }
);

describe("image loading boundary", () => {
    class TestImage {
        crossOrigin = "";
        naturalWidth = 2400;
        naturalHeight = 1200;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        requests: { url: string; crossOrigin: string }[] = [];
        removeAttribute = jest.fn();
        set src(url: string) {
            this.requests.push({ url, crossOrigin: this.crossOrigin });
        }
    }
    let image: TestImage;
    let drawImage: jest.Mock;
    let context: jest.SpyInstance;
    beforeEach(() => {
        jest.useFakeTimers();
        image = new TestImage();
        jest.spyOn(window, "Image").mockImplementation(() => image as any);
        drawImage = jest.fn();
        context = jest
            .spyOn(HTMLCanvasElement.prototype, "getContext")
            .mockReturnValue({ drawImage } as any);
    });
    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    test.each([
        [2400, 1200, 1024, 512],
        [1200, 2400, 512, 1024],
        [320, 160, 320, 160],
    ])(
        "sizes %sx%s without stretching or upscaling",
        async (width, height, outWidth, outHeight) => {
            image.naturalWidth = width;
            image.naturalHeight = height;
            const controller = new AbortController();
            const removeListener = jest.spyOn(
                controller.signal,
                "removeEventListener"
            );
            const loading = loadFlashTexture(
                THREE,
                art().imageUrl,
                controller.signal
            );
            expect(image.requests).toEqual([
                { url: art().imageUrl, crossOrigin: "anonymous" },
            ]);
            image.onload!();
            const result = await loading;
            expect(result.texture.image.width).toBe(outWidth);
            expect(result.texture.image.height).toBe(outHeight);
            expect(result.aspect).toBe(width / height);
            expect(drawImage).toHaveBeenCalledWith(
                image,
                0,
                0,
                outWidth,
                outHeight
            );
            expect(result.texture.colorSpace).toBe(THREE.SRGBColorSpace);
            expect(image.removeAttribute).toHaveBeenCalledWith("src");
            expect(image.onload).toBeNull();
            expect(image.onerror).toBeNull();
            expect(removeListener).toHaveBeenCalledWith(
                "abort",
                expect.any(Function)
            );
            expect(jest.getTimerCount()).toBe(0);
            const dispose = jest.spyOn(result.texture, "dispose");
            controller.abort();
            expect(dispose).not.toHaveBeenCalled(); // Ownership has passed to presenter.
            result.texture.dispose();
        }
    );

    test("times out and detaches a stalled image after 15 seconds", async () => {
        const loading = loadFlashTexture(
            THREE,
            art().imageUrl,
            new AbortController().signal
        );
        const failure = expect(loading).rejects.toThrow("took too long");
        jest.advanceTimersByTime(15000);
        await failure;
        expect(image.removeAttribute).toHaveBeenCalledWith("src");
        expect(image.onload).toBeNull();
        expect(image.onerror).toBeNull();
        expect(drawImage).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
    });

    test.each(["before", "during"])(
        "aborts %s requesting the image",
        async (when) => {
            const controller = new AbortController();
            if (when === "before") controller.abort();
            const loading = loadFlashTexture(
                THREE,
                art().imageUrl,
                controller.signal
            );
            const failure = expect(loading).rejects.toThrow("Flash cancelled");
            if (when === "during") controller.abort();
            await failure;
            expect(image.requests).toHaveLength(when === "before" ? 0 : 1);
            expect(image.removeAttribute).toHaveBeenCalledWith("src");
            expect(image.onload).toBeNull();
            expect(image.onerror).toBeNull();
            expect(drawImage).not.toHaveBeenCalled();
            expect(jest.getTimerCount()).toBe(0);
        }
    );

    test.each(["network", "empty", "canvas", "draw"])(
        "cleans up a %s failure",
        async (cause) => {
            if (cause === "empty") image.naturalWidth = 0;
            if (cause === "canvas") context.mockReturnValue(null);
            if (cause === "draw")
                drawImage.mockImplementation(() => {
                    throw new Error("Decode failed");
                });
            const loading = loadFlashTexture(
                THREE,
                art().imageUrl,
                new AbortController().signal
            );
            const failure = expect(loading).rejects.toThrow();
            if (cause === "network") image.onerror!();
            else image.onload!();
            await failure;
            expect(image.removeAttribute).toHaveBeenCalledWith("src");
            expect(image.onload).toBeNull();
            expect(image.onerror).toBeNull();
            expect(jest.getTimerCount()).toBe(0);
        }
    );
});

test("a Flash shows for five seconds, then lowers its arms gracefully and never replays", async () => {
    const rig = { ...avatar(), endFlash: jest.fn() };
    const parent = new THREE.Group();
    const onTimeout = jest.fn();
    const presenter = createFlashPresentation(THREE, {
        loadTexture: jest.fn(async () => ({
            texture: new THREE.Texture(),
            aspect: 1,
        })),
        onTimeout,
    });
    const actor = {
        id: "self",
        avatar: rig as any,
        parent,
        flash: art(),
        local: true,
    };
    presenter.beginFrame();
    presenter.sync(actor);
    await flush();
    for (let t = 0; t < 4.9; t += 0.05) {
        presenter.beginFrame();
        presenter.sync(actor);
        presenter.finishFrame(0.05);
    }
    expect(onTimeout).not.toHaveBeenCalled();
    presenter.beginFrame();
    presenter.sync(actor);
    presenter.finishFrame(0.2);
    expect(onTimeout).toHaveBeenCalledWith(actor.flash);
    expect(rig.endFlash).toHaveBeenCalledTimes(1);
    // The same selection keeps arriving until the clear lands; it must not restart.
    for (let i = 0; i < 20; i++) {
        presenter.beginFrame();
        presenter.sync(actor);
        presenter.finishFrame(0.05);
    }
    expect(rig.playFlash).toHaveBeenCalledTimes(1);
    expect(rig.stopFlash).not.toHaveBeenCalled();
    expect(parent.children).toHaveLength(0);
    expect(presenter.has("self")).toBe(false);
    presenter.dispose();
});

test("focus reports the settled Flash nearest the middle of the view", async () => {
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
    camera.position.set(0, 1.2, 4);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld();
    const presenter = createFlashPresentation(THREE, {
        loadTexture: jest.fn(async () => ({
            texture: new THREE.Texture(),
            aspect: 1,
        })),
    });
    const parent = new THREE.Group();
    const actor = {
        id: "peer",
        name: "Ada",
        avatar: avatar() as any,
        parent,
        flash: art(),
    };
    presenter.beginFrame();
    presenter.sync(actor);
    await flush();
    presenter.finishFrame(0.1);
    expect(presenter.focus(camera)).toBeNull();
    presenter.beginFrame();
    presenter.sync(actor);
    presenter.finishFrame(1);
    parent.updateMatrixWorld(true);
    expect(presenter.focus(camera)).toEqual({
        id: "peer",
        flash: actor.flash,
        name: "Ada",
    });
    camera.lookAt(20, 1, 0);
    camera.updateMatrixWorld();
    expect(presenter.focus(camera)).toBeNull();
    presenter.dispose();
});
