import type * as Three from "three";

/** A soft highlight following the halo's radius, generated once with no asset fetch. */
export function createTravelGlowTexture(THREE: typeof Three) {
    const size = 256;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = ((x + 0.5) / size) * 2 - 1;
            const v = ((y + 0.5) / size) * 2 - 1;
            const distance = Math.hypot(u, v) - 0.7925;
            const angle = Math.atan2(v, u);
            // A tight leading edge and a longer fading trail, with a soft bloom.
            const angularWidth = angle < 0 ? 0.065 : 0.24;
            const trail = Math.exp(-0.5 * (angle / angularWidth) ** 2);
            const core = Math.exp(-0.5 * (distance / 0.006) ** 2);
            const bloom = Math.exp(-0.5 * (distance / 0.022) ** 2);
            const index = (y * size + x) * 4;
            pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
            pixels[index + 3] = Math.round(
                255 * Math.min(1, trail * (core * 0.9 + bloom * 0.28))
            );
        }
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

/** One smooth speed cycle per revolution keeps the slow point fixed on the ring. */
export function sampleTravelGlowAngle(elapsedMs: number) {
    const turns = Math.max(0, elapsedMs) / 1000;
    const tau = Math.PI * 2;
    // Integrating this pulse keeps forward speed between 40% and 160%.
    return -turns * tau - 0.6 * Math.sin((turns % 1) * tau);
}
