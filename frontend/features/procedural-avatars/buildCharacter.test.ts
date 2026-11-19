import * as T from "three/webgpu";
import catalogue from "@components/_3DExhibit-v2/three/factory/player/vrms.json";
import rigMap from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/baker/rigmap";
import { bakeAvatarAnimation } from "@components/_3DExhibit-v2/three/factory/artwork/meshes/model/avatarAnimations";
import { buildCharacter } from "./buildCharacter";
import { Drawing } from "./drawing";
import { coatShadowUV, garmentInk } from "./garmentPrint";
import { coatUVBase } from "./surfaces";
import { roundedProfileRows, type RoundedSection } from "./shapeRecipe";
import { defineLook, type AvatarRecipe } from "./recipes";
import { cartoonCast } from "./cartoonCast";
import { avatarStyles, crewOpening } from "./styles";
import { characters, proceduralCharacter, recipeForUrl } from "./catalog";
import { drawingRig } from "./referenceProportions";
import { referencePose } from "./referencePose";
import { disposeAvatarGraph } from "../lobby/webgpu/avatarResources";
import motion from "../../public/lobby/native-avatar-motion.json";

test("the chest descends from every meridian of a deep bound crew neckline", () => {
    const drawing = new Drawing("sunshine");
    const surface = jest.spyOn(drawing.s, "surface");
    drawing.body(
        [
            [170, -30, 30, 17],
            [176, -50, 50, 26],
            [185, -64, 64, 32],
            [212, -76, 76, 37],
        ],
        "#8899aa",
        false,
        20,
        "none",
        0,
        {
            neckline: {
                kind: "crew",
                width: 0.55,
                depth: 0.82,
                frontDrop: 13,
                backDrop: 2,
            },
            binding: "#2255aa",
            interior: "#553344",
            bandWidth: 5,
        }
    );
    const binding = surface.mock.calls.find(
        ([, color]) => color === "#2255aa"
    )[0];
    const fabric = surface.mock.calls.at(-1)[0];
    for (let i = 0; i < binding[1].length; i++) {
        expect(fabric[0][i][1]).toBeGreaterThan(binding[1][i][1]);
        expect(fabric[1][i][1]).toBeGreaterThan(fabric[0][i][1]);
    }
    expect(fabric.at(-1)[0][1]).toBe(212);
});

test("a shaped cross-section keeps its measured bounds at both avatar detail levels", () => {
    const roundedProfile: RoundedSection[] = [
        [50, 343, 357, 6, -2, 0.5, 2],
        [81, 299, 401, 48, -4, 0.38, 2.8],
        [111, 290, 410, 58, -5, 0.32, 2.5],
        [147, 319, 381, 34, 2, 0.65, 1.8],
        [165, 346, 354, 5, 4, 0.5, 2],
    ];
    const ring = roundedProfileRows(roundedProfile, 24)[2];
    expect(ring[0]).toEqual(ring.at(-1));
    expect(Math.min(...ring.map((p) => p[2]))).toBeCloseTo(-63);
    expect(Math.max(...ring.map((p) => p[2]))).toBeCloseTo(53);
    expect(ring[6][0]).toBeCloseTo(410);
    expect(ring[6][2]).toBeCloseTo(-5 + 58 * (2 * 0.32 - 1));
    const recipe: AvatarRecipe = {
        template: "sunshine",
        shapes: {
            palette: { skin: { color: "#e98768", finish: "skin" } },
            parts: [{ bone: "head", paint: "skin", roundedProfile, sides: 24 }],
        },
    };
    for (const lod of ["full", "crowd"] as const) {
        const rig = buildCharacter(recipe, lod);
        const mesh = rig.scene.getObjectByProperty(
            "isSkinnedMesh",
            true
        ) as T.SkinnedMesh;
        expect(mesh.geometry.index.count).toBeGreaterThan(0);
        expect(mesh.geometry.index.count / 3).toBeLessThanOrEqual(240);
        expect(mesh.geometry.groups).toHaveLength(0);
        disposeAvatarGraph(rig.scene);
    }
});

