import * as THREE from "three/webgpu";
import { outline, toon } from "./toon.js";

// Bloomlings: a big round head, a little pear body, stubby limbs and a leaf
// sprout on top. Parts grow in from gifts (ears, wings, fins, paws, shell)
// and adults take on their alignment (Sunny petal ring, Shade horns).
// Everything is procedural and posed per frame from a small action state.

const INK = 0x1d1a2e;
const tmpC = new THREE.Color();

function mixHex(a, b, t) {
    return tmpC.setHex(a).lerp(new THREE.Color(b), t).getHex();
}

export function bodyColor(look) {
    let c = look.tint ?? look.color;
    if (look.stage === "adult" && look.align === "shade")
        c = mixHex(c, 0x3c2f63, 0.5);
    if (look.stage === "adult" && look.align === "sunny")
        c = mixHex(c, 0xfff6e0, 0.35);
    return c;
}

export function orbColor(align) {
    return align === "sunny"
        ? 0xffe066
        : align === "shade"
        ? 0xff4f9a
        : 0x7fe3ff;
}

// ------------------------------------------------------------- orb shapes

const orbGeos = {};
function orbGeometry(kind) {
    if (orbGeos[kind]) return orbGeos[kind];
    let g;
    const extrude = (shape, depth = 0.05) => {
        const geo = new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.02,
            bevelSegments: 3,
            curveSegments: 10,
        });
        geo.center();
        return geo;
    };
    if (kind === "heart") {
        const s = new THREE.Shape();
        s.moveTo(0, -0.09);
        s.bezierCurveTo(-0.02, -0.06, -0.12, -0.01, -0.12, 0.05);
        s.bezierCurveTo(-0.12, 0.11, -0.04, 0.12, 0, 0.07);
        s.bezierCurveTo(0.04, 0.12, 0.12, 0.11, 0.12, 0.05);
        s.bezierCurveTo(0.12, -0.01, 0.02, -0.06, 0, -0.09);
        g = extrude(s);
    } else if (kind === "question") {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-0.07, 0.07, 0),
            new THREE.Vector3(-0.04, 0.12, 0),
            new THREE.Vector3(0.04, 0.12, 0),
            new THREE.Vector3(0.07, 0.06, 0),
            new THREE.Vector3(0.02, 0.0, 0),
            new THREE.Vector3(0.0, -0.04, 0),
        ]);
        const tube = new THREE.TubeGeometry(curve, 24, 0.025, 8);
        const dot = new THREE.SphereGeometry(0.032, 10, 8).translate(
            0,
            -0.11,
            0
        );
        g = mergeGeos([tube, dot]);
    } else if (kind === "alert") {
        const bar = new THREE.CapsuleGeometry(0.03, 0.12, 4, 10).translate(
            0,
            0.04,
            0
        );
        const dot = new THREE.SphereGeometry(0.034, 10, 8).translate(
            0,
            -0.1,
            0
        );
        g = mergeGeos([bar, dot]);
    } else if (kind === "swirl") {
        const pts = [];
        for (let i = 0; i <= 40; i++) {
            const a = (i / 40) * Math.PI * 4;
            const r = 0.015 + (i / 40) * 0.1;
            pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
        }
        g = new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(pts),
            60,
            0.02,
            6
        );
    } else if (kind === "zzz") {
        const z = (s, x, y) => {
            const sh = new THREE.Shape();
            sh.moveTo(-s, s);
            sh.lineTo(s, s);
            sh.lineTo(s, s * 0.6);
            sh.lineTo(-s * 0.3, -s * 0.6);
            sh.lineTo(s, -s * 0.6);
            sh.lineTo(s, -s);
            sh.lineTo(-s, -s);
            sh.lineTo(-s, -s * 0.6);
            sh.lineTo(s * 0.3, s * 0.6);
            sh.lineTo(-s, s * 0.6);
            const geo = new THREE.ExtrudeGeometry(sh, {
                depth: 0.02,
                bevelEnabled: false,
            });
            geo.translate(x, y, 0);
            return geo;
        };
        g = mergeGeos([z(0.05, -0.05, -0.04), z(0.035, 0.05, 0.06)]);
        g.center();
    } else {
        g = new THREE.SphereGeometry(0.075, 16, 12);
    }
    orbGeos[kind] = g;
    return g;
}

