import {
    BufferGeometry,
    Float32BufferAttribute,
    Group,
    Mesh,
    MeshBasicMaterial,
    ShaderMaterial,
    Texture,
    CompressedTexture,
    FramebufferTexture,
} from "three";
import {
    captureRoomTextureUpgrade,
    captureRoomTextureRecords,
} from "./roomTextureUpgrade";

function texture(size = 128, image) {
    const result = new Texture(
        image || { width: size, height: size, close: jest.fn() }
    );
    result.flipY = false;
    jest.spyOn(result, "dispose");
    return result;
}
function geometry(reverse = false) {
    const result = new BufferGeometry();
    const points = [
        [0, 0, 0, 0, 0],
        [1, 0, 0, 1, 0],
        [0, 1, 0, 0, 1],
    ];
    if (reverse) points.reverse();
    result.setAttribute(
        "position",
        new Float32BufferAttribute(
            points.flatMap((point) => point.slice(0, 3)),
            3
        )
    );
    result.setAttribute(
        "uv",
        new Float32BufferAttribute(
            points.flatMap((point) => point.slice(3)),
            2
        )
    );
    jest.spyOn(result, "dispose");
    return result;
}
function material(name, map) {
    const result = new MeshBasicMaterial({ map });
    result.name = name;
    jest.spyOn(result, "dispose");
    return result;
}
function mesh(name, map, materialName = name) {
    const result = new Mesh(geometry(), material(materialName, map));
    result.name = name;
    return result;
}
function scene(...children) {
    const scene = new Group();
    scene.add(...children);
    return scene;
}
function apply(plan, upload = jest.fn()) {
    for (const step of plan.steps(upload)) step();
    return upload;
}

test("reordered meshes and material arrays match semantics without replacing geometry or camera", () => {
    const red = texture(),
        blue = texture();
    const lowMesh = mesh("wall", red);
    lowMesh.material = [material("red", red), material("blue", blue)];
    const lowFloor = mesh("floor", texture());
    const low = scene(lowMesh, lowFloor),
        originalGeometry = lowMesh.geometry;
    low.position.x = 13;
    const highRed = texture(512),
        highBlue = texture(1024);
    const highMesh = mesh("wall", highBlue);
    highMesh.material = [material("blue", highBlue), material("red", highRed)];
    highMesh.geometry = geometry(true);
    const highFloor = mesh("floor", texture(512));
    const owner = captureRoomTextureUpgrade(low),
        plan = owner.plan({ scene: scene(highFloor, highMesh) });
    expect(plan.stats).toEqual({
        total: 3,
        matched: 3,
        alreadyFull: 0,
        applied: 0,
    });
    const upload = apply(plan);
    expect(upload).toHaveBeenCalledTimes(3);
    expect(lowMesh.material[0].map.image).toBe(highRed.image);
    expect(lowMesh.material[1].map.image).toBe(highBlue.image);
    expect(lowMesh.geometry).toBe(originalGeometry);
    expect(low.position.x).toBe(13);
    expect(plan.stats.applied).toBe(3);
    plan.dispose();
    owner.dispose();
});

test("converted shader and every pipeline pass receive the correct texture including cloned low sources", () => {
    const lowTexture = texture(),
        low = scene(mesh("walls", lowTexture));
    const owner = captureRoomTextureUpgrade(low);
    const lowClone = lowTexture.clone();
    const base = new ShaderMaterial({
        uniforms: { tInput: { value: lowClone } },
    });
    const mirror = new ShaderMaterial({
        uniforms: { array: { value: [lowClone] } },
    });
    const lighting = material("light", lowTexture);
    const live = scene(mesh("new pipeline name", lowTexture));
    live.children[0].material = base;
    live.children[0].diffuseMaterials = {
        material: base,
        mirrorMaterial: mirror,
    };
    live.children[0].lightingMaterials = { material: lighting };
    owner.bind(live);
    const highTexture = texture(512),
        plan = owner.plan({ scene: scene(mesh("walls", highTexture)) });
    apply(plan);
    expect(base.uniforms.tInput.value.image).toBe(highTexture.image);
    expect(mirror.uniforms.array.value[0]).toBe(base.uniforms.tInput.value);
    expect(lighting.map.image).toBe(highTexture.image);
    expect(low.children[0].material.map).toBe(lighting.map);
    plan.dispose();
    owner.dispose();
});

