import type * as THREE from "three/webgpu";
import { CHARACTERS } from "./characters";
import type { AvatarData } from "./generate";
import {
    ProceduralAvatar,
    assembleAvatar,
    generateAvatarInSlices,
} from "./index";
import { createProceduralAvatarWorker } from "./workerFactory";

/**
 * The part of a loaded VRM that Oncyber's avatar code relies on. A
 * procedural avatar offers the same, so it can stand in for a VRM file.
 */
export interface VrmLike {
    scene: THREE.Group;
    humanoid: {
        getNormalizedBoneNode(name: string): THREE.Object3D | null;
        getNormalizedPose(): unknown;
        resetNormalizedPose(): void;
        setNormalizedPose(pose: unknown): void;
    };
    meta: { metaVersion: string };
    update(delta: number): void;
}

type Pose = Record<
    string,
    {
        position: [number, number, number];
        rotation: [number, number, number, number];
    }
>;

/** Wrap a procedural avatar in the VRM-shaped interface. */
export function asVrm(avatar: ProceduralAvatar): VrmLike {
    const rest: Pose = {};
    for (const [name, bone] of Object.entries(avatar.bones))
        rest[name] = {
            position: bone.position.toArray() as [number, number, number],
            rotation: bone.quaternion.toArray() as [
                number,
                number,
                number,
                number
            ],
        };
    const apply = (pose: Pose) => {
        for (const [name, value] of Object.entries(pose)) {
            const bone = avatar.bones[name];
            if (!bone) continue;
            if (value.position) bone.position.fromArray(value.position);
            if (value.rotation) bone.quaternion.fromArray(value.rotation);
        }
    };
    return {
        scene: avatar.scene,
        humanoid: {
            getNormalizedBoneNode: (name) => avatar.bones[name] || null,
            getNormalizedPose() {
                const pose: Pose = {};
                for (const [name, bone] of Object.entries(avatar.bones))
                    pose[name] = {
                        position: bone.position.toArray() as [
                            number,
                            number,
                            number
                        ],
                        rotation: bone.quaternion.toArray() as [
                            number,
                            number,
                            number,
                            number
                        ],
                    };
                return pose;
            },
            resetNormalizedPose: () => apply(rest),
            setNormalizedPose: (pose) => apply((pose || {}) as Pose),
        },
        // VRM 1.0 convention: the avatar faces +Z.
        meta: { metaVersion: "1" },
        update: (delta) => avatar.update(delta),
    };
}

/** Generated once per character; every avatar instance shares the buffers. */
const generated = new Map<string, Promise<AvatarData>>();

function generateInWorker(
    id: string,
    detail: number
): Promise<AvatarData> | null {
    let worker: Worker | null = null;
    try {
        worker = createProceduralAvatarWorker();
    } catch {
        worker = null;
    }
    if (!worker) return null;
    return new Promise<AvatarData>((resolve, reject) => {
        worker.onmessage = (
            event: MessageEvent<{ data?: AvatarData; error?: string }>
        ) => {
            worker.terminate();
            if (event.data.data) resolve(event.data.data);
            else
                reject(
                    new Error(event.data.error || "Avatar generation failed")
                );
        };
        worker.onerror = (event) => {
            worker.terminate();
            reject(new Error(event.message || "Avatar worker failed"));
        };
        worker.postMessage({ id, detail });
    });
}

/**
 * The data for a built-in procedural avatar. It is generated in a worker
 * when one is available and in slices on the page otherwise, and kept for
 * the rest of the session.
 */
export function proceduralAvatarData(
    id: string,
    detail = 1
): Promise<AvatarData> {
    const key = `${id}@${detail}`;
    let pending = generated.get(key);
    if (!pending) {
        const spec = CHARACTERS[id];
        if (!spec)
            return Promise.reject(
                new Error(`Unknown procedural avatar "${id}"`)
            );
        const inline = () => generateAvatarInSlices(spec, { detail });
        const worker = generateInWorker(id, detail);
        pending = worker ? worker.catch(inline) : inline();
        generated.set(key, pending);
        pending.catch(() => generated.delete(key));
    }
    return pending;
}

/** Build a procedural avatar by id and present it as a VRM. */
export async function loadProceduralVrm(
    id: string,
    detail = 1
): Promise<VrmLike> {
    return asVrm(assembleAvatar(await proceduralAvatarData(id, detail)));
}
