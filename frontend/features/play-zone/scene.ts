import { baseTokens } from "@styles/tokens";
import {
    playBodies,
    type PlayPerson,
    type PlayRecipe,
} from "../../../multiplayer/protocol/play-zone";

type Three = typeof import("three/webgpu");

/** The eight colours a recipe may name, all from the design tokens. */
export const PLAY_PALETTE = [
    baseTokens.color.accent,
    baseTokens.color.accentCreate,
    baseTokens.color.selectionStart,
    baseTokens.color.selectionEnd,
    baseTokens.color.anaglyphBlue,
    baseTokens.color.paper,
    baseTokens.color.secondary,
    baseTokens.color.muted,
];

const PERSON_RADIUS = 0.35;
const PERSON_HALF = 0.55;

/**
 * Draws one play zone: the arena, its things as two instanced meshes (balls
 * and boxes) and a capsule per person. It holds no game state; call
 * `setRecipe` when a game starts and `draw` with the poses to show.
 */
export function createPlayScene(THREE: Three) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(baseTokens.color.black);
    scene.add(
        new THREE.HemisphereLight(
            baseTokens.color.white,
            baseTokens.color.muted,
            1.6
        )
    );
    const sun = new THREE.DirectionalLight(baseTokens.color.white, 2.2);
    sun.position.set(6, 14, 8);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    const arena = new THREE.Group();
    scene.add(arena);

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    let balls: InstanceType<Three["InstancedMesh"]> | null = null,
        boxes: InstanceType<Three["InstancedMesh"]> | null = null;
    /** For each body: which mesh it is in, its slot there and its size. */
    let slots: Array<{ box: boolean; slot: number; size: number }> = [];

    const capsule = new THREE.CapsuleGeometry(
        PERSON_RADIUS,
        PERSON_HALF * 2,
        6,
        14
    );
    const nose = new THREE.BoxGeometry(0.12, 0.12, 0.3);
    const people = new Map<number, InstanceType<Three["Group"]>>();
    const personGroup = new THREE.Group();
    scene.add(personGroup);

    function person(id: number, own: boolean) {
        let mesh = people.get(id);
        if (mesh) return mesh;
        mesh = new THREE.Group();
        const colour = own
            ? baseTokens.color.paper
            : baseTokens.color.secondary;
        const body = new THREE.Mesh(
            capsule,
            new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6 })
        );
        body.position.y = PERSON_HALF + PERSON_RADIUS;
        // A small block shows which way the person faces.
        const front = new THREE.Mesh(
            nose,
            new THREE.MeshStandardMaterial({ color: baseTokens.color.accent })
        );
        front.position.set(0, 1.45, PERSON_RADIUS + 0.1);
        mesh.add(body, front);
        personGroup.add(mesh);
        people.set(id, mesh);
        return mesh;
    }

    function clear(group: InstanceType<Three["Group"]>) {
        for (const child of [...group.children]) {
            group.remove(child);
            const mesh = child as any;
            mesh.geometry?.dispose?.();
            mesh.material?.dispose?.();
        }
    }

    return {
        scene,
        camera,
        setRecipe(recipe: PlayRecipe) {
            clear(arena);
            const { halfX, halfZ, walls, net } = recipe.arena;
            const floor = new THREE.Mesh(
                new THREE.BoxGeometry(halfX * 2, 0.1, halfZ * 2),
                new THREE.MeshStandardMaterial({
                    color: baseTokens.color.paperInk,
                    roughness: 0.9,
                })
            );
            floor.position.y = -0.05;
            arena.add(floor);
            // Side A's half is marked so the two sides are easy to tell apart.
            const half = new THREE.Mesh(
                new THREE.BoxGeometry(halfX, 0.02, halfZ * 2),
                new THREE.MeshStandardMaterial({
                    color: baseTokens.color.accent,
                    transparent: true,
                    opacity: 0.12,
                })
            );
            half.position.set(-halfX / 2, 0.011, 0);
            arena.add(half);
            const glass = () =>
                new THREE.MeshStandardMaterial({
                    color: baseTokens.color.white,
                    transparent: true,
                    opacity: 0.08,
                });
            if (walls)
                for (const [x, z, w, d] of [
                    [halfX + 0.25, 0, 0.5, halfZ * 2 + 1],
                    [-halfX - 0.25, 0, 0.5, halfZ * 2 + 1],
                    [0, halfZ + 0.25, halfX * 2 + 1, 0.5],
                    [0, -halfZ - 0.25, halfX * 2 + 1, 0.5],
                ]) {
                    const wall = new THREE.Mesh(
                        new THREE.BoxGeometry(w, 4, d),
                        glass()
                    );
                    wall.position.set(x, 2, z);
                    arena.add(wall);
                }
            if (net) {
                const mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(0.1, net, halfZ * 2),
                    new THREE.MeshStandardMaterial({
                        color: baseTokens.color.white,
                        transparent: true,
                        opacity: 0.45,
                    })
                );
                mesh.position.y = net / 2;
                arena.add(mesh);
            }

            const bodies = playBodies(recipe);
            const ballCount = bodies.filter(
                (body) => body.kind === "ball"
            ).length;
            const material = () =>
                new THREE.MeshStandardMaterial({ roughness: 0.45 });
            balls = new THREE.InstancedMesh(
                new THREE.SphereGeometry(1, 20, 14),
                material(),
                Math.max(1, ballCount)
            );
            boxes = new THREE.InstancedMesh(
                new THREE.BoxGeometry(2, 2, 2),
                material(),
                Math.max(1, bodies.length - ballCount)
            );
            balls.count = boxes.count = 0;
            let ball = 0,
                box = 0;
            slots = bodies.map((body) => {
                const isBox = body.kind === "box",
                    mesh = isBox ? boxes : balls,
                    slot = isBox ? box++ : ball++;
                mesh.setColorAt(
                    slot,
                    tint.set(PLAY_PALETTE[body.color] || PLAY_PALETTE[0])
                );
                return { box: isBox, slot, size: body.size };
            });
            balls.count = ball;
            boxes.count = box;
            for (const mesh of [balls, boxes]) {
                mesh.frustumCulled = false;
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
                arena.add(mesh);
            }
            // Far enough back to see the whole arena from one end.
            const reach = Math.max(halfX, halfZ);
            camera.position.set(0, reach * 1.25 + 4, halfZ + reach * 1.1 + 5);
            camera.lookAt(0, 0.5, 0);
        },
        /** `poses`: seven numbers a body. A body not yet heard about (`known` 0) is hidden. */
        draw(poses: Float32Array, known: Uint8Array) {
            if (!balls || !boxes) return;
            for (let i = 0; i < slots.length; i++) {
                const { box, slot, size } = slots[i],
                    p = i * 7;
                dummy.position.set(poses[p], poses[p + 1], poses[p + 2]);
                dummy.quaternion.set(
                    poses[p + 3],
                    poses[p + 4],
                    poses[p + 5],
                    poses[p + 6]
                );
                dummy.scale.setScalar(known[i] ? size : 0);
                dummy.updateMatrix();
                (box ? boxes : balls).setMatrixAt(slot, dummy.matrix);
            }
            balls.instanceMatrix.needsUpdate = true;
            boxes.instanceMatrix.needsUpdate = true;
        },
        /** Everyone in the zone. `self` is drawn from the local pose so it never lags. */
        drawPeople(
            list: PlayPerson[],
            self: PlayPerson | null,
            seconds: number
        ) {
            const seen = new Set<number>();
            const ease = 1 - Math.exp(-18 * seconds);
            for (const entry of list) {
                if (self && entry.id === self.id) continue;
                seen.add(entry.id);
                const fresh = !people.has(entry.id),
                    mesh = person(entry.id, false);
                if (fresh) mesh.position.set(entry.x, entry.y, entry.z);
                else {
                    mesh.position.x += (entry.x - mesh.position.x) * ease;
                    mesh.position.y += (entry.y - mesh.position.y) * ease;
                    mesh.position.z += (entry.z - mesh.position.z) * ease;
                }
                mesh.rotation.y = entry.yaw;
            }
            if (self) {
                seen.add(self.id);
                const mesh = person(self.id, true);
                mesh.position.set(self.x, self.y, self.z);
                mesh.rotation.y = self.yaw;
            }
            for (const [id, mesh] of people)
                if (!seen.has(id)) {
                    personGroup.remove(mesh);
                    people.delete(id);
                }
        },
        resize(width: number, height: number) {
            camera.aspect = width / Math.max(1, height);
            camera.updateProjectionMatrix();
        },
    };
}