test("one shared map/emissive source upgrades once and retains shared bindings", () => {
    const map = texture(),
        lowMesh = mesh("space", map);
    lowMesh.material.emissiveMap = map;
    const owner = captureRoomTextureUpgrade(scene(lowMesh));
    const high = texture(512),
        highMesh = mesh("space", high);
    highMesh.material.emissiveMap = high;
    const plan = owner.plan({ scene: scene(highMesh) });
    expect(plan.textures).toHaveLength(1);
    apply(plan);
    expect(lowMesh.material.map).toBe(lowMesh.material.emissiveMap);
    plan.dispose();
    owner.dispose();
    expect(high.image.close).toHaveBeenCalledTimes(1);
    expect(map.image.close).toHaveBeenCalledTimes(1);
});

test.each([
    "uv",
    "transform",
    "sampler",
    "channel",
    "resolution",
    "unknown dimensions",
])("incompatible %s keeps the low image", (reason) => {
    const map = texture(),
        low = scene(mesh("room", map));
    const highMap = texture(512),
        highMesh = mesh("room", highMap);
    if (reason === "uv") highMesh.geometry.attributes.uv.setX(1, 0.2);
    if (reason === "transform") highMesh.position.x = 10;
    if (reason === "sampler") highMap.repeat.x = 2;
    if (reason === "channel") highMap.channel = 1;
    if (reason === "resolution") highMap.image.width = 64;
    if (reason === "unknown dimensions") highMap.image = {};
    const owner = captureRoomTextureUpgrade(low),
        plan = owner.plan({ scene: scene(highMesh) });
    expect(plan.textures).toHaveLength(0);
    apply(plan);
    expect(low.children[0].material.map).toBe(map);
    plan.dispose();
    owner.dispose();
});

test("ambiguous duplicate semantic names cannot assign a different high texture", () => {
    const low = scene(
        mesh("duplicate", texture(), "default"),
        mesh("duplicate", texture(), "default")
    );
    const high = scene(
        mesh("duplicate", texture(512), "default"),
        mesh("duplicate", texture(512), "default")
    );
    const owner = captureRoomTextureUpgrade(low),
        plan = owner.plan({ scene: high });
    expect(plan.textures).toHaveLength(0);
    plan.dispose();
    owner.dispose();
});

test("shared low texture with conflicting high assignments remains unchanged", () => {
    const map = texture(),
        low = scene(mesh("a", map), mesh("b", map));
    const owner = captureRoomTextureUpgrade(low),
        plan = owner.plan({
            scene: scene(mesh("a", texture(512)), mesh("b", texture(512))),
        });
    expect(plan.textures).toHaveLength(0);
    plan.dispose();
    owner.dispose();
});

test("donor ownership releases meshes immediately but closes installed images once at owner disposal", () => {
    const map = texture(),
        low = scene(mesh("wall", map));
    const donorMap = texture(512),
        donorMesh = mesh("wall", donorMap),
        unused = texture(1024);
    donorMap.userData.mesh = donorMesh;
    const donor = scene(donorMesh, mesh("unused", unused));
    const owner = captureRoomTextureUpgrade(low),
        plan = owner.plan({ scene: donor, textures: [donorMap, unused] });
    expect(plan.textures[0].userData.mesh).toBeUndefined();
    const installed = plan.textures[0];
    jest.spyOn(installed, "dispose");
    apply(plan);
    plan.dispose();
    plan.dispose();
    expect(donorMesh.geometry.dispose).toHaveBeenCalledTimes(1);
    expect(donorMesh.material.dispose).toHaveBeenCalledTimes(1);
    expect(donorMap.dispose).toHaveBeenCalledTimes(1);
    expect(donorMap.image.close).not.toHaveBeenCalled();
    expect(unused.image.close).toHaveBeenCalledTimes(1);
    expect(installed.dispose).not.toHaveBeenCalled();
    owner.dispose();
    owner.dispose();
    expect(installed.dispose).toHaveBeenCalledTimes(1);
    expect(donorMap.image.close).toHaveBeenCalledTimes(1);
});

