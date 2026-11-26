import * as T from "three/webgpu";
import { createPoseSampler } from "./pose-layers.mjs";
import { retargetClip } from "@oncyber/avatar-kit";
import { decodeCC0LocomotionPack } from "./motion/cc0LocomotionPack.ts";
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const clamp = T.MathUtils.clamp;
const TAU = Math.PI * 2;
const skinTones = ["#cc9981", "#a86f52", "#805540"];
const wardrobes = [
    {
        jacket: "#65554a",
        shirt: "#dfd4bc",
        pants: "#453c37",
        tie: "#56403a",
        hair: "#3c2c22",
        vest: true,
    },
    {
        jacket: "#323945",
        shirt: "#c4c8ca",
        pants: "#30343d",
        tie: "#685650",
        hair: "#211c19",
    },
    {
        jacket: "#535354",
        shirt: "#c2beb0",
        pants: "#414245",
        tie: "#333846",
        hair: "#201c18",
    },
];
export async function loadCast() {
    const url = (name) => new URL("./assets/" + name, document.baseURI);
    const [mesh, core, air] = await Promise.all(
        [
            "fitted-cast.json.gz",
            "quaternius-core.c66c3d2a7450.lcp",
            "quaternius-jump.8983c8916396.lcp",
        ].map(async (k) => {
            const r = await fetch(url(k));
            if (!r.ok) throw Error("Missing cast asset " + k);
            return r;
        })
    );
    const anatomy = await new Response(
        mesh.body.pipeThrough(new DecompressionStream("gzip"))
    ).json();
    return {
        anatomy,
        clips: {
            ...decodeCC0LocomotionPack(await core.arrayBuffer()).clips,
            ...decodeCC0LocomotionPack(await air.arrayBuffer()).clips,
        },
    };
}