function mergeGeos(list) {
    // Tiny merge for non-indexed + indexed mixes: convert all to non-indexed.
    const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
    let count = 0;
    for (const p of parts) count += p.attributes.position.count;
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    let o = 0;
    for (const p of parts) {
        pos.set(p.attributes.position.array, o * 3);
        nor.set(p.attributes.normal.array, o * 3);
        o += p.attributes.position.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    return g;
}

export function createOrb() {
    const mat = toon(0x7fe3ff, { emissive: 0x2a6f88, unique: true });
    const mesh = new THREE.Mesh(orbGeometry("ball"), mat);
    const group = new THREE.Group();
    group.add(mesh);
    return { group, mesh, mat, kind: "ball", pop: 0, color: 0x7fe3ff };
}

export function setOrb(orb, kind, color) {
    if (kind !== orb.kind) {
        orb.kind = kind;
        orb.pop = 1;
        orb.mesh.visible = kind !== "none";
        if (kind !== "none") orb.mesh.geometry = orbGeometry(kind);
    }
    let c = color;
    if (kind === "heart") c = 0xff5f9e;
    else if (kind === "swirl") c = 0x9aa0c8;
    else if (kind === "alert") c = 0xffd23f;
    else if (kind === "zzz") c = 0xbfd6ff;
    if (c !== orb.color) {
        orb.color = c;
        orb.mat.color.setHex(c);
        orb.mat.emissive.setHex(c).multiplyScalar(0.55);
    }
}

// ------------------------------------------------------------- body

function part(geo, mat, parent, x = 0, y = 0, z = 0, w = 0.018) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (w) outline(m, w, INK);
    parent.add(m);
    return m;
}

function leafGeo(len, wid) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.quadraticCurveTo(wid, len * 0.5, 0, len);
    s.quadraticCurveTo(-wid, len * 0.5, 0, 0);
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.012,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 2,
    });
    g.translate(0, 0, -0.006);
    return g;
}

/**
 * Build a bloomling. Returns a handle with `root` (place it in the world),
 * `orb` (added to the scene separately so it floats freely) and pose state.
 */
