import tess from "../../public/lobby/procedural/recipes/tess-brindle.json";
import { readCartoonFile } from "./cartoonFile";
import * as T from "three/webgpu";
import { RecipeCrowdBatch } from "./crowdBatch";
import { buildCharacter } from "./buildCharacter";
import { recipeForUrl } from "./catalog";
import { disposeAvatarGraph } from "../lobby/webgpu/avatarResources";

test("distinct URL recipes share a visible draw range and independently release their slots", () => {
    const scene = new T.Scene(),
        camera = new T.PerspectiveCamera(60, 1, 0.1, 40);
    camera.position.set(0, 1, -6);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld();
    const batch = new RecipeCrowdBatch(scene, T.WebGLCoordinateSystem);
    const avatars = ["sunshine/17", "rick/83", "sunshine/18"].map((path, i) => {
        const url = "/models/procedural/" + path,
            recipe = recipeForUrl(url);
        const { scene: root } = buildCharacter(recipe, "crowd");
        root.position.x = i - 1;
        scene.add(root);
        return batch.add({
            root,
            sourceUrl: url,
            height: 1.8,
            update: () => {},
            playEmote: async () => {},
            dispose: () => {
                root.removeFromParent();
                disposeAvatarGraph(root);
            },
        });
    });
    expect(recipeForUrl("/models/procedural/sunshine/17")).toEqual(
        recipeForUrl("/models/procedural/sunshine/17")
    );
    expect(recipeForUrl("/models/procedural/sunshine/17")).not.toEqual(
        recipeForUrl("/models/procedural/sunshine/18")
    );
    batch.flush(camera);
    expect(batch.visible).toBe(3);
    const merged = scene.getObjectByName("Procedural avatar crowd") as T.Mesh;
    expect(merged.geometry.groups).toHaveLength(0);
    const tris = batch.triangles;
    avatars[1].setReveal(0);
    batch.flush(camera);
    expect(batch.visible).toBe(2);
    expect(batch.triangles).toBeLessThan(tris);
    avatars[1].setReveal(1);
    batch.flush(camera);
    expect(batch.triangles).toEqual(tris);
    avatars[0].root.position.set(100, 0, 0);
    batch.flush(camera);
    expect(batch.visible).toBe(2);
    avatars[2].dispose();
    avatars[2].dispose();
    batch.flush(camera);
    expect(batch.size).toBe(2);
    expect(batch.visible).toBe(1);
    batch.dispose();
    expect(batch.size).toBe(0);
});

test("gaze blends independently on two batched avatars and restores both eye buffers exactly", () => {
    const design = readCartoonFile(tess).design;
    const scene = new T.Scene(),
        camera = new T.PerspectiveCamera(60, 1, 0.1, 40);
    camera.position.set(0, 1, -6);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld();
    const batch = new RecipeCrowdBatch(scene, T.WebGLCoordinateSystem);
    const actors = [0, 1].map((i) => {
        const actor = buildCharacter({ style: "cartoon", design }, "crowd");
        const root = actor.scene;
        root.position.x = i;
        scene.add(root);
        return batch.add({
            root,
            setGazePose: actor.setGazePose,
            sourceUrl: "/models/procedural/drawn-tess-brindle",
            height: 1.8,
            update: () => {},
            playEmote: async () => {},
            dispose: () => disposeAvatarGraph(root),
        });
    });
    batch.flush(camera);
    const mesh = scene.getObjectByName("Procedural avatar crowd") as T.Mesh;
    const geom = mesh.geometry,
        uv = geom.attributes.uv as T.BufferAttribute;
    const normals = geom.attributes.normal as T.BufferAttribute;
    const neutralUV = uv.array.slice(),
        neutralNormals = normals.array.slice();
    const half = uv.array.length / 2;
    const triangles = batch.triangles;
    actors[1].setGazePose(0.5);
    batch.flush(camera);
    expect(uv.array.slice(0, half)).toEqual(neutralUV.slice(0, half));
    const changed = uv.array.filter((v, i) => v !== neutralUV[i]).length;
    expect(changed).toBeGreaterThan(10);
    expect(changed).toBeLessThan(300);
    const version = uv.version;
    actors[1].setGazePose(0.5);
    batch.flush(camera);
    expect(uv.version).toEqual(version);
    actors[1].root.visible = false;
    actors[1].setGazePose(0);
    batch.flush(camera);
    expect(batch.visible).toBe(1);
    actors[1].root.visible = true;
    batch.flush(camera);
    expect(uv.array).toEqual(neutralUV);
    expect(normals.array).toEqual(neutralNormals);
    expect(mesh.geometry).toBe(geom);
    expect(batch.triangles).toBe(triangles);
    expect(batch.visible).toBe(2);
    batch.dispose();
});
