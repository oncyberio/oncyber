import * as THREE from "three/webgpu";
import { abs, color, float, mix, normalLocal, pow, sin, smoothstep, uniform, uv, vec3, cos, length, max } from "three/tsl";
import { BOLT_R, COMET_R } from "./sim.js";

// The three kinds of ball. The Comet is stitched leather with seams that
// glow ember-hot as it flies; the Bolts are riveted iron with a dull red
// heart; the Wisp is a hot white-gold spark with two beating wings. Each
// carries a soft additive halo so you can find it from across the bowl.

function halo(colorHex, size, strength) {
    const mat = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const d = length(uv().sub(0.5)).mul(2);
    const level = uniform(strength);
    mat.colorNode = color(colorHex).mul(pow(max(float(1).sub(d), 0), float(2.2))).mul(level);
    mat.fog = false;
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(size);
    s.renderOrder = 5;
    s.userData.level = level;
    return s;
}

export function createBalls(time) {
    const group = new THREE.Group();

    // The Comet.
    const heat = uniform(0);
    const cometMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.55, metalness: 0 });
    const n = normalLocal;
    const seamA = smoothstep(0.06, 0.0, abs(n.y.add(sin(n.x.mul(3.2)).mul(0.35))));
    const seamB = smoothstep(0.06, 0.0, abs(n.x.add(cos(n.z.mul(3.2)).mul(0.35))));
    const seam = max(seamA, seamB);
    cometMat.colorNode = mix(color(0x9c2a17), color(0xf3dcb0), seam);
    cometMat.emissiveNode = color(0xff6a1a).mul(seam.mul(heat.mul(6).add(0.6))).add(color(0xff3b10).mul(heat.mul(0.25)));
    const comet = new THREE.Mesh(new THREE.SphereGeometry(COMET_R, 32, 20), cometMat);
    comet.castShadow = true;
    const cometHalo = halo(0xff7a2a, 3.2, 0.5);
    group.add(comet, cometHalo);

    // Bolts.
    const boltMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.38, metalness: 0.95 });
    const rivets = smoothstep(0.82, 0.9, abs(sin(n.x.mul(9))).mul(abs(sin(n.y.mul(9)))).mul(abs(sin(n.z.mul(9)))).add(0.85));
    boltMat.colorNode = mix(color(0x2c2d33), color(0x5c5e66), rivets);
    const glow = uniform(0.4);
    boltMat.emissiveNode = color(0xff2a12).mul(smoothstep(0.92, 1.0, abs(sin(n.y.mul(14).add(time.mul(3))))).mul(glow));
    const bolts = [0, 1].map(() => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(BOLT_R, 28, 18), boltMat);
        m.castShadow = true;
        group.add(m);
        const h = halo(0xff3a1a, 1.8, 0.18);
        group.add(h);
        return { mesh: m, halo: h };
    });

    // The Wisp: a core, a corona and two wings.
    const wisp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(9, 7, 3.4) }));
    const corona = halo(0xffd27a, 2.6, 1.2);
    const wingMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const wd = length(uv().sub(vec3(0.5, 0.5, 0).xy).mul(vec3(1.0, 2.2, 0).xy));
    wingMat.colorNode = color(0xfff0c4).mul(smoothstep(0.5, 0.1, wd)).mul(2.2);
    const wingGeo = new THREE.PlaneGeometry(0.62, 0.3);
    wingGeo.translate(0.34, 0, 0);
    const wings = [1, -1].map((s) => {
        const w = new THREE.Mesh(wingGeo, wingMat);
        w.scale.x = s;
        wisp.add(w);
        return w;
    });
    wisp.add(core, corona);
    wisp.visible = false;
    group.add(wisp);

    const q = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    return {
        group,
        comet,
        bolts,
        wisp,
        update(m, dt, t, cameraPos) {
            const c = m.comet;
            comet.position.set(c.pos.x, c.pos.y, c.pos.z);
            const speed = Math.hypot(c.vel.x, c.vel.y, c.vel.z);
            // Roll about the axis across its flight.
            if (speed > 0.5) {
                axis.set(c.vel.z, 0, -c.vel.x).normalize();
                q.setFromAxisAngle(axis, (speed * dt) / COMET_R);
                comet.quaternion.premultiply(q);
            }
            const held = c.holder >= 0;
            heat.value += ((held ? 0.05 : Math.min(1, speed / 38)) - heat.value) * Math.min(1, dt * 6);
            cometHalo.position.copy(comet.position);
            // Bigger from far away so it reads across the pitch.
            const far = cameraPos.distanceTo(comet.position);
            cometHalo.scale.setScalar(2.2 + far * 0.035 + heat.value * 1.5);
            cometHalo.userData.level.value = 0.35 + heat.value * 0.9;
            m.bolts.forEach((b, i) => {
                const B = bolts[i];
                B.mesh.position.set(b.pos.x, b.pos.y, b.pos.z);
                B.mesh.rotation.x += dt * 4;
                B.mesh.rotation.y += dt * 3;
                B.halo.position.copy(B.mesh.position);
                B.halo.scale.setScalar(1.5 + cameraPos.distanceTo(B.mesh.position) * 0.02);
            });
            glow.value = 0.5 + Math.sin(t * 5) * 0.2;
            const w = m.wisp;
            wisp.visible = w.active;
            if (w.active) {
                wisp.position.set(w.pos.x, w.pos.y, w.pos.z);
                wisp.lookAt(w.pos.x + w.vel.x, w.pos.y + w.vel.y, w.pos.z + w.vel.z);
                const flap = Math.sin(t * 46) * 0.9;
                wings[0].rotation.y = flap;
                wings[1].rotation.y = -flap;
                corona.scale.setScalar(1.6 + Math.sin(t * 13) * 0.3 + cameraPos.distanceTo(wisp.position) * 0.02);
            }
        },
    };
}

