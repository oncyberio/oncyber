import {
    defaultRecipe,
    setRecipeField,
    TOON_AVATAR_FIELDS,
    type ToonAvatarRecipe,
} from "../recipe";
import { TOON_BONES } from "../skeleton";
import { buildToonMesh } from "./index";

function expectSound(recipe: ToonAvatarRecipe, label: string) {
    const { geometry, layout } = buildToonMesh(recipe);
    const count = geometry.position.length / 3;
    const bad = (array: ArrayLike<number>) =>
        Array.prototype.findIndex.call(
            array,
            (v: number) => !Number.isFinite(v)
        );
    expect([label, bad(geometry.position)]).toEqual([label, -1]);
    expect([label, bad(geometry.normal)]).toEqual([label, -1]);
    expect([label, bad(geometry.paint)]).toEqual([label, -1]);
    expect(geometry.index.length % 3).toBe(0);
    let maxIndex = 0;
    for (const i of geometry.index) maxIndex = Math.max(maxIndex, i);
    expect(maxIndex).toBeLessThan(count);
    for (let i = 0; i < count; i++) {
        let total = 0;
        for (let k = 0; k < 4; k++) {
            total += geometry.skinWeight[i * 4 + k];
            if (geometry.skinIndex[i * 4 + k] >= TOON_BONES.length)
                throw new Error(`${label}: vertex ${i} uses a missing bone`);
        }
        if (Math.abs(total - 1) > 1e-4)
            throw new Error(`${label}: vertex ${i} weights sum to ${total}`);
    }
    // Feet on the floor, nothing absurdly far from the body.
    expect(geometry.min[1]).toBeGreaterThan(-0.02);
    expect(geometry.min[1]).toBeLessThan(0.03);
    expect(geometry.max[1]).toBeGreaterThan(layout.height - 0.01);
    expect(geometry.max[1]).toBeLessThan(layout.height + 0.6);
    return { count, triangles: geometry.index.length / 3 };
}

describe("toon avatar mesh", () => {
    it("builds the default avatar within a small budget", () => {
        const { count, triangles } = expectSound(defaultRecipe(), "default");
        expect(count).toBeGreaterThan(1500);
        expect(triangles).toBeLessThan(30000);
    });

    it("builds every choice of every option", () => {
        for (const { group, key, field } of TOON_AVATAR_FIELDS) {
            if (field.kind !== "choice") continue;
            for (const option of field.options) {
                const recipe = setRecipeField(
                    defaultRecipe(),
                    group as any,
                    key as never,
                    option
                );
                expectSound(recipe, `${group}.${key}=${option}`);
            }
        }
    });

    it("stays sound at both ends of every slider", () => {
        for (const extreme of [0, 1]) {
            let recipe = defaultRecipe();
            for (const { group, key, field } of TOON_AVATAR_FIELDS)
                if (field.kind === "unit")
                    recipe = setRecipeField(
                        recipe,
                        group as any,
                        key as never,
                        extreme
                    );
            expectSound(recipe, `all sliders at ${extreme}`);
        }
    });

    it("is deterministic", () => {
        const a = buildToonMesh(defaultRecipe()).geometry;
        const b = buildToonMesh(defaultRecipe()).geometry;
        expect(Array.from(a.position)).toEqual(Array.from(b.position));
    });
});