export function buildCharacter(data, role) {
    const w = wardrobes[role],
        rest = {},
        ids = {},
        bones = {},
        normBones = {};
    for (const [i, [name, , x, y, z]] of data.bones.entries()) {
        rest[name] = V(x, y, z);
        ids[name] = i;
        bones[name] = new T.Bone();
        bones[name].name = name;
    }
    const boneList = Object.values(bones),
        root = new T.Group(),
        pivot = new T.Group();
    root.add(pivot);
    for (const [i, [name, parent]] of data.bones.entries()) {
        const b = boneList[i];
        b.position.copy(rest[name]);
        if (parent >= 0) {
            b.position.sub(rest[data.bones[parent][0]]);
            boneList[parent].add(b);
        } else pivot.add(b);
    }
    // The kit requests normalized VRM names in precisely this source-bone order.
    const vrm = {
        humanoid: {
            getNormalizedBoneNode(n) {
                return normBones[n] || null;
            },
        },
    };
    const central = {
        Hips: "hips",
        Spine: "spine",
        Spine1: "chest",
        Spine2: "upperChest",
        Head: "head",
        Neck: "neck",
    };
    for (const [n, b] of Object.entries(bones)) {
        if (central[n]) {
            normBones[central[n]] = b;
            continue;
        }
        const [, side, part] = n.match(/^(Left|Right)(.+)$/);
        let norm =
            {
                Arm: "UpperArm",
                ForeArm: "LowerArm",
                UpLeg: "UpperLeg",
                Leg: "LowerLeg",
                ToeBase: "Toes",
            }[part] || part;
        const m = part.match(/^Hand(Thumb|Index|Middle|Ring|Pinky)([123])$/);
        if (m)
            norm =
                (m[1] === "Pinky" ? "Little" : m[1]) +
                (m[1] === "Thumb"
                    ? ["Metacarpal", "Proximal", "Distal"]
                    : ["Proximal", "Intermediate", "Distal"])[+m[2] - 1];
        normBones[side.toLowerCase() + norm] = b;
    }
    const pos = [],
        nor = [],
        col = [],
        si = [],
        sw = [],
        ix = [];
    const colorCache = new Map();
    function color(c) {
        if (!colorCache.has(c)) colorCache.set(c, new T.Color(c));
        return colorCache.get(c);
    }
    function vertex(p, n, c, j, wt, shade = 1) {
        const i = pos.length / 3;
        pos.push(p.x, p.y, p.z);
        nor.push(n.x, n.y, n.z);
        const rgb = typeof c === "string" ? color(c) : c;
        col.push(rgb.r * shade, rgb.g * shade, rgb.b * shade);
        si.push(j[0] || 0, j[1] || 0, j[2] || 0, j[3] || 0);
        sw.push(wt[0] || 0, wt[1] || 0, wt[2] || 0, wt[3] || 0);
        return i;
    }
    for (const [part, buf] of Object.entries(data.parts)) {
        const offset = pos.length / 3;
        for (const v of buf.v) {
            const p = V(v[0] / 1e4, v[1] / 1e4, v[2] / 1e4),
                n = V(v[3] / 100, v[4] / 100, v[5] / 100).normalize();
            let c = color(
                part === "skin"
                    ? skinTones[role]
                    : part === "shoes"
                    ? "#24201f"
                    : "#c5b9a8"
            ).clone();
            if (part === "skin" && p.y > 1.53) {
                const brow = Math.abs(p.x),
                    arch = 1.707 - 0.2 * Math.abs(brow - 0.041);
                if (
                    p.z > 0.122 &&
                    brow < 0.065 &&
                    brow > 0.014 &&
                    Math.abs(p.y - arch) < 0.004
                )
                    c.lerp(color(w.hair), 0.78);
                const lip =
                    Math.exp(
                        -(((p.y - 1.622) / 0.006) ** 2 + (p.x / 0.032) ** 2)
                    ) * clamp((p.z - 0.13) * 80, 0, 1);
                c.lerp(color("#975d53"), lip * 0.77);
                const beard =
                    clamp((1.655 - p.y) * 19, 0, 0.4) *
                    clamp((p.z - 0.025) * 11, 0, 1);
                c.lerp(color(w.hair), beard * (role === 1 ? 1 : 0.42));
            }
            if (part === "eyes") {
                const r = Math.hypot(Math.abs(p.x) - 0.027, p.y - 1.685);
                if (p.z > 0.137 && r < 0.0076)
                    c = color(r < 0.0035 ? "#100f0e" : "#4f5042");
            }
            const variation =
                0.995 + 0.004 * Math.sin(v[0] * 0.091 + v[2] * 0.055);
            const weights = v.slice(10, 14),
                sum = weights.reduce((a, b) => a + b, 0) || 1;
            vertex(
                p,
                n,
                c,
                v.slice(6, 10),
                weights.map((a) => a / sum),
                variation
            );
        }
        for (const i of buf.i) ix.push(offset + i);
    }
    function skinned(p, n, c, b1, b2, mix = 0, shade = 1) {
        return vertex(p, n, c, [ids[b1], ids[b2]], [1 - mix, mix], shade);
    }
    function strip(a, b, reverse = false) {
        for (let j = 0; j < a.length; j++) {
            const k = (j + 1) % a.length;
            if (reverse) ix.push(a[j], b[k], a[k], a[j], b[j], b[k]);
            else ix.push(a[j], a[k], b[k], a[j], b[k], b[j]);
        }
    }
    // Tailored profiles, expressed in the common bind space. Each hem, knee, elbow
    // and shoulder can be influenced by both of its neighbouring joints.
    function tube(rings, c, axis = "y", s = 1) {
        const sides = 36;
        let prev = null;
        for (const [index, r] of rings.entries()) {
            const [along, r1, r2, off, depth, b1, b2, mix = 0] = r,
                ring = [];
            for (let j = 0; j < sides; j++) {
                const a = (j * TAU) / sides,
                    sa = Math.sin(a),
                    ca = Math.cos(a);
                const wrinkle =
                    1 +
                    0.011 * Math.cos(6 * a + index * 0.75) +
                    0.016 * Math.cos(3 * a - index * 1.3);
                let p, n;
                if (axis === "y") {
                    p = V(
                        off + r1 * sa * wrinkle,
                        along,
                        depth + r2 * ca * wrinkle
                    );
                    n = V(sa / r1, 0, ca / r2).normalize();
                } else {
                    p = V(
                        s * along,
                        off + r1 * sa * wrinkle,
                        depth + r2 * ca * wrinkle
                    );
                    n = V(0, sa / r1, ca / r2).normalize();
                }
                const grain = 0.98 + 0.017 * Math.cos(j * 2.7);
                ring.push(skinned(p, n, c, b1, b2 || b1, mix, grain));
            }
            if (prev) strip(prev, ring, axis === "x" ? s === 1 : false);
            prev = ring;
        }
    }
    for (const [s, side] of [
        [1, "Left"],
        [-1, "Right"],
    ]) {
        const leg = side + "UpLeg",
            knee = side + "Leg",
            arm = side + "Arm",
            el = side + "ForeArm";
        tube(
            [
                [0.09, 0.089, 0.102, 0.127 * s, 0.002, knee],
                [0.113, 0.098, 0.108, 0.127 * s, 0.002, knee],
                [0.14, 0.092, 0.103, 0.127 * s, 0.006, knee],
                [0.24, 0.087, 0.091, 0.127 * s, -0.003, knee],
                [0.38, 0.089, 0.097, 0.126 * s, -0.006, knee],
                [0.485, 0.092, 0.099, 0.126 * s, 0.003, knee, leg, 0.18],
                [0.525, 0.094, 0.105, 0.125 * s, 0.005, knee, leg, 0.48],
                [0.565, 0.097, 0.11, 0.124 * s, 0.005, knee, leg, 0.82],
                [0.72, 0.117, 0.126, 0.118 * s, 0.002, leg],
                [0.89, 0.132, 0.139, 0.111 * s, 0.001, leg, "Hips", 0.12],
                [1.013, 0.128, 0.142, 0.105 * s, 0.002, leg, "Hips", 0.8],
            ],
            w.pants
        );
        const sleeve = w.vest ? w.shirt : w.jacket;
        tube(
            [
                [0.153, 0.101, 0.102, 1.448, 0.017, arm, "Spine2", 0.68],
                [0.204, 0.1, 0.111, 1.445, 0.018, arm, "Spine2", 0.24],
                [0.247, 0.098, 0.109, 1.448, 0.018, arm],
                [0.3, 0.082, 0.089, 1.446, 0.02, arm],
                [0.4, 0.073, 0.078, 1.441, 0.02, arm],
                [0.467, 0.066, 0.068, 1.44, 0.019, arm, el, 0.3],
                [0.489, 0.067, 0.067, 1.441, 0.02, arm, el, 0.7],
                [0.52, 0.069, 0.068, 1.445, 0.019, el],
                [0.614, 0.058, 0.062, 1.443, 0.02, el],
                [0.71, 0.049, 0.05, 1.443, 0.02, el],
                [0.732, 0.05, 0.051, 1.443, 0.02, el],
            ],
            sleeve,
            "x",
            s
        );
        tube(
            [
                [0.72, 0.051, 0.053, 1.443, 0.02, el],
                [0.742, 0.05, 0.052, 1.443, 0.02, el],
                [0.75, 0.046, 0.048, 1.443, 0.02, el],
            ],
            w.shirt,
            "x",
            s
        );
    }
    const torso = [
        [0.91, 0.214, 0.148, 0, 0.003, "Hips"],
        [0.966, 0.226, 0.156, 0, 0.009, "Hips"],
        [1.055, 0.201, 0.145, 0, 0.011, "Hips", "Spine", 0.4],
        [1.13, 0.191, 0.14, 0, 0.01, "Spine", "Spine1", 0.15],
        [1.24, 0.212, 0.153, 0, 0.008, "Spine1", "Spine2", 0.28],
        [1.356, 0.249, 0.151, 0, 0.008, "Spine2"],
        [1.437, 0.243, 0.137, 0, 0.011, "Spine2"],
        [1.478, 0.214, 0.119, 0, 0.012, "Spine2"],
        [1.505, 0.151, 0.099, 0, 0.022, "Spine2"],
        [1.535, 0.074, 0.078, 0, 0.031, "Neck", "Spine2", 0.5],
    ];
    tube(torso, w.jacket);
    function frontZ(x, y) {
        let a = torso[0],
            b = torso.at(-1);
        for (let i = 1; i < torso.length; i++)
            if (y <= torso[i][0]) {
                a = torso[i - 1];
                b = torso[i];
                break;
            }
        const u = clamp((y - a[0]) / (b[0] - a[0]), 0, 1),
            f = (i) => a[i] * (1 - u) + b[i] * u;
        return (
            f(4) + f(2) * Math.sqrt(Math.max(0.02, 1 - (x / f(1)) ** 2)) + 0.006
        );
    }
    function panel(points, c, lift = 0) {
        // Subdivide and drape the pattern onto the same cross-sections and joint
        // weights as the garment underneath, including concave lapel notches.
        const outline = points.map(([x, y]) => new T.Vector2(x, y));
        function add(x, y) {
            let i = 1;
            while (i < torso.length - 1 && y > torso[i][0]) i++;
            const lo = torso[i - 1],
                hi = torso[i],
                t = clamp((y - lo[0]) / (hi[0] - lo[0]), 0, 1);
            const m = new Map();
            function bind(row, w) {
                const mix = row[7] || 0;
                for (const [b, k] of [
                    [row[5], 1 - mix],
                    [row[6] || row[5], mix],
                ])
                    m.set(ids[b], (m.get(ids[b]) || 0) + w * k);
            }
            bind(lo, 1 - t);
            bind(hi, t);
            return vertex(
                V(x, y, frontZ(x, y) + lift + 0.005),
                V(x * 2, 0.08, 1).normalize(),
                c,
                [...m.keys()],
                [...m.values()]
            );
        }
        function surface(a, b, c, depth) {
            if (depth === 0) {
                ix.push(add(a.x, a.y), add(b.x, b.y), add(c.x, c.y));
                return;
            }
            const ab = a.clone().lerp(b, 0.5),
                bc = b.clone().lerp(c, 0.5),
                ca = c.clone().lerp(a, 0.5);
            surface(a, ab, ca, depth - 1);
            surface(ab, b, bc, depth - 1);
            surface(ca, bc, c, depth - 1);
            surface(ab, bc, ca, depth - 1);
        }
        for (const tri of T.ShapeUtils.triangulateShape(outline, [])) {
            const [a, b, c] = tri.map((i) => outline[i]);
            const length = Math.max(
                a.distanceTo(b),
                b.distanceTo(c),
                c.distanceTo(a)
            );
            surface(
                a,
                b,
                c,
                Math.min(4, Math.max(0, Math.ceil(Math.log2(length / 0.024))))
            );
        }
    }
    panel(
        [
            [-0.071, 1.527],
            [-0.104, 1.467],
            [-0.051, 1.355],
            [0, 1.229],
            [0.064, 1.371],
            [0.101, 1.468],
            [0.063, 1.526],
        ],
        w.shirt,
        0.001
    );
    panel(
        [
            [-0.013, 1.491],
            [-0.021, 1.47],
            [-0.011, 1.448],
            [-0.018, 1.308],
            [0, 1.279],
            [0.017, 1.31],
            [0.01, 1.445],
            [0.021, 1.472],
            [0.012, 1.492],
        ],
        w.tie,
        0.009
    );
    for (const s of [-1, 1]) {
        panel(
            [
                [s * 0.008, 1.489],
                [s * 0.054, 1.538],
                [s * 0.08, 1.512],
                [s * 0.067, 1.448],
            ],
            "#e8decc",
            0.012
        );
        panel(
            [
                [s * 0.062, 1.529],
                [s * 0.149, 1.465],
                [s * 0.112, 1.432],
                [s * 0.145, 1.419],
                [s * 0.058, 1.303],
                [-s * 0.003, 1.222],
            ],
            color(w.jacket).clone().multiplyScalar(1.22),
            0.005
        );
        panel(
            [
                [s * 0.116, 1.095],
                [s * 0.19, 1.107],
                [s * 0.188, 1.097],
                [s * 0.116, 1.084],
            ],
            color(w.jacket).clone().multiplyScalar(0.62),
            0.004
        );
    }
    panel(
        [
            [0.107, 1.381],
            [0.18, 1.39],
            [0.18, 1.382],
            [0.107, 1.372],
        ],
        "#686061",
        0.005
    );
    panel(
        [
            [0.123, 1.388],
            [0.149, 1.406],
            [0.159, 1.394],
            [0.17, 1.401],
            [0.174, 1.391],
        ],
        w.shirt,
        0.006
    );
    for (const y of w.vest
        ? [1.205, 1.163, 1.12, 1.076, 1.032]
        : [1.211, 1.143]) {
        const pts = [];
        for (let i = 0; i < 12; i++)
            pts.push([
                0.012 + 0.008 * Math.cos((i * TAU) / 12),
                y + 0.008 * Math.sin((i * TAU) / 12),
            ]);
        panel(pts, "#302820", 0.008);
    }
    // Scalp is derived from the actual fitted head surface. The diagonal part and
    // swept ridges remain on the skull through the same head-joint transform.
    const skin = data.parts.skin,
        hairMap = new Map();
    function scalp(v) {
        const [x, y, z] = v.slice(0, 3).map((n) => n / 1e4);
        const front = clamp((z + 0.016) / 0.165, 0, 1);
        return (
            y >
            1.632 +
                0.108 * front +
                0.013 * Math.cos(x * 23) * front -
                (0.012 * Math.abs(x)) / 0.09
        );
    }
    function hair(i) {
        if (hairMap.has(i)) return hairMap.get(i);
        const v = skin.v[i],
            p = V(...v.slice(0, 3).map((a) => a / 1e4)),
            n = V(...v.slice(3, 6).map((a) => a / 100)).normalize();
        const crown = clamp((p.y - 1.675) * 8, 0, 1),
            groove =
                0.5 +
                0.5 *
                    Math.sin(
                        p.x * 640 +
                            p.z * 142 +
                            p.y * 220 +
                            3 * Math.sin(p.z * 29)
                    );
        const partLine = Math.exp(
            -(((p.x + 0.037 + (p.z - 0.075) * 0.17) / 0.004) ** 2)
        );
        const len =
            0.004 +
            crown *
                (role === 0 ? 0.022 : 0.013) *
                (0.73 + 0.27 * groove) *
                (1 - 0.45 * partLine);
        p.addScaledVector(n, len);
        p.x -= 0.009 * crown;
        p.z -= 0.004 * crown;
        const out = skinned(
            p,
            n,
            w.hair,
            "Head",
            "Head",
            0,
            0.76 + groove * 0.38 + partLine * 0.45
        );
        hairMap.set(i, out);
        return out;
    }
    for (let i = 0; i < skin.i.length; i += 3) {
        const a = skin.i[i],
            b = skin.i[i + 1],
            c = skin.i[i + 2];
        if (scalp(skin.v[a]) && scalp(skin.v[b]) && scalp(skin.v[c]))
            ix.push(hair(a), hair(b), hair(c));
    }
    const geo = new T.BufferGeometry();
    for (const [name, array, d] of [
        ["position", pos, 3],
        ["normal", nor, 3],
        ["color", col, 3],
        ["skinWeight", sw, 4],
    ])
        geo.setAttribute(name, new T.Float32BufferAttribute(array, d));
    geo.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    geo.setIndex(ix);
    const mat = new T.MeshStandardNodeMaterial({
        vertexColors: true,
        roughness: 0.78,
        metalness: 0.025,
        side: T.DoubleSide,
    });
    const mesh = new T.SkinnedMesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.name = ["The traveller", "First agent", "Second agent"][role];
    pivot.add(mesh);
    root.updateMatrixWorld(true);
    mesh.bind(new T.Skeleton(boneList));
    pivot.position.copy(rest.Hips).multiplyScalar(-1);
    return { root, pivot, bones, boneList, rest, vrm, mesh, normBones };
}

