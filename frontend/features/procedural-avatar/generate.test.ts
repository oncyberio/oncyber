/** @jest-environment node */
import { CHARACTERS } from "./characters";
import { AvatarData, generateAvatar, transferables } from "./generate";

// A light build keeps the suite quick; the checks do not depend on density.
const built: Record<string, AvatarData> = {};
beforeAll(() => {
    for (const id of Object.keys(CHARACTERS))
        built[id] = generateAvatar(CHARACTERS[id], { detail: 0.3 });
});

const ids = Object.keys(CHARACTERS);

describe.each(ids)("%s", (id) => {
    const data = () => built[id];
    const part = (name: string) => data().parts.find((p) => p.name === name);

    test("is a body plus separate clothes, hair and accessories", () => {
        const names = data().parts.map((p) => p.name);
        for (const expected of [
            "Body",
            "Head",
            "Hair",
            "Shirt",
            "Tie",
            "Belt",
            "Socks",
            "Shoes",
            "Badge",
        ])
            expect(names).toContain(expected);
        expect(
            names.some((name) => name === "Skirt" || name === "Trousers")
        ).toBe(true);
        expect(new Set(names).size).toBe(names.length);
        // The lobby instances avatars of up to 32 meshes and 256 bones.
        expect(names.length).toBeLessThanOrEqual(32);
        expect(data().bones.length).toBeLessThanOrEqual(256);
    });

    test("every part is well-formed, skinned geometry", () => {
        for (const p of data().parts) {
            const count = p.positions.length / 3;
            expect(count).toBeGreaterThan(0);
            expect(p.normals.length).toBe(count * 3);
            expect(p.colors.length).toBe(count * 3);
            expect(p.uvs.length).toBe(count * 2);
            expect(p.skinIndex.length).toBe(count * 4);
            expect(p.skinWeight.length).toBe(count * 4);
            expect(p.indices.length % 3).toBe(0);
            let bad = 0;
            for (let i = 0; i < p.positions.length; i++)
                if (
                    !Number.isFinite(p.positions[i]) ||
                    !Number.isFinite(p.normals[i])
                )
                    bad++;
            for (let i = 0; i < p.indices.length; i++)
                if (p.indices[i] >= count) bad++;
            for (let i = 0; i < count; i++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += p.skinWeight[i * 4 + k];
                    if (p.skinIndex[i * 4 + k] >= data().bones.length) bad++;
                }
                if (Math.abs(sum - 1) > 1e-4) bad++;
                const n = Math.hypot(
                    p.normals[i * 3],
                    p.normals[i * 3 + 1],
                    p.normals[i * 3 + 2]
                );
                if (Math.abs(n - 1) > 0.02) bad++;
            }
            expect([p.name, bad]).toEqual([p.name, 0]);
        }
    });

    test("stands on the ground at a human size, left and right alike", () => {
        let minY = Infinity;
        let maxY = -Infinity;
        let minX = Infinity;
        let maxX = -Infinity;
        for (const p of data().parts)
            for (let i = 0; i < p.positions.length; i += 3) {
                minX = Math.min(minX, p.positions[i]);
                maxX = Math.max(maxX, p.positions[i]);
                minY = Math.min(minY, p.positions[i + 1]);
                maxY = Math.max(maxY, p.positions[i + 1]);
            }
        expect(minY).toBeGreaterThan(-0.02);
        expect(minY).toBeLessThan(0.02);
        expect(maxY).toBeGreaterThan(1.6);
        expect(maxY).toBeLessThan(2);
        // T-pose: arms out level, the same reach on both sides.
        expect(maxX).toBeGreaterThan(0.7);
        expect(maxX + minX).toBeLessThan(0.02);
    });

    test("the body is whole: every humanoid bone moves some of it", () => {
        const body = part("Body");
        const moved = new Set<number>();
        for (let i = 0; i < body.skinIndex.length; i++)
            if (body.skinWeight[i] > 0.5) moved.add(body.skinIndex[i]);
        const head = part("Head");
        for (let i = 0; i < head.skinIndex.length; i++)
            if (head.skinWeight[i] > 0.5) moved.add(head.skinIndex[i]);
        const names = data().bones.map((bone) => bone.name);
        const missing = names.filter(
            (name, i) => !name.startsWith("hair") && !moved.has(i)
        );
        // Two arms, two legs, ten fingers of three bones each: nothing missing.
        expect(missing).toEqual([]);
    });

    test("can be handed across threads without copying", () => {
        const buffers = transferables(data());
        expect(buffers.length).toBeGreaterThanOrEqual(data().parts.length * 7);
        expect(buffers.every((buffer) => buffer.byteLength > 0)).toBe(true);
        expect(new Set(buffers).size).toBe(buffers.length);
    });
});

test("the two characters differ in build and outfit, not in how they are made", () => {
    const names = (id: string) => built[id].parts.map((p) => p.name);
    expect(names("runner")).toEqual(
        expect.arrayContaining(["Skirt", "Glasses", "Radio"])
    );
    expect(names("stagehand")).toEqual(
        expect.arrayContaining(["Trousers", "Headphones", "Ring"])
    );
    const height = (id: string) =>
        built[id].bones.find((bone) => bone.name === "head").position[1];
    expect(height("stagehand")).toBeGreaterThan(height("runner") + 0.05);
});

test("the studio look uses no textures: every surface is shaded from its vertices", () => {
    const stagehand = built.stagehand;
    for (const p of stagehand.parts) {
        expect([p.name, p.material.kind]).toEqual([p.name, "studio"]);
        expect(p.aux.length).toBe((p.positions.length / 3) * 4);
        expect(p.tangents.length).toBe((p.positions.length / 3) * 4);
    }
    // The face's paint is in the head's vertex colours: lips differ from skin.
    const head = stagehand.parts.find((p) => p.name === "Head");
    const colours = new Set<string>();
    for (let i = 0; i < head.colors.length; i += 3)
        colours.add(
            `${head.colors[i].toFixed(2)},${head.colors[i + 1].toFixed(2)}`
        );
    expect(colours.size).toBeGreaterThan(8);
    // Hair carries a strand direction and openness for its shader.
    const hair = stagehand.parts.find((p) => p.name === "Hair");
    let bad = 0;
    for (let i = 0; i < hair.tangents.length; i += 4) {
        const l = Math.hypot(
            hair.tangents[i],
            hair.tangents[i + 1],
            hair.tangents[i + 2]
        );
        if (Math.abs(l - 1) > 0.02) bad++;
        if (!(hair.aux[i] >= 0 && hair.aux[i] <= 1)) bad++;
    }
    expect(bad).toBe(0);
    // The painted look keeps its two generated textures.
    expect(
        built.runner.parts.filter((p) => p.material.kind === "textured")
    ).toHaveLength(2);
});
