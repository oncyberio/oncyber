/** A feathered square rim for actual clipped surface fragments. One shared map
 * and material serve the entire glow batch on both legacy WebGL and WebGPU. */
export function worldTileGlowPixels(size = 64): Uint8Array {
    const pixels = new Uint8Array(size * size * 4);
    const smooth = (x: number) => {
        const t = Math.max(0, Math.min(1, x));
        return t * t * (3 - 2 * t);
    };
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const u = x / (size - 1),
                v = y / (size - 1);
            const edge = Math.max(Math.abs(u * 2 - 1), Math.abs(v * 2 - 1));
            const feather = 1 - smooth((edge - 0.76) / 0.24);
            const rim = Math.exp(-(((edge - 0.72) / 0.23) ** 2));
            const fill = 0.13 * (1 - smooth(edge));
            const alpha = Math.min(1, (0.68 * rim + fill) * feather);
            const tint = smooth((u + v) / 2),
                offset = (y * size + x) * 4;
            // Icy blue blends gently into lavender rather than a white flash.
            pixels[offset] = Math.round(150 + 25 * tint);
            pixels[offset + 1] = Math.round(207 - 27 * tint);
            pixels[offset + 2] = 255;
            pixels[offset + 3] = Math.round(alpha * 255);
        }
    return pixels;
}
export function createWorldTileGlowMaterial(THREE: any) {
    const texture = new THREE.DataTexture(
        worldTileGlowPixels(),
        64,
        64,
        THREE.RGBAFormat
    );
    texture.name = "world-tile-soft-charge";
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    if ("colorSpace" in texture && THREE.SRGBColorSpace)
        texture.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
    texture.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({
        name: "world-tile-soft-glow",
        color: 0xffffff,
        map: texture,
        vertexColors: true,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
        // Only resolve coplanar fighting with the underlying fragment. This is
        // not a depth override: opaque geometry and the avatar still occlude it.
        polygonOffset: true,
        polygonOffsetFactor: -0.25,
        polygonOffsetUnits: -0.25,
    });
    let disposed = false;
    return {
        material,
        texture,
        dispose() {
            if (disposed) return;
            disposed = true;
            material.dispose();
            texture.dispose();
        },
    };
}