test("partial cancellation releases installed and uninstalled image sources exactly once", () => {
    const low = scene(mesh("a", texture()), mesh("b", texture()));
    const a = texture(512),
        b = texture(512);
    const owner = captureRoomTextureUpgrade(low),
        plan = owner.plan({ scene: scene(mesh("a", a), mesh("b", b)) });
    const steps = [...plan.steps()];
    steps[0]();
    owner.dispose();
    steps[1]();
    plan.dispose();
    expect(a.image.close).toHaveBeenCalledTimes(1);
    expect(b.image.close).toHaveBeenCalledTimes(1);
    expect(low.children[1].material.map.image).not.toBe(b.image);
});

test("late donor arrival after owner disposal creates an empty disposable plan", () => {
    const owner = captureRoomTextureUpgrade(scene(mesh("wall", texture())));
    owner.dispose();
    const map = texture(512),
        donor = mesh("wall", map);
    const plan = owner.plan({ scene: scene(donor) });
    expect(plan.textures).toHaveLength(0);
    plan.dispose();
    expect(map.image.close).toHaveBeenCalledTimes(1);
    expect(donor.geometry.dispose).toHaveBeenCalledTimes(1);
});

test("a texture changed by another runtime effect is never overwritten", () => {
    const low = scene(mesh("wall", texture())),
        owner = captureRoomTextureUpgrade(low);
    const plan = owner.plan({ scene: scene(mesh("wall", texture(512))) });
    const external = texture(1024);
    low.children[0].material.map = external;
    const upload = apply(plan);
    expect(upload).not.toHaveBeenCalled();
    expect(low.children[0].material.map).toBe(external);
    plan.dispose();
    owner.dispose();
    expect(external.dispose).not.toHaveBeenCalled();
});

test("compressed startup texture can refine to an ordinary high image with its own mipmap policy", () => {
    const lowMap = new CompressedTexture([], 128, 128);
    lowMap.name = "compressed";
    const low = scene(mesh("wall", lowMap));
    const highMap = texture(512);
    highMap.minFilter = lowMap.minFilter;
    const owner = captureRoomTextureUpgrade(low),
        plan = owner.plan({ scene: scene(mesh("wall", highMap)) });
    expect(plan.textures).toHaveLength(1);
    apply(plan);
    expect(low.children[0].material.map.isCompressedTexture).not.toBe(true);
    expect(low.children[0].material.map.generateMipmaps).toBe(true);
    plan.dispose();
    owner.dispose();
});

test("shared externally owned textures are not disposed or closed by refinement", () => {
    const lowMap = texture();
    lowMap.userData.isShared = true;
    const highMap = texture(512);
    highMap.userData.isShared = true;
    const low = scene(mesh("wall", lowMap));
    const owner = captureRoomTextureUpgrade(low),
        plan = owner.plan({ scene: scene(mesh("wall", highMap)) });
    apply(plan);
    plan.dispose();
    owner.dispose();
    expect(lowMap.dispose).not.toHaveBeenCalled();
    expect(lowMap.image.close).not.toHaveBeenCalled();
    expect(highMap.dispose).not.toHaveBeenCalled();
    expect(highMap.image.close).not.toHaveBeenCalled();
});

test("unused donor aliases cannot close an installed bitmap shared by another map", () => {
    const image = { width: 512, height: 512, close: jest.fn() };
    const donorMap = texture(512, image),
        unusedAlias = texture(512, image);
    const low = scene(mesh("wall", texture())),
        owner = captureRoomTextureUpgrade(low);
    const plan = owner.plan({
        scene: scene(mesh("wall", donorMap), mesh("unused", unusedAlias)),
    });
    apply(plan);
    plan.dispose();
    expect(image.close).not.toHaveBeenCalled();
    owner.dispose();
    expect(image.close).toHaveBeenCalledTimes(1);
});