export function createBloomling(look) {
    const root = new THREE.Group();
    const body = new THREE.Group(); // bob, lean, squash
    root.add(body);
    const skin = toon(0xffffff, { unique: true });
    const belly = toon(0xffffff, { unique: true });
    const dark = new THREE.MeshBasicNodeMaterial({ color: 0x15121f });
    const white = new THREE.MeshBasicNodeMaterial({ color: 0xffffff });
    const cheekMat = toon(0xff8fb1, { emissive: 0x5a1a2a });
    const accent = toon(0xffffff, { unique: true });

    const torso = part(
        new THREE.SphereGeometry(0.17, 18, 14),
        skin,
        body,
        0,
        0.2,
        0
    );
    torso.scale.set(1, 1.08, 0.95);
    const tummy = part(
        new THREE.SphereGeometry(0.12, 14, 10),
        belly,
        torso,
        0,
        -0.01,
        0.07,
        0
    );
    tummy.scale.set(1, 1.05, 0.6);

    const head = new THREE.Group();
    head.position.y = 0.47;
    body.add(head);
    const skull = part(
        new THREE.SphereGeometry(0.25, 24, 18),
        skin,
        head,
        0,
        0,
        0,
        0.02
    );
    skull.scale.set(1.1, 0.95, 1);

    // Eyes: glossy ovals, with happy arcs and closed lines swapped in.
    const eyes = [];
    for (const s of [-1, 1]) {
        const eye = new THREE.Group();
        eye.position.set(s * 0.095, 0.02, 0.215);
        eye.rotation.y = s * 0.28;
        head.add(eye);
        const ball = new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 14, 10),
            dark
        );
        ball.scale.set(0.78, 1.15, 0.45);
        eye.add(ball);
        const shine = new THREE.Mesh(
            new THREE.SphereGeometry(0.018, 8, 6),
            white
        );
        shine.position.set(-s * 0.012 + 0.008, 0.025, 0.022);
        eye.add(shine);
        const shine2 = new THREE.Mesh(
            new THREE.SphereGeometry(0.008, 6, 4),
            white
        );
        shine2.position.set(0.012, -0.022, 0.022);
        eye.add(shine2);
        const arc = new THREE.Mesh(
            new THREE.TorusGeometry(0.035, 0.011, 6, 12, Math.PI),
            dark
        );
        arc.position.set(0, -0.01, 0.02);
        arc.visible = false;
        eye.add(arc);
        const line = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.009, 0.05, 3, 6),
            dark
        );
        line.rotation.z = Math.PI / 2;
        line.position.z = 0.02;
        line.visible = false;
        eye.add(line);
        eyes.push({ eye, ball, shine, shine2, arc, line });
        const cheek = new THREE.Mesh(
            new THREE.CircleGeometry(0.035, 12),
            cheekMat
        );
        cheek.position.set(s * 0.165, -0.065, 0.19);
        cheek.rotation.y = s * 0.7;
        head.add(cheek);
    }
    const mouthSmile = new THREE.Mesh(
        new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI),
        dark
    );
    mouthSmile.rotation.z = Math.PI;
    mouthSmile.position.set(0, -0.06, 0.238);
    head.add(mouthSmile);
    const mouthOpen = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 10, 8),
        toon(0xc2324f)
    );
    mouthOpen.scale.set(1, 0.8, 0.4);
    mouthOpen.position.set(0, -0.07, 0.232);
    mouthOpen.visible = false;
    head.add(mouthOpen);

    // Leaf sprout.
    const sprout = new THREE.Group();
    sprout.position.set(0, 0.22, 0);
    head.add(sprout);
    const stem = part(
        new THREE.CylinderGeometry(0.012, 0.02, 0.09, 6),
        accent,
        sprout,
        0,
        0.04,
        0,
        0.012
    );
    void stem;
    const leaves = [];
    for (const s of [-1, 1]) {
        const l = part(leafGeo(0.14, 0.06), accent, sprout, 0, 0.08, 0, 0.012);
        l.rotation.z = -s * 0.9;
        leaves.push(l);
    }

    // Limbs.
    const arms = [];
    for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.14, 0.27, 0.02);
        body.add(pivot);
        const arm = part(
            new THREE.CapsuleGeometry(0.04, 0.06, 4, 8),
            skin,
            pivot,
            s * 0.05,
            -0.04,
            0,
            0.015
        );
        arm.rotation.z = s * 1.0;
        const paw = part(
            new THREE.SphereGeometry(0.045, 10, 8),
            skin,
            pivot,
            s * 0.1,
            -0.08,
            0.01,
            0.015
        );
        arms.push({ pivot, arm, paw, s });
    }
    const feet = [];
    for (const s of [-1, 1]) {
        const f = part(
            new THREE.SphereGeometry(0.065, 12, 8),
            skin,
            root,
            s * 0.085,
            0.04,
            0.02,
            0.016
        );
        f.scale.set(0.85, 0.6, 1.25);
        feet.push({ mesh: f, s });
    }
    const tail = part(
        new THREE.SphereGeometry(0.05, 10, 8),
        accent,
        body,
        0,
        0.15,
        -0.16,
        0.014
    );

    // Optional parts.
    const ears = [];
    for (const s of [-1, 1]) {
        const e = part(
            new THREE.CapsuleGeometry(0.04, 0.2, 4, 10),
            skin,
            head,
            s * 0.12,
            0.2,
            -0.04,
            0.014
        );
        e.geometry.translate(0, 0.12, 0);
        e.rotation.z = -s * 0.35;
        const inner = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.022, 0.16, 3, 8),
            cheekMat
        );
        inner.geometry.translate(0, 0.12, 0);
        inner.position.z = 0.022;
        e.add(inner);
        ears.push(e);
    }
    const wings = [];
    for (const s of [-1, 1]) {
        const w = new THREE.Group();
        w.position.set(s * 0.1, 0.3, -0.12);
        body.add(w);
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.bezierCurveTo(0.08, 0.12, 0.26, 0.14, 0.28, 0.05);
        shape.bezierCurveTo(0.2, 0.04, 0.22, -0.02, 0.15, -0.03);
        shape.bezierCurveTo(0.12, -0.08, 0.04, -0.06, 0, 0);
        const geo = new THREE.ExtrudeGeometry(shape, {
            depth: 0.015,
            bevelEnabled: true,
            bevelThickness: 0.008,
            bevelSize: 0.008,
            bevelSegments: 2,
        });
        if (s < 0) geo.scale(-1, 1, 1);
        const m = part(geo, accent, w, 0, 0, 0, 0.012);
        m.rotation.y = s * -0.5;
        wings.push(w);
    }
    const fins = [];
    for (const s of [-1, 1]) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(0.13, 0.07);
        shape.lineTo(0.1, 0.0);
        shape.lineTo(0.14, -0.06);
        shape.lineTo(0, -0.03);
        const geo = new THREE.ExtrudeGeometry(shape, {
            depth: 0.012,
            bevelEnabled: true,
            bevelThickness: 0.006,
            bevelSize: 0.006,
            bevelSegments: 1,
        });
        if (s < 0) geo.scale(-1, 1, 1);
        const f = part(geo, accent, head, s * 0.24, 0.0, -0.02, 0.01);
        f.rotation.y = s * 0.5;
        fins.push(f);
    }
    const shell = part(
        new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        toon(0x5fb862, { unique: true }),
        body,
        0,
        0.22,
        -0.1,
        0.016
    );
    shell.rotation.x = -Math.PI / 2 + 0.1;
    shell.scale.set(1, 1, 0.55);

    // Adult alignment features.
    const halo = new THREE.Group();
    halo.position.y = 0.27;
    halo.rotation.x = 0.25;
    head.add(halo);
    const haloMat = toon(0xffe27a, { emissive: 0xb88a1a });
    for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(leafGeo(0.09, 0.045), haloMat);
        outline(p, 0.008, INK);
        const a = (i / 6) * Math.PI * 2;
        p.position.set(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15);
        p.rotation.set(Math.PI / 2, 0, -a + Math.PI / 2);
        halo.add(p);
    }
    const horns = [];
    for (const s of [-1, 1]) {
        const geo = new THREE.ConeGeometry(0.045, 0.15, 8).translate(
            0,
            0.075,
            0
        );
        const h = part(geo, toon(0x2a1f45), head, s * 0.14, 0.17, 0.05, 0.012);
        h.rotation.z = -s * 0.55;
        horns.push(h);
    }

    // Egg and cocoon shells.
    const eggMat = toon(0xffffff, { unique: true });
    const egg = part(
        new THREE.SphereGeometry(0.2, 20, 16),
        eggMat,
        root,
        0,
        0.24,
        0,
        0.02
    );
    egg.scale.set(1, 1.28, 1);
    const spots = toon(0xffffff, { unique: true });
    for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(
            new THREE.CircleGeometry(0.035 + (i % 3) * 0.01, 10),
            spots
        );
        const a = i * 1.7;
        const y = -0.05 + (i % 3) * 0.08;
        sp.position.set(Math.cos(a) * 0.203, y, Math.sin(a) * 0.203);
        sp.lookAt(sp.position.clone().multiplyScalar(2));
        egg.add(sp);
    }
    const cocoon = part(
        new THREE.SphereGeometry(0.34, 20, 16),
        toon(0xffffff, { emissive: 0x6a6a7a, unique: true }),
        root,
        0,
        0.36,
        0,
        0.02
    );
    cocoon.scale.set(1, 1.25, 1);
    cocoon.visible = false;

    const handle = {
        root,
        body,
        head,
        skull,
        torso,
        eyes,
        mouthSmile,
        mouthOpen,
        sprout,
        leaves,
        arms,
        feet,
        tail,
        ears,
        wings,
        fins,
        shell,
        halo,
        horns,
        egg,
        eggMat,
        spots,
        cocoon,
        mats: { skin, belly, accent, shellMat: shell.material },
        orb: createOrb(),
        phase: Math.random() * 10,
        blink: 2 + Math.random() * 3,
        look: null,
        scale: 1,
        orbPos: new THREE.Vector3(),
        squash: 0,
    };
    setLook(handle, look);
    return handle;
}

