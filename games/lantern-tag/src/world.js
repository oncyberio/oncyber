// The courtyard at night, all of it made here from code: flagstones, four
// low walls with an arch in each, a well in the middle, a moon, stars, and
// twelve lantern posts. Nothing is loaded from a file.
import * as THREE from "three";
import { LIFE, POSTS, WELL, YARD } from "./round.js";

const WARM = new THREE.Color(0xffc56b);
const DARK = new THREE.Color(0x2a2f45);

/** A square canvas painted by `paint(context, size)`, as a texture. */
function painted(size, paint) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    paint(canvas.getContext("2d"), size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function flagstones() {
    const texture = painted(256, (c, size) => {
        c.fillStyle = "#1d2233";
        c.fillRect(0, 0, size, size);
        let seed = 7;
        const next = () => ((seed = (seed * 16807) % 2147483647) % 1000) / 1000;
        const cell = size / 4;
        for (let y = 0; y < 4; y++)
            for (let x = 0; x < 4; x++) {
                const shade = 46 + Math.floor(next() * 22);
                c.fillStyle = `rgb(${shade},${shade + 6},${shade + 22})`;
                c.fillRect(
                    x * cell +
                        2 +
                        (y % 2 ? cell / 2 : 0) -
                        (x === 3 && y % 2 ? size : 0),
                    y * cell + 2,
                    cell - 4,
                    cell - 4
                );
                if (y % 2 && x === 3)
                    c.fillRect(-cell / 2 + 2, y * cell + 2, cell - 4, cell - 4);
            }
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    return texture;
}

function glowTexture() {
    return painted(128, (c, size) => {
        const g = c.createRadialGradient(
            size / 2,
            size / 2,
            0,
            size / 2,
            size / 2,
            size / 2
        );
        g.addColorStop(0, "rgba(255,226,160,1)");
        g.addColorStop(0.25, "rgba(255,190,96,0.55)");
        g.addColorStop(1, "rgba(255,160,60,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, size, size);
    });
}

export function createWorld() {
    const group = new THREE.Group();
    group.name = "courtyard";
    const owned = [];
    const keep = (thing) => (owned.push(thing), thing);
    const lambert = (color, extra = {}) =>
        keep(new THREE.MeshLambertMaterial({ color, ...extra }));

    // Light: a cool sky, a moon from over the far wall.
    group.add(new THREE.HemisphereLight(0x8fa4ff, 0x232032, 1.5));
    const moonLight = new THREE.DirectionalLight(0xbfd0ff, 1.6);
    moonLight.position.set(-8, 14, -10);
    group.add(moonLight);

    const ground = new THREE.Mesh(
        keep(new THREE.PlaneGeometry(YARD * 2, YARD * 2)),
        lambert(0xffffff, { map: keep(flagstones()) })
    );
    ground.rotation.x = -Math.PI / 2;
    group.add(ground);
    // Beyond the walls: dark grass out to the fog.
    const field = new THREE.Mesh(
        keep(new THREE.CircleGeometry(90, 24)),
        lambert(0x10182a)
    );
    field.rotation.x = -Math.PI / 2;
    field.position.y = -0.02;
    group.add(field);

    // Walls with an arch in the middle of each side.
    const stone = lambert(0x4b5370);
    const cap = lambert(0x666f90);
    const wallGeometry = keep(new THREE.BoxGeometry(YARD - 1.4, 2.4, 0.6));
    const capGeometry = keep(new THREE.BoxGeometry(YARD - 1.2, 0.25, 0.8));
    const pillarGeometry = keep(new THREE.BoxGeometry(0.9, 3.4, 0.9));
    const lintelGeometry = keep(new THREE.BoxGeometry(3.7, 0.5, 0.8));
    for (let side = 0; side < 4; side++) {
        const turn = new THREE.Group();
        turn.rotation.y = (side * Math.PI) / 2;
        for (const sign of [-1, 1]) {
            const wall = new THREE.Mesh(wallGeometry, stone);
            wall.position.set(sign * (YARD / 2 + 0.7), 1.2, -YARD);
            const top = new THREE.Mesh(capGeometry, cap);
            top.position.set(sign * (YARD / 2 + 0.7), 2.52, -YARD);
            const pillar = new THREE.Mesh(pillarGeometry, cap);
            pillar.position.set(sign * 1.4, 1.7, -YARD);
            turn.add(wall, top, pillar);
        }
        const lintel = new THREE.Mesh(lintelGeometry, cap);
        lintel.position.set(0, 3.55, -YARD);
        turn.add(lintel);
        group.add(turn);
    }

    // The well.
    const well = new THREE.Mesh(
        keep(
            new THREE.CylinderGeometry(
                WELL - 0.35,
                WELL - 0.25,
                0.9,
                20,
                1,
                true
            )
        ),
        lambert(0x5a6386, { side: THREE.DoubleSide })
    );
    well.position.y = 0.45;
    const rim = new THREE.Mesh(
        keep(new THREE.TorusGeometry(WELL - 0.35, 0.12, 8, 24)),
        cap
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.9;
    const water = new THREE.Mesh(
        keep(new THREE.CircleGeometry(WELL - 0.4, 20)),
        keep(new THREE.MeshBasicMaterial({ color: 0x23406e }))
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.6;
    group.add(well, rim, water);

    // The moon and a scatter of stars, far beyond the fog.
    const sky = new THREE.Group();
    const moon = new THREE.Mesh(
        keep(new THREE.CircleGeometry(5, 28)),
        keep(new THREE.MeshBasicMaterial({ color: 0xe8edff, fog: false }))
    );
    moon.position.set(-34, 42, -78);
    moon.lookAt(0, 0, 0);
    sky.add(moon);
    const starPositions = [];
    let seed = 99;
    const next = () => ((seed = (seed * 48271) % 2147483647) % 10000) / 10000;
    for (let i = 0; i < 260; i++) {
        const a = next() * Math.PI * 2;
        const h = 0.12 + next() * 0.85;
        const r = 95;
        starPositions.push(
            Math.cos(a) * Math.sqrt(1 - h * h) * r,
            h * r,
            Math.sin(a) * Math.sqrt(1 - h * h) * r
        );
    }
    const starGeometry = keep(new THREE.BufferGeometry());
    starGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(starPositions, 3)
    );
    sky.add(
        new THREE.Points(
            starGeometry,
            keep(
                new THREE.PointsMaterial({
                    color: 0xdfe6ff,
                    size: 1.6,
                    sizeAttenuation: false,
                    fog: false,
                })
            )
        )
    );
    group.add(sky);

    // Lantern posts: a pole, a cage and a lamp that glows when lit.
    const poleGeometry = keep(new THREE.CylinderGeometry(0.05, 0.07, 2.1, 8));
    const lampGeometry = keep(new THREE.OctahedronGeometry(0.26, 0));
    const hatGeometry = keep(new THREE.ConeGeometry(0.34, 0.2, 6));
    const poolGeometry = keep(new THREE.CircleGeometry(1.4, 20));
    const iron = lambert(0x1c1f2c);
    const glow = keep(glowTexture());
    const lanterns = POSTS.map(([x, z]) => {
        const post = new THREE.Group();
        post.position.set(x, 0, z);
        const pole = new THREE.Mesh(poleGeometry, iron);
        pole.position.y = 1.05;
        const hat = new THREE.Mesh(hatGeometry, iron);
        hat.position.y = 2.42;
        const lampMaterial = keep(
            new THREE.MeshBasicMaterial({ color: DARK.clone() })
        );
        const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
        lamp.position.y = 2.1;
        const haloMaterial = keep(
            new THREE.SpriteMaterial({
                map: glow,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                opacity: 0,
            })
        );
        const halo = new THREE.Sprite(haloMaterial);
        halo.position.y = 2.1;
        halo.scale.setScalar(3.2);
        // The pool of light on the stones: where to stand to catch it.
        const poolMaterial = keep(
            new THREE.MeshBasicMaterial({
                map: glow,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                transparent: true,
                opacity: 0,
            })
        );
        const pool = new THREE.Mesh(poolGeometry, poolMaterial);
        pool.rotation.x = -Math.PI / 2;
        pool.position.y = 0.03;
        post.add(pole, hat, lamp, halo, pool);
        group.add(post);
        return { lamp, lampMaterial, haloMaterial, poolMaterial, level: 0 };
    });

    let time = 0;
    return {
        group,
        /**
         * Draw the round's lanterns: `lit` is post -> second lit, `elapsed`
         * the round's clock. A lantern dims and flickers as it runs out.
         */
        update(seconds, lit, elapsed) {
            time += seconds;
            lanterns.forEach((lantern, post) => {
                let target = 0;
                if (lit && post in lit) {
                    const left = 1 - (elapsed - lit[post]) / LIFE;
                    const flicker =
                        left < 0.35
                            ? 0.75 + 0.25 * Math.sin(time * 22 + post)
                            : 1;
                    target = Math.max(0.15, Math.min(1, 0.3 + left)) * flicker;
                }
                lantern.level +=
                    (target - lantern.level) * Math.min(1, seconds * 10);
                const level = lantern.level;
                lantern.lampMaterial.color.copy(DARK).lerp(WARM, level);
                lantern.haloMaterial.opacity = level * 0.95;
                lantern.poolMaterial.opacity = level * 0.55;
                lantern.lamp.rotation.y = time * 0.6 + post;
            });
        },
        dispose() {
            owned.forEach((thing) => thing.dispose());
        },
    };
}

/**
 * The body a visitor without an avatar plays in: a pale cloaked figure with
 * a hood, made here. It faces +z, as the avatar kit's avatars do, and
 * `crouch(amount)` folds it for the arrival pose.
 */
export function createBearer(height) {
    const root = new THREE.Group();
    root.name = "bearer";
    const cloth = new THREE.MeshLambertMaterial({ color: 0xd9dcf2 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xf0c9a8 });
    const trim = new THREE.MeshLambertMaterial({ color: 0xffb454 });
    const body = new THREE.Group();
    const cloak = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.36, height * 0.74, 12),
        cloth
    );
    cloak.position.y = height * 0.37;
    const sash = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.035, 6, 16),
        trim
    );
    sash.rotation.x = Math.PI / 2;
    sash.position.y = height * 0.5;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), skin);
    head.position.y = height * 0.86;
    const hood = new THREE.Mesh(
        new THREE.SphereGeometry(
            0.19,
            14,
            10,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.62
        ),
        cloth
    );
    hood.position.set(0, height * 0.88, -0.03);
    hood.rotation.x = -0.35;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), cloth);
    tip.position.set(0, height * 0.965, -0.06);
    body.add(cloak, sash, head, hood, tip);
    root.add(body);
    return {
        root,
        height,
        crouch(amount) {
            body.scale.y = 1 - 0.45 * amount;
        },
        dispose() {
            body.traverse((o) => o.geometry?.dispose());
            cloth.dispose();
            skin.dispose();
            trim.dispose();
        },
    };
}
