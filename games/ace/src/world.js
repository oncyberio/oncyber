import * as THREE from "three";
import { COURT } from "./config.js";
import { outline, toon } from "./toon.js";

// The stadium: sky, court, net, stands, crowd and a handful of toy-box props.

const LINE = 0.05; // line width

function canvasTexture(w, h, draw, opts = {}) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = opts.anisotropy || 8;
    if (opts.repeat) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    return t;
}

function sky() {
    const geo = new THREE.SphereGeometry(400, 32, 16);
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            top: { value: new THREE.Color(0x2f7bff) },
            mid: { value: new THREE.Color(0x8fd0ff) },
            bottom: { value: new THREE.Color(0xe9fbff) },
            sun: { value: new THREE.Vector3(-0.4, 0.55, -0.73).normalize() },
        },
        vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
        fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sun;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = mix(bottom, mid, smoothstep(-0.02, 0.18, h));
        c = mix(c, top, smoothstep(0.18, 0.75, h));
        float s = max(dot(vDir, sun), 0.0);
        c += vec3(1.0, 0.95, 0.8) * (pow(s, 600.0) * 1.5 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    return mesh;
}

function cloud(rng) {
    const g = new THREE.Group();
    const mat = toon(0xffffff, { emissive: 0x6a7fa8 });
    const n = 4 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
        const r = 3 + rng() * 4;
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
        s.position.set((i - n / 2) * 4 + rng() * 2, rng() * 2.5, rng() * 3);
        s.scale.y = 0.75;
        g.add(s);
    }
    return g;
}

function tree(rng) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8),
        toon(0x8a5a3b)
    );
    trunk.position.y = 1.1;
    g.add(trunk);
    const leaf = toon([0x37b34a, 0x2e9e45, 0x4cc35a][Math.floor(rng() * 3)]);
    const crown = new THREE.Mesh(
        new THREE.SphereGeometry(1.7 + rng() * 0.8, 14, 10),
        leaf
    );
    crown.position.y = 3.3;
    crown.castShadow = true;
    g.add(crown);
    outline(crown, 0.05, 0x1d3a2a);
    const crown2 = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), leaf);
    crown2.position.set(0.9, 2.6, 0.4);
    g.add(crown2);
    g.scale.setScalar(0.9 + rng() * 0.6);
    return g;
}

function bannerTexture(text, bg, fg) {
    return canvasTexture(
        1024,
        128,
        (g, w, h) => {
            g.fillStyle = bg;
            g.fillRect(0, 0, w, h);
            g.fillStyle = "rgba(255,255,255,0.14)";
            for (let x = -h; x < w; x += 48) {
                g.beginPath();
                g.moveTo(x, h);
                g.lineTo(x + 24, h);
                g.lineTo(x + 24 + h, 0);
                g.lineTo(x + h, 0);
                g.fill();
            }
            g.fillStyle = fg;
            g.font = "italic 900 84px 'Arial Black', sans-serif";
            g.textAlign = "center";
            g.textBaseline = "middle";
            for (let x = w * 0.25; x < w; x += w * 0.5)
                g.fillText(text, x, h * 0.54);
        },
        { repeat: [1, 1] }
    );
}

function netTexture() {
    return canvasTexture(
        512,
        64,
        (g, w, h) => {
            g.clearRect(0, 0, w, h);
            g.strokeStyle = "rgba(20,20,30,0.85)";
            g.lineWidth = 2;
            for (let x = 0; x <= w; x += 8) {
                g.beginPath();
                g.moveTo(x, 0);
                g.lineTo(x, h);
                g.stroke();
            }
            for (let y = 0; y <= h; y += 8) {
                g.beginPath();
                g.moveTo(0, y);
                g.lineTo(w, y);
                g.stroke();
            }
        },
        { repeat: [6, 1] }
    );
}

function grassTexture() {
    return canvasTexture(
        512,
        512,
        (g, w, h) => {
            g.fillStyle = "#5cc45a";
            g.fillRect(0, 0, w, h);
            for (let i = 0; i < 8; i++) {
                if (i % 2) continue;
                g.fillStyle = "#54b953";
                g.fillRect(0, (i * h) / 8, w, h / 8);
            }
        },
        { repeat: [14, 14] }
    );
}

function courtTexture() {
    // Subtle grain so the big blue surface doesn't read as flat plastic.
    return canvasTexture(
        512,
        512,
        (g, w, h) => {
            g.fillStyle = "#3a6fe0";
            g.fillRect(0, 0, w, h);
            const img = g.getImageData(0, 0, w, h);
            for (let i = 0; i < img.data.length; i += 4) {
                const n = (Math.random() - 0.5) * 14;
                img.data[i] += n;
                img.data[i + 1] += n;
                img.data[i + 2] += n;
            }
            g.putImageData(img, 0, 0);
        },
        { repeat: [6, 12] }
    );
}

