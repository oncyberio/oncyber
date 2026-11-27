/** @jest-environment node */
import { bindPart, followBody } from "./assemble";
import { MeshBuilder } from "./kernel/build";
import { Influence, Rig } from "./rig";

const rig = new Rig();

test("the skeleton is a VRM humanoid in a T-pose facing +Z", () => {
    const names = rig.bones.map((bone) => bone.name);
    for (const required of [
        "hips",
        "spine",
        "chest",
        "upperChest",
        "neck",
        "head",
        "leftShoulder",
        "leftUpperArm",
        "leftLowerArm",
        "leftHand",
        "rightUpperLeg",
        "rightLowerLeg",
        "rightFoot",
        "rightToes",
        "leftThumbMetacarpal",
        "leftIndexProximal",
        "rightLittleDistal",
    ])
        expect(names).toContain(required);
    expect(new Set(names).size).toBe(names.length);
    const at = (name: string) => rig.bones[rig.index[name]].position;
    // Left is +X, arms level, toes forward of the ankle.
    expect(at("leftHand")[0]).toBeGreaterThan(at("leftUpperArm")[0] + 0.4);
    expect(at("rightHand")[0]).toBeCloseTo(-at("leftHand")[0]);
    expect(at("leftHand")[1]).toBeCloseTo(at("leftUpperArm")[1]);
    expect(at("leftToes")[2]).toBeGreaterThan(at("leftFoot")[2] + 0.08);
    // Every bone but the root hangs off an earlier bone.
    rig.bones.forEach((bone, i) => {
        if (i === 0) expect(bone.parent).toBeNull();
        else expect(rig.index[bone.parent]).toBeLessThan(i);
    });
});

test("each part of the body follows its own bones", () => {
    const out = new Influence();
    const strongest = (p: readonly number[]) => {
        rig.skinAt(p[0], p[1], p[2], out);
        let sum = 0;
        for (let i = 0; i < 4; i++) sum += out.weights[i];
        expect(sum).toBeCloseTo(1, 5);
        return rig.bones[out.bones[0]].name;
    };
    expect(strongest([0, 1.6, 0.05])).toBe("head");
    expect(strongest([0, 1.12, 0.08])).toBe("chest");
    expect(strongest([0, 0.94, 0.09])).toBe("hips");
    expect(strongest([0.08, 0.7, 0.05])).toBe("leftUpperLeg");
    expect(strongest([-0.08, 0.3, 0])).toBe("rightLowerLeg");
    expect(strongest([0.08, 0.04, 0.02])).toBe("leftFoot");
    expect(strongest([0.08, 0.03, 0.14])).toBe("leftToes");
    // Arms hang in the design pose; ask along them.
    expect(strongest(rig.at("leftUpperArm", [0.14, 0, 0]))).toBe(
        "leftUpperArm"
    );
    expect(strongest(rig.at("rightLowerArm", [-0.12, 0, 0]))).toBe(
        "rightLowerArm"
    );
    expect(strongest(rig.at("leftHand", [0.04, 0, 0]))).toBe("leftHand");
    // Each finger moves alone: a point on one is not pulled by its neighbour.
    for (const finger of [
        "Thumb",
        "Index",
        "Middle",
        "Ring",
        "Little",
    ] as const) {
        const chain = rig.finger("right", finger);
        const mid = chain.points[1].map((v, k) => (v + chain.points[2][k]) / 2);
        expect(strongest(mid)).toBe(rig.bones[chain.bones[1]].name);
    }
});

test("binding carries a design-pose surface to the T-pose and back exactly", () => {
    // A strip of points down the left arm, sculpted where the arm hangs.
    const part = new MeshBuilder();
    const design: number[][] = [];
    for (let i = 0; i <= 20; i++) {
        const p = rig.at("leftUpperArm", [(i / 20) * 0.62, 0.03, 0.01]);
        design.push(p);
        part.vertex(p, [0, 1, 0], [1, 1, 1]);
    }
    for (let i = 0; i + 2 <= 20; i++) part.tri(i, i + 1, i + 2);
    const bound = bindPart(rig, part, followBody(rig));
    // In the T-pose the arm is level: the strip lies along +X at shoulder height.
    const shoulderY = rig.body.upperArm[1];
    for (let i = 8; i <= 20; i++)
        expect(Math.abs(bound.positions[i * 3 + 1] - shoulderY)).toBeLessThan(
            0.06
        );
    // Skinning the T-pose strip with the design pose gives the sculpt back.
    design.forEach((expected, i) => {
        const p = [
            bound.positions[i * 3],
            bound.positions[i * 3 + 1],
            bound.positions[i * 3 + 2],
        ];
        const posed = [0, 0, 0];
        for (let k = 0; k < 4; k++) {
            const w = bound.skinWeight[i * 4 + k];
            const m = rig.skin[bound.skinIndex[i * 4 + k]];
            for (let r = 0; r < 3; r++)
                posed[r] +=
                    w *
                    (m[r] * p[0] +
                        m[4 + r] * p[1] +
                        m[8 + r] * p[2] +
                        m[12 + r]);
        }
        for (let r = 0; r < 3; r++)
            expect(posed[r]).toBeCloseTo(expected[r], 5);
    });
});
