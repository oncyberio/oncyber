import {
    createWorldTileGlowMaterial,
    worldTileGlowPixels,
} from "./worldTileGlow";
const THREE = require("three");
test("square charge texture has a feathered colored rim instead of a white flash", () => {
    const size = 64,
        pixels = worldTileGlowPixels(size);
    const alpha = (x, y) => pixels[(y * size + x) * 4 + 3];
    expect(pixels).toHaveLength(size * size * 4);
    for (let index = 0; index < size; index++) {
        expect(alpha(index, 0)).toBe(0);
        expect(alpha(index, size - 1)).toBe(0);
        expect(alpha(0, index)).toBe(0);
        expect(alpha(size - 1, index)).toBe(0);
    }
    expect(alpha(54, 32)).toBeGreaterThan(alpha(32, 32));
    expect(alpha(59, 32)).toBeGreaterThan(alpha(62, 32));
    expect(alpha(62, 32)).toBeGreaterThan(0);
    const lit = (32 * size + 54) * 4;
    expect(pixels[lit]).toBeLessThan(pixels[lit + 2]);
    expect(pixels[lit + 1]).toBeLessThan(pixels[lit + 2]);
    expect(alpha(54, 32)).toBeLessThan(190);
});
test("shared glow uses native material depth and vertex intensity across renderers", () => {
    const glow = createWorldTileGlowMaterial(THREE);
    expect(glow.material.isMeshBasicMaterial).toBe(true);
    expect(glow.material.vertexColors).toBe(true);
    expect(glow.material.blending).toBe(THREE.AdditiveBlending);
    expect(glow.material.side).toBe(THREE.FrontSide);
    expect(glow.material.depthTest).toBe(true);
    expect(glow.material.depthWrite).toBe(false);
    expect(glow.material.opacity).toBeLessThan(0.3);
    expect(glow.material.map).toBe(glow.texture);
    expect(glow.texture.generateMipmaps).toBe(false);
    expect(glow.material.polygonOffsetFactor).toBeGreaterThan(-1);
    glow.dispose();
});
test("owned shared material and texture are disposed exactly once", () => {
    const glow = createWorldTileGlowMaterial(THREE);
    const material = jest.spyOn(glow.material, "dispose"),
        texture = jest.spyOn(glow.texture, "dispose");
    glow.dispose();
    glow.dispose();
    expect(material).toHaveBeenCalledTimes(1);
    expect(texture).toHaveBeenCalledTimes(1);
});
