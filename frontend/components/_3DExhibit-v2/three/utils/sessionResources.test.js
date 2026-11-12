import { SessionResources, ownRendererResources } from "./sessionResources";
test("20 visits dispose drawn, offscreen and warmed resources without retaining them", () => {
    const owner = new SessionResources();
    const renderer = {
        renderObject: jest.fn(),
        setRenderTarget: jest.fn(),
        initTexture: jest.fn(),
    };
    ownRendererResources(renderer, owner);
    for (let i = 0; i < 20; i++) {
        const geometry = { dispose: jest.fn() },
            target = { dispose: jest.fn() },
            texture = { isTexture: true, dispose: jest.fn() },
            material = {
                dispose: jest.fn(),
                uniforms: { map: { value: texture } },
            };
        owner.begin();
        renderer.renderObject(null, null, null, geometry, material, null);
        renderer.renderObject(null, null, null, geometry, material, null);
        renderer.setRenderTarget(target);
        renderer.initTexture(texture);
        owner.end();
        owner.end();
        for (const resource of [geometry, target, texture, material])
            expect(resource.dispose).toHaveBeenCalledTimes(1);
        expect(owner.resources.size).toBe(0);
    }
});
test("one disposal failure does not retain the rest of a scene", () => {
    const owner = new SessionResources(),
        log = jest.spyOn(console, "error").mockImplementation(() => {}),
        last = { dispose: jest.fn() };
    owner.begin();
    owner.track({
        dispose() {
            throw Error("bad");
        },
    });
    owner.track(last);
    owner.end();
    expect(last.dispose).toHaveBeenCalled();
    expect(owner.resources.size).toBe(0);
    log.mockRestore();
});
test("a draw forwards all nine arguments and does no repeated work for known objects", () => {
    const owner = new SessionResources();
    const draw = jest.fn(() => "drawn");
    const renderer = {
        renderObject: draw,
        setRenderTarget: jest.fn(),
        initTexture: jest.fn(),
    };
    ownRendererResources(renderer, owner);
    const geometry = { dispose: jest.fn() };
    const material = {
        dispose: jest.fn(),
        map: { isTexture: true, dispose: jest.fn() },
    };
    owner.begin();
    const add = jest.spyOn(owner.resources, "add");
    const args = [
        "object",
        "scene",
        "camera",
        geometry,
        material,
        "group",
        "lights",
        "clip",
        "pass",
    ];
    for (let frame = 0; frame < 100; frame++)
        expect(renderer.renderObject(...args)).toBe("drawn");
    expect(draw).toHaveBeenLastCalledWith(...args);
    // geometry, material and its texture: once each, not once per draw
    expect(add).toHaveBeenCalledTimes(3);
    // stamps are symbols: invisible to Object.values, for..in and JSON
    expect(Object.keys(material)).toEqual(["dispose", "map"]);
    expect(JSON.stringify(geometry)).toBe("{}");
    owner.end();
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(material.map.dispose).toHaveBeenCalledTimes(1);
});
test("a texture attached to a drawn material later is found within a second", () => {
    jest.useFakeTimers();
    try {
        const owner = new SessionResources();
        const renderer = {
            renderObject: jest.fn(),
            setRenderTarget: jest.fn(),
            initTexture: jest.fn(),
        };
        ownRendererResources(renderer, owner);
        const material = { dispose: jest.fn() };
        owner.begin();
        renderer.renderObject(null, null, null, null, material);
        const late = { isTexture: true, dispose: jest.fn() };
        material.map = late;
        renderer.renderObject(null, null, null, null, material);
        expect(owner.resources.has(late)).toBe(false);
        jest.advanceTimersByTime(1000);
        renderer.renderObject(null, null, null, null, material);
        expect(owner.resources.has(late)).toBe(true);
        owner.end();
        expect(late.dispose).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
    } finally {
        jest.useRealTimers();
    }
});
test("a geometry kept between visits is owned again by the next visit", () => {
    const owner = new SessionResources();
    const geometry = { dispose: jest.fn() };
    owner.begin();
    owner.drawn(geometry);
    owner.end();
    owner.begin();
    owner.drawn(geometry);
    expect(owner.resources.has(geometry)).toBe(true);
    owner.end();
    expect(geometry.dispose).toHaveBeenCalledTimes(2);
});

test("disposed resources are forgotten during a long visit, not just at exit", () => {
    const { Texture, MeshBasicMaterial, BoxGeometry } = require("three");
    const owner = new SessionResources();
    owner.begin();
    for (let change = 0; change < 50; change++) {
        const texture = new Texture();
        const material = new MeshBasicMaterial({ map: texture });
        const geometry = new BoxGeometry();
        owner.track(geometry);
        owner.material(material);
        expect(owner.resources.size).toBe(3);
        geometry.dispose();
        material.dispose();
        texture.dispose();
        expect(owner.resources.size).toBe(0);
    }
    owner.end();
});

test("a resource reused after GPU invalidation is tracked again without duplicate listeners", () => {
    const { Texture } = require("three");
    const owner = new SessionResources();
    const texture = new Texture();
    const dispose = jest.spyOn(texture, "dispose");
    owner.begin();
    owner.track(texture);
    owner.track(texture);
    texture.dispose();
    expect(owner.resources.size).toBe(0);
    owner.track(texture);
    expect(owner.resources.size).toBe(1);
    owner.end();
    owner.end();
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(texture._listeners.dispose).toHaveLength(0);
});


test("exit still owns a live texture reallocated between throttled material scans", () => {
    const { Texture, MeshBasicMaterial } = require("three");
    const owner = new SessionResources();
    const texture = new Texture();
    const material = new MeshBasicMaterial({ map: texture });
    const release = jest.spyOn(texture, "dispose");
    owner.begin();
    owner.material(material);
    // VideoTexture sends this when adaptive streaming changes its resolution.
    texture.dispatchEvent({ type: "dispose" });
    owner.material(material);
    owner.end();
    expect(release).toHaveBeenCalledTimes(1);
    expect(owner.resources.size).toBe(0);
});
