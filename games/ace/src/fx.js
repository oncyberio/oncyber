import * as THREE from "three";
import { BALL_RADIUS } from "./config.js";

// Juice: particles, ball trail, shadow, landing marker, bounce marks, rings.

const MAX_PARTICLES = 900;

function particleSystem() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_PARTICLES * 3);
    const col = new Float32Array(MAX_PARTICLES * 4);
    const size = new Float32Array(MAX_PARTICLES);
    const shape = new Float32Array(MAX_PARTICLES);
    geo.setAttribute(
        "position",
        new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)
    );
    geo.setAttribute(
        "color",
        new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage)
    );
    geo.setAttribute(
        "size",
        new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage)
    );
    geo.setAttribute(
        "shape",
        new THREE.BufferAttribute(shape, 1).setUsage(THREE.DynamicDrawUsage)
    );
    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { scale: { value: 600 } },
        vertexShader: /* glsl */ `
      attribute float size; attribute vec4 color; attribute float shape;
      uniform float scale;
      varying vec4 vColor; varying float vShape;
      void main() {
        vColor = color; vShape = shape;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(size * scale / -mv.z, 64.0);
        gl_Position = projectionMatrix * mv;
      }`,
        fragmentShader: /* glsl */ `
      varying vec4 vColor; varying float vShape;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float a;
        if (vShape > 1.5) {
          // Four-point sparkle.
          float d = min(abs(p.x), abs(p.y)) * 4.0 + length(p) * 0.9;
          a = 1.0 - smoothstep(0.55, 1.0, d);
        } else if (vShape > 0.5) {
          // Five-point star.
          float ang = atan(p.y, p.x);
          float r = length(p);
          float k = 0.55 + 0.45 * pow(abs(cos(2.5 * ang)), 2.0);
          a = 1.0 - smoothstep(k * 0.85, k, r);
        } else {
          float r = length(p);
          a = 1.0 - smoothstep(0.6, 1.0, r);
        }
        if (a * vColor.a < 0.01) discard;
        gl_FragColor = vec4(vColor.rgb, a * vColor.a);
      }`,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 5;
    const list = [];
    for (let i = 0; i < MAX_PARTICLES; i++) list.push({ life: 0 });
    return { points, list, cursor: 0, geo };
}

