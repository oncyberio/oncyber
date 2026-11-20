import { baseTokens } from "@styles/tokens";
import { BONES, JOINTS, type Joint } from "./rig";

type Three = typeof import("three/webgpu");

const J = Object.fromEntries(JOINTS.map((name, i) => [name, i * 3])) as Record<
    Joint,
    number
>;

/**
 * A plain jointed figure for a pose from `actionPose`: a rounded limb
 * between each pair of joints, a head, hands and feet. It stands in for an
 * avatar while actions are being tried; the same poses can drive an
 * avatar's bones later. Add `group` to a scene and place it; the pose is in
 * the figure's own space.
 */
export function createMannequin(
    THREE: Three,
    colour: string = baseTokens.color.paper
) {
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({
        color: colour,
        roughness: 0.55,
    });
    const accent = new THREE.MeshStandardMaterial({
        color: baseTokens.color.accent,
        roughness: 0.5,
    });
    // One limb shape, stretched and thinned for each bone.
    const limb = new THREE.CapsuleGeometry(1, 1, 4, 10);
    const ball = new THREE.SphereGeometry(1, 14, 10);
    const bones = BONES.map(([, , thick]) => {
        const mesh = new THREE.Mesh(limb, skin);
        mesh.userData.thick = thick;
        group.add(mesh);
        return mesh;
    });
    const part = (size: number, material = skin) => {
        const mesh = new THREE.Mesh(ball, material);
        mesh.scale.setScalar(size);
        group.add(mesh);
        return mesh;
    };
    const head = part(0.115);
    // The face side of the head, so the way the figure looks is readable.
    const nose = part(0.035, accent);
    const ends: Array<[Joint, InstanceType<Three["Mesh"]>]> = [
        ["leftHand", part(0.055)],
        ["rightHand", part(0.055, accent)],
        ["leftFoot", part(0.07)],
        ["rightFoot", part(0.07)],
    ];

    const a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        up = new THREE.Vector3(0, 1, 0),
        along = new THREE.Vector3();

    return {
        group,
        /** `pose`: three numbers a joint, in the order of JOINTS. */
        update(pose: Float32Array) {
            BONES.forEach(([from, to], i) => {
                a.fromArray(pose, J[from]);
                b.fromArray(pose, J[to]);
                const mesh = bones[i],
                    thick = mesh.userData.thick,
                    length = a.distanceTo(b);
                mesh.position.copy(a).add(b).multiplyScalar(0.5);
                // The shape is 3 long before scaling. Run a little past each
                // joint so neighbouring limbs overlap into a rounded joint.
                mesh.scale.set(thick, (length + thick) / 3, thick);
                mesh.quaternion.setFromUnitVectors(
                    up,
                    along.copy(b).sub(a).normalize()
                );
            });
            head.position.fromArray(pose, J.head);
            // Forward of the head, along where the chest faces.
            a.fromArray(pose, J.leftShoulder);
            b.fromArray(pose, J.rightShoulder);
            along.copy(b).sub(a).normalize();
            nose.position
                .copy(head.position)
                .add(a.set(-along.z, 0, along.x).multiplyScalar(0.11));
            for (const [joint, mesh] of ends)
                mesh.position.fromArray(pose, J[joint]);
        },
        dispose() {
            limb.dispose();
            ball.dispose();
            skin.dispose();
            accent.dispose();
        },
    };
}
