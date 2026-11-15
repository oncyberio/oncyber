import * as THREE from "three/webgpu";
import { color, float, length, mix, pass, screenUV, smoothstep, uniform, vec2, vec3, vec4 } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

// The frame after the scene: bloom on the hot things (the sun, the Wisp,
// embers, hoop glow, fireworks), a speed blur that pulls the screen's edges
// toward the centre as you go fast, a hit flash and a gentle vignette.

export function createPost(renderer, scene, camera) {
    const post = new THREE.PostProcessing(renderer);
    const scenePass = pass(scene, camera);
    const tex = scenePass.getTextureNode("output");
    const speed = uniform(0);
    const flash = uniform(0);
    const flashColor = uniform(new THREE.Color(1, 1, 1));
    // Radial speed blur: a few taps toward the centre, strongest at the edges.
    const center = vec2(0.5, 0.5);
    const off = screenUV.sub(center);
    const edge = smoothstep(0.18, 0.75, length(off.mul(vec2(1.4, 1))));
    let acc = tex.sample(screenUV).rgb;
    const taps = 6;
    for (let i = 1; i <= taps; i++) {
        const k = float((i / taps) * 0.06).mul(speed).mul(edge);
        acc = acc.add(tex.sample(screenUV.sub(off.mul(k))).rgb);
    }
    const blurred = acc.div(taps + 1);
    const glow = bloom(tex, 0.55, 0.45, 0.82);
    let rgb = blurred.add(glow.rgb);
    // Vignette.
    const v = smoothstep(1.15, 0.35, length(off.mul(vec2(1.25, 1.05))));
    rgb = rgb.mul(mix(float(0.72), float(1), v));
    rgb = mix(rgb, vec3(flashColor), flash.mul(0.55).mul(edge.mul(0.6).add(0.4)));
    post.outputNode = vec4(rgb, 1);
    return { post, speed, flash, flashColor, glow };
}

void color;
