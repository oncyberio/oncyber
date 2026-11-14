import * as THREE from "three";
import { outline, toon } from "./toon.js";

// A chunky, toy-like tennis player with floating hands and feet. Everything is
// procedural: the pose is rebuilt every frame from the athlete's state.
// Local frame: forward is -z, right is +x, up is +y.

const L = (r, h, f) => new THREE.Vector3(r, h, -f);
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpM = new THREE.Matrix4();

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const damp = (current, target, rate, dt) =>
    current + (target - current) * (1 - Math.exp(-rate * dt));

/** Cubic Bezier through four control points. */
function bezier(out, a, b, c, d, t) {
    const u = 1 - t;
    out.set(0, 0, 0)
        .addScaledVector(a, u * u * u)
        .addScaledVector(b, 3 * u * u * t)
        .addScaledVector(c, 3 * u * t * t)
        .addScaledVector(d, t * t * t);
    return out;
}

// ---------------------------------------------------------------- faces

const FACE_SIZE = 256;
const faceCache = {};
export function faceTexture(kind) {
    if (faceCache[kind]) return faceCache[kind];
    const c = document.createElement("canvas");
    c.width = c.height = FACE_SIZE;
    const g = c.getContext("2d");
    const S = FACE_SIZE;
    g.clearRect(0, 0, S, S);
    const ink = "#1d1a2e";
    const eye = (x, y, open, look = 0) => {
        g.save();
        g.translate(x * S, y * S);
        if (open <= 0.15) {
            g.strokeStyle = ink;
            g.lineWidth = S * 0.028;
            g.lineCap = "round";
            g.beginPath();
            if (kind === "happy") {
                g.arc(0, S * 0.02, S * 0.05, Math.PI * 1.1, Math.PI * 1.9);
            } else {
                g.moveTo(-S * 0.045, 0);
                g.lineTo(S * 0.045, 0);
            }
            g.stroke();
        } else {
            g.fillStyle = ink;
            g.beginPath();
            g.ellipse(
                look * S * 0.01,
                0,
                S * 0.038,
                S * 0.062 * open,
                0,
                0,
                Math.PI * 2
            );
            g.fill();
            g.fillStyle = "#fff";
            g.beginPath();
            g.arc(
                S * 0.012 + look * S * 0.01,
                -S * 0.025 * open,
                S * 0.014,
                0,
                Math.PI * 2
            );
            g.fill();
        }
        g.restore();
    };
    const brow = (x, y, tilt) => {
        g.save();
        g.translate(x * S, y * S);
        g.rotate(tilt);
        g.fillStyle = ink;
        g.beginPath();
        g.roundRect(-S * 0.05, -S * 0.012, S * 0.1, S * 0.024, S * 0.012);
        g.fill();
        g.restore();
    };
    const blush = () => {
        g.fillStyle = "rgba(255,120,140,0.45)";
        for (const x of [0.28, 0.72]) {
            g.beginPath();
            g.ellipse(x * S, 0.62 * S, S * 0.055, S * 0.03, 0, 0, Math.PI * 2);
            g.fill();
        }
    };
    const mouth = (shape) => {
        g.strokeStyle = ink;
        g.fillStyle = ink;
        g.lineWidth = S * 0.024;
        g.lineCap = "round";
        g.beginPath();
        if (shape === "smile") {
            g.arc(S * 0.5, S * 0.62, S * 0.06, Math.PI * 0.15, Math.PI * 0.85);
            g.stroke();
        } else if (shape === "grin") {
            g.moveTo(S * 0.42, S * 0.64);
            g.quadraticCurveTo(S * 0.5, S * 0.76, S * 0.58, S * 0.64);
            g.closePath();
            g.fill();
            g.fillStyle = "#ff7a8a";
            g.beginPath();
            g.ellipse(
                S * 0.5,
                S * 0.695,
                S * 0.035,
                S * 0.018,
                0,
                0,
                Math.PI * 2
            );
            g.fill();
        } else if (shape === "o") {
            g.ellipse(
                S * 0.5,
                S * 0.67,
                S * 0.032,
                S * 0.042,
                0,
                0,
                Math.PI * 2
            );
            g.fill();
        } else if (shape === "frown") {
            g.arc(S * 0.5, S * 0.72, S * 0.05, Math.PI * 1.2, Math.PI * 1.8);
            g.stroke();
        } else {
            g.moveTo(S * 0.46, S * 0.66);
            g.lineTo(S * 0.54, S * 0.66);
            g.stroke();
        }
    };
    if (kind === "neutral" || kind === "blink") {
        const open = kind === "blink" ? 0 : 1;
        eye(0.38, 0.47, open);
        eye(0.62, 0.47, open);
        brow(0.37, 0.35, -0.08);
        brow(0.63, 0.35, 0.08);
        blush();
        mouth("smile");
    } else if (kind === "focus") {
        eye(0.38, 0.48, 0.8);
        eye(0.62, 0.48, 0.8);
        brow(0.37, 0.37, 0.28);
        brow(0.63, 0.37, -0.28);
        mouth("flat");
    } else if (kind === "shout") {
        eye(0.38, 0.47, 0.75);
        eye(0.62, 0.47, 0.75);
        brow(0.37, 0.36, 0.32);
        brow(0.63, 0.36, -0.32);
        mouth("o");
    } else if (kind === "happy") {
        eye(0.38, 0.47, 0);
        eye(0.62, 0.47, 0);
        brow(0.37, 0.33, -0.15);
        brow(0.63, 0.33, 0.15);
        blush();
        mouth("grin");
    } else if (kind === "sad") {
        eye(0.38, 0.5, 0.55);
        eye(0.62, 0.5, 0.55);
        brow(0.37, 0.38, -0.35);
        brow(0.63, 0.38, 0.35);
        mouth("frown");
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    faceCache[kind] = tex;
    return tex;
}

// ---------------------------------------------------------------- racket

function stringTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 2;
    for (let i = 4; i < 128; i += 11) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, 128);
        g.stroke();
        g.beginPath();
        g.moveTo(0, i);
        g.lineTo(128, i);
        g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
