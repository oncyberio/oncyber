/** @jest-environment node */
import fs from "fs";
import { Blob as NodeBlob } from "buffer";
beforeAll(() =>
    Object.defineProperty(globalThis, "Blob", {
        configurable: true,
        value: NodeBlob,
    })
);
import path from "path";
import {
    decodeLook,
    encodeLook,
    shapeWeights,
    starters,
    visiblePart,
} from "./look";
import { dressDocument, packVrm, type KitDocument } from "./modelFile";
import { readBuilds } from "./library";
import atelier from "./templates/atelier.json";
import relay from "./templates/relay.json";

describe.each(starters)("$name avatar kit", ({ look, name }) => {
    const source = (look.base === "atelier"
        ? atelier
        : relay) as unknown as KitDocument;
    const doc = dressDocument(source, look);
    it("uses the live controls on every selected primitive and keeps the rig intact", () => {
        expect(decodeLook(encodeLook(look))).toEqual(look);
        expect(doc.buffers).toBe(source.buffers);
        expect(doc.nodes).toHaveLength(source.nodes.length);
        expect(doc.extensions).toBe(source.extensions);
        let shapeCount = 0;
        for (const mesh of doc.meshes) {
            const names = mesh.extras?.targetNames ?? [];
            for (const p of mesh.primitives) {
                expect(
                    visiblePart(doc.materials[p.material].extras ?? {}, look)
                ).toBe(true);
                expect(
                    (p as { targets?: unknown[] }).targets?.length ?? 0
                ).toBe(names.length);
            }
            for (const [name, value] of Object.entries(shapeWeights(look))) {
                const i = names.indexOf(name);
                if (i >= 0) {
                    expect(mesh.weights[i]).toBe(value);
                    shapeCount++;
                }
            }
        }
        expect(shapeCount).toBeGreaterThanOrEqual(3);
        for (const m of source.meshes)
            expect((m.weights ?? []).every((v) => v === 0)).toBe(true);
    });
    it("exports an aligned standalone VRM with the same bones, licensing and binary", async () => {
        const buffer = fs.readFileSync(
            path.join(__dirname, "../../public", source.buffers[0].uri)
        );
        const blob = packVrm(doc, Uint8Array.from(buffer).buffer, name);
        const result = Buffer.from(await blob.arrayBuffer());
        expect(result.subarray(0, 4).toString()).toBe("glTF");
        expect(result.readUInt32LE(8)).toBe(result.length);
        const jsonEnd = 20 + result.readUInt32LE(12);
        const g = JSON.parse(result.subarray(20, jsonEnd).toString());
        expect(g.buffers).toEqual([{ byteLength: buffer.byteLength }]);
        expect(g.extensions.VRMC_vrm.meta).toEqual({
            ...source.extensions.VRMC_vrm.meta,
            name,
        });
        expect(g.extensions.VRMC_vrm.humanoid.humanBones.leftHand.node).toEqual(
            expect.any(Number)
        );
        expect(g.extensions.VRMC_vrm.expressions.preset.blink).toBeDefined();
        expect(result.readUInt32LE(jsonEnd + 4)).toBe(0x004e4942);
        expect(
            result
                .subarray(jsonEnd + 8, jsonEnd + 8 + buffer.length)
                .equals(Uint8Array.from(buffer))
        ).toBe(true);
        expect(result.length % 4).toBe(0);
    });
});
it("rejects unsupported versions, invalid palette indices and arbitrary model paths", () => {
    const code = encodeLook(starters[0].look);
    for (const bad of [
        code.replace("v1", "v2"),
        code.replace("atelier-1", "atelier-9"),
        "../../elsewhere",
        code + "-1",
    ]) {
        expect(decodeLook(bad)).toBeUndefined();
        expect(
            readBuilds(JSON.stringify([{ id: "a", name: "Test", code: bad }]))
        ).toEqual([]);
    }
});
