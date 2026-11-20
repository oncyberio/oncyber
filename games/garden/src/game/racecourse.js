import * as THREE from "three/webgpu";
import {
    float,
    mix,
    mx_noise_float,
    positionWorld,
    sin,
    smoothstep,
    time,
    vec3,
} from "three/tsl";
import { COURSE, COURSE_LENGTH, RACE_FRUITS } from "./games.js";
import { RACE_ISLE, heightAt } from "./terrain.js";
import { outline, toon } from "./toon.js";
import { fruitGeometry, labelPlane } from "./world.js";
import { FRUITS } from "./sim.js";
import { checkerTexture } from "./text.js";

// Bloom Dash's own stage: a winding raised track around the race islet with a
// start gate (countdown lights), a sunken pool, a climbing wall, a glide off
// the wall over a pond, fruit pickups and a finish gate. Distances along the
// course (s) map to a path distance (d) on a spline plus a height.

export const TRACK_Y = 1.3;
export const LANE_W = 1.2;
export const LANES = 4;
export const WALL_H = 3.2;
export const HALF = (LANES / 2) * LANE_W + 0.35;
const WALL_DEPTH = 1.1;

// Section boundaries in race metres, from games.js COURSE.
const bounds = [];
{
    let s = 0;
    for (const c of COURSE) {
        bounds.push({ kind: c.kind, s0: s, s1: s + c.len });
        s += c.len;
    }
}
const sec = (kind, n = 0) => bounds.filter((b) => b.kind === kind)[n];
export const POOL = sec("swim");
export const CLIMB = sec("climb");
export const GLIDE = sec("glide");
const CLIMB_ACROSS = WALL_DEPTH / 2 + 0.15; // over the top to its middle
// Run-up behind the start line, so the chase camera has room.
export const START_D = 7;

/** Path distance and height above the track for race distance s. */
export function pathOf(s) {
    if (s < CLIMB.s0) {
        const inPool = s >= POOL.s0 && s < POOL.s1;
        // Dive in and climb out over half a metre.
        const dip = inPool
            ? Math.min(1, (s - POOL.s0) / 0.6, (POOL.s1 - s) / 0.6)
            : 0;
        return { d: START_D + s, y: -0.42 * dip };
    }
    if (s < CLIMB.s1) {
        const u = (s - CLIMB.s0) / (CLIMB.s1 - CLIMB.s0);
        if (u < 0.82) return { d: START_D + CLIMB.s0, y: (u / 0.82) * WALL_H };
        return {
            d: START_D + CLIMB.s0 + ((u - 0.82) / 0.18) * CLIMB_ACROSS,
            y: WALL_H,
        };
    }
    const glideD = GLIDE.s1 - GLIDE.s0;
    if (s < GLIDE.s1) {
        const u = (s - GLIDE.s0) / glideD;
        // Hop off, hang, then float down to the landing pad.
        return {
            d: START_D + CLIMB.s0 + CLIMB_ACROSS + (s - GLIDE.s0),
            y: WALL_H * (1 - u * u) + Math.sin(u * Math.PI) * 0.7,
        };
    }
    return {
        d: START_D + CLIMB.s0 + CLIMB_ACROSS + glideD + (s - GLIDE.s1),
        y: 0,
    };
}

export const FINISH_D = pathOf(COURSE_LENGTH).d;
const RUNOUT = 9;

// A winding spline over the islet.
const CTRL = [
    [-25, 6],
    [-19, 13],
    [-7, 14.5],
    [5, 12.8],
    [14.5, 6.8],
    [17, -2.6],
    [12, -11],
    [1.7, -14.5],
    [-8.5, -12.8],
    [-16, -6],
    [-18, 3.4],
];
const curve = new THREE.CatmullRomCurve3(
    CTRL.map(
        ([x, z]) => new THREE.Vector3(RACE_ISLE.x + x, 0, RACE_ISLE.z + z)
    ),
    false,
    "centripetal"
);
const LENGTH = curve.getLength();
const tmpP = new THREE.Vector3();
const tmpT = new THREE.Vector3();

/** World x/z and heading at path distance d, offset across the lanes. */
export function pathPoint(d, offset = 0) {
    const u = Math.min(1, Math.max(0, d / LENGTH));
    curve.getPointAt(u, tmpP);
    curve.getTangentAt(u, tmpT);
    const h = Math.atan2(tmpT.x, tmpT.z);
    // Local +x of a group turned by h.
    return {
        x: tmpP.x + Math.cos(h) * offset,
        z: tmpP.z - Math.sin(h) * offset,
        h,
    };
}