export function createWorld(scene, rng = Math.random) {
    const world = {
        crowd: null,
        flags: [],
        clouds: [],
        excite: 0,
        wave: 0,
        time: 0,
        screen: null,
    };
    scene.add(sky());

    // Lights.
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a8a4a, 1.25);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2dc, 2.6);
    sun.position.set(-12, 26, -8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 20;
    sc.bottom = -20;
    sc.near = 5;
    sc.far = 70;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    scene.add(sun);
    scene.add(sun.target);
    world.sun = sun;

    // Ground and court.
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(220, 220),
        new THREE.MeshLambertMaterial({ map: grassTexture() })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    const apron = new THREE.Mesh(
        new THREE.PlaneGeometry(
            COURT.doublesHalfWidth * 2 + 8,
            COURT.halfLength * 2 + 13
        ),
        new THREE.MeshLambertMaterial({ color: 0x2fa36b })
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.005;
    apron.receiveShadow = true;
    scene.add(apron);

    const court = new THREE.Mesh(
        new THREE.PlaneGeometry(
            COURT.doublesHalfWidth * 2 + 0.6,
            COURT.halfLength * 2 + 0.6
        ),
        new THREE.MeshLambertMaterial({ map: courtTexture() })
    );
    court.rotation.x = -Math.PI / 2;
    court.receiveShadow = true;
    scene.add(court);

    // Lines as thin boxes for crisp edges.
    const lineMat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        emissive: 0x6b7a99,
    });
    const lines = new THREE.Group();
    const addLine = (x, z, w, d) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.004, d), lineMat);
        m.position.set(x, 0.003, z);
        m.receiveShadow = true;
        lines.add(m);
    };
    const HL = COURT.halfLength;
    for (const s of [-1, 1]) {
        addLine(0, s * HL, COURT.doublesHalfWidth * 2 + LINE, LINE * 1.6); // baselines
        addLine(s * COURT.halfWidth, 0, LINE, HL * 2); // singles sidelines
        addLine(s * COURT.doublesHalfWidth, 0, LINE, HL * 2); // doubles sidelines
        addLine(0, s * COURT.serviceLine, COURT.halfWidth * 2, LINE); // service lines
        addLine(0, s * (COURT.serviceLine / 2), LINE, COURT.serviceLine); // centre service line
        addLine(0, s * (HL - 0.1), LINE, 0.2); // centre marks
    }
    scene.add(lines);

    // Net.
    const netGroup = new THREE.Group();
    const netW = COURT.postX * 2;
    const netGeo = new THREE.PlaneGeometry(netW, 1, 40, 4);
    const pos = netGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const top =
            COURT.netCenter +
            (COURT.netPost - COURT.netCenter) *
                Math.pow(Math.min(1, Math.abs(x) / COURT.postX), 2);
        const v = pos.getY(i) + 0.5; // 0..1
        pos.setY(i, v * top);
    }
    netGeo.computeVertexNormals();
    const netMesh = new THREE.Mesh(
        netGeo,
        new THREE.MeshLambertMaterial({
            map: netTexture(),
            transparent: true,
            side: THREE.DoubleSide,
            alphaTest: 0.2,
        })
    );
    netMesh.castShadow = true;
    netGroup.add(netMesh);
    // Tape along the top: a tube following the sag.
    const tapePts = [];
    for (let i = 0; i <= 24; i++) {
        const x = -COURT.postX + (i / 24) * netW;
        const top =
            COURT.netCenter +
            (COURT.netPost - COURT.netCenter) *
                Math.pow(Math.abs(x) / COURT.postX, 2);
        tapePts.push(new THREE.Vector3(x, top, 0));
    }
    const tape = new THREE.Mesh(
        new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(tapePts),
            48,
            0.03,
            6
        ),
        toon(0xffffff)
    );
    tape.castShadow = true;
    netGroup.add(tape);
    const strap = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, COURT.netCenter, 0.01),
        toon(0xffffff)
    );
    strap.position.y = COURT.netCenter / 2;
    netGroup.add(strap);
    for (const s of [-1, 1]) {
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, COURT.netPost + 0.08, 12),
            toon(0x1d2b4f)
        );
        post.position.set(s * COURT.postX, (COURT.netPost + 0.08) / 2, 0);
        post.castShadow = true;
        netGroup.add(post);
        outline(post, 0.012);
        const cap = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 10, 8),
            toon(0xffd23c)
        );
        cap.position.set(s * COURT.postX, COURT.netPost + 0.1, 0);
        netGroup.add(cap);
    }
    scene.add(netGroup);
    world.net = netMesh;

    // Courtside walls with banners.
    const wallH = 1.0;
    const banners = [
        bannerTexture("ACE!", "#ff4d5e", "#ffffff"),
        bannerTexture("ONCYBER", "#1d2b4f", "#ffd23c"),
        bannerTexture("RALLY!", "#ffb01f", "#1d2b4f"),
    ];
    const wallMat = (i) =>
        new THREE.MeshLambertMaterial({
            map: banners[i % banners.length],
            emissive: 0x222222,
        });
    const wallX = COURT.doublesHalfWidth + 4.6;
    const wallZ = COURT.halfLength + 7.2;
    const addWall = (x, z, len, rotY, i) => {
        const w = new THREE.Mesh(new THREE.BoxGeometry(len, wallH, 0.2), [
            toon(0x1d2b4f),
            toon(0x1d2b4f),
            toon(0xffffff),
            toon(0x1d2b4f),
            wallMat(i),
            wallMat(i),
        ]);
        w.position.set(x, wallH / 2, z);
        w.rotation.y = rotY;
        w.castShadow = true;
        w.receiveShadow = true;
        scene.add(w);
    };
    addWall(0, -wallZ, wallX * 2, 0, 0);
    addWall(0, wallZ, wallX * 2, Math.PI, 1);
    for (const s of [-1, 1]) {
        addWall(s * wallX, -wallZ / 2, wallZ, (-s * Math.PI) / 2, 2);
        addWall(s * wallX, wallZ / 2, wallZ, (-s * Math.PI) / 2, 1);
    }

    // Stands: stepped tiers with seats; crowd instanced on top.
    const seats = [];
    const tierMat = toon(0xe8ecf5);
    const tierSide = toon(0x9fb0d6);
    const standRows = 7;
    const buildStand = (cx, cz, len, rotY) => {
        const g = new THREE.Group();
        for (let r = 0; r < standRows; r++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 1.1), [
                tierSide,
                tierSide,
                tierMat,
                tierSide,
                tierSide,
                tierSide,
            ]);
            step.position.set(0, 0.55 * r + 0.27 + 1.2, -(r * 1.1 + 0.55));
            step.receiveShadow = true;
            g.add(step);
            // Under-fill so the stand looks solid.
            const fill = new THREE.Mesh(
                new THREE.BoxGeometry(len, 0.55 * r + 1.2, 1.1),
                tierSide
            );
            fill.position.set(0, (0.55 * r + 1.2) / 2, -(r * 1.1 + 0.55));
            g.add(fill);
            const n = Math.floor(len / 0.72);
            for (let i = 0; i < n; i++) {
                if (rng() < 0.12) continue;
                const local = new THREE.Vector3(
                    -len / 2 + 0.36 + i * 0.72 + (rng() - 0.5) * 0.1,
                    0.55 * r + 0.55 + 1.2,
                    -(r * 1.1 + 0.6)
                );
                seats.push({ local, stand: g, row: r });
            }
        }
        g.position.set(cx, 0, cz);
        g.rotation.y = rotY;
        scene.add(g);
        return g;
    };
    const sideX = wallX + 1.4;
    buildStand(-sideX, 0, (wallZ - 1) * 2, Math.PI / 2);
    buildStand(sideX, 0, (wallZ - 1) * 2, -Math.PI / 2);
    buildStand(0, -(wallZ + 1.4), wallX * 2 + 4, 0);
    scene.updateMatrixWorld(true);

    const crowdColors = [
        0xff4d5e, 0x3d7bff, 0xffd23c, 0x2bd17e, 0xffffff, 0xff8ad8, 0x9b6bff,
        0xff9a3c,
    ];
    const skinColors = [0xffd2b0, 0xe9b48c, 0xc68a5f, 0x8d5a3b, 0xffe0c2];
    const count = seats.length;
    const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.25, 4, 8);
    const headGeo = new THREE.SphereGeometry(0.17, 10, 8);
    const bodies = new THREE.InstancedMesh(
        bodyGeo,
        toon(0xffffff, { unique: true }),
        count
    );
    const heads = new THREE.InstancedMesh(
        headGeo,
        toon(0xffffff, { unique: true }),
        count
    );
    const color = new THREE.Color();
    const base = [];
    for (let i = 0; i < count; i++) {
        const s = seats[i];
        const wp = s.local.clone().applyMatrix4(s.stand.matrixWorld);
        base.push({
            p: wp,
            phase: rng() * Math.PI * 2,
            freq: 7 + rng() * 5,
            energy: 0.5 + rng() * 0.8,
        });
        bodies.setColorAt(
            i,
            color.setHex(crowdColors[Math.floor(rng() * crowdColors.length)])
        );
        heads.setColorAt(
            i,
            color.setHex(skinColors[Math.floor(rng() * skinColors.length)])
        );
    }
    bodies.instanceColor.needsUpdate = true;
    heads.instanceColor.needsUpdate = true;
    scene.add(bodies);
    scene.add(heads);
    world.crowd = { bodies, heads, base, count };

    // Umpire chair.
    const chair = new THREE.Group();
    const leg = toon(0x1d2b4f);
    for (const [x, z] of [
        [-0.35, -0.35],
        [0.35, -0.35],
        [-0.35, 0.35],
        [0.35, 0.35],
    ]) {
        const l = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.05, 2.0, 6),
            leg
        );
        l.position.set(x, 1.0, z);
        chair.add(l);
    }
    const seat = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.12, 0.9),
        toon(0xff4d5e)
    );
    seat.position.y = 2.05;
    chair.add(seat);
    const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.7, 0.1),
        toon(0xff4d5e)
    );
    back.position.set(0, 2.45, 0.42);
    chair.add(back);
    chair.position.set(COURT.postX + 1.4, 0, 0);
    chair.rotation.y = -Math.PI / 2;
    chair.traverse((o) => (o.castShadow = true));
    scene.add(chair);
    world.umpireSeat = new THREE.Vector3(COURT.postX + 1.4, 2.1, 0);

    // Flags and trees around the stadium.
    const flagColors = [0xff4d5e, 0x3d7bff, 0xffd23c, 0x2bd17e];
    for (let i = 0; i < 6; i++) {
        const x = -15 + i * 6;
        const z = -(wallZ + 10.5);
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 7, 6),
            toon(0xdddddd)
        );
        pole.position.set(x, 3.5 + 3.8, z);
        scene.add(pole);
        const flagGeo = new THREE.PlaneGeometry(1.8, 1.1, 12, 4);
        flagGeo.translate(0.9, 0, 0);
        const flag = new THREE.Mesh(
            flagGeo,
            toon(flagColors[i % 4], { unique: true })
        );
        flag.material.side = THREE.DoubleSide;
        flag.position.set(x, 10.2, z);
        flag.userData.base = flagGeo.attributes.position.array.slice();
        scene.add(flag);
        world.flags.push(flag);
    }
    for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const r = 42 + rng() * 14;
        const t = tree(rng);
        t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        scene.add(t);
    }
    // Rolling hills on the horizon.
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.3;
        const hill = new THREE.Mesh(
            new THREE.SphereGeometry(30 + rng() * 25, 20, 12),
            toon(i % 2 ? 0x4fb85a : 0x45a852)
        );
        hill.position.set(Math.cos(a) * 150, -18, Math.sin(a) * 150);
        hill.scale.y = 0.55;
        scene.add(hill);
    }
    for (let i = 0; i < 9; i++) {
        const c = cloud(rng);
        c.position.set(
            -160 + i * 40 + rng() * 15,
            38 + rng() * 25,
            -120 - rng() * 60
        );
        c.scale.setScalar(1.4 + rng());
        scene.add(c);
        world.clouds.push(c);
    }
    return world;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const sc = new THREE.Vector3(1, 1, 1);
