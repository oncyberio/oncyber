// Same world, but the whole static scene (lights, props, forest) is kept across
// versions, not only its geometry and materials. Each version attaches its own
// few objects (ground, coins, player) on enter and detaches them on suspend.
import * as THREE from "three/webgpu";
import { color, mix, positionWorld, sin } from "three/tsl";
import { buildProps, buildTrees } from "./lib/props.js";
import { initialPlayer, stepPlayer } from "./lib/player.js";

export const stateVersion = 0;
const PROPS = 300, KINDS = 24, TREES = 3000, SEED = 7, COINS = 20;
const GROUND_A = 0x1f3d2b, GROUND_B = 0x4f7f55;

const round = (n) => Math.round(n * 1e6) / 1e6;

export default function createGame(ctx) {
    let renderer, scene, camera, playerMesh, mine;
    const coinMeshes = [];
    let s = { player: initialPlayer(), score: 0, taken: [], t: 0 };

    const coinAt = (i) => [Math.cos(i * 2.4) * (4 + i * 1.3), Math.sin(i * 2.4) * (4 + i * 1.3)];
    const syncCoins = () => coinMeshes.forEach((m, i) => (m.visible = !s.taken.includes(i)));

    return {
        async prepare() {
            renderer = await ctx.keep("renderer", [], () => ctx.graphics.createRenderer(THREE), (r) => r.dispose());
            camera = new THREE.PerspectiveCamera(60, ctx.graphics.width / ctx.graphics.height, 0.1, 400);

            scene = await ctx.keep("staticScene", [PROPS, KINDS, TREES, SEED], () => {
                const sc = new THREE.Scene();
                sc.background = new THREE.Color(0x0b1020);
                sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, 2.5));
                const sun = new THREE.DirectionalLight(0xffffff, 2);
                sun.position.set(5, 10, 3);
                sc.add(sun);
                const props = buildProps(THREE, PROPS, SEED, KINDS);
                for (const item of props.items) {
                    const mesh = new THREE.Mesh(props.geometries[item.g], props.materials[item.m]);
                    mesh.position.set(...item.p); mesh.scale.setScalar(item.s); mesh.rotation.y = item.r;
                    sc.add(mesh);
                }
                const trees = buildTrees(THREE, TREES, SEED);
                const forest = new THREE.InstancedMesh(trees.geometry, trees.material, TREES);
                forest.instanceMatrix.array.set(trees.matrices);
                sc.add(forest);
                sc.userData.dispose = () => { props.geometries.forEach((g) => g.dispose()); props.materials.forEach((m) => m.dispose()); trees.geometry.dispose(); trees.material.dispose(); forest.dispose(); };
                return sc;
            }, (sc) => sc.userData.dispose());

            const ground = await ctx.keep("ground", [GROUND_A, GROUND_B], () => {
                const material = new THREE.MeshStandardNodeMaterial();
                material.colorNode = mix(color(GROUND_A), color(GROUND_B), sin(positionWorld.x.mul(0.6)).mul(sin(positionWorld.z.mul(0.6))).mul(0.5).add(0.5));
                return { geometry: new THREE.PlaneGeometry(240, 240), material };
            }, (g) => { g.geometry.dispose(); g.material.dispose(); });

            mine = new THREE.Group(); // this version's own objects
            const groundMesh = new THREE.Mesh(ground.geometry, ground.material);
            groundMesh.rotation.x = -Math.PI / 2;
            mine.add(groundMesh);
            const coinGeo = ctx.own(new THREE.SphereGeometry(0.4, 16, 12));
            const coinMat = ctx.own(new THREE.MeshStandardNodeMaterial({ color: 0xffd23f, emissive: 0x554400 }));
            for (let i = 0; i < COINS; i++) {
                const [x, z] = coinAt(i);
                const m = new THREE.Mesh(coinGeo, coinMat);
                m.position.set(x, 0.8, z);
                coinMeshes.push(m); mine.add(m);
            }
            playerMesh = new THREE.Mesh(ctx.own(new THREE.CapsuleGeometry(0.4, 1, 6, 12)),
                ctx.own(new THREE.MeshStandardNodeMaterial({ color: 0xff5a36 })));
            mine.add(playerMesh);

            // Compile only what is new, for the scene it will join. On the first
            // mount that scene is new too, so compile it as well.
            if (!scene.userData.compiled) { await renderer.compileAsync(scene, camera); scene.userData.compiled = true; }
            await renderer.compileAsync(mine, camera, scene);
        },
        enter(continuity) {
            scene.add(mine);
            [s.player.x, s.player.y, s.player.z] = continuity.avatar.position;
        },
        update(dt) {
            stepPlayer(s.player, ctx.input, ctx.pressed, dt, ctx.params);
            for (let i = 0; i < COINS; i++) {
                if (s.taken.includes(i)) continue;
                const [x, z] = coinAt(i);
                if (Math.hypot(s.player.x - x, s.player.z - z) < 1 && s.player.y < 1.5) { s.taken.push(i); s.score++; coinMeshes[i].visible = false; }
            }
            s.t += dt;
            playerMesh.position.set(s.player.x, s.player.y + 0.9, s.player.z);
            camera.position.set(s.player.x, 6, s.player.z + 12);
            camera.lookAt(s.player.x, 1, s.player.z);
            if (ctx.render !== false) renderer.render(scene, camera);
        },
        suspend() { scene.remove(mine); return s; },
        snapshot() { return s; },
        restore(saved) {
            s = { score: 0, taken: [], t: 0, ...saved, player: { ...initialPlayer(), ...saved.player } };
            if (!mine.parent) scene.add(mine); // put back after a rolled-back swap
            syncCoins();
        },
        dispose() { scene?.remove(mine); },
        inspect() {
            return { score: s.score, x: round(s.player.x), y: round(s.player.y), z: round(s.player.z),
                maxY: round(s.player.maxY), jumps: s.player.jumps, t: round(s.t) };
        },
    };
}
