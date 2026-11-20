import * as T from "three/webgpu";
import pattern from "../../public/lobby/procedural/recipes/vale-streetwear.json";
import { disposeAvatarGraph } from "../lobby/webgpu/avatarResources";
import { readAvatarFile } from "./avatarFile";
import { buildCharacter } from "./buildCharacter";
import { streetShade } from "./streetwearPattern";

test.each(["full", "crowd"] as const)(
    "streetwear retains a single finite skinned draw and both palms at %s detail",
    (lod) => {
        const avatar = buildCharacter(readAvatarFile(pattern).recipe, lod);
        try {
            const meshes: T.SkinnedMesh[] = [];
            avatar.scene.traverse((object) => {
                if ((object as T.SkinnedMesh).isSkinnedMesh)
                    meshes.push(object as T.SkinnedMesh);
            });
            expect(meshes).toHaveLength(1);
            const { geometry, material, skeleton } = meshes[0];
            expect(Array.isArray(material)).toBe(false);
            expect(geometry.groups.length).toBeLessThanOrEqual(1);
            expect(geometry.index.count / 3).toBeLessThanOrEqual(5500);
            for (const key of ["position", "normal", "color", "skinWeight"])
                expect(
                    Array.from(geometry.attributes[key].array).every(
                        Number.isFinite
                    )
                ).toBe(true);
            const bound = new Set<number>();
            const weights = geometry.attributes.skinWeight,
                joints = geometry.attributes.skinIndex;
            for (let i = 0; i < weights.count; i++) {
                if (weights.getX(i) > 0.45) bound.add(joints.getX(i));
                if (weights.getY(i) > 0.45) bound.add(joints.getY(i));
            }
            for (const side of ["left", "right"])
                for (const joint of [
                    "Hand",
                    "IndexProximal",
                    "IndexDistal",
                    "LowerLeg",
                    "Foot",
                ]) {
                    expect(
                        bound.has(
                            skeleton.bones.indexOf(
                                skeleton.getBoneByName(side + joint)
                            )
                        )
                    ).toBe(true);
                }
        } finally {
            disposeAvatarGraph(avatar.scene);
        }
    }
);

test("a fitted seam must enclose a leg and pigment stations must bracket the fabric", () => {
    const file = JSON.parse(JSON.stringify(pattern));
    file.jeans[2][1] = file.jeans[2][2];
    expect(() => readAvatarFile(file)).toThrow();
    const paint = JSON.parse(JSON.stringify(pattern));
    paint.panels.tee[0][2] = paint.panels.tee[0][1];
    expect(() => readAvatarFile(paint)).toThrow();
});

test("a new hair dye keeps the crown highlights and lowlights in its own palette", () => {
    expect(streetShade("#fdedd3", "#fdedd3", "#edce9f")).toBe("#edce9f");
    expect(streetShade("#784050", "#fdedd3", "#edce9f")).toBe("#70383c");
});