let strings = null;

function buildRacket(color) {
    const racket = new THREE.Group();
    // Handle along +y from the grip.
    const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.026, 0.2, 10),
        toon(0x2a2340)
    );
    grip.position.y = 0.04;
    racket.add(grip);
    const throat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.018, 0.16, 8),
        toon(color)
    );
    throat.position.y = 0.21;
    racket.add(throat);
    const frame = new THREE.Mesh(
        new THREE.TorusGeometry(0.135, 0.016, 8, 28),
        toon(color)
    );
    frame.scale.set(0.82, 1.08, 1);
    frame.position.y = 0.42;
    racket.add(frame);
    outline(frame, 0.008);
    outline(grip, 0.008);
    strings ||= stringTexture();
    const net = new THREE.Mesh(
        new THREE.CircleGeometry(0.128, 24),
        new THREE.MeshBasicMaterial({
            map: strings,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            opacity: 0.9,
        })
    );
    net.scale.set(0.82, 1.08, 1);
    net.position.y = 0.42;
    racket.add(net);
    racket.userData.head = frame;
    racket.scale.setScalar(1.25);
    return racket;
}

function starGeometry(r) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    return new THREE.ExtrudeGeometry(shape, {
        depth: 0.015,
        bevelEnabled: false,
    });
}

// ---------------------------------------------------------------- body

export const PALETTES = [
    {
        shirt: 0xff4d5e,
        shorts: 0xffffff,
        band: 0xffffff,
        racket: 0xff4d5e,
        hair: 0x4a2c1f,
        skin: 0xffd2b0,
        shoe: 0xffffff,
        sole: 0xff4d5e,
    },
    {
        shirt: 0x3d7bff,
        shorts: 0x1f2a5c,
        band: 0xffd23c,
        racket: 0x3d7bff,
        hair: 0x1b1730,
        skin: 0xe9b48c,
        shoe: 0x1f2a5c,
        sole: 0xffd23c,
    },
    {
        shirt: 0x2bd17e,
        shorts: 0xffffff,
        band: 0x125c3a,
        racket: 0x2bd17e,
        hair: 0xe5a83a,
        skin: 0xffe0c2,
        shoe: 0xffffff,
        sole: 0x2bd17e,
    },
    {
        shirt: 0xffb01f,
        shorts: 0x5a3b9c,
        band: 0x5a3b9c,
        racket: 0xffb01f,
        hair: 0x2a1a12,
        skin: 0xc68a5f,
        shoe: 0x5a3b9c,
        sole: 0xffb01f,
    },
];

