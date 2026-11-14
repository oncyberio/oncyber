import * as THREE from "three/webgpu";
import { outline, toon } from "./toon.js";
import { CRITTERS } from "./sim.js";

// Small animals that live in the garden. Each is a few toon primitives with
// a hop/flap/swim idle; gifting one to a bloomling passes on its knack.

const dark = () => new THREE.MeshBasicNodeMaterial({ color: 0x15121f });

function eyes(parent, y, z, spread, r = 0.018) {
    const m = dark();
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
        e.position.set(s * spread, y, z);
        parent.add(e);
    }
}

function bit(geo, color, parent, x, y, z, w = 0.012) {
    const m = new THREE.Mesh(geo, toon(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    if (w) outline(m, w);
    parent.add(m);
    return m;
}

export function critterMesh(kind) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const c = CRITTERS[kind].color;
    const parts = {};
    if (kind === "hopper") {
        const b = bit(
            new THREE.SphereGeometry(0.11, 14, 10),
            c,
            body,
            0,
            0.11,
            0
        );
        b.scale.set(1, 0.9, 1.15);
        bit(new THREE.SphereGeometry(0.075, 12, 8), c, body, 0, 0.2, 0.08);
        parts.ears = [];
        for (const s of [-1, 1]) {
            const e = bit(
                new THREE.CapsuleGeometry(0.022, 0.09, 3, 8),
                c,
                body,
                s * 0.035,
                0.3,
                0.06,
                0.01
            );
            e.rotation.z = -s * 0.2;
            parts.ears.push(e);
        }
        bit(
            new THREE.SphereGeometry(0.035, 8, 6),
            0xffffff,
            body,
            0,
            0.12,
            -0.13,
            0.008
        );
        eyes(body, 0.22, 0.145, 0.035);
    } else if (kind === "tweet") {
        bit(new THREE.SphereGeometry(0.1, 14, 10), c, body, 0, 0.12, 0);
        bit(
            new THREE.ConeGeometry(0.025, 0.06, 6).rotateX(Math.PI / 2),
            0xffc23d,
            body,
            0,
            0.13,
            0.11,
            0.006
        );
        parts.wings = [];
        for (const s of [-1, 1]) {
            const w = bit(
                new THREE.SphereGeometry(0.05, 8, 6),
                0x3a9bdc,
                body,
                s * 0.09,
                0.12,
                -0.01,
                0.008
            );
            w.scale.set(0.4, 0.8, 1.1);
            parts.wings.push(w);
        }
        eyes(body, 0.16, 0.085, 0.04);
    } else if (kind === "fishlet") {
        const b = bit(
            new THREE.SphereGeometry(0.1, 14, 10),
            c,
            body,
            0,
            0.08,
            0
        );
        b.scale.set(0.7, 0.9, 1.3);
        const tail = bit(
            new THREE.ConeGeometry(0.07, 0.1, 4).rotateX(-Math.PI / 2),
            0xffd27a,
            body,
            0,
            0.08,
            -0.15,
            0.008
        );
        tail.scale.x = 0.3;
        parts.tail = tail;
        eyes(body, 0.11, 0.09, 0.05);
    } else if (kind === "digger") {
        const b = bit(
            new THREE.SphereGeometry(0.11, 14, 10),
            c,
            body,
            0,
            0.1,
            0
        );
        b.scale.set(1, 0.85, 1.2);
        bit(
            new THREE.SphereGeometry(0.035, 8, 6),
            0xff8fb1,
            body,
            0,
            0.11,
            0.13,
            0.008
        );
        for (const s of [-1, 1]) {
            const p = bit(
                new THREE.SphereGeometry(0.045, 8, 6),
                0xffd9c2,
                body,
                s * 0.1,
                0.05,
                0.08,
                0.008
            );
            p.scale.set(1.2, 0.5, 1);
        }
        eyes(body, 0.15, 0.115, 0.04, 0.012);
    } else {
        const shell = bit(
            new THREE.SphereGeometry(
                0.12,
                14,
                10,
                0,
                Math.PI * 2,
                0,
                Math.PI / 2
            ),
            0x3f8f4a,
            body,
            0,
            0.04,
            0
        );
        shell.scale.y = 0.75;
        bit(new THREE.SphereGeometry(0.05, 10, 8), c, body, 0, 0.06, 0.13);
        for (const [x, z] of [
            [-0.08, 0.07],
            [0.08, 0.07],
            [-0.08, -0.07],
            [0.08, -0.07],
        ])
            bit(
                new THREE.SphereGeometry(0.03, 8, 6),
                c,
                body,
                x,
                0.025,
                z,
                0.006
            );
        eyes(body, 0.08, 0.17, 0.022, 0.011);
    }
    return { group: g, body, parts, kind, phase: Math.random() * 10 };
}

/** Idle and travel animation; `moving` in m/s, `swim` for fish in water. */
export function animateCritter(c, dt, moving) {
    c.phase += dt;
    const t = c.phase;
    const b = c.body;
    b.position.y = 0;
    b.rotation.set(0, 0, 0);
    switch (c.kind) {
        case "hopper": {
            const hop = Math.abs(Math.sin(t * (moving ? 9 : 2)));
            b.position.y = moving ? hop * 0.14 : hop * 0.01;
            for (const e of c.parts.ears)
                e.rotation.x = -0.2 + Math.sin(t * 3) * 0.15;
            break;
        }
        case "tweet": {
            const flap = Math.sin(t * (moving ? 30 : 6));
            c.parts.wings[0].rotation.z = 0.4 + flap * 0.6;
            c.parts.wings[1].rotation.z = -0.4 - flap * 0.6;
            b.position.y = moving
                ? 0.25 + Math.sin(t * 4) * 0.08
                : Math.abs(Math.sin(t * 3)) * 0.03;
            break;
        }
        case "fishlet":
            c.parts.tail.rotation.y = Math.sin(t * 12) * 0.5;
            b.rotation.z = Math.sin(t * 2) * 0.1;
            break;
        case "digger":
            b.rotation.y = Math.sin(t * 1.5) * 0.4;
            b.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.03 : 0;
            break;
        default:
            b.position.y = moving ? Math.abs(Math.sin(t * 5)) * 0.015 : 0;
            b.rotation.z = Math.sin(t * 2.5) * (moving ? 0.08 : 0.02);
    }
}