test("retired low images stay alive until every converted alias has switched", () => {
    const lowMap = texture(),
        lowClone = lowMap.clone();
    jest.spyOn(lowClone, "dispose");
    const low = scene(mesh("wall", lowMap)),
        owner = captureRoomTextureUpgrade(low);
    const live = scene(mesh("converted", lowClone));
    owner.bind(live);
    const high = texture(512),
        plan = owner.plan({ scene: scene(mesh("wall", high)) });
    const steps = [...plan.steps()];
    expect(steps).toHaveLength(2);
    steps[0]();
    expect(lowMap.dispose).toHaveBeenCalledTimes(1);
    expect(lowMap.image.close).not.toHaveBeenCalled();
    steps[1]();
    expect(lowClone.dispose).toHaveBeenCalledTimes(1);
    expect(lowMap.image.close).toHaveBeenCalledTimes(1);
    plan.dispose();
    owner.dispose();
    expect(lowMap.dispose).toHaveBeenCalledTimes(1);
    expect(lowClone.dispose).toHaveBeenCalledTimes(1);
    expect(lowMap.image.close).toHaveBeenCalledTimes(1);
});

test("a resumed plan only allocates textures for bindings still using their low source", () => {
    const low = scene(mesh("a", texture()), mesh("b", texture()));
    const owner = captureRoomTextureUpgrade(low);
    const first = owner.plan({
        scene: scene(mesh("a", texture(512)), mesh("b", texture(512))),
    });
    [...first.steps()][0]();
    expect(first.stats.applied).toBe(1);
    first.dispose();
    const installed = low.children[0].material.map;
    const resumed = owner.plan({
        scene: scene(mesh("a", texture(512)), mesh("b", texture(512))),
    });
    expect(resumed.textures).toHaveLength(1);
    expect(resumed.stats).toEqual({
        total: 2,
        matched: 1,
        alreadyFull: 0,
        applied: 0,
    });
    apply(resumed);
    expect(resumed.stats.applied).toBe(1);
    expect(low.children[0].material.map).toBe(installed);
    resumed.dispose();
    owner.dispose();
});

test("bounded diagnostics distinguish existing resolution from missing UV compatibility", () => {
    const low = scene(mesh("small-wall", texture()), mesh("no-uv", texture()));
    low.children[1].geometry.deleteAttribute("uv");
    const high = scene(
        mesh("small-wall", texture()),
        mesh("no-uv", texture(512))
    );
    high.children[1].geometry.deleteAttribute("uv");
    const owner = captureRoomTextureUpgrade(low),
        plan = owner.plan({ scene: high });
    expect(plan.diagnostics).toEqual([
        {
            reason: "same-resolution",
            mesh: "small-wall",
            material: "small-wall",
            slot: "map",
            low: [128, 128],
            high: [128, 128],
        },
        {
            reason: "missing-uv",
            mesh: "no-uv",
            material: "no-uv",
            slot: "map",
            low: [128, 128],
            high: [512, 512],
        },
    ]);
    plan.dispose();
    owner.dispose();
});

test("SpacePod PC-screen resize rounding preserves compatibility without accepting stretched images", () => {
    const lowMap = texture(1024);
    lowMap.image.height = 321;
    const low = scene(mesh("P_PC_Screen", lowMap));
    const highMap = texture(3444);
    highMap.image.height = 1080;
    const owner = captureRoomTextureUpgrade(low),
        plan = owner.plan({ scene: scene(mesh("P_PC_Screen", highMap)) });
    expect(plan.textures).toHaveLength(1);
    expect(plan.diagnostics).toEqual([]);
    apply(plan);
    plan.dispose();
    owner.dispose();

    const stretchedLow = scene(mesh("screen", texture(1024)));
    const stretchedHigh = texture(4096);
    stretchedHigh.image.height = 2048;
    const protectedOwner = captureRoomTextureUpgrade(stretchedLow);
    const rejected = protectedOwner.plan({
        scene: scene(mesh("screen", stretchedHigh)),
    });
    expect(rejected.textures).toHaveLength(0);
    expect(rejected.diagnostics[0].reason).toBe("aspect-ratio-mismatch");
    rejected.dispose();
    protectedOwner.dispose();
});