export function createActor(resources, role) {
    const actor = buildCharacter(resources.anatomy, role);
    const { root, bones, vrm, rest } = actor,
        mixer = new T.AnimationMixer(root),
        actions = {};
    for (const [key, clip] of Object.entries(resources.clips)) {
        const ref = rest.Hips,
            base = resources.clips.IDLE.tracks.find(
                (t) => t.name === "mixamorigHips.position"
            ).values[1];
        const a = mixer.clipAction(
            retargetClip(clip, vrm, { x: ref.x, z: ref.z, height: ref.y }, base)
        );
        a.play();
        a.paused = true;
        actions[key] = a;
    }
    const Q = new T.Quaternion(),
        q2 = new T.Quaternion(),
        eul = new T.Euler();
    function rotate(name, x, y, z) {
        bones[name].quaternion.multiply(
            Q.setFromEuler(eul.set(x, y, z, "XYZ"))
        );
    }
    function solve(upper, lower, end, goal, pole, weight) {
        if (weight < 0.001) return;
        const a = bones[upper],
            b = bones[lower],
            c = bones[end],
            start = a.getWorldPosition(V()),
            mid = b.getWorldPosition(V()),
            tip = c.getWorldPosition(V());
        const wanted = tip.lerp(goal, weight),
            line = wanted.clone().sub(start),
            distance = line.length();
        if (distance < 0.0001) return;
        line.normalize();
        const l1 = start.distanceTo(mid),
            l2 = c.position.length() * root.scale.x;
        const d = clamp(distance, Math.abs(l1 - l2) + 0.0001, l1 + l2 - 0.0001);
        const axial = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
            height = Math.sqrt(Math.max(0, l1 * l1 - axial * axial));
        const bend = pole.clone().sub(start);
        bend.addScaledVector(line, -bend.dot(line)).normalize();
        const joint = start
            .clone()
            .addScaledVector(line, axial)
            .addScaledVector(bend, height);
        function aim(bone, from, to) {
            const before = bone.getWorldQuaternion(new T.Quaternion()),
                par = bone.parent.getWorldQuaternion(new T.Quaternion());
            const correction = new T.Quaternion().setFromUnitVectors(
                from.normalize(),
                to.normalize()
            );
            bone.quaternion.copy(
                par.invert().multiply(correction).multiply(before)
            );
            bone.updateWorldMatrix(false, true);
        }
        aim(a, mid.clone().sub(start), joint.clone().sub(start));
        const pivot = b.getWorldPosition(V());
        aim(
            b,
            c.getWorldPosition(V()).sub(pivot),
            start.clone().addScaledVector(line, d).sub(pivot)
        );
    }
    function localPoint(x, y, z) {
        return root.localToWorld(V(x, y, z));
    }
    const sampleClips = createPoseSampler(actor.boneList, mixer);
    function pose(p) {
        root.position.set(p.x, p.y, p.z);
        root.quaternion
            .setFromAxisAngle(V(0, 0, 1), p.bank)
            .multiply(q2.setFromAxisAngle(V(0, 1, 0), p.yaw))
            .multiply(q2.setFromAxisAngle(V(1, 0, 0), p.pitch || 0));
        for (const [k, a] of Object.entries(actions)) {
            const wt = p.weights[k] || 0;
            a.enabled = true;
            a.setEffectiveWeight(wt);
            const t = p.clipTime?.[k] ?? p.phase;
            a.time =
                k === "IDLE" || k === "WALK" || k === "RUN" || k === "JUMP"
                    ? T.MathUtils.euclideanModulo(t, a.getClip().duration)
                    : clamp(t, 0, a.getClip().duration - 0.00001);
        }
        sampleClips(0);
        const guard = p.guard || 0,
            air = p.air || 0,
            hit = p.hit || 0,
            tuck = p.tuck || 0;
        rotate(
            "Spine",
            0.12 * guard + 0.26 * tuck - 0.12 * hit,
            0.1 * guard,
            0
        );
        rotate(
            "Spine2",
            0.04 * guard - 0.18 * hit,
            (p.twist || 0) + 0.12 * guard,
            0.08 * hit
        );
        rotate("Neck", -0.09 * guard - 0.13 * tuck, 0.15 * guard, -0.08 * hit);
        for (const [s, side] of [
            [1, "Left"],
            [-1, "Right"],
        ]) {
            rotate(side + "UpLeg", -0.26 * tuck, 0, s * 0.07 * air);
            rotate(side + "Leg", 0.55 * tuck, 0, 0);
            for (const f of ["Index", "Middle", "Ring", "Pinky"])
                for (const i of [1, 2, 3]) {
                    const bone = bones[side + "Hand" + f + i];
                    bone.quaternion.slerp(
                        Q.setFromEuler(
                            eul.set(0, 0, -s * (i === 1 ? 0.81 : 1.0))
                        ),
                        guard * 0.9
                    );
                }
        }
        root.updateWorldMatrix(true, true);
        // Targets use metres relative to the hips, with +z towards the other actor.
        for (const [s, side] of [
            [1, "Left"],
            [-1, "Right"],
        ]) {
            const sideGuard = clamp(guard + air, 0, 1);
            const wrist = localPoint(
                s * (0.145 + 0.21 * air),
                0.36 + 0.13 * (s === 1 ? 1 : 0) - 0.17 * air,
                0.265 + 0.065 * (s === 1 ? 1 : 0)
            );
            const pole = localPoint(s * 0.44, 0.02 - 0.16 * air, -0.03);
            solve(
                side + "Arm",
                side + "ForeArm",
                side + "Hand",
                wrist,
                pole,
                sideGuard
            );
        }
    }
    function plant(room, p) {
        const quarter = Math.round(p.bank / (Math.PI / 2)),
            flat = (quarter * Math.PI) / 2;
        const weight =
            (1 - clamp(Math.abs(flat - p.bank) / 0.63, 0, 1)) *
            (1 - (p.air || 0));
        if (weight < 0.08 || Math.cos(p.pitch || 0) < 0.58) return;
        const normal = V(-Math.sin(flat), Math.cos(flat), 0);
        const level =
            Math.abs(normal.y) > 0.5 ? (normal.y > 0 ? 0 : -2.72) : -1.62;
        const soles = ["Left", "Right"].map((side) => {
            const ankle = bones[side + "Foot"].getWorldPosition(V());
            const toe = bones[side + "ToeBase"].getWorldPosition(V());
            const pa = room.worldToLocal(ankle.clone()),
                pt = room.worldToLocal(toe.clone());
            const h =
                Math.min(pa.dot(normal) - 0.066, pt.dot(normal) - 0.023) -
                level;
            return { side, ankle, pa, h };
        });
        const nearest = Math.min(...soles.map((s) => s.h));
        // Bring the support sole to the surface before solving the second leg.
        root.position.addScaledVector(
            normal,
            -weight * clamp(nearest, -0.2, 0.17)
        );
        root.updateWorldMatrix(true, true);
        for (const { side, pa, h } of soles) {
            const stance = (p.guard || 0) * 0.93;
            const delta = -weight * (h - nearest) * stance;
            if (Math.abs(delta) < 0.002) continue;
            const goal = room.localToWorld(
                pa.addScaledVector(
                    normal,
                    delta - weight * clamp(nearest, -0.2, 0.17)
                )
            );
            if (side === "Left" || side === "Right")
                solve(
                    side + "UpLeg",
                    side + "Leg",
                    side + "Foot",
                    goal,
                    localPoint(side === "Left" ? 0.16 : -0.16, -0.45, 0.55),
                    1
                );
        }
    }
    function reach(side, goal, weight) {
        solve(
            side + "Arm",
            side + "ForeArm",
            side + "Hand",
            goal,
            localPoint(side === "Left" ? 0.41 : -0.41, 0.18, -0.04),
            weight
        );
    }
    return { ...actor, pose, plant, reach, localPoint, solve };
}