function trailMesh() {
    const N = 26;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(
            THREE.DynamicDrawUsage
        )
    );
    geo.setAttribute(
        "alpha",
        new THREE.BufferAttribute(new Float32Array(N * 2), 1).setUsage(
            THREE.DynamicDrawUsage
        )
    );
    const idx = [];
    for (let i = 0; i < N - 1; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
            color: { value: new THREE.Color(0xff5a3c) },
            strength: { value: 1 },
        },
        vertexShader: /* glsl */ `
      attribute float alpha; varying float vA;
      void main() { vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
      uniform vec3 color; uniform float strength; varying float vA;
      void main() { gl_FragColor = vec4(color * strength, vA); }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    return { mesh, N, pts: [], width: 0.09 };
}

function discTexture(inner = 0, ring = false) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, inner, 64, 64, 64);
    if (ring) {
        g.strokeStyle = "#fff";
        g.lineWidth = 12;
        g.beginPath();
        g.arc(64, 64, 52, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = "rgba(255,255,255,0.25)";
        g.beginPath();
        g.arc(64, 64, 46, 0, Math.PI * 2);
        g.fill();
    } else {
        grd.addColorStop(0, "rgba(0,0,0,1)");
        grd.addColorStop(0.6, "rgba(0,0,0,0.6)");
        grd.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grd;
        g.fillRect(0, 0, 128, 128);
    }
    const t = new THREE.CanvasTexture(c);
    return t;
}

function haloTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,0.9)");
    grd.addColorStop(0.35, "rgba(255,255,255,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}

function ballTexture() {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#e4ff3a";
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 9;
    g.beginPath();
    for (let x = 0; x <= 256; x += 4) {
        const y = 64 + Math.sin((x / 256) * Math.PI * 4) * 34;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
    }
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export function createFx(scene) {
    const fx = { scene, time: 0 };
    fx.particles = particleSystem();
    scene.add(fx.particles.points);
    fx.trail = trailMesh();
    scene.add(fx.trail.mesh);

    const ball = new THREE.Mesh(
        new THREE.SphereGeometry(BALL_RADIUS * 2.3, 20, 14),
        new THREE.MeshToonMaterial({ map: ballTexture(), emissive: 0x3a4a00 })
    );
    ball.castShadow = true;
    scene.add(ball);
    fx.ball = ball;
    // The ball is visually oversized (toy scale) for readability; an outline helps too.
    const ballGlow = new THREE.Mesh(
        new THREE.SphereGeometry(BALL_RADIUS * 2.75, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x1d1a2e, side: THREE.BackSide })
    );
    ball.add(ballGlow);
    // Soft halo so the ball reads against crowd and court at any distance.
    const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: haloTexture(),
            color: 0xf4ff9a,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            opacity: 0.55,
        })
    );
    halo.scale.set(0.42, 0.42, 1);
    ball.add(halo);

    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
            map: discTexture(),
            transparent: true,
            depthWrite: false,
            opacity: 0.5,
        })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 2;
    scene.add(shadow);
    fx.shadow = shadow;

    const ringTex = discTexture(0, true);
    const marker = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
            map: ringTex,
            transparent: true,
            depthWrite: false,
            color: 0xffe14d,
        })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.012;
    marker.renderOrder = 3;
    marker.visible = false;
    scene.add(marker);
    fx.marker = marker;

    // Aim reticle on the far court while charging.
    const aim = marker.clone();
    aim.material = marker.material.clone();
    aim.material.color.set(0xffffff);
    aim.material.opacity = 0.85;
    aim.visible = false;
    scene.add(aim);
    fx.aim = aim;

    fx.marks = [];
    for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({
                map: discTexture(),
                transparent: true,
                depthWrite: false,
                opacity: 0,
                color: 0xffffff,
            })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.008;
        m.renderOrder = 2;
        m.userData.life = 0;
        scene.add(m);
        fx.marks.push(m);
    }
    fx.markCursor = 0;

    fx.rings = [];
    for (let i = 0; i < 8; i++) {
        const r = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({
                map: ringTex,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            })
        );
        r.visible = false;
        r.userData = { life: 0, max: 0.3, size: 1, flat: false };
        r.renderOrder = 6;
        scene.add(r);
        fx.rings.push(r);
    }
    fx.ringCursor = 0;
    return fx;
}

const color = new THREE.Color();

export function emitParticle(fx, p) {
    const ps = fx.particles;
    const slot = ps.list[ps.cursor];
    ps.cursor = (ps.cursor + 1) % MAX_PARTICLES;
    Object.assign(slot, {
        x: p.x,
        y: p.y,
        z: p.z,
        vx: p.vx || 0,
        vy: p.vy || 0,
        vz: p.vz || 0,
        life: p.life || 0.6,
        max: p.life || 0.6,
        size: p.size || 0.2,
        grow: p.grow ?? -0.5,
        g: p.gravity ?? 0,
        drag: p.drag ?? 2,
        color: p.color ?? 0xffffff,
        shape: p.shape || 0,
        alpha: p.alpha ?? 1,
        spin: p.spin || 0,
    });
}

/** A burst of stars and sparks at contact. */
export function hitBurst(fx, at, tint, big = false) {
    const n = big ? 34 : 16;
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const b = (Math.random() - 0.5) * Math.PI;
        const sp = (big ? 6 : 4) * (0.4 + Math.random());
        emitParticle(fx, {
            x: at.x,
            y: at.y,
            z: at.z,
            vx: Math.cos(a) * Math.cos(b) * sp,
            vy: Math.sin(b) * sp + 1,
            vz: Math.sin(a) * Math.cos(b) * sp,
            life: 0.35 + Math.random() * 0.35,
            size: (big ? 0.28 : 0.2) * (0.6 + Math.random()),
            color: i % 3 === 0 ? 0xffffff : tint,
            shape: i % 2 ? 1 : 2,
            drag: 5,
            gravity: -4,
        });
    }
    ring(fx, at, tint, big ? 2.6 : 1.4, big ? 0.32 : 0.22, false);
    if (big) ring(fx, at, 0xffffff, 4.2, 0.4, false);
}

export function dustPuff(fx, x, z, strength = 1, tint = 0xd6e4ff) {
    const n = Math.round(6 + strength * 8);
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const sp = 0.8 + Math.random() * 1.4 * strength;
        emitParticle(fx, {
            x,
            y: 0.05,
            z,
            vx: Math.cos(a) * sp,
            vy: 0.4 + Math.random() * 0.8,
            vz: Math.sin(a) * sp,
            life: 0.45 + Math.random() * 0.3,
            size: 0.18 + Math.random() * 0.14,
            grow: 0.9,
            color: tint,
            alpha: 0.7,
            drag: 4,
            gravity: -0.5,
        });
    }
}

export function ring(fx, at, tint, size, life, flat) {
    const r = fx.rings[fx.ringCursor];
    fx.ringCursor = (fx.ringCursor + 1) % fx.rings.length;
    r.visible = true;
    r.position.copy(at);
    r.material.color.setHex(tint);
    r.userData = { life, max: life, size, flat };
    r.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
}

export function bounceMark(fx, x, z, out) {
    const m = fx.marks[fx.markCursor];
    fx.markCursor = (fx.markCursor + 1) % fx.marks.length;
    m.position.set(x, 0.008 + fx.markCursor * 0.0003, z);
    m.scale.set(0.22, 0.34, 1);
    m.material.color.setHex(out ? 0xff4d5e : 0x0d1a40);
    m.userData.life = out ? 3 : 1.6;
    m.userData.max = m.userData.life;
}

export function confetti(fx, center, count = 160) {
    const tints = [0xff4d5e, 0x3d7bff, 0xffd23c, 0x2bd17e, 0xff8ad8, 0xffffff];
    for (let i = 0; i < count; i++) {
        emitParticle(fx, {
            x: center.x + (Math.random() - 0.5) * 8,
            y: center.y + Math.random() * 3,
            z: center.z + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 6,
            vy: 4 + Math.random() * 7,
            vz: (Math.random() - 0.5) * 6,
            life: 2.2 + Math.random() * 1.5,
            size: 0.2 + Math.random() * 0.12,
            grow: 0,
            color: tints[i % tints.length],
            shape: i % 3 === 0 ? 1 : 0,
            drag: 1.2,
            gravity: -5,
        });
    }
}

export function setTrail(fx, tint, strength, width) {
    fx.trail.mesh.material.uniforms.color.value.setHex(tint);
    fx.trail.mesh.material.uniforms.strength.value = strength;
    fx.trail.width = width;
}

export function resetTrail(fx) {
    fx.trail.pts.length = 0;
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();

export function updateFx(fx, dt, camera, ballPos, ballVisible) {
    fx.time += dt;
    // Particles.
    const ps = fx.particles;
    const pos = ps.geo.attributes.position.array;
    const col = ps.geo.attributes.color.array;
    const size = ps.geo.attributes.size.array;
    const shape = ps.geo.attributes.shape.array;
    for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = ps.list[i];
        if (p.life > 0) {
            p.life -= dt;
            const k = Math.exp(-p.drag * dt);
            p.vx *= k;
            p.vy = p.vy * k + p.g * dt;
            p.vz *= k;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            if (p.y < 0.02) {
                p.y = 0.02;
                p.vy = Math.abs(p.vy) * 0.3;
            }
            const t = Math.max(0, p.life / p.max);
            pos[i * 3] = p.x;
            pos[i * 3 + 1] = p.y;
            pos[i * 3 + 2] = p.z;
            color.setHex(p.color);
            col[i * 4] = color.r;
            col[i * 4 + 1] = color.g;
            col[i * 4 + 2] = color.b;
            col[i * 4 + 3] = p.alpha * Math.min(1, t * 3);
            size[i] = Math.max(0, p.size * (1 + p.grow * (1 - t)));
            shape[i] = p.shape;
        } else {
            size[i] = 0;
            col[i * 4 + 3] = 0;
        }
    }
    ps.geo.attributes.position.needsUpdate = true;
    ps.geo.attributes.color.needsUpdate = true;
    ps.geo.attributes.size.needsUpdate = true;
    ps.geo.attributes.shape.needsUpdate = true;
    ps.points.material.uniforms.scale.value =
        window.innerHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));

    // Ball, shadow.
    fx.ball.visible = ballVisible;
    fx.shadow.visible = ballVisible;
    if (ballVisible) {
        fx.ball.position.set(ballPos.x, ballPos.y, ballPos.z);
        const h = ballPos.y;
        const s = 0.16 + Math.min(0.25, h * 0.04);
        fx.shadow.scale.set(s, s, 1);
        fx.shadow.position.set(ballPos.x, 0.01, ballPos.z);
        fx.shadow.material.opacity = Math.max(0.12, 0.55 - h * 0.08);
    }

    // Trail: a camera-facing ribbon through recent positions.
    const tr = fx.trail;
    if (ballVisible) {
        tr.pts.unshift(new THREE.Vector3(ballPos.x, ballPos.y, ballPos.z));
        if (tr.pts.length > tr.N) tr.pts.pop();
    } else tr.pts.length = 0;
    const tpos = tr.mesh.geometry.attributes.position.array;
    const talpha = tr.mesh.geometry.attributes.alpha.array;
    for (let i = 0; i < tr.N; i++) {
        const p = tr.pts[Math.min(i, tr.pts.length - 1)];
        if (!p) {
            talpha[i * 2] = talpha[i * 2 + 1] = 0;
            continue;
        }
        const next = tr.pts[Math.min(i + 1, tr.pts.length - 1)];
        const prev = tr.pts[Math.max(Math.min(i, tr.pts.length - 1) - 1, 0)];
        v1.copy(prev).sub(next);
        v2.copy(p).sub(camera.position);
        v3.crossVectors(v1, v2).normalize();
        const t = 1 - i / (tr.N - 1);
        const w = tr.width * t;
        tpos[i * 6] = p.x + v3.x * w;
        tpos[i * 6 + 1] = p.y + v3.y * w;
        tpos[i * 6 + 2] = p.z + v3.z * w;
        tpos[i * 6 + 3] = p.x - v3.x * w;
        tpos[i * 6 + 4] = p.y - v3.y * w;
        tpos[i * 6 + 5] = p.z - v3.z * w;
        const valid = i < tr.pts.length ? 1 : 0;
        talpha[i * 2] = talpha[i * 2 + 1] = valid * t * t * 0.9;
    }
    tr.mesh.geometry.attributes.position.needsUpdate = true;
    tr.mesh.geometry.attributes.alpha.needsUpdate = true;

    // Marks and rings.
    for (const m of fx.marks) {
        if (m.userData.life > 0) {
            m.userData.life -= dt;
            m.material.opacity = Math.min(
                0.55,
                (m.userData.life / m.userData.max) * 0.9
            );
        } else m.material.opacity = 0;
    }
    for (const r of fx.rings) {
        if (!r.visible) continue;
        r.userData.life -= dt;
        if (r.userData.life <= 0) {
            r.visible = false;
            continue;
        }
        const t = 1 - r.userData.life / r.userData.max;
        // Keep rings a similar size on screen whether near or far from the camera.
        const dist = r.position.distanceTo(camera.position);
        const s =
            r.userData.size *
            Math.min(1.4, Math.max(0.35, dist / 16)) *
            (0.2 + 0.8 * (1 - Math.pow(1 - t, 3)));
        r.scale.set(s, s, s);
        r.material.opacity = (1 - t) * 0.8;
        if (!r.userData.flat) r.quaternion.copy(camera.quaternion);
    }
}