test.each(characters)(
    "$name fits the animation and crowd mesh contracts",
    ({ id }) => {
        const source = catalogue["procedural-" + id].url;
        expect(proceduralCharacter(source)).toBe(id);
        expect(
            proceduralCharacter("https://example.net" + source)
        ).toBeUndefined();
        const rig = buildCharacter(id);
        const meshes: T.SkinnedMesh[] = [];
        rig.scene.traverse((o) => {
            if ((o as T.Mesh).isMesh) meshes.push(o as T.SkinnedMesh);
        });
        expect(meshes).toHaveLength(1);
        const [mesh] = meshes;
        expect(mesh.geometry.groups).toHaveLength(0);
        expect(mesh.material).toMatchObject({
            vertexColors: true,
            map: null,
            colorNode: expect.anything(),
        });
        for (const name of Object.values(rigMap))
            expect(rig.humanoid.getNormalizedBoneNode(name)).toBeInstanceOf(
                T.Bone
            );
        const { position, color, uv, skinIndex, skinWeight } =
            mesh.geometry.attributes;
        for (const attribute of [position, color, uv, skinIndex, skinWeight]) {
            expect(attribute.count).toBe(position.count);
            expect(attribute.array.every(Number.isFinite)).toBe(true);
        }
        const colors = new Set(color.array);
        expect(colors.size).toBeGreaterThan(200);
        expect(mesh.geometry.index.count / 3).toBeLessThanOrEqual(
            {
                sunshine: 2756 / 2,
                rick: 2550,
                morty: 2050,
                summer: 2000,
                lux: 2650,
                remy: 3150,
                vale: 2550,
                "rick-classic": 3750,
            }[id]
        );
        let valid = true;
        for (let i = 0; i < position.count; i++) {
            const weight =
                skinWeight.getX(i) +
                skinWeight.getY(i) +
                skinWeight.getZ(i) +
                skinWeight.getW(i);
            valid &&=
                Math.abs(weight - 1) < 1e-5 &&
                skinIndex.getX(i) < mesh.skeleton.bones.length &&
                skinIndex.getY(i) < mesh.skeleton.bones.length;
        }
        expect(valid).toBe(true);

        const rest = rig.humanoid.getNormalizedPose();
        const undo = referencePose(rig.scene, id);
        expect(rig.humanoid.getNormalizedPose()).not.toEqual(rest);
        const drawing = drawingRig(id);
        const front = new T.Quaternion().setFromAxisAngle(
            new T.Vector3(0, 1, 0),
            Math.PI
        );
        for (const joint of drawing.joints.values()) {
            const expected = drawing
                .world(joint.point)
                .multiplyScalar(0.01)
                .applyQuaternion(front);
            const actual = rig.humanoid
                .getNormalizedBoneNode(joint.name)
                .getWorldPosition(new T.Vector3());
            expect(actual.distanceTo(expected)).toBeLessThan(0.00002);
        }
        undo();
        const clip = bakeAvatarAnimation(rig, motion.WALK, "avatar:walk");
        expect(rig.humanoid.getNormalizedPose()).toEqual(rest);
        const mixer = new T.AnimationMixer(rig.scene);
        mixer.clipAction(clip).play();
        const knee = rig.humanoid.getNormalizedBoneNode("leftLowerLeg");
        const before = knee.quaternion.clone();
        mixer.setTime(clip.duration * 0.32);
        expect(knee.quaternion.angleTo(before)).toBeGreaterThan(0.03);
        mixer.stopAllAction();
        mixer.uncacheRoot(rig.scene);
        disposeAvatarGraph(rig.scene);
    }
);

test("a new paint and silhouette recipe uses the shared rig in both detail levels", () => {
    const recipe = {
        template: "sunshine" as const,
        build: 1.09,
        headHeight: 1.16,
        shapes: {
            palette: { blue: { color: "#357ab8", finish: "cloth" as const } },
            parts: [
                {
                    bone: "head",
                    paint: "blue",
                    oval: [350, 103, 0] as [number, number, number],
                    radii: [41, 65, 48] as [number, number, number],
                },
            ],
        },
    };
    for (const detail of ["full", "crowd"] as const) {
        const avatar = buildCharacter(recipe, detail);
        const mesh = avatar.scene.getObjectByProperty(
            "isSkinnedMesh",
            true
        ) as T.SkinnedMesh;
        mesh.geometry.computeBoundingBox();
        const extent = mesh.geometry.boundingBox.getSize(new T.Vector3());
        expect(extent.x).toBeCloseTo(2 * 41 * 1.09 * 0.0028, 1);
        expect(extent.y).toBeCloseTo(2 * 65 * 1.16 * 0.0028, 1);
        expect(extent.z).toBeCloseTo(2 * 48 * 0.0028, 1);
        expect(mesh.geometry.index.count / 3).toBeLessThan(400);
        expect(
            mesh.skeleton.bones.find((b) => b.name === "leftFoot")
        ).toBeDefined();
        const indexes = mesh.geometry.getAttribute("skinIndex");
        expect(
            new Set(
                Array.from({ length: indexes.count }, (_, i) => indexes.getX(i))
            ).size
        ).toBe(1);
        disposeAvatarGraph(avatar.scene);
    }
});

