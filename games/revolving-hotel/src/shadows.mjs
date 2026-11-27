import * as T from "three/webgpu";
import { HEIGHT, WIDTH } from "./hotel/scene.mjs";
import * as n from "three/tsl";
export function addContactShadows(room, actors) {
    const plane = new T.PlaneGeometry(1, 1),
        v = new T.Vector3();
    const walls = [
        { normal: [0, 1, 0], level: 0 },
        { normal: [1, 0, 0], level: -WIDTH / 2 + 0.047 },
        { normal: [0, -1, 0], level: -HEIGHT + 0.012 },
        { normal: [-1, 0, 0], level: -WIDTH / 2 + 0.047 },
    ].map(({ normal, level }) => ({ normal: new T.Vector3(...normal), level }));
    const groups = actors.map((a) =>
        [a.bones.LeftFoot, a.bones.RightFoot, a.bones.Hips].map((bone, i) => {
            const strength = n.uniform(0);
            const m = new T.MeshBasicNodeMaterial({
                color: "#21160e",
                transparent: true,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -1,
            });
            m.opacityNode = n
                .exp(n.uv().sub(0.5).mul(2).length().pow(2).mul(-4.3))
                .mul(strength);
            const mesh = new T.Mesh(plane, m);
            mesh.renderOrder = 2;
            room.add(mesh);
            return { mesh, strength, bone, body: i === 2 };
        })
    );
    return function update() {
        for (const group of groups)
            for (const { mesh, strength, bone, body } of group) {
                room.worldToLocal(bone.getWorldPosition(v));
                let wall = walls[0],
                    dist = Infinity;
                for (const w of walls) {
                    const d = v.dot(w.normal) - w.level;
                    if (d < dist) {
                        dist = d;
                        wall = w;
                    }
                }
                mesh.visible = dist < (body ? 1.22 : 0.51);
                if (!mesh.visible) continue;
                mesh.position
                    .copy(v)
                    .addScaledVector(wall.normal, 0.012 - dist);
                mesh.quaternion.setFromUnitVectors(
                    new T.Vector3(0, 0, 1),
                    wall.normal
                );
                mesh.rotateZ(Math.PI / 2);
                const soft = Math.max(0, dist);
                mesh.scale.set(
                    (body ? 1.24 : 0.48) + soft * 0.3,
                    (body ? 0.84 : 0.27) + soft * 0.28,
                    1
                );
                strength.value = body
                    ? 0.22 * (1 - soft / 1.3)
                    : 0.73 * Math.pow(1 - Math.min(1, soft / 0.54), 1.3);
            }
    };
}