const pp = new THREE.Vector3();

export function cheer(world, amount = 1) {
    world.excite = Math.min(1.4, world.excite + amount);
}

export function updateWorld(world, dt, focus) {
    world.time += dt;
    world.excite = Math.max(0, world.excite - dt * 0.35);
    const t = world.time;
    const crowd = world.crowd;
    const ex = world.excite;
    for (let i = 0; i < crowd.count; i++) {
        const b = crowd.base[i];
        const bounce =
            Math.max(0, Math.sin(t * b.freq * (0.4 + ex * 0.6) + b.phase)) *
            (0.03 + ex * 0.32 * b.energy);
        // Heads follow the ball a little.
        pp.copy(b.p);
        pp.y += bounce;
        m4.compose(pp, q, sc);
        crowd.bodies.setMatrixAt(i, m4);
        pp.y += 0.42;
        if (focus) pp.x += Math.sign(focus.x - b.p.x) * 0.02;
        m4.compose(pp, q, sc);
        crowd.heads.setMatrixAt(i, m4);
    }
    crowd.bodies.instanceMatrix.needsUpdate = true;
    crowd.heads.instanceMatrix.needsUpdate = true;
    for (const f of world.flags) {
        const pos = f.geometry.attributes.position;
        const base = f.userData.base;
        for (let i = 0; i < pos.count; i++) {
            const x = base[i * 3];
            pos.setZ(i, Math.sin(x * 2.4 - t * 5 + f.position.x) * 0.16 * x);
        }
        pos.needsUpdate = true;
    }
    for (const c of world.clouds) {
        c.position.x += dt * 0.8;
        if (c.position.x > 200) c.position.x = -200;
    }
}