test("garment recipes can exchange prints without changing another wearer's shirt", () => {
    const printCoordinates = (
        recipe: AvatarRecipe,
        detail: "full" | "crowd"
    ) => {
        const avatar = buildCharacter(recipe, detail);
        const mesh = avatar.scene.getObjectByProperty(
            "isSkinnedMesh",
            true
        ) as T.SkinnedMesh;
        const uv = mesh.geometry.attributes.uv;
        let sum = 0,
            printed = 0;
        for (let i = 0; i < uv.count; i++) {
            if (Math.floor(uv.getX(i)) % 8 === 4) {
                sum += uv.getX(i) % 1;
                printed++;
            }
        }
        disposeAvatarGraph(avatar.scene);
        return sum / printed;
    };
    for (const detail of ["full", "crowd"] as const) {
        const lettering = printCoordinates(
            { template: "vale", garments: { print: "lettering" } },
            detail
        );
        const crosses = printCoordinates({ template: "vale" }, detail);
        expect(lettering - crosses).toBeCloseTo(0.5, 3);
        expect(
            printCoordinates(
                { template: "vale", garments: { print: "crosses" } },
                detail
            )
        ).toEqual(crosses);
    }
});

test.each(characters)(
    "$name keeps an equipped item on either wrist through native motion",
    ({ id }) => {
        for (const detail of ["crowd", "full"] as const) {
            const avatar = buildCharacter(
                { template: id, build: 1.08 },
                detail
            );
            const rig = avatar.humanoid;
            const mesh = avatar.scene.getObjectByProperty(
                "isSkinnedMesh",
                true
            ) as T.SkinnedMesh;
            const clip = bakeAvatarAnimation(
                avatar,
                motion.WALK,
                "animated grip"
            );
            const mixer = new T.AnimationMixer(avatar.scene);
            mixer.clipAction(clip).play();
            const item = new T.Group();
            for (const side of ["right", "left"] as const) {
                mixer.setTime(0.14);
                const wrist = rig.getNormalizedBoneNode(side + "Hand");
                const finger = rig.getNormalizedBoneNode(
                    side + "IndexProximal"
                );
                const before = finger.quaternion.clone();
                avatar.equipItem(side, item, { radius: 0.013 });
                expect(item.parent.parent).toBe(wrist);
                expect(finger.quaternion.angleTo(before)).toBeGreaterThan(0.15);
                const atRest = wrist.worldToLocal(
                    item.getWorldPosition(new T.Vector3())
                );
                const grip = finger.quaternion.clone();
                mixer.setTime(clip.duration * 0.43);
                avatar.update();
                const moved = wrist.worldToLocal(
                    item.getWorldPosition(new T.Vector3())
                );
                expect(moved.distanceTo(atRest)).toBeLessThan(0.00001);
                expect(finger.quaternion.angleTo(grip)).toBeLessThan(0.00001);
                if (mesh.geometry.userData.referenceItem?.side === side)
                    expect(mesh.geometry.drawRange.count).toEqual(
                        mesh.geometry.userData.referenceItem.start
                    );
            }
            avatar.releaseItems();
            expect(item.parent).toBeNull();
            expect(mesh.geometry.drawRange.count).toBe(Infinity);
            mixer.stopAllAction();
            mixer.uncacheRoot(avatar.scene);
            disposeAvatarGraph(avatar.scene);
        }
    }
);

test("passing a held item to another avatar releases the first grip", () => {
    const a = buildCharacter("rick-classic"),
        b = buildCharacter("morty"),
        item = new T.Group();
    const finger = a.humanoid.getNormalizedBoneNode("rightMiddleIntermediate");
    const previous = finger.quaternion.clone();
    a.equipItem("right", item);
    b.equipItem("left", item);
    expect(item.parent.parent).toBe(
        b.humanoid.getNormalizedBoneNode("leftHand")
    );
    expect(finger.quaternion.angleTo(previous)).toBeLessThan(0.00001);
    a.releaseItems();
    expect(item.parent).toBeTruthy();
    b.releaseItems();
    disposeAvatarGraph(a.scene);
    disposeAvatarGraph(b.scene);
});

