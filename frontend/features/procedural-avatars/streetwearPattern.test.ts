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

test("dressing preserves the complete figure, exposes the right skin and uses the gameplay triangles", () => {
    const recipe = readAvatarFile(pattern).recipe;
    const studio = buildCharacter({ ...recipe, inspectClothingFit: true });
    const player = buildCharacter(recipe);
    try {
        const mesh = studio.scene.getObjectByProperty(
            "isSkinnedMesh",
            true
        ) as T.SkinnedMesh;
        const game = player.scene.getObjectByProperty(
            "isSkinnedMesh",
            true
        ) as T.SkinnedMesh;
        const g = mesh.geometry,
            ranges = g.userData.wardrobe;
        expect(g.drawRange).toEqual(ranges.dressed);
        const indices = (range: { start: number; count: number }) =>
            Array.from(
                g.index.array.slice(range.start, range.start + range.count)
            );
        const studioIndices = indices(ranges.dressed);
        const visible = [...new Set(studioIndices)].sort((a, b) => a - b);
        const gameIndices = Array.from(game.geometry.index.array);
        expect(gameIndices.map((i) => visible[i])).toEqual(studioIndices);
        expect(game.geometry.attributes.position.count).toBe(visible.length);
        for (const name of [
            "position",
            "normal",
            "color",
            "uv",
            "skinWeight",
            "skinIndex",
        ]) {
            const reference = g.getAttribute(name),
                compact = game.geometry.getAttribute(name);
            const error = visible.reduce((largest, source, i) => {
                for (let c = 0; c < compact.itemSize; c++)
                    largest = Math.max(
                        largest,
                        Math.abs(
                            reference.array[source * compact.itemSize + c] -
                                compact.array[i * compact.itemSize + c]
                        )
                    );
                return largest;
            }, 0);
            expect(error).toBe(0);
        }
        expect(game.geometry.getAttribute("coveredSkin")).toBeUndefined();
        const marks = g.attributes.coveredSkin,
            weights = g.attributes.skinWeight,
            joints = g.attributes.skinIndex;
        function checkLayers(layer: string) {
            const unique = new Set(indices(ranges[layer]));
            const bones = new Set<string>(),
                hidden = new Set<number>();
            for (const v of unique) {
                hidden.add(marks.getX(v));
                for (const [bone, weight] of [
                    [joints.getX(v), weights.getX(v)],
                    [joints.getY(v), weights.getY(v)],
                ])
                    if (weight > 0.3) bones.add(mesh.skeleton.bones[bone].name);
                expect(weights.getZ(v) + weights.getW(v)).toBe(0);
            }
            return { bones, hidden };
        }
        const base = checkLayers("body"),
            trousers = checkLayers("bottoms"),
            dressed = checkLayers("dressed");
        for (const bone of [
            "chest",
            "hips",
            "leftUpperArm",
            "leftLowerArm",
            "rightHand",
            "leftUpperLeg",
            "leftLowerLeg",
            "rightFoot",
        ])
            expect(base.bones.has(bone)).toBe(true);
        expect(base.hidden.has(1) && base.hidden.has(2)).toBe(true);
        // Whole marked panels disappear in the clothed index. Transition triangles at an opening remain.
        const buried = (
            range: { start: number; count: number },
            min: number
        ) => {
            const ids = indices(range);
            let total = 0;
            for (let i = 0; i < ids.length; i += 3)
                if (
                    Math.min(
                        ...ids.slice(i, i + 3).map((v) => marks.getX(v))
                    ) >= min
                )
                    total++;
            return total;
        };
        expect(buried(ranges.body, 2)).toBeGreaterThan(100);
        expect(buried(ranges.bottoms, 2)).toBe(0);
        expect(buried(ranges.dressed, 1)).toBe(0);
        const rest = player.humanoid.getRawPose();
        expect(rest.length).toBe(
            Object.keys(player.humanoid.rawHumanBones).length
        );
        expect(rest.length).toBe(game.skeleton.bones.length - 2);
        for (const side of ["right", "left"]) {
            const name = side + "SleeveHem";
            expect(base.bones.has(name) || trousers.bones.has(name)).toBe(
                false
            );
            expect(dressed.bones.has(name)).toBe(true);
            expect(player.humanoid.getNormalizedBoneNode(name)).toBeNull();
            const hem = game.skeleton.getBoneByName(name),
                shoulder = game.skeleton.getBoneByName(side + "UpperArm");
            shoulder.rotation.z = 0.94;
            player.update();
            const bent = hem.quaternion.clone();
            expect(bent.angleTo(new T.Quaternion())).toBeCloseTo(
                0.94 * 0.61,
                3
            );
            game.skeleton.getBoneByName(side + "LowerArm").rotation.x = 0.8;
            game.skeleton.getBoneByName(side + "Hand").rotation.y = -0.6;
            player.update();
            expect(bent.angleTo(hem.quaternion)).toBeCloseTo(0, 6);
        }
        player.humanoid.setRawPose(rest);
        expect(
            game.skeleton
                .getBoneByName("leftSleeveHem")
                .quaternion.angleTo(new T.Quaternion())
        ).toBeCloseTo(0, 6);
    } finally {
        disposeAvatarGraph(studio.scene);
        disposeAvatarGraph(player.scene);
    }
});