/** Where a racer stands: lane 0..3 across, s metres along. */
export function coursePoint(s, lane) {
    const p = pathOf(s);
    const q = pathPoint(p.d, (lane - (LANES - 1) / 2) * LANE_W);
    return { x: q.x, z: q.z, y: TRACK_Y + p.y, h: q.h };
}

/** Fruit pickup positions: shared with the sim so everyone agrees. */
export function fruitSlots() {
    return RACE_FRUITS;
}

// ------------------------------------------------------------- geometry

function ribbon(d0, d1, w0, w1, y, colorFn = null, step = 0.4) {
    const n = Math.max(2, Math.ceil((d1 - d0) / step));
    const pos = [];
    const col = [];
    const idx = [];
    const c = new THREE.Color();
    for (let i = 0; i <= n; i++) {
        const d = d0 + ((d1 - d0) * i) / n;
        const a = pathPoint(d, w0);
        const b = pathPoint(d, w1);
        pos.push(a.x, y, a.z, b.x, y, b.z);
        if (colorFn) {
            colorFn(d, c);
            col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        if (i < n) {
            const k = i * 2;
            idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    if (colorFn)
        g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const nor = g.attributes.normal;
    for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
    return g;
}

function wall(d0, d1, off, y0, y1, step = 0.4) {
    const n = Math.max(2, Math.ceil((d1 - d0) / step));
    const pos = [];
    const idx = [];
    for (let i = 0; i <= n; i++) {
        const d = d0 + ((d1 - d0) * i) / n;
        const a = pathPoint(d, off);
        pos.push(a.x, y0, a.z, a.x, y1, a.z);
        if (i < n) {
            const k = i * 2;
            idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

const sided = (m) => {
    m.side = THREE.DoubleSide;
    return m;
};

function checker(w, h, cells = 8) {
    return checkerTexture(cells, Math.max(1, Math.round((cells * h) / w)));
}

function gate(d, label, bg, lights) {
    const g = new THREE.Group();
    const p = pathPoint(d, 0);
    g.position.set(p.x, TRACK_Y, p.z);
    g.rotation.y = p.h;
    const postMat = toon(0xffffff);
    for (const s of [-1, 1]) {
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.2, 4, 12),
            postMat
        );
        post.position.set(s * (HALF + 0.25), 2, 0);
        outline(post, 0.025);
        g.add(post);
        const cap = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 12, 10),
            toon(bg === "checker" ? 0xff5f7e : 0x2f7bff)
        );
        cap.position.set(s * (HALF + 0.25), 4.1, 0);
        outline(cap, 0.02);
        g.add(cap);
    }
    const w = HALF * 2 + 0.5;
    let banner;
    if (bg === "checker") {
        banner = new THREE.Mesh(
            new THREE.BoxGeometry(w, 0.9, 0.12),
            toon(0xffffff, { map: checker(w, 0.9, 16), unique: true })
        );
        const text = labelPlane(label, w * 0.5, 0.7, "#ffffff", "#ff5f7e");
        text.position.set(0, 0, 0.07);
        banner.add(text);
        const back = text.clone();
        back.rotation.y = Math.PI;
        back.position.z = -0.07;
        banner.add(back);
    } else {
        banner = new THREE.Mesh(
            new THREE.BoxGeometry(w, 0.9, 0.12),
            toon(0x2f7bff)
        );
        const text = labelPlane(label, w * 0.6, 0.72, "#ffffff", bg);
        text.position.z = -0.07;
        text.rotation.y = Math.PI;
        banner.add(text);
        const front = labelPlane(label, w * 0.6, 0.72, "#ffffff", bg);
        front.position.z = 0.07;
        banner.add(front);
    }
    banner.position.y = 3.55;
    outline(banner, 0.03);
    g.add(banner);
    const lamps = [];
    if (lights) {
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(1.7, 0.6, 0.3),
            toon(0x2a2340)
        );
        box.position.set(0, 2.85, 0);
        outline(box, 0.02);
        g.add(box);
        for (let i = 0; i < 3; i++) {
            const mat = toon(0x444455, { emissive: 0x000000, unique: true });
            const lamp = new THREE.Mesh(
                new THREE.SphereGeometry(0.19, 14, 10),
                mat
            );
            // Face back down the course, toward the racers and the camera.
            lamp.position.set((i - 1) * 0.52, 2.85, -0.17);
            g.add(lamp);
            lamps.push(mat);
        }
    }
    return { group: g, lamps };
}

function balloon(color, x, y, z) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 16, 12),
        toon(color, { emissive: color & 0x222222 })
    );
    b.scale.y = 1.18;
    outline(b, 0.02);
    g.add(b);
    const string = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 2.2, 4),
        toon(0xffffff)
    );
    string.position.y = -1.5;
    g.add(string);
    g.position.set(x, y, z);
    g.userData.phase = Math.random() * 6;
    return g;
}