test("Rick’s lining and lit coat retain the source swatch on identical study geometry", () => {
    const painted = buildCharacter("rick-classic");
    const study = buildCharacter({
        template: "rick-classic",
        inspectPaint: true,
    });
    const body = (a: typeof study) =>
        a.scene.getObjectByProperty("isSkinnedMesh", true) as T.SkinnedMesh;
    const g = body(study).geometry;
    const raw = g.userData.referencePaint as T.BufferAttribute;
    expect(raw.count).toBe(g.attributes.color.count);
    expect(body(painted).geometry.userData.referencePaint).toBeUndefined();
    expect(g.index.count).toBe(body(painted).geometry.index.count);
    const coat = new T.Color("#fefefe"),
        swatches: number[] = [];
    for (let i = 0; i < raw.count; i++)
        if (
            Math.abs(raw.getX(i) - coat.r) < 0.0001 &&
            Math.abs(raw.getZ(i) - coat.b) < 0.0001
        )
            swatches.push(g.attributes.color.getZ(i));
    expect(swatches.length).toBeGreaterThan(120);
    expect(Math.max(...swatches) - Math.min(...swatches)).toBeGreaterThan(0.25);
    disposeAvatarGraph(study.scene);
    disposeAvatarGraph(painted.scene);
});

test.each(["full", "crowd"] as const)(
    "Rick's %s coat has shaded folds and clear lining on the shared material",
    (detail) => {
        const rig = buildCharacter("rick-classic", detail);
        const mesh = rig.scene.getObjectByProperty(
            "isSkinnedMesh",
            true
        ) as T.SkinnedMesh;
        const uv = mesh.geometry.attributes.uv;
        const coat = Array.from({ length: uv.count }, (_, i) => i).filter(
            (i) => Math.floor(uv.getX(i)) === coatUVBase
        );
        expect(coat.length).toBeGreaterThan(50);
        expect(mesh.geometry.groups).toHaveLength(0);
        const tile = garmentInk.image;
        const shadow = (across: number, down: number) => {
            const x = Math.floor(
                (coatShadowUV.origin[0] + coatShadowUV.span[0] * across) *
                    tile.width
            );
            const y = Math.floor(
                (coatShadowUV.origin[1] + coatShadowUV.span[1] * down) *
                    tile.height
            );
            return tile.data[(y * tile.width + x) * 4 + 3];
        };
        expect(shadow(0, 0.12)).toBeGreaterThan(shadow(0.14, 0.12) + 30);
        expect(shadow(0.15, 0.79)).toBeGreaterThan(shadow(0.075, 0.79) + 35);
        expect(shadow(0.15, 1)).toBeLessThan(shadow(0.15, 0.79) / 2);
        expect(shadow(0.6, 0.8)).toBe(0);
        expect(shadow(1, 0.5)).toBe(0);
        disposeAvatarGraph(rig.scene);
    }
);

