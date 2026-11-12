import * as THREE from "three";
import { createWorldCubeReveal } from "./worldCubeReveal";
import { createTravelPreviewWorld } from "./testing/createTravelPreviewWorld";

function triangle() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
            [0.2, 0.2, 0.5, 0.6, 0.2, 0.5, 0.2, 0.6, 0.5],
            3
        )
    );
    geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2)
    );
    geometry.computeVertexNormals();
    return geometry;
}
function fragments(scene: THREE.Scene) {
    const result: THREE.Mesh[] = [];
    scene.traverse((object) => {
        if (object.name.startsWith("world-batch:"))
            result.push(object as THREE.Mesh);
    });
    return result;
}
function worldVertices(mesh: THREE.Mesh) {
    const position = mesh.geometry.getAttribute("position");
    return Array.from({ length: position.count }, (_, index) =>
        new THREE.Vector3()
            .fromBufferAttribute(position as THREE.BufferAttribute, index)
            .applyMatrix4(mesh.matrixWorld)
    );
}
function makeMesh() {
    const mesh = new THREE.Mesh(triangle(), new THREE.MeshStandardMaterial());
    mesh.name = "destination";
    return mesh;
}
const anchor = { x: 0, y: 0, z: 0 };

describe("world cube reveal independent geometry audit", () => {
    it("keeps mirrored triangles front-facing after baking transforms", () => {
        const scene = new THREE.Scene();
        const mesh = makeMesh();
        mesh.scale.x = -1;
        scene.add(mesh);
        const reveal = createWorldCubeReveal(THREE, [mesh], {
            scene,
            anchor,
            cellSize: 2,
        });
        reveal.setProgress(1);
        scene.updateMatrixWorld(true);
        const fragment = fragments(scene)[0];
        const [a, b, c] = worldVertices(fragment);
        const cross = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
        const normal = new THREE.Vector3()
            .fromBufferAttribute(fragment.geometry.getAttribute("normal"), 0)
            .applyNormalMatrix(
                new THREE.Matrix3().getNormalMatrix(fragment.matrixWorld)
            );
        expect(cross.dot(normal)).toBeCloseTo(1, 5);
        expect(reveal.stats.triangles).toBe(1);
        reveal.dispose();
    });

    it("does not reveal triangles omitted from material-array groups", () => {
        const scene = new THREE.Scene();
        const geometry = triangle();
        const first = Array.from(geometry.getAttribute("position").array);
        geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute([...first, ...first], 3)
        );
        geometry.deleteAttribute("normal");
        geometry.deleteAttribute("uv");
        geometry.addGroup(0, 3, 0);
        const mesh = new THREE.Mesh(geometry, [new THREE.MeshBasicMaterial()]);
        scene.add(mesh);
        const reveal = createWorldCubeReveal(THREE, [mesh], {
            scene,
            anchor,
            cellSize: 2,
        });
        expect(reveal.stats.triangles).toBe(1);
        expect(
            fragments(scene)[0].geometry.getAttribute("position").count
        ).toBe(3);
        reveal.dispose();
    });

    it("does not add visible backfaces to intentionally invisible materials", () => {
        const scene = new THREE.Scene();
        const mesh = makeMesh();
        mesh.material.visible = false;
        scene.add(mesh);
        const reveal = createWorldCubeReveal(THREE, [mesh], {
            scene,
            anchor,
            cellSize: 2,
        });
        const generated: THREE.Mesh[] = [];
        scene.getObjectByName("native-world-cube-reveal").traverse((object) => {
            if ((object as THREE.Mesh).isMesh)
                generated.push(object as THREE.Mesh);
        });
        for (const piece of generated) {
            const materials = Array.isArray(piece.material)
                ? piece.material
                : [piece.material];
            expect(materials.every((material) => !material.visible)).toBe(true);
        }
        reveal.dispose();
        expect(mesh.material.visible).toBe(false);
    });

    it("bounds clipping work before committing an incomplete source mesh", () => {
        const scene = new THREE.Scene();
        const mesh = makeMesh();
        scene.add(mesh);
        const reveal = createWorldCubeReveal(THREE, [mesh], {
            scene,
            anchor,
            cellSize: 2,
            maxClipTests: 0,
        });
        expect(reveal.stats).toMatchObject({
            cells: 0,
            triangles: 0,
            fragments: 0,
            skipped: 1,
        });
        expect(fragments(scene)).toHaveLength(0);
        expect(mesh.visible).toBe(false);
        reveal.dispose();
        expect(mesh.visible).toBe(true);
    });

    it("reconstructs world positions through a transformed scene and nested roots", () => {
        const scene = new THREE.Scene();
        scene.position.set(3, 1, -2);
        scene.rotation.y = 0.2;
        scene.scale.set(1.1, 0.9, 1.3);
        const group = new THREE.Group();
        group.position.set(1, 2, 3);
        group.rotation.set(0.2, -0.4, 0.1);
        const mesh = makeMesh();
        mesh.position.set(0.4, 0.2, -0.1);
        mesh.scale.set(1.4, 0.8, 1.2);
        group.add(mesh);
        scene.add(group);
        scene.updateMatrixWorld(true);
        const expected = worldVertices(mesh);
        const origin = expected[0].clone().subScalar(1);
        const reveal = createWorldCubeReveal(THREE, [group], {
            scene,
            anchor: origin,
            cellSize: 8,
        });
        reveal.setProgress(1);
        scene.updateMatrixWorld(true);
        const fragment = fragments(scene)[0];
        const actual = worldVertices(fragment);
        expect(actual).toHaveLength(3);
        actual.forEach((vertex, i) =>
            expect(vertex.distanceTo(expected[i])).toBeLessThan(0.00001)
        );
        expect(Array.from(fragment.geometry.getAttribute("uv").array)).toEqual([
            0, 0, 1, 0, 0, 1,
        ]);
        expect(fragment.material).toBe(mesh.material);
        reveal.dispose();
    });

    it("does not expose hidden ancestors or excluded player subtrees", () => {
        const scene = new THREE.Scene();
        const hidden = new THREE.Group();
        hidden.visible = false;
        const mesh = makeMesh();
        hidden.add(mesh);
        scene.add(hidden);
        const player = new THREE.Group();
        player.userData.worldRevealExclude = true;
        const avatar = makeMesh();
        player.add(avatar);
        scene.add(player);
        const reveal = createWorldCubeReveal(THREE, [mesh, player], {
            scene,
            anchor,
        });
        expect(reveal.stats).toMatchObject({
            cells: 0,
            triangles: 0,
            fragments: 0,
            skipped: 0,
        });
        expect(mesh.visible).toBe(true);
        expect(avatar.visible).toBe(true);
        expect(hidden.visible).toBe(false);
        reveal.dispose();
        expect(hidden.visible).toBe(false);
    });

    it("bounds overlapping mesh fragments and rolls back rejected meshes", () => {
        const scene = new THREE.Scene();
        const meshes = Array.from({ length: 20 }, () => makeMesh());
        scene.add(...meshes);
        const reveal = createWorldCubeReveal(THREE, meshes, {
            scene,
            anchor,
            cellSize: 2,
            maxFragments: 4,
        });
        expect(reveal.stats.fragments).toBe(4);
        expect(reveal.stats.skipped).toBe(16);
        expect(reveal.stats.triangles).toBe(4);
        expect(fragments(scene)).toHaveLength(4);
        expect(meshes.every((mesh) => !mesh.visible)).toBe(true);
        reveal.setProgress(1);
        expect(meshes.every((mesh) => mesh.visible)).toBe(true);
        reveal.dispose();
        expect(scene.children).toHaveLength(20);
    });

    it("holds unsupported and over-budget world meshes until completion", () => {
        const scene = new THREE.Scene();
        const shader = new THREE.Mesh(triangle(), new THREE.ShaderMaterial());
        const ordinary = makeMesh();
        scene.add(shader, ordinary);
        const reveal = createWorldCubeReveal(THREE, [shader, ordinary], {
            scene,
            anchor,
            maxTriangles: 0,
        });
        expect(reveal.stats.skipped).toBe(2);
        expect(reveal.stats.cells).toBe(0);
        expect(shader.visible).toBe(false);
        expect(ordinary.visible).toBe(false);
        reveal.setProgress(1);
        expect(shader.visible).toBe(true);
        expect(ordinary.visible).toBe(true);
        reveal.setProgress(0);
        expect(shader.visible).toBe(false);
        reveal.dispose();
        expect(shader.visible).toBe(true);
        expect(ordinary.visible).toBe(true);
    });

    it("restores background, fog and source resources after cancellation exactly once", () => {
        const scene = new THREE.Scene();
        const background = new THREE.Color(0x345678);
        const fog = new THREE.Fog(0x345678, 2, 40);
        scene.background = background;
        scene.fog = fog;
        const mesh = makeMesh();
        scene.add(mesh);
        const originalGeometryDispose = jest.spyOn(mesh.geometry, "dispose");
        const originalMaterialDispose = jest.spyOn(mesh.material, "dispose");
        const reveal = createWorldCubeReveal(THREE, [mesh], {
            scene,
            anchor,
            cellSize: 2,
        });
        const generated = fragments(scene)[0].geometry;
        const generatedDispose = jest.spyOn(generated, "dispose");
        expect(scene.background).not.toBe(background);
        expect(scene.fog).toBeNull();
        reveal.setProgress(0.6);
        reveal.dispose();
        reveal.dispose();
        reveal.setProgress(0.2);
        expect(scene.background).toBe(background);
        expect(scene.fog).toBe(fog);
        expect(mesh.visible).toBe(true);
        expect(mesh.geometry).not.toBe(generated);
        expect(generatedDispose).toHaveBeenCalledTimes(1);
        expect(originalGeometryDispose).not.toHaveBeenCalled();
        expect(originalMaterialDispose).not.toHaveBeenCalled();
        expect(scene.children).toEqual([mesh]);
    });

    it("rebuilds the preview after cancellation without retaining fragments or replacing world assets", () => {
        const scene = new THREE.Scene();
        const background = new THREE.Color(0x112233);
        const fog = new THREE.Fog(0x112233, 1, 10);
        scene.background = background;
        scene.fog = fog;
        const unrelated = makeMesh();
        scene.add(unrelated);
        const preview = createTravelPreviewWorld(THREE, scene);
        const source = preview.group.children[0] as THREE.Mesh;
        const disposeSource = jest.spyOn(source.geometry, "dispose");
        preview.show(0.45, new THREE.Vector3(1, 0, 2), 0.2);
        expect(fragments(scene).length).toBeGreaterThan(0);
        expect(source.visible).toBe(false);
        preview.hide();
        expect(fragments(scene)).toHaveLength(0);
        expect(preview.group.visible).toBe(false);
        expect(source.visible).toBe(true);
        expect(disposeSource).not.toHaveBeenCalled();
        expect(scene.background).toBe(background);
        expect(scene.fog).toBe(fog);
        preview.show(1, new THREE.Vector3(4, 0, 5), -0.3);
        expect(preview.group.position.toArray()).toEqual([4, 0, 5]);
        expect(preview.group.visible).toBe(true);
        expect(source.visible).toBe(true);
        expect(unrelated.visible).toBe(true);
        preview.dispose();
        expect(disposeSource).toHaveBeenCalledTimes(1);
        expect(scene.children).toEqual([unrelated]);
        expect(scene.background).toBe(background);
        expect(scene.fog).toBe(fog);
    });
});