export function setLook(h, look) {
    h.look = look;
    const stage = look.stage;
    const col = bodyColor(look);
    h.mats.skin.color.setHex(col);
    h.mats.belly.color.setHex(mixHex(col, 0xffffff, 0.55));
    const accent =
        look.align === "sunny" && stage === "adult"
            ? 0xffd23f
            : look.align === "shade" && stage === "adult"
            ? 0x7b3fe0
            : mixHex(col, 0x3fbf5a, 0.65);
    h.mats.accent.color.setHex(accent);
    const egg = stage === "egg";
    h.egg.visible = egg;
    h.eggMat.color.setHex(mixHex(look.color, 0xffffff, 0.55));
    h.spots.color.setHex(look.color);
    h.body.visible = !egg;
    for (const f of h.feet) f.mesh.visible = !egg;
    const p = look.parts || {};
    const grow = (list, v, base = 1) => {
        for (const m of list) {
            m.visible = v > 0.05;
            m.scale.setScalar(Math.max(0.001, (0.45 + v * 0.75) * base));
        }
    };
    const adultType = stage === "adult" ? look.type : null;
    grow(h.ears, Math.max(p.ears || 0, adultType === "run" ? 0.6 : 0));
    grow(h.wings, Math.max(p.wings || 0, adultType === "fly" ? 0.9 : 0));
    grow(h.fins, Math.max(p.fins || 0, adultType === "swim" ? 0.8 : 0));
    const arms =
        1 + Math.max(p.arms || 0, adultType === "power" ? 0.7 : 0) * 0.6;
    for (const a of h.arms) a.paw.scale.setScalar(arms);
    h.shell.visible = (p.shell || 0) > 0.05;
    h.shell.scale.set(
        0.6 + (p.shell || 0) * 0.5,
        0.6 + (p.shell || 0) * 0.5,
        0.35 + (p.shell || 0) * 0.3
    );
    h.halo.visible = stage === "adult" && look.align === "sunny";
    for (const horn of h.horns)
        horn.visible = stage === "adult" && look.align === "shade";
    h.sprout.scale.setScalar(
        stage === "adult" && look.align === "breeze" ? 1.6 : 1
    );
    h.scale = stage === "adult" ? 1.3 : 1;
    h.root.scale.setScalar(h.scale);
}