test("the fitted undershirt stays a closed skinned surface after simplification", () => {
    const rig = buildCharacter({
        template: "rick-classic",
        inspectPaint: true,
    });
    const body = rig.scene.getObjectByProperty(
        "isSkinnedMesh",
        true
    ) as T.SkinnedMesh;
    const geo = body.geometry,
        raw = geo.userData.referencePaint as T.BufferAttribute;
    const shirt = new T.Color("#9adad8"),
        edges = new Map<string, number>();
    for (let i = 0; i < geo.index.count; i += 3) {
        const a = geo.index.getX(i);
        if (
            Math.abs(raw.getX(a) - shirt.r) > 1e-5 ||
            Math.abs(raw.getY(a) - shirt.g) > 1e-5 ||
            Math.abs(raw.getZ(a) - shirt.b) > 1e-5
        )
            continue;
        const vertices = [a, geo.index.getX(i + 1), geo.index.getX(i + 2)];
        for (let j = 0; j < 3; j++) {
            const v = vertices[j],
                w = vertices[(j + 1) % 3];
            const edge = v < w ? v + "," + w : w + "," + v;
            edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
    }
    expect(edges.size).toBeGreaterThan(30);
    expect([...edges.values()].every((count) => count === 2)).toBe(true);
    disposeAvatarGraph(rig.scene);
});

test("style recipes preserve their eye and wardrobe families and produce closed crew necks", () => {
    for (const style of ["cartoon", "sunshine", "streetwear"] as const) {
        const config = avatarStyles[style];
        const points = crewOpening([100, -30, 30, 20, 0], config.neckline, 24);
        expect(points[0]).toEqual(points.at(-1));
        for (const [x, , z] of points)
            expect(
                (x / (30 * config.neckline.width)) ** 2 +
                    (z / (20 * config.neckline.depth)) ** 2
            ).toBeCloseTo(1, 8);
        expect(points[0][1]).toBeGreaterThan(points[6][1]);
        expect(points[0][1]).toBeGreaterThan(points[12][1]);
        const avatar = buildCharacter({ style });
        expect(
            avatar.scene.getObjectByProperty("isSkinnedMesh", true)
        ).toBeTruthy();
        disposeAvatarGraph(avatar.scene);
    }
    expect(defineLook({ style: "cartoon", template: "summer" }).template).toBe(
        "summer"
    );
    expect(defineLook({ style: "sunshine" }).template).toBe("sunshine");
    expect(() =>
        defineLook(JSON.parse('{"style":"sunshine","template":"rick"}'))
    ).toThrow();
});

test("a new cartoon can inherit a character and tailor its outfit, hair and face", () => {
    const source = defineLook({ style: "cartoon", character: "inez-vale" });
    const relative = defineLook({
        style: "cartoon",
        character: "inez-vale",
        changes: {
            height: 560,
            hair: { cut: "bun" },
            outfit: { top: "polo", color: "#a65e47" },
            freckles: true,
        },
    });
    expect(relative.cartoon.hair).toEqual({
        cut: "bun",
        color: source.cartoon.hair.color,
    });
    expect(relative.cartoon.outfit.trousers).toBe(
        source.cartoon.outfit.trousers
    );
    expect(relative.cartoon.outfit.color).not.toBe(source.cartoon.outfit.color);
    expect(relative.layout.origin.floor).toBe(560);
    expect(source.cartoon.hair.cut).toBe("curls");
    const avatar = buildCharacter(relative);
    expect(
        avatar.scene.getObjectByProperty("isSkinnedMesh", true)
    ).toBeTruthy();
    disposeAvatarGraph(avatar.scene);
    const recoat = defineLook({
        style: "cartoon",
        character: "morty-smith",
        changes: { outfit: { top: "cardigan" } },
    });
    expect(recoat.cartoon.household).toBeDefined();
    expect(recoat.cartoon.outfit.top).toBe("cardigan");
    const talking = defineLook({
        style: "cartoon",
        character: "morty-smith",
        changes: { gaze: 0.3, brow: "knit", mouth: "speaking" },
    });
    expect(talking.cartoon.household.orbits).toBe(
        recoat.cartoon.household.orbits
    );
    expect(talking.cartoon.fit.sections.openMouth).toBeUndefined();
    expect(talking.cartoon.mouth).toBe("speaking");
    const restyle = defineLook({
        style: "cartoon",
        character: "morty-smith",
        changes: { hair: { cut: "bun" } },
    });
    expect(restyle.cartoon.household).toBeUndefined();
    expect(restyle.cartoon.hair.cut).toBe("bun");
});

test.each(cartoonCast)(
    "$name builds its cartoon recipe with an animated grip at both detail levels",
    ({ id }) => {
        const url = "/models/procedural/cast-" + id;
        const recipe = defineLook({ style: "cartoon", character: id });
        expect(recipeForUrl(url)).toEqual(recipe);
        if (id !== "rick-classic")
            expect(catalogue["procedural-cast-" + id].url).toBe(url);
        for (const detail of ["full", "crowd"] as const) {
            const model = buildCharacter(recipe, detail),
                mesh = model.scene.getObjectByProperty(
                    "isSkinnedMesh",
                    true
                ) as T.SkinnedMesh;
            expect(mesh.geometry.groups).toHaveLength(0);
            expect(mesh.geometry.index.count / 3).toBeLessThanOrEqual(
                id === "rick-classic" ? 3750 : 3300
            );
            expect(
                mesh.geometry.attributes.position.array.every(Number.isFinite)
            ).toBe(true);
            const item = new T.Group();
            model.equipItem("right", item);
            expect(item.parent.parent.name).toBe("rightHand");
            model.equipItem("left", item);
            expect(item.parent.parent.name).toBe("leftHand");
            model.releaseItems();
            expect(item.parent).toBeNull();
            disposeAvatarGraph(model.scene);
        }
        expect(recipeForUrl(url + "/29")).toEqual(recipeForUrl(url + "/29"));
        expect(recipeForUrl(url + "/29")).not.toEqual(
            recipeForUrl(url + "/30")
        );
    }
);
