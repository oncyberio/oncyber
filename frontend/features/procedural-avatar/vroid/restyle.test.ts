import { STAGEHAND_RECIPE } from "./recipe";
import { fitQuadratic, planReshape, reshapePoint } from "./restyle";

describe("reshaping a base model through its skeleton", () => {
    // hips -> spine -> head, and hips -> leg -> foot.
    const parents = [-1, 0, 1, 0, 3];
    const from: [number, number, number][] = [
        [0, 1, 0],
        [0, 1.2, 0],
        [0, 1.5, 0],
        [0.1, 0.95, 0],
        [0.1, 0.1, 0],
    ];
    const scale: [number, number, number][] = [
        [1, 1, 1],
        [1.2, 1.5, 1],
        [1, 1, 1],
        [1.1, 1.2, 1.1],
        [1, 1, 1],
    ];
    const plan = planReshape(parents, from, scale);

    it("moves children with their parent's scale and keeps the root", () => {
        expect(plan.to[0]).toEqual([0, 1, 0]);
        expect(plan.to[1]).toEqual([0, 1.2, 0]);
        // The spine is half as long again, so the head rises with it.
        expect(plan.to[2][1]).toBeCloseTo(1.2 + 0.3 * 1.5, 9);
        // The leg is a fifth longer: the foot goes down.
        expect(plan.to[4][1]).toBeCloseTo(0.95 - 0.85 * 1.2, 9);
        expect(plan.to[4][0]).toBeCloseTo(0.1, 9);
    });

    it("carries a vertex with the bone it is bound to", () => {
        // A point a third of the way up the spine, off to the side.
        const p = reshapePoint(
            plan,
            [0.1, 1.3, 0],
            [1, 0, 0, 0],
            [1, 0, 0, 0],
            0
        );
        expect(p[0]).toBeCloseTo(0.12, 9);
        expect(p[1]).toBeCloseTo(1.2 + 0.1 * 1.5, 9);
        // Bound to nothing, it stays.
        expect(
            reshapePoint(plan, [0.3, 0.3, 0.3], [0, 0, 0, 0], [0, 0, 0, 0], 0)
        ).toEqual([0.3, 0.3, 0.3]);
    });

    it("blends between bones without tearing a joint", () => {
        // A point exactly at the joint between spine and head lands on
        // the joint's new place whichever bone carries it.
        const joint = from[2];
        const bySpine = reshapePoint(
            plan,
            joint,
            [1, 0, 0, 0],
            [1, 0, 0, 0],
            0
        );
        const byHead = reshapePoint(plan, joint, [2, 0, 0, 0], [1, 0, 0, 0], 0);
        const shared = reshapePoint(
            plan,
            joint,
            [1, 2, 0, 0],
            [0.5, 0.5, 0, 0],
            0
        );
        for (let a = 0; a < 3; a++) {
            expect(bySpine[a]).toBeCloseTo(plan.to[2][a], 9);
            expect(byHead[a]).toBeCloseTo(plan.to[2][a], 9);
            expect(shared[a]).toBeCloseTo(plan.to[2][a], 9);
        }
    });

    it("fits a smooth profile through noisy points", () => {
        const curve = fitQuadratic([
            [0, 1],
            [1, 3],
            [2, 9],
            [3, 19],
        ]);
        // z = 1 + 2 y^2
        expect(curve(1.5)).toBeCloseTo(5.5, 6);
        expect(fitQuadratic([[1, 4]])(7)).toBeCloseTo(4, 9);
    });

    it("describes the Stagehand with sane numbers", () => {
        for (const scales of Object.values(STAGEHAND_RECIPE.bones))
            for (const value of scales) {
                expect(value).toBeGreaterThan(0);
                expect(value).toBeLessThan(2);
            }
        expect(STAGEHAND_RECIPE.bones.leftUpperLeg).toEqual(
            STAGEHAND_RECIPE.bones.rightUpperLeg
        );
        for (const hex of Object.values(STAGEHAND_RECIPE.palette))
            expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    });
});