// ------------------------------------------------------------- posing

const lerp = (a, b, t) => a + (b - a) * t;

function setEyes(h, mode) {
    for (const e of h.eyes) {
        const open = mode === "open" || mode === "sad" || mode === "wide";
        e.ball.visible = e.shine.visible = e.shine2.visible = open;
        e.arc.visible = mode === "happy";
        e.line.visible = mode === "closed";
        e.ball.scale.y = mode === "wide" ? 1.35 : mode === "sad" ? 0.95 : 1.15;
        e.eye.rotation.z =
            mode === "sad" ? -0.25 * Math.sign(e.eye.position.x) : 0;
    }
}

/**
 * Pose from an action. `s` carries: act, speed (m/s), t (seconds in act),
 * mood (orb kind), held, eating, hatch (0..1 egg wobble), cocoon (0..1).
 */
export function poseBloomling(h, s, dt) {
    h.phase += dt;
    const t = h.phase;
    const act = s.act || "idle";
    const sp = s.speed || 0;
    const b = h.body;
    // Remember last frame's pose so the new one can ease in (no popping
    // between actions), then rebuild it from neutral.
    const prev = capturePose(h);
    // Reset.
    b.position.set(0, 0, 0);
    b.rotation.set(0, 0, 0);
    h.head.rotation.set(0, 0, 0);
    h.head.position.y = 0.47;
    for (const a of h.arms) a.pivot.rotation.set(0, 0, 0);
    for (const f of h.feet) f.mesh.position.set(f.s * 0.085, 0.04, 0.02);
    for (const w of h.wings) w.rotation.set(0, 0, 0);
    let eyes = "open";
    let mouth = "smile";
    let sq = 0;

    if (h.look.stage === "egg") {
        const w = s.hatch || 0;
        const wob =
            Math.sin(t * (8 + w * 20)) *
            (0.05 + w * 0.2) *
            (Math.sin(t * 1.3) > 0.3 ? 1 : 0.15);
        h.egg.rotation.z = wob;
        h.egg.position.y = 0.24 + Math.max(0, Math.sin(t * 9)) * w * 0.04;
        return;
    }
    h.cocoon.visible = act === "cocoon";
    b.visible = act !== "cocoon";
    for (const f of h.feet) f.mesh.visible = act !== "cocoon";
    if (act === "cocoon") {
        const k = s.cocoon || 0;
        h.cocoon.scale.set(
            1 + Math.sin(t * 3) * 0.03,
            1.25 + Math.sin(t * 3) * 0.04,
            1
        );
        h.cocoon.rotation.y += dt * (0.5 + k * 6);
        h.cocoon.material.emissive
            .setHex(0x6a6a7a)
            .lerp(tmpC.setHex(0xffffff), k);
        return;
    }

    // Gait phase advances with distance travelled, so feet stay planted
    // (stride ≈ 4 × swing) and speed changes never make the legs jump.
    const scale = h.scale || 1;
    const walkCycle = (lift, swing) => {
        const rate = Math.min(
            30,
            Math.max(7, (sp * Math.PI * 2) / (4 * swing * scale))
        );
        h.gait = (h.gait || 0) + dt * rate;
        const ph = h.gait;
        h.feet[0].mesh.position.z = 0.02 + Math.sin(ph) * swing;
        h.feet[1].mesh.position.z = 0.02 - Math.sin(ph) * swing;
        h.feet[0].mesh.position.y = 0.04 + Math.max(0, Math.cos(ph)) * lift;
        h.feet[1].mesh.position.y = 0.04 + Math.max(0, -Math.cos(ph)) * lift;
        b.position.y = Math.abs(Math.sin(ph)) * lift * 0.8;
        b.rotation.z = Math.sin(ph) * 0.07;
        h.arms[0].pivot.rotation.x = Math.sin(ph) * 0.6;
        h.arms[1].pivot.rotation.x = -Math.sin(ph) * 0.6;
    };

    switch (act) {
        case "walk":
        case "wander":
        case "follow":
            walkCycle(0.05, 0.06);
            break;
        case "run":
        case "practice-run":
            walkCycle(0.08, 0.09);
            b.rotation.x = 0.25;
            for (const a of h.arms)
                a.pivot.rotation.x = -1.1 + Math.sin(t * 18) * 0.3;
            mouth = "open";
            break;
        case "tired":
            walkCycle(0.03, 0.04);
            b.rotation.x = 0.35;
            h.head.rotation.x = 0.2;
            mouth = "open";
            eyes = "sad";
            break;
        case "swim": {
            b.rotation.x = 1.15;
            b.position.set(0, -0.12 + Math.sin(t * 4) * 0.02, 0.05);
            const p = t * 9;
            h.arms[0].pivot.rotation.set(Math.sin(p) * 1.4, 0, -0.6);
            h.arms[1].pivot.rotation.set(-Math.sin(p) * 1.4, 0, 0.6);
            h.head.rotation.x = -1.0;
            for (const f of h.feet)
                f.mesh.position.set(
                    f.s * 0.07,
                    0.05 + Math.sin(p * 1.3 + f.s) * 0.04,
                    -0.28
                );
            break;
        }
        case "glide":
        case "fly":
        case "practice-fly": {
            const flap = Math.sin(t * 22);
            for (const w of h.wings)
                w.rotation.y = flap * 0.7 * (w.position.x > 0 ? 1 : -1);
            h.arms[0].pivot.rotation.z = -1.2 + flap * 0.5;
            h.arms[1].pivot.rotation.z = 1.2 - flap * 0.5;
            b.position.y = 0.06 + Math.sin(t * 6) * 0.04;
            b.rotation.x = act === "glide" ? 0.4 : 0;
            mouth = "open";
            break;
        }
        case "climb": {
            const p = t * 8;
            b.rotation.x = -0.3;
            h.arms[0].pivot.rotation.x = -2.6 + Math.sin(p) * 0.5;
            h.arms[1].pivot.rotation.x = -2.6 - Math.sin(p) * 0.5;
            h.feet[0].mesh.position.y = 0.06 + Math.max(0, Math.sin(p)) * 0.08;
            h.feet[1].mesh.position.y = 0.06 + Math.max(0, -Math.sin(p)) * 0.08;
            h.head.rotation.x = -0.4;
            break;
        }
        case "practice-power": {
            // Push-ups of a sort: squat and heave.
            const p = Math.sin(t * 6);
            sq = p * 0.12;
            for (const a of h.arms) a.pivot.rotation.x = -1.4 + p * 0.4;
            mouth = p > 0 ? "open" : "smile";
            eyes = p > 0.5 ? "closed" : "open";
            break;
        }
        case "sit":
        case "idle-sit":
            b.position.y = -0.08;
            for (const f of h.feet) f.mesh.position.set(f.s * 0.1, 0.05, 0.14);
            h.head.rotation.z = Math.sin(t * 0.8) * 0.12;
            for (const a of h.arms) a.pivot.rotation.x = -0.3;
            break;
        case "sleep": {
            b.position.set(0, -0.06, -0.05);
            b.rotation.set(-0.15, 0, 1.2);
            sq = Math.sin(t * 1.6) * 0.04;
            eyes = "closed";
            mouth = "small";
            break;
        }
        case "eat": {
            const chew = Math.sin(t * 14);
            h.head.rotation.x = 0.18 + chew * 0.06;
            for (const a of h.arms) a.pivot.rotation.set(-1.5, 0, -a.s * 0.7);
            b.position.y = -0.05;
            mouth = chew > 0 ? "open" : "small";
            eyes = "happy";
            break;
        }
        case "cry": {
            for (const a of h.arms)
                a.pivot.rotation.set(
                    -2.2,
                    0,
                    -a.s * 0.9 + Math.sin(t * 12) * 0.2
                );
            h.head.rotation.x = 0.25;
            b.position.y = Math.abs(Math.sin(t * 10)) * 0.02;
            eyes = "closed";
            mouth = "open";
            break;
        }
        case "happy":
        case "cheer":
        case "win": {
            const hop = Math.abs(Math.sin(t * 7));
            b.position.y = hop * 0.18;
            for (const f of h.feet) f.mesh.position.y = 0.04 + hop * 0.18;
            for (const a of h.arms)
                a.pivot.rotation.set(
                    0,
                    0,
                    -a.s * (2.4 + Math.sin(t * 14) * 0.3)
                );
            sq = (1 - hop) * 0.15 - 0.05;
            eyes = "happy";
            mouth = "open";
            break;
        }
        case "pet": {
            sq = Math.sin(t * 5) * 0.06;
            b.rotation.z = Math.sin(t * 2.5) * 0.15;
            h.head.rotation.z = Math.sin(t * 2.5) * 0.2;
            for (const a of h.arms) a.pivot.rotation.set(-0.4, 0, -a.s * 0.4);
            eyes = "happy";
            break;
        }
        case "dance": {
            b.rotation.y = Math.sin(t * 4) * 0.6;
            b.position.y = Math.abs(Math.sin(t * 8)) * 0.06;
            for (const a of h.arms)
                a.pivot.rotation.set(
                    0,
                    0,
                    -a.s * (1.6 + Math.sin(t * 8 + a.s) * 0.8)
                );
            eyes = "happy";
            break;
        }
        case "held":
        case "thrown": {
            for (const f of h.feet)
                f.mesh.position.y = -0.02 + Math.sin(t * 9 + f.s) * 0.03;
            for (const a of h.arms)
                a.pivot.rotation.set(
                    0,
                    0,
                    -a.s * (1.4 + Math.sin(t * 10) * 0.3)
                );
            b.rotation.z = Math.sin(t * 3) * 0.1;
            eyes = act === "thrown" ? "wide" : s.likes ? "happy" : "open";
            mouth = "open";
            break;
        }
        case "look":
            h.head.rotation.y = Math.sin(t * 1.5) * 0.6;
            h.head.rotation.z = 0.2;
            eyes = "wide";
            mouth = "small";
            break;
        case "trip":
        case "dizzy": {
            b.rotation.set(0.9, 0, Math.sin(t * 6) * 0.2);
            b.position.y = -0.08;
            eyes = "closed";
            mouth = "open";
            break;
        }
        case "windup": {
            b.rotation.x = -0.3;
            sq = 0.12;
            for (const a of h.arms) a.pivot.rotation.x = 1.2;
            eyes = "sad";
            mouth = "small";
            break;
        }
        case "dash": {
            b.rotation.x = 0.7;
            sq = -0.1;
            for (const a of h.arms) a.pivot.rotation.x = 1.6;
            mouth = "open";
            break;
        }
        case "recoil":
        case "dodge":
            b.rotation.x = -0.6;
            for (const a of h.arms) a.pivot.rotation.set(-1, 0, -a.s * 1.2);
            eyes = act === "dodge" ? "open" : "closed";
            mouth = "open";
            break;
        case "out":
            b.rotation.x = -1.2;
            eyes = "closed";
            mouth = "open";
            break;
        default: {
            // Idle: breathe, glance about.
            sq = Math.sin(t * 2.2) * 0.03;
            h.head.rotation.y = Math.sin(t * 0.7) * 0.25;
            h.head.rotation.z = Math.sin(t * 0.45) * 0.08;
            for (const a of h.arms)
                a.pivot.rotation.z = -a.s * Math.sin(t * 2.2) * 0.08;
        }
    }

    // Ease only across a change of action; within one, follow it exactly.
    if (act !== h.lastAct) {
        h.lastAct = act;
        h.blendT = 0.3;
    }
    h.blendT = (h.blendT || 0) - dt;
    blendPose(h, prev, h.blendT > 0 ? 1 - Math.exp(-dt * 12) : 1);

    if (s.mood === "swirl" && eyes === "open") eyes = "sad";
    if (s.mood === "heart" && eyes === "open" && act === "idle") mouth = "open";
    // Blink.
    h.blink -= dt;
    if (h.blink < 0) {
        if (eyes === "open" || eyes === "sad") eyes = "closed";
        if (h.blink < -0.12) h.blink = 2 + Math.random() * 3.5;
    }
    setEyes(h, eyes);
    h.mouthSmile.visible = mouth === "smile";
    h.mouthOpen.visible = mouth === "open" || mouth === "small";
    h.mouthOpen.scale.set(
        mouth === "small" ? 0.6 : 1,
        mouth === "small" ? 0.5 : 0.9,
        0.4
    );
    // Squash and stretch with a little spring for impacts.
    h.squash = lerp(h.squash, 0, Math.min(1, dt * 8));
    const q = sq + h.squash;
    b.scale.set(1 + q * 0.6, 1 - q, 1 + q * 0.6);
    // Leaves and tail jiggle.
    h.leaves[0].rotation.x = Math.sin(t * 3) * 0.15;
    h.leaves[1].rotation.x = Math.sin(t * 3 + 1) * 0.15;
    h.tail.position.x = Math.sin(t * 5) * 0.015;
    for (const e of h.ears)
        e.rotation.x = -0.15 + Math.sin(t * 2.4) * 0.08 - b.position.y;
    if (h.halo.visible) h.halo.rotation.y += dt * 0.8;
}