export function createCharacter(palette = PALETTES[0], opts = {}) {
    const root = new THREE.Group();
    const body = new THREE.Group(); // bobbing, leaning upper body
    root.add(body);
    const parts = {};

    const shirt = toon(palette.shirt);
    const torso = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.25, 0.2, 6, 16),
        shirt
    );
    torso.position.y = 0.98;
    torso.scale.set(1, 1, 0.86);
    torso.castShadow = true;
    body.add(torso);
    outline(torso, 0.016);
    const shorts = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.262,
            18,
            10,
            0,
            Math.PI * 2,
            Math.PI * 0.55,
            Math.PI * 0.45
        ),
        toon(palette.shorts)
    );
    shorts.position.y = 0.92;
    shorts.scale.set(1, 1.05, 0.88);
    body.add(shorts);
    // A chest/back stripe and a star patch so players read from behind.
    const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.255, 0.255, 0.07, 20, 1, true),
        toon(palette.band === 0xffffff ? 0xffffff : palette.band)
    );
    stripe.position.y = 1.08;
    stripe.scale.set(1, 1, 0.86);
    body.add(stripe);
    const star = new THREE.Mesh(starGeometry(0.09), toon(0xffffff));
    star.position.set(0, 0.96, 0.222);
    body.add(star);
    // Collar stripe.
    const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.022, 8, 20),
        toon(0xffffff)
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.3;
    body.add(collar);

    const head = new THREE.Group();
    head.position.y = 1.6;
    body.add(head);
    const skull = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 28, 20),
        toon(palette.skin)
    );
    skull.scale.set(1, 0.96, 0.95);
    skull.castShadow = true;
    head.add(skull);
    outline(skull, 0.016);
    const face = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.303,
            24,
            16,
            Math.PI * 1.5 - 0.95,
            1.9,
            Math.PI * 0.5 - 0.85,
            1.7
        ),
        new THREE.MeshToonMaterial({
            map: faceTexture("neutral"),
            transparent: true,
            alphaTest: 0.05,
            depthWrite: false,
        })
    );
    face.scale.copy(skull.scale);
    head.add(face);
    // Ears.
    for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 10, 8),
            toon(palette.skin)
        );
        ear.position.set(s * 0.29, -0.02, 0.02);
        ear.scale.set(0.6, 1, 0.8);
        head.add(ear);
    }
    // Hair: a cap plus a swoop of bangs, then a sweatband.
    const hairMat = toon(palette.hair);
    const cap = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.315,
            24,
            14,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.42
        ),
        hairMat
    );
    cap.rotation.x = 0.28;
    cap.position.set(0, 0.02, 0.03);
    head.add(cap);
    outline(cap, 0.014);
    const bang = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 10),
        hairMat
    );
    bang.position.set(0.12, 0.2, -0.2);
    bang.scale.set(1.5, 0.55, 0.8);
    bang.rotation.z = -0.4;
    head.add(bang);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), hairMat);
    tuft.position.set(-0.04, 0.34, 0.05);
    tuft.rotation.z = 0.5;
    head.add(tuft);
    const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.035, 8, 32),
        toon(palette.band)
    );
    band.rotation.x = Math.PI / 2 + 0.18;
    band.position.y = 0.1;
    band.scale.set(1.02, 1, 0.97);
    head.add(band);

    // Floating hands and feet live on the root so they can swing freely.
    const handGeo = new THREE.SphereGeometry(0.085, 14, 10);
    const mkHand = () => {
        const h = new THREE.Group();
        const m = new THREE.Mesh(handGeo, toon(palette.skin));
        m.castShadow = true;
        h.add(m);
        outline(m, 0.012);
        const cuff = new THREE.Mesh(
            new THREE.TorusGeometry(0.07, 0.03, 8, 16),
            toon(palette.band)
        );
        cuff.position.y = -0.06;
        cuff.rotation.x = Math.PI / 2;
        h.add(cuff);
        root.add(h);
        return h;
    };
    parts.handR = mkHand();
    parts.handL = mkHand();
    const footGeo = new THREE.CapsuleGeometry(0.075, 0.12, 4, 10);
    const mkFoot = () => {
        const f = new THREE.Group();
        const shoe = new THREE.Mesh(footGeo, toon(palette.shoe));
        shoe.rotation.x = Math.PI / 2;
        shoe.scale.set(1.15, 1, 0.85);
        shoe.position.y = 0.07;
        shoe.castShadow = true;
        f.add(shoe);
        outline(shoe, 0.012);
        const sole = new THREE.Mesh(
            new THREE.BoxGeometry(0.17, 0.035, 0.29),
            toon(palette.sole)
        );
        sole.position.y = 0.018;
        f.add(sole);
        root.add(f);
        return f;
    };
    parts.footR = mkFoot();
    parts.footL = mkFoot();

    const racket = buildRacket(palette.racket);
    root.add(racket);

    const ch = {
        root,
        body,
        head,
        torso,
        face,
        racket,
        parts,
        palette,
        expression: "neutral",
        blinkAt: 1 + Math.random() * 3,
        blinkUntil: 0,
        gait: 0,
        footPlant: [
            new THREE.Vector3(0.18, 0, 0),
            new THREE.Vector3(-0.18, 0, 0),
        ],
        yaw: 0,
        twist: 0,
        lean: new THREE.Vector2(),
        hop: 0,
        hopV: 0,
        squash: 1,
        handR: new THREE.Vector3(),
        handL: new THREE.Vector3(),
        racketDir: new THREE.Vector3(0.6, 0.6, -0.2).normalize(),
        racketPrev: new THREE.Vector3(),
        celebrate: 0,
        time: 0,
        charging: 0,
        side: 1,
        scale: opts.scale || 1,
    };
    root.scale.setScalar(ch.scale);
    return ch;
}

