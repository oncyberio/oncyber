import * as T from "three/webgpu";
const rad = Math.PI / 180,
    clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const duration = 29;
export const chapters = [
    [0, "The approach"],
    [3.8, "First contact"],
    [7.1, "The wall"],
    [12.9, "Free fall"],
    [16.4, "The ceiling"],
    [21.4, "The return"],
];
const V = (x, y, z) => new T.Vector3(x, y, z);
export function smooth(a, b, t) {
    const u = clamp((t - a) / (b - a));
    return u * u * (3 - 2 * u);
}
const windowAt = (a, b, c, d, t) => smooth(a, b, t) * (1 - smooth(c, d, t));
// Monotone piecewise cubic interpolation preserves contact holds and endpoints.
// Each actor key is [seconds, pelvis x/y/z in set metres, bank, heading, somersault].
function slope(x, y) {
    return x * y <= 0 ? 0 : (2 * x * y) / (x + y);
}
function sample(keys, t) {
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1][0] < t) i++;
    const a = keys[i],
        b = keys[i + 1],
        p = keys[i - 1],
        c = keys[i + 2],
        dt = b[0] - a[0],
        u = clamp((t - a[0]) / dt),
        u2 = u * u,
        u3 = u2 * u;
    return a.slice(1).map((v, k) => {
        const j = k + 1,
            d = (b[j] - v) / dt;
        const m = p ? slope((v - p[j]) / (a[0] - p[0]), d) : d;
        const n = c ? slope(d, (c[j] - b[j]) / (c[0] - b[0])) : d;
        return (
            (2 * u3 - 3 * u2 + 1) * v +
            (u3 - 2 * u2 + u) * dt * m +
            (-2 * u3 + 3 * u2) * b[j] +
            (u3 - u2) * dt * n
        );
    });
}
const hero = [
    [0, -0.3, 1.02, 5.5, 0, 3, 0],
    [2.7, -0.24, 1.02, 8.5, 0, 5, 0],
    [3.8, -0.32, 1.0, 10.1, -3, 25, 5],
    [4.65, -0.32, 0.93, 10.94, -5, 44, 8],
    [5.3, -0.38, 0.91, 10.99, -11, 48, 12],
    [5.85, -0.36, 0.94, 11.07, 5, 39, 2],
    [6.5, -0.25, 0.9, 11.21, -8, 32, 14],
    [7.12, -0.28, 0.94, 11.32, -15, 34, 7],
    [7.72, -0.73, 1.04, 11.5, -42, 25, -8],
    [8.18, -0.91, 1.36, 11.89, -77, 25, -16],
    [8.54, -0.91, 1.55, 12.18, -108, 11, 9],
    [9.05, -0.71, 1.6, 12.61, -91, 4, 15],
    [9.8, -0.64, 1.51, 13.37, -87, 0, 4],
    [12.28, -0.65, 1.49, 16.9, -89, 5, 6],
    [13.1, -0.72, 1.58, 17.83, -91, 23, 13],
    [13.68, -0.79, 1.6, 18.05, -110, 29, 23],
    [14.16, -0.55, 1.51, 18.38, -139, 20, 53],
    [14.74, 0.02, 1.53, 18.82, -171, -8, 95],
    [15.28, 0.38, 1.81, 19.23, -194, -23, 142],
    [15.85, 0.46, 1.96, 19.61, -194, -35, 242],
    [16.36, 0.32, 1.97, 19.9, -181, -35, 325],
    [16.8, 0.31, 1.87, 20.1, -180, -38, 368],
    [17.2, 0.34, 1.75, 20.11, -180, -39, 361],
    [18.5, 0.33, 1.79, 20.26, -178, -42, 370],
    [19.4, 0.26, 1.83, 20.46, -182, -43, 372],
    [20.2, 0.28, 1.77, 20.56, -182, -40, 359],
    [21.18, 0.32, 1.72, 21.22, -183, -18, 366],
    [21.67, 0.59, 1.85, 21.82, -203, -13, 378],
    [22.14, 0.9, 1.71, 22.45, -246, 1, 392],
    [22.62, 0.85, 1.28, 23.02, -287, 5, 410],
    [23.03, 0.47, 1.03, 23.49, -321, -5, 385],
    [23.47, 0.12, 0.73, 23.89, -350, 3, 392],
    [23.74, 0.02, 0.68, 24.08, -358, 8, 400],
    [24.5, -0.08, 0.91, 24.4, -360, 2, 374],
    [25.45, -0.15, 1.02, 25.04, -360, -6, 360],
    [29, -0.27, 1.02, 28.4, -360, -2, 360],
];
const first = [
    [0, 0.42, 1.01, 15.1, 0, -169, 0],
    [2.6, 0.4, 1.0, 13.65, 0, -166, 0],
    [3.9, 0.32, 0.98, 12.0, 3, -146, 5],
    [4.62, 0.21, 0.93, 11.5, 3, -136, 10],
    [5.39, 0.25, 0.93, 11.55, 10, -135, 5],
    [5.92, 0.31, 0.94, 11.65, -5, -140, -11],
    [6.52, 0.23, 0.92, 11.72, 6, -143, 13],
    [7.15, 0.18, 0.94, 11.88, -13, -150, 7],
    [7.75, -0.2, 1.19, 12.02, -45, -161, -18],
    [8.21, -0.56, 1.53, 12.47, -74, -153, 18],
    [8.62, -0.9, 1.61, 12.8, -103, -160, 43],
    [9.05, -0.96, 1.6, 13.15, -115, -173, 70],
    [9.62, -1.26, 1.1, 13.19, -162, -175, 90],
    [10.15, -1.42, 0.55, 13.0, -199, -184, 92],
    [13, -1.4, 0.36, 12.8, -194, -186, 88],
    [16, -0.43, 2.3, 12.35, -180, -180, 87],
    [20, -0.4, 2.4, 12.2, -180, -184, 90],
    [24, -1.08, 0.36, 12.15, -352, -184, 90],
    [29, -1.08, 0.3, 12.15, -360, -184, 90],
];
const second = [
    [0, 0.24, 1.01, 26.7, 0, 179, 0],
    [4, 0.21, 1.02, 25.8, 0, 181, 0],
    [7, 0.15, 1.02, 24.72, -6, 181, 5],
    [8.9, -0.48, 1.26, 23.7, -68, 174, 10],
    [10, -0.64, 1.58, 22.56, -89, 177, 8],
    [12.3, -0.65, 1.65, 19.65, -90, 180, 10],
    [13.08, -0.69, 1.77, 18.57, -91, 197, 12],
    [13.65, -0.67, 1.8, 18.64, -105, 205, -3],
    [14.32, -0.75, 1.97, 19.05, -139, 187, 23],
    [14.9, -0.68, 1.81, 19.6, -168, 181, 65],
    [15.6, -0.47, 1.81, 20.36, -194, 156, 82],
    [16.2, -0.03, 2.09, 20.65, -188, 149, 36],
    [16.78, -0.18, 1.88, 20.66, -180, 143, 3],
    [17.48, -0.16, 1.79, 20.73, -179, 140, 12],
    [18.55, -0.18, 1.81, 20.82, -184, 134, 6],
    [19.5, -0.18, 1.91, 20.99, -191, 140, -20],
    [20.36, -0.25, 2.09, 21.13, -204, 153, -55],
    [21.25, -0.28, 2.38, 20.98, -209, 154, -84],
    [22.23, 0.25, 2.08, 20.6, -236, 169, -89],
    [23.15, 0.82, 0.65, 20.29, -310, 180, -88],
    [24, 0.87, 0.31, 20.2, -358, 183, -88],
    [29, 0.82, 0.29, 20.2, -360, 183, -88],
];
const roll = [
    [0, 0],
    [2.7, 0],
    [4.6, 6],
    [6.4, -5],
    [7.15, 6],
    [8.45, 84],
    [9.24, 104],
    [10.5, 88],
    [12.7, 91],
    [13.3, 107],
    [15.67, 192],
    [16.64, 180],
    [18.7, 184],
    [20.6, 173],
    [21.45, 193],
    [22.9, 305],
    [23.8, 369],
    [25.2, 355],
    [26.4, 360],
    [29, 360],
];
// Wind-up, full extension and release are independent of the clip phase.
// World-space target evaluation happens after all actors have sampled their poses.
const contacts = [
    [1, 0, "Right", "LeftShoulder", 4.39, 4.69, 4.94],
    [0, 1, "Left", "RightShoulder", 4.61, 4.8, 5.06],
    [0, 1, "Right", "Spine2", 5.34, 5.68, 5.97],
    [1, 0, "Left", "RightShoulder", 6.02, 6.29, 6.56],
    [0, 1, "Left", "LeftArm", 6.63, 6.91, 7.8],
    [1, 0, "Right", "LeftArm", 6.78, 7.09, 7.78],
    [0, 1, "Right", "Spine2", 8.35, 8.63, 9.05],
    [2, 0, "Right", "LeftShoulder", 12.78, 13.1, 13.46],
    [0, 2, "Left", "RightArm", 13.08, 13.4, 14.29],
    [2, 0, "Left", "RightArm", 13.18, 13.55, 14.32],
    [2, 0, "Left", "Spine2", 17.13, 17.46, 17.74],
    [0, 2, "Right", "LeftShoulder", 17.58, 17.83, 18.12],
    [2, 0, "Right", "RightShoulder", 18.14, 18.42, 18.73],
    [0, 2, "Left", "Spine2", 18.72, 19.02, 19.27],
    [0, 2, "Right", "LeftShoulder", 19.29, 19.65, 20.06],
];
function envelope(start, peak, end, t) {
    return smooth(start, peak, t) * (1 - smooth(peak, end, t));
}
function makePose(keys, role, t) {
    const [x, y, z, bank, yaw, pitch] = sample(keys, t),
        g1 = windowAt(3.65, 4.28, 8.7, 9.55, t),
        g2 = windowAt(12.38, 13.04, 13.75, 14.5, t),
        g3 = windowAt(16.32, 16.98, 19.85, 20.45, t);
    const air =
        role === 1
            ? windowAt(7.04, 7.67, 8.95, 9.86, t)
            : Math.max(
                  windowAt(7.1, 7.72, 8.41, 9.08, t),
                  windowAt(13.5, 14.08, 16.1, 16.66, t),
                  windowAt(21.38, 22.02, 23.15, 23.67, t)
              );
    const guard =
        role === 1 ? g1 : role === 2 ? Math.max(g2, g3) : Math.max(g1, g2, g3);
    const land =
        role === 0
            ? Math.max(
                  envelope(8.4, 8.65, 9.16, t),
                  envelope(16.27, 16.66, 17.13, t),
                  envelope(23.12, 23.64, 24.65, t)
              )
            : 0;
    const down =
        role === 1
            ? smooth(8.72, 9.8, t)
            : role === 2
            ? smooth(19.82, 20.98, t)
            : 0;
    const running = windowAt(9.1, 9.68, 12.47, 13.12, t) * (1 - down);
    const idle = clamp(Math.max(guard * 0.95, down, land * 0.35)),
        walking = (1 - idle) * (1 - running);
    const weights = { IDLE: idle, WALK: walking, RUN: (1 - idle) * running };
    for (const k in weights) weights[k] *= (1 - air) * (1 - land);
    weights.JUMP = air * (1 - land);
    weights.LAND = land;
    let twist = 0,
        hit = 0;
    for (const [src, dst, hand, , a, b, c] of contacts) {
        if (role === src)
            twist +=
                (hand === "Right" ? -1 : 1) *
                (0.44 * envelope(a, b, c, t) -
                    0.22 * envelope(a - 0.22, a, b, t));
        if (role === dst)
            hit = Math.max(hit, envelope(b - 0.05, b + 0.09, c + 0.22, t));
    }
    const phase = t * (role === 0 ? 0.87 : 0.81) + role * 0.31;
    return {
        x,
        y,
        z,
        bank: bank * rad,
        yaw: yaw * rad,
        pitch: pitch * rad,
        weights,
        phase,
        clipTime: {
            RUN: t * 0.57,
            JUMP: t * 0.55,
            LAND: clamp(t - (t < 12 ? 8.38 : t < 20 ? 16.21 : 23.12), 0, 1.25),
        },
        guard,
        air,
        tuck: clamp(0.79 * land + 0.62 * air + 0.4 * down),
        twist,
        hit,
    };
}
function camera(t, poses, angle) {
    const p = poses[0],
        bob = 0.022 * Math.sin(t * 5),
        aspect = innerWidth / innerHeight;
    let x, y, z, tx, ty, tz, fov, follow;
    if (t < 3.8) {
        // Lead the walk, seeing the traveller's face before revealing the agent.
        x = 0.74 - (0.26 * t) / 3.8;
        y = 1.31 + bob;
        z = p.z + 3.95 - (0.65 * t) / 3.8;
        tx = p.x;
        ty = 1.09;
        tz = p.z;
        fov = 42;
        follow = 0.05;
    } else if (t < 7.55) {
        x = 1.03;
        y = 1.17 + bob;
        z = p.z - 2.4;
        tx = -0.02;
        ty = 1.12;
        tz = p.z + 0.33;
        fov = 55;
        follow = 0.14;
    } else if (t < 12.94) {
        const u = smooth(7.6, 10.0, t);
        x = 0.62 + 0.39 * u;
        y = 1.28;
        z = p.z - 2.94;
        tx = p.x * 0.58;
        ty = 1.37;
        tz = p.z + 0.33;
        fov = 54;
        follow = 0.25;
    } else if (t < 16.62) {
        x = 1.13 - 0.3 * smooth(13.7, 15.95, t);
        y = 0.93;
        z = p.z - 2.78;
        tx = 0;
        ty = 1.5;
        tz = p.z + 0.34;
        fov = 56;
        follow = 0.54;
    } else if (t < 21.5) {
        x = -1.03;
        y = 1.12;
        z = p.z - 2.51;
        tx = 0.02;
        ty = 1.67;
        tz = p.z + 0.32;
        fov = 52;
        follow = 0.79;
    } else if (t < 25.02) {
        x = -0.84;
        y = 1.21;
        z = p.z + 3.05;
        tx = 0.05 + p.x * 0.65;
        ty = 1.22;
        tz = p.z;
        fov = 52;
        follow = 0.31;
    } else {
        x = 0.56;
        y = 1.21;
        z = 22.1 + 0.22 * (t - 25);
        tx = p.x;
        ty = 1.16;
        tz = p.z;
        fov = 47;
        follow = 0;
    }
    // 'follow' is the share of the room's roll inherited by the camera.
    // At the ceiling beat the camera mostly follows the ceiling and the actors hang inverted in frame.
    return {
        eye: [x, y, z],
        target: [tx, ty, tz],
        cameraBank: angle * (follow - 1),
        fov: aspect < 0.85 ? Math.min(91, fov + 22) : fov,
    };
}
export function drawSequence(t, actors) {
    const angle = sample(roll, t)[0] * rad,
        poses = [hero, first, second].map((k, i) => makePose(k, i, t));
    actors.forEach((a, i) => {
        a.pose(poses[i]);
        a.plant(a.root.parent, poses[i]);
    });
    for (const [src, dst, side, bone, start, peak, end] of contacts) {
        if (t < start || t > end) continue;
        const target = actors[dst].bones[bone].getWorldPosition(
            new T.Vector3()
        );
        // Stop the wrist short by the remaining palm length.
        const from = actors[src].bones[side + "Arm"].getWorldPosition(
            new T.Vector3()
        );
        const delta = from.sub(target);
        if (delta.lengthSq() > 0.001)
            target.addScaledVector(delta.normalize(), 0.068);
        actors[src].reach(side, target, envelope(start, peak, end, t));
    }
    return {
        angle,
        poses,
        view: camera(t, poses, angle),
        chapter: chapters.filter((c) => t >= c[0]).at(-1)[1],
    };
}