test("alreadyFull counts compatible live texture clones without counting UV or shared-source conflicts", () => {
    const full = texture(),
        upgradeable = texture(),
        invalid = texture();
    const low = scene(
        mesh("full", full),
        mesh("upgrade", upgradeable),
        mesh("invalid", invalid)
    );
    const owner = captureRoomTextureUpgrade(low);
    const clone = full.clone(),
        converted = scene(mesh("converted", clone));
    owner.bind(converted);
    const invalidHigh = mesh("invalid", texture());
    invalidHigh.geometry.attributes.uv.setX(1, 0.3);
    const plan = owner.plan({
        scene: scene(
            mesh("full", texture()),
            mesh("upgrade", texture(512)),
            invalidHigh
        ),
    });
    expect(plan.stats).toEqual({
        total: 4,
        matched: 1,
        alreadyFull: 2,
        applied: 0,
    });
    apply(plan);
    expect(plan.stats.applied + plan.stats.alreadyFull).toBe(3);
    plan.dispose();
    owner.dispose();
});

test("asynchronous tile upload keeps low visible until a complete replacement is ready", async () => {
    const lowTexture = texture(),
        low = mesh("wall", lowTexture);
    const owner = captureRoomTextureUpgrade(scene(low));
    const p = owner.plan({ scene: scene(mesh("wall", texture(512))) });
    const replacement = new FramebufferTexture(512, 512);
    let resolve;
    const uploading = p.steps(
        () =>
            new Promise((done) => {
                resolve = done;
            })
    )[0]();
    expect(low.material.map).toBe(lowTexture);
    resolve(replacement);
    await uploading;
    expect(low.material.map).toBe(replacement);
    expect(p.stats.applied).toBe(1);
    p.dispose();
    expect(lowTexture.image.close).not.toHaveBeenCalled();
    owner.restoreLowTextureBindings();
    expect(low.material.map).toBe(lowTexture);
    owner.dispose();
    expect(lowTexture.image.close).toHaveBeenCalledTimes(1);
});

test("late uploaded texture after scene disposal is discarded without installing", async () => {
    const lowTexture = texture(),
        low = mesh("wall", lowTexture);
    const owner = captureRoomTextureUpgrade(scene(low));
    const p = owner.plan({ scene: scene(mesh("wall", texture(512))) });
    const replacement = new FramebufferTexture(512, 512);
    const dispose = jest.spyOn(replacement, "dispose");
    let resolve;
    const uploading = p.steps(
        () =>
            new Promise((done) => {
                resolve = done;
            })
    )[0]();
    owner.dispose();
    resolve(replacement);
    await uploading;
    expect(low.material.map).toBe(lowTexture);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(p.stats.applied).toBe(0);
});

test("unsupported incremental upload preserves low texture and never triggers a shader rebuild", async () => {
    const lowTexture = texture(),
        low = mesh("wall", lowTexture);
    const owner = captureRoomTextureUpgrade(scene(low));
    const p = owner.plan({ scene: scene(mesh("wall", texture(512))) });
    const version = low.material.version;
    await p.steps(async () => null)[0]();
    expect(low.material.map).toBe(lowTexture);
    expect(low.material.version).toBe(version);
    expect(p.stats.applied).toBe(0);
    p.dispose();
    owner.dispose();
});

test("worker donor records install without a main-thread donor scene", async () => {
    const low = mesh("wall", texture()),
        high = texture(512);
    const owner = captureRoomTextureUpgrade(scene(low));
    const roomTextureRecords = captureRoomTextureRecords(
        scene(mesh("wall", high))
    );
    const plan = owner.plan({ roomTextureRecords, textures: [high] });
    const replacement = new FramebufferTexture(512, 512);
    expect(plan.stats.matched).toBe(1);
    await plan.steps(async () => replacement)[0]();
    expect(low.material.map).toBe(replacement);
    plan.dispose();
    expect(high.dispose).toHaveBeenCalledTimes(1);
    owner.dispose();
});
