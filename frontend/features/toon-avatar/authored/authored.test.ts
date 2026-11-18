import { encodeRecipe } from "../codec";
import { buildToonMesh } from "../mesh";
import { defaultRecipe, normalizeRecipe } from "../recipe";
import { TOON_BONES } from "../skeleton";
import { createToonVrm } from "../three/vrm";
import { authoredAvatarUrl, isToonAvatarUrl, toonAvatarSource } from "../url";
import {
    AUTHORED_AVATARS,
    isAuthoredAvatarId,
    loadAuthoredAvatar,
} from "./catalogue";

describe("authored avatars", () => {
    it.each(AUTHORED_AVATARS.map((item) => item.id))(
        "%s adds sound geometry of its own to the standard parts",
        async (id) => {
            const avatar = await loadAuthoredAvatar(id);
            expect(avatar.id).toBe(id);
            expect(avatar.id).toMatch(/^[a-z0-9-]+$/);
            const plain = buildToonMesh(avatar.recipe).geometry;
            const { geometry, layout } = buildToonMesh(
                avatar.recipe,
                avatar.build
            );
            const count = geometry.position.length / 3;
            expect(count).toBeGreaterThan(plain.position.length / 3);
            expect(geometry.index.length / 3).toBeLessThan(40000);
            for (const array of [
                geometry.position,
                geometry.normal,
                geometry.paint,
            ])
                expect(array.every(Number.isFinite)).toBe(true);
            for (let i = 0; i < count; i++) {
                let total = 0;
                for (let k = 0; k < 4; k++) {
                    total += geometry.skinWeight[i * 4 + k];
                    if (geometry.skinIndex[i * 4 + k] >= TOON_BONES.length)
                        throw new Error(`vertex ${i} uses a missing bone`);
                }
                if (Math.abs(total - 1) > 1e-4)
                    throw new Error(`vertex ${i} weights sum to ${total}`);
            }
            // Nothing under the floor or flung far from the body.
            expect(geometry.min[1]).toBeGreaterThan(-0.03);
            expect(geometry.max[1]).toBeLessThan(layout.height + 0.7);
            expect(Math.max(-geometry.min[0], geometry.max[0])).toBeLessThan(
                1.2
            );
            // And it stands up as a lobby humanoid.
            const vrm = createToonVrm(undefined, avatar);
            expect(vrm.avatar.recipe).toEqual(normalizeRecipe(avatar.recipe));
            vrm.update(1 / 60);
            vrm.avatar.dispose();
        }
    );

    it("are addressed by id, alone or with changed sliders", () => {
        const code = encodeRecipe(defaultRecipe());
        expect(authoredAvatarUrl("tinker")).toBe("/studio/avatar?id=tinker");
        expect(toonAvatarSource("/studio/avatar?id=tinker")).toEqual({
            id: "tinker",
        });
        expect(toonAvatarSource(authoredAvatarUrl("moth", code))).toEqual({
            id: "moth",
            code,
        });
        expect(
            toonAvatarSource(`https://oncyber.io/studio/avatar?id=juno`)
        ).toEqual({ id: "juno" });
        expect(isToonAvatarUrl("/studio/avatar?id=nobody")).toBe(false);
        expect(isToonAvatarUrl("/studio/avatar?id=__proto__")).toBe(false);
        expect(isAuthoredAvatarId("constructor")).toBe(false);
        expect(authoredAvatarUrl("tinker")).toMatch(/^(https?:\/\/|\/)/);
    });

    it("lists every module it can load, and nothing else", async () => {
        for (const { id, name } of AUTHORED_AVATARS)
            expect((await loadAuthoredAvatar(id)).name).toBe(name);
        expect(await loadAuthoredAvatar("nobody")).toBeNull();
    });
});
