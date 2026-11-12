/** Neutral backs for real moving tiles; never sample the destination artwork. */
export function worldTileBackPixels(size = 32): Uint8Array {
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const gradient = (x * 0.3 + y * 0.7) / Math.max(1, size - 1);
            const shade = Math.round(26 * gradient);
            const offset = (y * size + x) * 4;
            pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = shade;
            pixels[offset + 3] = 255;
        }
    return pixels;
}
export function createWorldTileBackMaterial(THREE: any, side = THREE.BackSide) {
    const texture = new THREE.DataTexture(
        worldTileBackPixels(),
        32,
        32,
        THREE.RGBAFormat
    );
    texture.name = "world-tile-dark-back-gradient";
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    if ("colorSpace" in texture && THREE.SRGBColorSpace)
        texture.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
    texture.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({
        name: "world-tile-dark-back",
        map: texture,
        color: 0xffffff,
        side,
        depthTest: true,
        depthWrite: true,
        toneMapped: false,
        fog: false,
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
