import * as THREE from "three/webgpu";
import { RING_RADIUS } from "./games.js";
import { DOJO_ISLE, heightAt } from "./terrain.js";
import { outline, toon } from "./toon.js";
import { labelPlane } from "./world.js";

// The Bump Dojo ring on its islet. (Bloom Dash has its own stage in
// racecourse.js.)

export const RING = { x: DOJO_ISLE.x, z: DOJO_ISLE.z, y: 1.75 };

export function buildDojo(scene) {
    const g = new THREE.Group();
    const base = heightAt(RING.x, RING.z);
    const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(
            RING_RADIUS + 0.4,
            RING_RADIUS + 0.9,
            RING.y - base + 0.2,
            36
        ),
        toon(0xd9a675)
    );
    plinth.position.set(RING.x, (RING.y + base) / 2 - 0.1, RING.z);
    outline(plinth, 0.05);
    plinth.receiveShadow = true;
    g.add(plinth);
    const mat = new THREE.Mesh(
        new THREE.CircleGeometry(RING_RADIUS + 0.35, 48).rotateX(-Math.PI / 2),
        toon(0xfff1d6)
    );
    mat.position.set(RING.x, RING.y + 0.01, RING.z);
    mat.receiveShadow = true;
    g.add(mat);
    const edge = new THREE.Mesh(
        new THREE.RingGeometry(
            RING_RADIUS - 0.1,
            RING_RADIUS + 0.1,
            48
        ).rotateX(-Math.PI / 2),
        toon(0xff5f7e)
    );
    edge.position.set(RING.x, RING.y + 0.02, RING.z);
    g.add(edge);
    const center = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 0.75, 32).rotateX(-Math.PI / 2),
        toon(0x7a3bd6)
    );
    center.position.set(RING.x, RING.y + 0.02, RING.z);
    g.add(center);
    // Lantern posts.
    const lanternMat = toon(0xffd36b, { emissive: 0xff9a3a });
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2; // none straight in front of the camera
        const x = RING.x + Math.cos(a) * (RING_RADIUS + 1.6);
        const z = RING.z + Math.sin(a) * (RING_RADIUS + 1.6);
        const y = heightAt(x, z);
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.1, 2.6, 8),
            toon(0x7a4a2a)
        );
        post.position.set(x, y + 1.3, z);
        g.add(post);
        const l = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 12, 10),
            lanternMat
        );
        l.position.set(x, y + 2.75, z);
        outline(l, 0.025);
        g.add(l);
    }
    const sign = labelPlane("BUMP DOJO", 6, 1.2, "#ffffff", "#7a3bd6");
    sign.position.set(RING.x, 4.4, RING.z - RING_RADIUS - 3);
    g.add(sign);
    scene.add(g);
    return { group: g };
}