export function buildRaceCourse(scene) {
    const g = new THREE.Group();
    const end = FINISH_D + RUNOUT;
    // Things the camera must not pass through.
    const occluders = [];
    const poolD = [pathOf(POOL.s0).d, pathOf(POOL.s1).d];
    const wallD = START_D + CLIMB.s0;
    const glideD = [wallD + CLIMB_ACROSS, pathOf(GLIDE.s1).d];

    // Track: lane stripes of colour, curbs, a bed down to the ground.
    const laneColors = [0xf7c98a, 0xf2bd78];
    const runs = [
        [0, poolD[0]],
        [poolD[1], wallD],
        [glideD[1] - 1.2, end],
    ];
    const track = toon(0xffffff, { vertexColors: true, unique: true });
    sided(track);
    const curb = toon(0xffffff, { vertexColors: true, unique: true });
    sided(curb);
    const bedMat = sided(toon(0xc98a5a));
    const lineMat = sided(toon(0xffffff));
    const c1 = new THREE.Color(0xff5f7e);
    const c2 = new THREE.Color(0xffffff);
    for (const [a, b] of runs) {
        for (let l = 0; l < LANES; l++) {
            const o0 = (l - LANES / 2) * LANE_W;
            const col = new THREE.Color(laneColors[l % 2]);
            const m = new THREE.Mesh(
                ribbon(a, b, o0, o0 + LANE_W, TRACK_Y, (d, c) => c.copy(col)),
                track
            );
            m.receiveShadow = true;
            g.add(m);
        }
        for (let l = 1; l < LANES; l++) {
            const o = (l - LANES / 2) * LANE_W;
            g.add(
                new THREE.Mesh(
                    ribbon(a, b, o - 0.035, o + 0.035, TRACK_Y + 0.01),
                    lineMat
                )
            );
        }
        for (const [o0, o1] of [
            [-HALF, -HALF + 0.35],
            [HALF - 0.35, HALF],
        ]) {
            const m = new THREE.Mesh(
                ribbon(a, b, o0, o1, TRACK_Y + 0.06, (d, c) =>
                    c.copy(Math.floor(d / 1.2) % 2 ? c1 : c2)
                ),
                curb
            );
            g.add(m);
            g.add(
                new THREE.Mesh(
                    wall(a, b, o0 < 0 ? o0 : o1, TRACK_Y, TRACK_Y + 0.06),
                    curb
                )
            );
        }
        for (const o of [-HALF, HALF])
            g.add(new THREE.Mesh(wall(a, b, o, 0, TRACK_Y), bedMat));
    }

    // Start and finish lines painted across the lanes.
    g.add(
        new THREE.Mesh(
            ribbon(
                START_D - 0.15,
                START_D + 0.15,
                -HALF + 0.35,
                HALF - 0.35,
                TRACK_Y + 0.015
            ),
            lineMat
        )
    );
    const finishLine = toon(0xffffff, {
        map: checker(2 * HALF, 0.6, 16),
        unique: true,
    });
    g.add(
        new THREE.Mesh(
            ribbon(
                FINISH_D - 0.3,
                FINISH_D + 0.3,
                -HALF + 0.35,
                HALF - 0.35,
                TRACK_Y + 0.015
            ),
            sided(finishLine)
        )
    );

    // The pool: tiled walls, a deep floor and moving water.
    const water = new THREE.MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const n = mx_noise_float(
        vec3(positionWorld.x.mul(1.4), positionWorld.z.mul(1.4), time.mul(0.9))
    );
    water.colorNode = mix(
        vec3(0.18, 0.72, 1.0),
        vec3(0.9, 1.0, 1.0),
        smoothstep(0.38, 0.72, n).add(
            sin(time.mul(2.4).add(positionWorld.x.mul(1.3))).mul(0.06)
        )
    );
    water.opacityNode = float(0.82);
    const pool = new THREE.Mesh(
        ribbon(poolD[0], poolD[1], -HALF + 0.2, HALF - 0.2, TRACK_Y - 0.12),
        water
    );
    pool.renderOrder = 2;
    g.add(pool);
    g.add(
        new THREE.Mesh(
            ribbon(poolD[0], poolD[1], -HALF, HALF, TRACK_Y - 0.9),
            sided(toon(0x37a9e0))
        )
    );
    const tile = sided(toon(0xffffff));
    for (const o of [-HALF, HALF]) {
        g.add(
            new THREE.Mesh(wall(poolD[0], poolD[1], o, 0, TRACK_Y + 0.12), tile)
        );
        g.add(
            new THREE.Mesh(
                ribbon(
                    poolD[0],
                    poolD[1],
                    o < 0 ? o : o - 0.2,
                    o < 0 ? o + 0.2 : o,
                    TRACK_Y + 0.12
                ),
                tile
            )
        );
    }
    for (const d of poolD) {
        const p = pathPoint(d, 0);
        const lip = new THREE.Mesh(
            new THREE.BoxGeometry(HALF * 2, 0.24, 0.2),
            toon(0xffffff)
        );
        lip.position.set(p.x, TRACK_Y - 0.06, p.z);
        lip.rotation.y = p.h;
        g.add(lip);
    }
    // Lane ropes floating in the pool.
    for (let l = 1; l < LANES; l++) {
        const o = (l - LANES / 2) * LANE_W;
        const rope = new THREE.Mesh(
            ribbon(
                poolD[0],
                poolD[1],
                o - 0.05,
                o + 0.05,
                TRACK_Y - 0.08,
                (d, c) =>
                    c.setHex(Math.floor(d / 0.5) % 2 ? 0xff5f7e : 0xffd23f)
            ),
            sided(toon(0xffffff, { vertexColors: true, unique: true }))
        );
        g.add(rope);
    }

    // The climbing wall: one block per lane with holds, and a ledge on top.
    for (let l = 0; l < LANES; l++) {
        const q = pathPoint(
            wallD + WALL_DEPTH / 2 + 0.12,
            (l - (LANES - 1) / 2) * LANE_W
        );
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(LANE_W * 0.98, WALL_H, WALL_DEPTH),
            toon([0xffc23d, 0xff8a4a, 0xffc23d, 0xff8a4a][l])
        );
        box.position.set(q.x, TRACK_Y + WALL_H / 2, q.z);
        box.rotation.y = q.h;
        outline(box, 0.03);
        box.castShadow = box.receiveShadow = true;
        g.add(box);
        occluders.push(box);
        for (let k = 0; k < 5; k++) {
            const hold = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 8, 6),
                toon(
                    [0x2f7bff, 0x3fbf5a, 0xff5f9e, 0xa07bff, 0xffffff][
                        (k + l) % 5
                    ]
                )
            );
            hold.position.set(
                k % 2 ? 0.28 : -0.28,
                -WALL_H / 2 + 0.45 + k * 0.6,
                -WALL_DEPTH / 2 - 0.03
            );
            hold.scale.z = 0.6;
            box.add(hold);
        }
    }

    // The glide: a pond under the gap and a springy landing pad.
    const pond = new THREE.Mesh(
        ribbon(glideD[0] + 0.6, glideD[1] - 1.4, -HALF - 1.5, HALF + 1.5, 0.75),
        water
    );
    pond.renderOrder = 2;
    g.add(pond);
    g.add(
        new THREE.Mesh(
            ribbon(
                glideD[0] + 0.6,
                glideD[1] - 1.4,
                -HALF - 1.5,
                HALF + 1.5,
                0.2
            ),
            sided(toon(0x2e8fd0))
        )
    );
    const pad = new THREE.Mesh(
        ribbon(glideD[1] - 1.6, glideD[1] + 0.4, -HALF, HALF, TRACK_Y + 0.02),
        sided(toon(0x7ed957))
    );
    g.add(pad);
    for (let i = 0; i < 6; i++) {
        const d = glideD[0] + 1.5 + i * 1.6;
        for (const s of [-1, 1]) {
            const p = pathPoint(d, s * (HALF + 1.2));
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.35, 0.07, 8, 18),
                toon(0xffffff, { emissive: 0x6a5a20 })
            );
            ring.position.set(p.x, TRACK_Y + 1.2 + Math.sin(i) * 0.4, p.z);
            ring.rotation.y = p.h;
            g.add(ring);
        }
    }

    // Gates.
    const start = gate(START_D + 0.9, "START", "#2f7bff", true);
    g.add(start.group);
    const finish = gate(FINISH_D, "GOAL!", "checker", false);
    g.add(finish.group);

    // Bunting poles and balloons along the course.
    const flagColors = [0xff5f7e, 0xffc23d, 0x2f7bff, 0x3fbf5a, 0xa07bff];
    for (let d = 2; d < end; d += 5) {
        if (d > glideD[0] && d < glideD[1]) continue;
        for (const s of [-1, 1]) {
            const p = pathPoint(d, s * (HALF + 0.6));
            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.06, 1.8, 6),
                toon(0xffffff)
            );
            pole.position.set(p.x, TRACK_Y + 0.3, p.z);
            g.add(pole);
            const f = new THREE.Mesh(
                new THREE.ConeGeometry(0.2, 0.42, 3),
                toon(flagColors[Math.floor(d / 5) % flagColors.length])
            );
            f.position.set(p.x, TRACK_Y + 1.05, p.z);
            f.rotation.set(Math.PI / 2, p.h + Math.PI / 2, 0);
            g.add(f);
            const base = heightAt(p.x, p.z);
            if (base < TRACK_Y - 1.4) {
                const stilt = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.08, 0.08, TRACK_Y - base, 6),
                    toon(0xc98a5a)
                );
                stilt.position.set(p.x, (TRACK_Y + base) / 2, p.z);
                g.add(stilt);
            }
        }
    }
    const balloons = [];
    for (const [d, s, col] of [
        [START_D + 0.9, -1, 0xff5f7e],
        [START_D + 0.9, 1, 0xffc23d],
        [FINISH_D, -1, 0x3fbf5a],
        [FINISH_D, 1, 0xa07bff],
        [poolD[0], 1, 0x2f7bff],
        [wallD, -1, 0xff8a4a],
    ]) {
        const p = pathPoint(d, s * (HALF + 1.1));
        const b = balloon(col, p.x, TRACK_Y + 4.6, p.z);
        balloons.push(b);
        g.add(b);
    }

    // Fruit pickups float over their lanes.
    const fruits = [];
    for (const f of fruitSlots()) {
        const row = [];
        for (let l = 0; l < LANES; l++) {
            const p = coursePoint(f.s, l);
            const m = new THREE.Mesh(
                fruitGeometry(f.kind),
                toon(FRUITS[f.kind].color, {
                    emissive: FRUITS[f.kind].color & 0x333333,
                })
            );
            m.position.set(p.x, p.y + 0.55, p.z);
            outline(m, 0.02);
            g.add(m);
            row.push(m);
        }
        fruits.push({ ...f, meshes: row, base: coursePoint(f.s, 0).y + 0.55 });
    }

    // A viewing deck in the middle for the players watching.
    const cx = RACE_ISLE.x - 1;
    const cz = RACE_ISLE.z;
    const deck = new THREE.Mesh(
        new THREE.CylinderGeometry(4.2, 4.6, 1.2, 28),
        toon(0xfff1d6)
    );
    deck.position.set(cx, heightAt(cx, cz) + 0.35, cz);
    outline(deck, 0.04);
    deck.receiveShadow = true;
    g.add(deck);
    const sign = labelPlane("BLOOM DASH", 6, 1.2, "#ffffff", "#ff5f7e");
    sign.position.set(cx, 4.8, cz);
    g.add(sign);
    const sign2 = sign.clone();
    sign2.rotation.y = Math.PI;
    g.add(sign2);
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 3.6, 8),
        toon(0xffffff)
    );
    pole.position.set(cx, 2.6, cz);
    g.add(pole);

    scene.add(g);
    return {
        group: g,
        standY: deck.position.y + 0.6,
        center: { x: cx, z: cz },
        lamps: start.lamps,
        fruits,
        balloons,
        occluders: [...occluders, start.group, finish.group, deck, ...balloons],
    };
}

/** Countdown lights: n = 3, 2, 1 lit red one by one, 0 all green, -1 off. */
export function setLights(course, n) {
    course.lamps.forEach((m, i) => {
        const on = n === 0 || (n > 0 && i < 4 - n);
        const c = n === 0 ? 0x3fff6a : 0xff3b3b;
        m.color.setHex(on ? c : 0x444455);
        m.emissive.setHex(on ? c : 0x000000);
    });
}

export function animateCourse(course, dt, t) {
    for (const f of course.fruits)
        f.meshes.forEach((m, i) => {
            m.rotation.y += dt * 2;
            m.position.y = f.base + Math.sin(t * 3 + i) * 0.08;
        });
    for (const b of course.balloons)
        b.position.y += Math.sin(t * 1.3 + b.userData.phase) * 0.003;
}
