import * as THREE from "three/webgpu";
import { cos, float, max, pass, screenUV, sin, vec2, vec4 } from "three/tsl";

// A light bloom written in core TSL (no addons): the scene pass, plus a ring
// of samples of its bright parts. Only highlights (sparkles, the sun on the
// water, lanterns) cross the threshold, so it reads as a soft glow.

export function createPost(renderer, scene, camera) {
    const post = new THREE.PostProcessing(renderer);
    const scenePass = pass(scene, camera);
    const color = scenePass.getTextureNode("output");
    const threshold = float(0.92);
    let glow = vec4(0, 0, 0, 0);
    let total = 0;
    for (const [radius, count, weight] of [
        [0.004, 6, 1],
        [0.011, 8, 0.7],
        [0.022, 10, 0.4],
    ]) {
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + radius * 100;
            const offset = vec2(cos(float(a)).mul(radius * 0.6), sin(float(a)).mul(radius));
            const s = color.sample(screenUV.add(offset));
            glow = glow.add(max(s.sub(threshold), 0).mul(weight));
            total += weight;
        }
    }
    const strength = float(0.85 / total);
    post.outputNode = vec4(color.rgb.add(glow.rgb.mul(strength)), color.a);
    return post;
}
