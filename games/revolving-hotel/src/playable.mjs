import * as T from "three/webgpu";
import { WIDTH, HEIGHT, LENGTH } from "./hotel/scene.mjs";
const clamp = T.MathUtils.clamp;
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const approach = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
const bounds = [
    [-WIDTH / 2 + 0.075, WIDTH / 2 - 0.075],
    [0, HEIGHT - 0.03],
];
const normals = [
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 0],
];
export function createRun(actors) {
    let time = 0,
        angle = 0,
        jump = false,
        strike = false,
        strikeSide = false,
        cleared = false,
        lastTag = "",
        stagger = 0;
    const people = [
        [-0.24, 4.2],
        [0.34, 11.4],
        [-0.25, 21.6],
    ].map(([x, z], i) => ({
        x,
        y: 1.01,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        bank: 0,
        yaw: i ? Math.PI : 0,
        normal: 0,
        grounded: true,
        phase: i * 0.21,
        clock: -1,
        health: i ? 2 : 5,
        impact: 0,
        down: 0,
        hit: false,
        fall: 0,
    }));
    function restart() {
        return createRun(actors);
    }
    function step(dt, held) {
        if (cleared || people[0].health <= 0) return;
        time += dt;
        angle =
            Math.max(0, time - 2.8) * 0.49 +
            0.52 * Math.sin(Math.max(0, time - 2.8) * 0.71);
        const gx = -Math.sin(angle) * 9.8,
            gy = -Math.cos(angle) * 9.8;
        const h = people[0];
        for (let i = 0; i < 3; i++) {
            const a = people[i],
                player = i === 0,
                dx = h.x - a.x,
                distZ = h.z - a.z,
                near = Math.abs(distZ) < 4.6,
                alive = a.health > 0;
            const motion = player
                ? Number(held.has("forward")) - Number(held.has("back"))
                : near && alive && Math.abs(distZ) > 0.62
                ? Math.sign(distZ) * 0.5
                : 0;
            const side = player
                ? Number(held.has("left")) - Number(held.has("right"))
                : 0;
            const speed = player ? (held.has("sprint") ? 3.25 : 1.95) : 2.4;
            a.vz = approach(a.vz, motion * speed, alive ? 9 : 3, dt);
            a.z = clamp(a.z + a.vz * dt, 0.75, LENGTH - 0.74);
            const [nx, ny] = normals[a.normal];
            const brace = a.grounded ? 1 : 0.15;
            a.vx += gx * dt;
            a.vy += gy * dt;
            const tangentV = a.vx * ny - a.vy * nx;
            const sideSpeed =
                side * 1.45 +
                (player ? 0 : near && alive ? clamp(dx, -0.45, 0.45) * ny : 0);
            const drag =
                (sideSpeed - tangentV) * (1 - Math.exp(-9 * dt)) * brace;
            a.vx += drag * ny;
            a.vy -= drag * nx;
            if (player && jump && a.grounded) {
                a.vx += nx * 4.35;
                a.vy += ny * 4.35;
                a.grounded = false;
                a.fall = 0.32;
            }
            a.x += a.vx * dt;
            a.y += a.vy * dt;
            a.fall = Math.max(0, a.fall - dt);
            const desired = Math.atan2(-nx, ny);
            a.bank +=
                angleDiff(desired, a.bank) *
                (1 - Math.exp(-dt * (a.grounded ? 10 : 4)));
            const ux = -Math.sin(a.bank),
                uy = Math.cos(a.bank);
            const collapse = alive ? 1 : 0.36,
                foot = 0.96 * collapse,
                head = 0.77 * collapse,
                rad = alive ? 0.18 : 0.23;
            const ext = (x) => [
                Math.min(-foot * x, head * x) - rad * (1 - Math.abs(x)),
                Math.max(-foot * x, head * x) + rad * (1 - Math.abs(x)),
            ];
            let best = -1,
                load = 0.2;
            const hits = [];
            for (const [k, axis, vaxis] of [
                [0, "x", "vx"],
                [1, "y", "vy"],
            ]) {
                const [lo, hi] = ext(k ? uy : ux);
                if (a[axis] + lo < bounds[k][0] + 0.001) {
                    a[axis] = bounds[k][0] - lo;
                    a[vaxis] = Math.max(0, a[vaxis]);
                    hits.push(k ? 0 : 3);
                }
                if (a[axis] + hi > bounds[k][1] - 0.001) {
                    a[axis] = bounds[k][1] - hi;
                    a[vaxis] = Math.min(0, a[vaxis]);
                    hits.push(k ? 2 : 1);
                }
            }
            for (const id of hits) {
                const [xx, yy] = normals[id],
                    support = -(gx * xx + gy * yy);
                if (support > load) {
                    best = id;
                    load = support;
                }
            }
            a.grounded = best >= 0 && a.fall === 0;
            if (best >= 0) a.normal = best;
            const targetAngle = player
                ? motion < 0
                    ? Math.PI
                    : 0
                : distZ < 0
                ? Math.PI
                : 0;
            a.yaw += angleDiff(targetAngle, a.yaw) * (1 - Math.exp(-dt * 11));
            a.phase += dt * (0.63 + 0.3 * Math.abs(a.vz));
            a.impact = Math.max(0, a.impact - dt * 2.8);
            a.down = approach(a.down, alive ? 0 : 1, 4.5, dt);
            a.clock += a.clock >= 0 ? dt : 0;
            if (a.clock > (player ? 0.53 : 1.18)) a.clock = -1;
            const reach = Math.hypot(h.x - a.x, h.y - a.y, distZ);
            if (
                a.clock < 0 &&
                alive &&
                (player ? strike : reach < 1.13 && h.health > 0)
            ) {
                a.clock = 0;
                a.hit = false;
                if (player) strikeSide = !strikeSide;
            }
        }
        for (let i = 0; i < 3; i++) {
            const a = people[i];
            if (a.hit || a.clock < (i ? 0.38 : 0.145) || a.health <= 0)
                continue;
            a.hit = true;
            const targets = i
                ? [h]
                : people
                      .slice(1)
                      .filter((b) => b.health > 0)
                      .sort(
                          (a, b) => Math.abs(a.z - h.z) - Math.abs(b.z - h.z)
                      );
            const b = targets[0];
            if (!b) continue;
            if (
                Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 1.23 ||
                (Math.abs(a.z - b.z) > 0.3 && (b.z - a.z) * Math.cos(a.yaw) < 0)
            )
                continue;
            b.impact = 1;
            b.vz += Math.sign(b.z - a.z || 1) * (i ? 0.7 : 1.35);
            if (i === 0 || stagger <= 0) {
                b.health = Math.max(0, b.health - 1);
                if (i) stagger = 1.15;
            }
        }
        stagger = Math.max(0, stagger - dt);
        jump = false;
        strike = false;
        if (h.z > LENGTH - 1.65 && people.slice(1).every((p) => !p.health))
            cleared = true;
    }
    function draw() {
        const h = people[0],
            poses = people.map((a, i) => {
                const moving =
                        clamp(Math.abs(a.vz) / 1.65, 0, 1) * (1 - a.down),
                    air = a.grounded ? 0 : 1,
                    run = clamp((Math.abs(a.vz) - 1.95) / 1.1, 0, 1);
                const near = i
                    ? Math.abs(h.z - a.z) < 3.2
                    : people
                          .slice(1)
                          .some(
                              (b) => b.health > 0 && Math.abs(h.z - b.z) < 2.6
                          );
                return {
                    x: a.x,
                    y: a.y,
                    z: a.z,
                    bank: a.bank,
                    yaw: a.yaw,
                    pitch: a.down * 1.52,
                    phase: a.phase,
                    weights: {
                        IDLE: (1 - moving) * (1 - air),
                        WALK: moving * (1 - run) * (1 - air),
                        RUN: moving * run * (1 - air),
                        JUMP: air,
                    },
                    air: air * 0.72,
                    guard: (near ? 0.75 : 0) * (1 - a.down),
                    twist:
                        a.clock >= 0
                            ? 0.32 *
                              Math.sin(Math.min(a.clock / 0.52, 1) * Math.PI)
                            : 0,
                    hit: a.impact,
                    tuck: air * 0.4 + a.down * 0.32,
                };
            });
        actors.forEach((a, i) => {
            a.pose(poses[i]);
            if (people[i].grounded) a.plant(a.root.parent, poses[i]);
        });
        for (const [i, a] of actors.entries()) {
            const p = people[i];
            if (p.clock < 0 || p.health === 0) continue;
            const side = i ? "Left" : strikeSide ? "Right" : "Left",
                time = i ? p.clock / 0.67 : p.clock / 0.39;
            const target = i
                ? actors[0]
                : actors[
                      (people[1].health &&
                          Math.abs(people[1].z - h.z) <
                              Math.abs(people[2].z - h.z)) ||
                      !people[2].health
                          ? 1
                          : 2
                  ];
            const dest = target.bones.Spine2.getWorldPosition(V()),
                source = a.bones[side + "Arm"].getWorldPosition(V());
            const goal =
                source.distanceTo(dest) < 1.25
                    ? dest
                    : a.localPoint(side === "Left" ? 0.1 : -0.1, 0.38, 0.65);
            a.reach(side, goal, Math.sin(clamp(time, 0, 1) * Math.PI));
        }
        const defeated = people.slice(1).filter((p) => !p.health).length;
        lastTag = cleared
            ? "Lift reached"
            : h.health <= 0
            ? "Caught by the agents"
            : defeated === 2
            ? "Reach the lift"
            : "Reach the lift · " + defeated + "/2 agents cleared";
        return {
            angle,
            poses,
            view: {
                eye: [
                    clamp(h.x * 0.45 + 0.48, -1.16, 1.16),
                    1.33,
                    clamp(h.z - 3.05, 0.26, LENGTH - 0.5),
                ],
                target: [h.x * 0.74, h.y + 0.08, h.z + 0.52],
                cameraBank: -angle * 0.68,
                fov: innerWidth < innerHeight ? 77 : 57,
            },
            chapter: lastTag,
            finished: cleared || h.health <= 0,
            health: h.health,
        };
    }
    function snapshot() {
        return {
            time,
            angle,
            cleared,
            stagger,
            strikeSide,
            people: people.map((p) => ({ ...p })),
        };
    }
    function restore(s) {
        if (!s || s.people?.length !== 3) return;
        time = s.time;
        angle = s.angle;
        cleared = s.cleared;
        stagger = s.stagger;
        strikeSide = s.strikeSide;
        people.forEach((p, i) => Object.assign(p, s.people[i]));
    }
    return {
        step,
        draw,
        restart,
        snapshot,
        restore,
        action(key) {
            if (key === "jump") jump = true;
            if (key === "strike") strike = true;
        },
    };
}