function setExpression(ch, kind) {
    if (ch.expression === kind) return;
    ch.expression = kind;
    ch.face.material.map = faceTexture(kind);
    ch.face.material.needsUpdate = true;
}

/** Racket racket pose keys in the local frame (right hand side). */
const KEYS = {
    ready: L(0.42, 0.95, 0.32),
    readyL: L(-0.3, 0.98, 0.28),
    fhBack: L(0.78, 1.12, -0.42),
    fhContact: L(0.82, 0.98, 0.38),
    fhFollow: L(-0.38, 1.48, 0.2),
    bhBack: L(-0.72, 1.06, -0.38),
    bhContact: L(-0.78, 0.98, 0.4),
    bhFollow: L(0.42, 1.5, 0.16),
    trophy: L(0.42, 1.55, -0.32),
    tossUp: L(-0.05, 2.25, 0.4),
    serveContact: L(0.25, 2.35, 0.35),
    serveFollow: L(-0.4, 0.9, 0.3),
};

/**
 * Pose the character from an athlete. `ctx` carries: dt, ballLocal (Vector3 in
 * local frame), facingYaw, swingSide (+1 forehand / -1 backhand while charging).
 */
export function poseCharacter(ch, ath, ctx) {
    const dt = ctx.dt;
    ch.time += dt;
    const root = ch.root;
    root.position.set(ath.x, 0, ath.z);
    // Face the far end, turning a little toward the ball.
    const baseYaw = ath.side > 0 ? 0 : Math.PI;
    // Off the court (the arrival walk) the caller owns the heading.
    const targetYaw =
        ctx.faceYaw !== undefined ? ctx.faceYaw : baseYaw + (ctx.yawBias || 0);
    ch.yaw = damp(ch.yaw, targetYaw, 10, dt);
    root.rotation.y = ch.yaw;

    // Local velocity.
    const cos = Math.cos(-ch.yaw);
    const sin = Math.sin(-ch.yaw);
    const lvx = ath.vx * cos - ath.vz * sin; // right
    const lvz = ath.vx * sin + ath.vz * cos; // local +z (backward)
    const speed = Math.hypot(lvx, lvz);
    const run = clamp01(speed / 6.5);

    // Gait: feet step along the velocity with lift arcs.
    ch.gait += dt * (4 + speed * 1.55);
    const stepLen = 0.12 + run * 0.32;
    const dirX = speed > 0.05 ? lvx / speed : 0;
    const dirZ = speed > 0.05 ? lvz / speed : 0;
    const feet = [ch.parts.footR, ch.parts.footL];
    for (let i = 0; i < 2; i++) {
        const ph = ch.gait + i * Math.PI;
        const swing = Math.sin(ph);
        const lift = Math.max(0, Math.cos(ph)) * (0.06 + run * 0.18);
        const side = i === 0 ? 1 : -1;
        const stance = 0.2 + (ath.state === "charge" ? 0.08 : 0);
        let fx = side * stance + dirX * swing * stepLen * (speed > 0.2 ? 1 : 0);
        let fz =
            dirZ * swing * stepLen * (speed > 0.2 ? 1 : 0) +
            (i === 0 ? 0.02 : -0.04);
        let fy = speed > 0.2 ? lift : 0;
        if (ath.state === "celebrate") fy += ch.hop * 0.6;
        const foot = feet[i];
        foot.position.set(fx, fy + ch.hop, fz);
        foot.rotation.set(
            speed > 0.2 ? -swing * 0.35 * run : 0,
            Math.atan2(dirX, -dirZ || 1) * 0.15 * run,
            0
        );
    }

    // Split-step hop and jumps.
    if (ctx.hopNow) {
        ch.hopV = ctx.hopNow;
    }
    ch.hopV -= 22 * dt;
    ch.hop += ch.hopV * dt;
    if (ch.hop <= 0) {
        if (ch.hopV < -1.2) ch.squash = 0.82;
        ch.hop = 0;
        ch.hopV = 0;
    }
    ch.squash = damp(ch.squash, 1, 12, dt);

    // Body bob, crouch and lean.
    const bob =
        speed > 0.2
            ? Math.abs(Math.sin(ch.gait)) * 0.05 * (0.4 + run)
            : Math.sin(ch.time * 3.2) * 0.012;
    let crouch = ath.state === "charge" ? 0.1 : speed < 0.3 ? 0.04 : 0.02;
    if (ath.state === "sad") crouch = 0.12;
    ch.body.position.y = ch.hop + bob - crouch - 0.06;
    ch.lean.x = damp(ch.lean.x, -lvx * 0.035, 8, dt);
    ch.lean.y = damp(ch.lean.y, lvz * 0.035, 8, dt);
    ch.body.rotation.z = ch.lean.x;
    ch.body.rotation.x = ch.lean.y + (ath.state === "sad" ? 0.35 : 0);
    ch.body.scale.set(
        1 / Math.sqrt(ch.squash),
        ch.squash,
        1 / Math.sqrt(ch.squash)
    );

    // Hands.
    const hr = ch.handR;
    const hl = ch.handL;
    let twist = 0;
    const swing = ath.swing;
    const side = ctx.swingSide || 1;
    const contactH = ctx.contactHeight || 1.0;
    if (swing && swing.kind === "serve") {
        const t = clamp01(swing.t / 0.42);
        const a = KEYS.trophy;
        const c = KEYS.serveContact;
        const d = KEYS.serveFollow;
        if (t < 0.18) hr.lerpVectors(a, c, smooth(t / 0.18));
        else
            bezier(
                hr,
                c,
                L(0.3, 1.9, 0.9),
                L(0, 1.0, 0.8),
                d,
                smooth((t - 0.18) / 0.82)
            );
        hl.lerpVectors(L(-0.1, 1.7, 0.35), L(-0.25, 1.0, 0.3), smooth(t));
        twist = THREE.MathUtils.lerp(0.5, -0.6, smooth(t));
    } else if (
        swing &&
        (swing.kind === "forehand" ||
            swing.kind === "backhand" ||
            swing.kind === "smash")
    ) {
        const t = clamp01(swing.t / 0.46);
        const fore = swing.kind !== "backhand";
        if (swing.kind === "smash") {
            bezier(
                hr,
                L(0.3, 2.3, 0.3),
                L(0.5, 2.1, 0.8),
                L(0.2, 1.3, 0.8),
                L(-0.3, 0.9, 0.3),
                smooth(t)
            );
            hl.lerpVectors(L(-0.2, 1.9, 0.4), L(-0.3, 1.0, 0.2), smooth(t));
            twist = THREE.MathUtils.lerp(0.4, -0.7, smooth(t));
        } else {
            const back = fore ? KEYS.fhBack : KEYS.bhBack;
            const cont = (fore ? KEYS.fhContact : KEYS.bhContact).clone();
            cont.y = Math.max(0.35, Math.min(1.9, contactH));
            let follow = fore ? KEYS.fhFollow : KEYS.bhFollow;
            if (swing.shot === "slice" || swing.shot === "drop")
                follow = fore ? L(-0.2, 0.8, 0.6) : L(0.3, 0.85, 0.6);
            if (swing.shot === "lob")
                follow = fore ? L(0.1, 2.0, 0.4) : L(0.05, 2.0, 0.4);
            // Starts just before contact (the hit already happened) and follows through.
            const tt = 0.22 + t * 0.78;
            if (tt < 0.32)
                hr.lerpVectors(
                    back,
                    cont,
                    smooth(((tt - 0.22) / 0.1) * 0.6 + 0.4)
                );
            else
                bezier(
                    hr,
                    cont,
                    cont.clone().add(L(fore ? -0.25 : 0.25, 0.15, 0.45)),
                    follow.clone().add(L(0, -0.1, 0.25)),
                    follow,
                    smooth((tt - 0.32) / 0.68)
                );
            if (fore)
                hl.lerpVectors(
                    L(-0.42, 1.08, 0.28),
                    L(-0.22, 1.12, 0.12),
                    smooth(t)
                );
            else hl.copy(hr).add(L(0.05, -0.08, -0.06)); // two-handed backhand
            twist = fore
                ? THREE.MathUtils.lerp(0.55, -0.85, smooth(t))
                : THREE.MathUtils.lerp(-0.6, 0.8, smooth(t));
            if (swing.stretch) twist *= 0.5;
        }
    } else if (ath.state === "charge") {
        const fore = side > 0;
        const shake = ath.charge >= 1 ? Math.sin(ch.time * 70) * 0.012 : 0;
        const k = smooth(clamp01(ath.stateTime / 0.16));
        hr.lerpVectors(KEYS.ready, fore ? KEYS.fhBack : KEYS.bhBack, k);
        hr.y += shake;
        if (fore) hl.lerpVectors(KEYS.readyL, L(-0.4, 1.12, 0.38), k);
        else hl.copy(hr).add(L(0.05, -0.08, -0.06));
        twist = (fore ? 0.6 : -0.65) * k;
    } else if (ath.state === "toss") {
        const t = clamp01(ath.stateTime / 0.35);
        hl.lerpVectors(L(-0.1, 1.0, 0.4), KEYS.tossUp, smooth(t));
        hr.lerpVectors(KEYS.ready, KEYS.trophy, smooth(t));
        twist = 0.45 * smooth(t);
    } else if (ath.state === "celebrate") {
        const pump = Math.sin(ch.time * 9);
        hr.set(0.38, 2.1 + pump * 0.12, -0.1);
        hl.set(-0.38, 2.1 - pump * 0.12, -0.1);
        if (ch.hop === 0 && ch.time % 0.9 < dt * 1.5) ch.hopV = 4.2;
        setExpression(ch, "happy");
    } else if (ath.state === "sad") {
        hr.set(0.32, 0.7, -0.15);
        hl.set(-0.3, 0.72, -0.12);
    } else {
        // Ready: racket out front, a little breathing.
        const breathe = Math.sin(ch.time * 3.2) * 0.015;
        hr.copy(KEYS.ready);
        hl.copy(KEYS.readyL);
        hr.y += breathe;
        hl.y += breathe;
        if (speed > 0.5) {
            // Arms pump while running.
            const pump = Math.sin(ch.gait) * 0.12 * run;
            hr.add(tmp.set(0.08 * run, 0.05 * run, pump));
            hl.add(tmp.set(-0.05 * run, 0, -pump));
        }
    }
    hr.y += ch.body.position.y;
    hl.y += ch.body.position.y;
    ch.twist = damp(ch.twist, twist, swing ? 40 : 14, dt);
    ch.body.rotation.y = ch.twist * 0.7;
    ch.head.rotation.y = -ch.twist * 0.45 + (ctx.headYaw || 0);
    ch.head.rotation.x =
        (ath.state === "sad" ? 0.35 : 0) + (ctx.headPitch || 0);

    ch.parts.handR.position.copy(hr);
    ch.parts.handL.position.copy(hl);

    // Racket: extends from the hand away from an imaginary shoulder pivot,
    // face turned along the swing direction.
    const shoulder = tmp.set(0.18, 1.32 + ch.body.position.y, 0);
    const dir = tmp2.copy(hr).sub(shoulder);
    if (swing && swing.kind === "serve" && swing.t < 0.07)
        dir.set(0.1, -1, 0.3);
    dir.y += 0.25;
    dir.normalize();
    ch.racketDir.lerp(dir, 1 - Math.exp(-(swing ? 60 : 18) * dt)).normalize();
    const vel = ch.racketPrev.copy(hr).sub(ch.racket.position);
    ch.racket.position.copy(hr);
    const up = ch.racketDir;
    let faceDir =
        vel.lengthSq() > 1e-6 ? vel.normalize() : new THREE.Vector3(0, 0, -1);
    faceDir.addScaledVector(up, -faceDir.dot(up));
    if (faceDir.lengthSq() < 1e-4) faceDir.set(0, 0, -1);
    faceDir.normalize();
    const xAxis = new THREE.Vector3().crossVectors(up, faceDir).normalize();
    tmpM.makeBasis(xAxis, up, faceDir);
    tmpQ.setFromRotationMatrix(tmpM);
    ch.racket.quaternion.slerp(tmpQ, 1 - Math.exp(-(swing ? 50 : 14) * dt));

    // Face.
    if (ath.state !== "celebrate") {
        let kind = "neutral";
        if (ath.state === "charge") kind = ath.charge > 0.6 ? "shout" : "focus";
        else if (swing && swing.t < 0.25) kind = "shout";
        else if (ath.state === "sad") kind = "sad";
        else if (ctx.mood === "happy") kind = "happy";
        if (kind === "neutral") {
            if (ch.time > ch.blinkAt) {
                ch.blinkUntil = ch.time + 0.12;
                ch.blinkAt = ch.time + 2 + Math.random() * 3;
            }
            if (ch.time < ch.blinkUntil) kind = "blink";
        }
        setExpression(ch, kind);
    }
}

/** World-space position of the racket head centre. */
export function racketHead(ch, out = new THREE.Vector3()) {
    return ch.racket.userData.head.getWorldPosition(out);
}

/** A round portrait (data URL) for HUD cards, drawn from the same face art. */
export function portrait(palette, kind = "happy") {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const g = c.getContext("2d");
    const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;
    g.fillStyle = hex(palette.shirt);
    g.fillRect(0, 0, 160, 160);
    g.fillStyle = hex(palette.skin);
    g.beginPath();
    g.ellipse(80, 92, 58, 56, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hex(palette.hair);
    g.beginPath();
    g.ellipse(80, 62, 60, 36, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(98, 50, 34, 16, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hex(palette.band);
    g.fillRect(20, 58, 120, 10);
    const face = faceTexture(kind).image;
    g.drawImage(face, 18, 30, 124, 124);
    return c.toDataURL();
}
