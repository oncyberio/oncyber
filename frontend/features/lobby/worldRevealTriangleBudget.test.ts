import { MeshBasicNodeMaterial, NodeMaterial } from "three/webgpu";
import { positionLocal, vec4 } from "three/tsl";
import { getWorldRevealTriangleBudget } from "./worldRevealTriangleBudget";

function mesh(triangles: number, overrides: any = {}) {
    return {
        isMesh: true,
        visible: true,
        userData: {},
        children: [],
        geometry: {
            attributes: { position: { count: triangles * 3 } },
            morphAttributes: {},
            drawRange: { start: 0, count: Infinity },
        },
        material: { visible: true },
        ...overrides,
    };
}

test("adds a capped cutting allowance only when source complexity needs it", () => {
    expect(getWorldRevealTriangleBudget([mesh(1000)])).toBe(120000);
    expect(getWorldRevealTriangleBudget([mesh(75000)])).toBe(120000);
    expect(getWorldRevealTriangleBudget([mesh(80001)])).toBe(129000);
    expect(getWorldRevealTriangleBudget([mesh(100001)])).toBe(160000);
    expect(getWorldRevealTriangleBudget([mesh(150000)])).toBe(160000);
});

test("counts shared roots once and never reads geometry buffers", () => {
    const source = mesh(80000);
    Object.defineProperty(source.geometry.attributes.position, "array", {
        get() {
            throw new Error("must not read vertices");
        },
    });
    const parent = { children: [source] };
    source.parent = parent;
    expect(getWorldRevealTriangleBudget([parent, source])).toBe(128000);
    expect(getWorldRevealTriangleBudget([source, mesh(80000)])).toBe(160000);
});

test("avatars, image backdrops, hidden parents and unsupported sources cannot inflate the allowance", () => {
    const avatar = { name: "avatarContainer", children: [mesh(100000)] };
    const backdrop = mesh(100000);
    const hidden = mesh(100000, { parent: { visible: false } });
    const customInstance = mesh(100000);
    customInstance.geometry.isInstancedBufferGeometry = true;
    const morph = mesh(100000);
    morph.geometry.morphAttributes.position = [{}];
    const placedBasic = new MeshBasicNodeMaterial();
    placedBasic.positionNode = positionLocal.mul(2);
    const billboard = mesh(100000, {
        material: { constructor: { name: "BillboardYMaterial" } },
    });
    expect(
        getWorldRevealTriangleBudget(
            [
                avatar,
                backdrop,
                hidden,
                customInstance,
                morph,
                billboard,
                mesh(100000, { visible: false }),
                mesh(100000, { userData: { worldRevealExclude: true } }),
                mesh(100000, { isSkinnedMesh: true }),
                mesh(100000, { material: { isShaderMaterial: true } }),
                mesh(100000, { material: { isRawShaderMaterial: true } }),
                // Ported engine shaders: plain node materials or vertex nodes.
                mesh(100000, { material: new NodeMaterial() }),
                mesh(100000, { material: placedBasic }),
                mesh(100000, { material: null }),
                mesh(200000),
                mesh(1000),
            ],
            (source) => source === backdrop || source.name === "avatarContainer"
        )
    ).toBe(120000);
});

test("visible material groups and draw ranges determine source complexity", () => {
    const source = mesh(100000, {
        material: [{ visible: true }, { visible: false }],
    });
    source.geometry.groups = [
        { start: 0, count: 240000, materialIndex: 0 },
        { start: 240000, count: 60000, materialIndex: 1 },
    ];
    expect(getWorldRevealTriangleBudget([source])).toBe(128000);
    source.geometry.drawRange = { start: 0, count: 120000 };
    expect(getWorldRevealTriangleBudget([source])).toBe(120000);
});

test("supported GPU instances count their copies within the existing instance-work bound", () => {
    const source = mesh(800, {
        isInstancedMesh: true,
        count: 100,
        instanceMatrix: { count: 100, itemSize: 16 },
        getMatrixAt() {
            throw new Error("metadata only");
        },
    });
    expect(getWorldRevealTriangleBudget([source])).toBe(128000);
    source.count = 4100;
    source.instanceMatrix.count = 4100;
    expect(getWorldRevealTriangleBudget([source])).toBe(120000);
    source.count = 100;
    source.instanceMatrix.itemSize = 4;
    expect(getWorldRevealTriangleBudget([source])).toBe(120000);
});

test("stops walking once the hard ceiling is known", () => {
    const later = {
        get isMesh() {
            throw new Error("ceiling reached");
        },
    };
    expect(getWorldRevealTriangleBudget([mesh(100000), later])).toBe(160000);
});

test("built-in and recoloured mesh-family node materials count as tile sources", () => {
    const recoloured = new MeshBasicNodeMaterial();
    recoloured.colorNode = vec4(1, 0, 0, 1);
    expect(
        getWorldRevealTriangleBudget([
            mesh(50000, { material: recoloured }),
            mesh(50000, { material: new MeshBasicNodeMaterial() }),
        ])
    ).toBe(160000);
});