function poseParts(h) {
    return [
        h.body,
        h.head,
        ...h.arms.map((a) => a.pivot),
        ...h.feet.map((f) => f.mesh),
        ...h.wings,
    ];
}

function capturePose(h) {
    if (!h.posed) return null;
    return poseParts(h).map((o) => [o.position.clone(), o.rotation.clone()]);
}

const lerpAngle = (a, b, k) =>
    a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

function blendPose(h, prev, k) {
    h.posed = true;
    if (!prev) return;
    poseParts(h).forEach((o, i) => {
        const [p, r] = prev[i];
        o.position.lerpVectors(p, o.position, k);
        o.rotation.set(
            lerpAngle(r.x, o.rotation.x, k),
            lerpAngle(r.y, o.rotation.y, k),
            lerpAngle(r.z, o.rotation.z, k)
        );
    });
}

/** Float the mood orb above the head with a lagging spring. */
export function updateOrb(h, dt, scene, visible = true) {
    const orb = h.orb;
    if (!orb.group.parent) scene.add(orb.group);
    const target = h.head.getWorldPosition(new THREE.Vector3());
    target.y += 0.38 * h.scale + 0.05;
    if (h.orbPos.lengthSq() === 0) h.orbPos.copy(target);
    h.orbPos.lerp(target, Math.min(1, dt * 9));
    orb.group.position.copy(h.orbPos);
    orb.group.position.y += Math.sin(h.phase * 2.2) * 0.025;
    orb.pop = Math.max(0, orb.pop - dt * 3);
    const s =
        (1 + Math.sin(orb.pop * Math.PI) * 0.6) * (h.scale > 1 ? 1.15 : 1);
    orb.group.scale.setScalar(s);
    orb.mesh.rotation.y =
        orb.kind === "ball" ? 0 : Math.sin(h.phase * 1.4) * 0.5;
    if (orb.kind === "swirl") orb.mesh.rotation.z -= dt * 3;
    orb.group.visible =
        visible && h.look.stage !== "egg" && orb.kind !== "none";
}

export function disposeBloomling(h) {
    h.root.parent?.remove(h.root);
    h.orb.group.parent?.remove(h.orb.group);
    h.root.traverse((o) => {
        if (
            o.isMesh &&
            o.geometry &&
            !Object.values(orbGeos).includes(o.geometry)
        )
            o.geometry.dispose?.();
    });
}
