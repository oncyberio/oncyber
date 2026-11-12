import { DEMO_SET_OPTIONS } from "./catalog";
import { immutableCopy } from "./immutable";
import {
    VIDEO_FPS,
    VIDEO_PROJECT_VERSION,
    VIDEO_TICKS_PER_FRAME,
    VIDEO_TIMEBASE,
    type CameraSpline,
    type SetOption,
    type Transform3D,
    type Vec3,
    type VideoArtwork,
    type VideoProjectV1,
    type VideoShot,
} from "./types";

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const COLOR = /^#[0-9a-f]{6}$/i;

export class VideoModelError extends Error {
    constructor(readonly code: string, message: string) {
        super(message);
        this.name = "VideoModelError";
    }
}

export const identityTransform = (): Transform3D => ({
    position: [0, 0, 0],
    rotationDeg: [0, 0, 0],
    scale: [1, 1, 1],
});

export function createDemoShot(
    id = "shot-1",
    setId = DEMO_SET_OPTIONS[0].id
): VideoShot {
    return {
        id,
        name: "Opening move",
        setId,
        durationTicks: VIDEO_TIMEBASE * 5,
        camera: {
            position: {
                interpolation: "catmull-rom-chordal",
                points: [
                    [7, 2.8, 8],
                    [3.8, 2.3, 4.5],
                    [0, 2, 1],
                    [-2.4, 1.8, -2.4],
                ],
            },
            target: {
                interpolation: "catmull-rom-chordal",
                points: [
                    [0, 1.5, 0],
                    [0, 1.6, -0.4],
                    [-0.8, 1.5, -1.2],
                    [-1.8, 1.4, -2],
                ],
            },
            focalLengthMm: 35,
            rollDeg: 0,
        },
        prompt: "A calm architectural reveal with natural cinematic light.",
    };
}

export function createDemoProject(
    input: Partial<Pick<VideoProjectV1, "id" | "title" | "setId">> = {}
): VideoProjectV1 {
    const setId = input.setId ?? DEMO_SET_OPTIONS[0].id;
    const shot = createDemoShot("shot-1", setId);
    const project: VideoProjectV1 = {
        schemaVersion: VIDEO_PROJECT_VERSION,
        id: input.id ?? "video-demo",
        revision: 0,
        title: input.title ?? "Untitled video",
        fps: VIDEO_FPS,
        timebase: VIDEO_TIMEBASE,
        setId,
        sets: {},
        orderedShotIds: [shot.id],
        shots: { [shot.id]: shot },
        activeShotId: shot.id,
        artworks: {},
    };
    return parseVideoProject(project);
}

const object = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
const vec3 = (value: unknown): value is Vec3 =>
    Array.isArray(value) && value.length === 3 && value.every(finite);
const transform = (value: unknown): value is Transform3D =>
    object(value) &&
    vec3(value.position) &&
    vec3(value.rotationDeg) &&
    vec3(value.scale) &&
    value.scale.every((part) => part > 0);
const spline = (value: unknown): value is CameraSpline =>
    object(value) &&
    value.interpolation === "catmull-rom-chordal" &&
    Array.isArray(value.points) &&
    value.points.length >= 2 &&
    value.points.length <= 128 &&
    value.points.every(vec3);

function validId(value: unknown): value is string {
    return typeof value === "string" && ID.test(value);
}

function validShot(value: unknown, id: string): value is VideoShot {
    if (!object(value) || value.id !== id || !validId(value.id)) return false;
    if (typeof value.name !== "string" || value.name.length > 120) return false;
    if (value.setId !== undefined && !validId(value.setId)) return false;
    if (typeof value.prompt !== "string" || value.prompt.length > 12_000)
        return false;
    if (
        !Number.isSafeInteger(value.durationTicks) ||
        (value.durationTicks as number) < VIDEO_TICKS_PER_FRAME ||
        (value.durationTicks as number) % VIDEO_TICKS_PER_FRAME !== 0
    )
        return false;
    if (!object(value.camera)) return false;
    return (
        spline(value.camera.position) &&
        spline(value.camera.target) &&
        finite(value.camera.focalLengthMm) &&
        value.camera.focalLengthMm >= 12 &&
        value.camera.focalLengthMm <= 200 &&
        finite(value.camera.rollDeg) &&
        Math.abs(value.camera.rollDeg) <= 180
    );
}

function validArtwork(value: unknown, id: string): value is VideoArtwork {
    if (!object(value) || value.id !== id || !validId(value.id)) return false;
    if (typeof value.name !== "string" || value.name.length > 120) return false;
    if (value.setId !== undefined && !validId(value.setId)) return false;
    if (!object(value.source)) return false;
    if (!["image", "nft"].includes(value.source.kind as string)) return false;
    if (typeof value.source.uri !== "string" || value.source.uri.length > 4096)
        return false;
    if (value.source.kind === "nft") {
        if (!object(value.source.nft)) return false;
        if (
            ![
                value.source.nft.chain,
                value.source.nft.contract,
                value.source.nft.tokenId,
            ].every(
                (part) =>
                    typeof part === "string" &&
                    part.length > 0 &&
                    part.length <= 256
            )
        )
            return false;
    }
    return (
        transform(value.transform) &&
        ["generative", "identity", "exact"].includes(
            value.protection as string
        ) &&
        typeof value.visible === "boolean"
    );
}

function validSetOption(value: unknown, id: string): value is SetOption {
    if (!object(value) || value.id !== id || !validId(value.id)) return false;
    if (
        typeof value.title !== "string" ||
        !value.title.trim() ||
        value.title.length > 120 ||
        typeof value.subtitle !== "string" ||
        value.subtitle.length > 240
    )
        return false;
    if (
        !Array.isArray(value.tags) ||
        value.tags.length > 24 ||
        value.tags.some(
            (tag) => typeof tag !== "string" || !tag || tag.length > 48
        )
    )
        return false;
    if (
        !Array.isArray(value.palette) ||
        value.palette.length < 2 ||
        value.palette.length > 8 ||
        value.palette.some(
            (color) => typeof color !== "string" || !COLOR.test(color)
        )
    )
        return false;
    if (
        !Array.isArray(value.nodes) ||
        value.nodes.length < 1 ||
        value.nodes.length > 128
    )
        return false;
    const nodeIds = new Set<string>();
    return value.nodes.every((node) => {
        if (
            !object(node) ||
            !validId(node.id) ||
            nodeIds.has(node.id) ||
            typeof node.name !== "string" ||
            node.name.length > 120 ||
            !["box", "plane", "cylinder", "sphere"].includes(
                node.primitive as string
            ) ||
            !transform(node.transform) ||
            !vec3(node.size) ||
            node.size.some((part) => part <= 0) ||
            !object(node.material) ||
            typeof node.material.color !== "string" ||
            !COLOR.test(node.material.color) ||
            !finite(node.material.roughness) ||
            node.material.roughness < 0 ||
            node.material.roughness > 1 ||
            !finite(node.material.metalness) ||
            node.material.metalness < 0 ||
            node.material.metalness > 1
        )
            return false;
        nodeIds.add(node.id);
        return true;
    });
}

export function validateVideoProject(value: unknown): readonly string[] {
    const errors: string[] = [];
    if (!object(value)) return ["project must be an object"];
    if (value.schemaVersion !== VIDEO_PROJECT_VERSION)
        errors.push("schemaVersion must be 1");
    if (!validId(value.id)) errors.push("id is invalid");
    if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0)
        errors.push("revision must be a non-negative integer");
    if (typeof value.title !== "string" || value.title.length > 120)
        errors.push("title is invalid");
    if (value.fps !== VIDEO_FPS) errors.push("fps must be 30");
    if (value.timebase !== VIDEO_TIMEBASE)
        errors.push("timebase must be 30000");
    if (!validId(value.setId)) errors.push("setId is invalid");
    if (value.sets !== undefined && !object(value.sets))
        errors.push("sets must be a record");
    else if (
        object(value.sets) &&
        (Object.keys(value.sets).length > 100 ||
            Object.entries(value.sets).some(
                ([id, set]) => !validSetOption(set, id)
            ))
    )
        errors.push("sets contains invalid entries");
    if (!object(value.shots)) errors.push("shots must be a record");
    if (
        !Array.isArray(value.orderedShotIds) ||
        value.orderedShotIds.length < 1 ||
        value.orderedShotIds.length > 100 ||
        !value.orderedShotIds.every(validId) ||
        new Set(value.orderedShotIds).size !== value.orderedShotIds.length
    )
        errors.push("orderedShotIds is invalid");
    const shots = value.shots;
    const orderedShotIds = value.orderedShotIds;
    if (object(shots) && Array.isArray(orderedShotIds)) {
        const shotKeys = Object.keys(shots);
        if (
            shotKeys.length !== orderedShotIds.length ||
            orderedShotIds.some((id) => !validShot(shots[id], id)) ||
            shotKeys.some((id) => !orderedShotIds.includes(id))
        )
            errors.push("shots do not match orderedShotIds");
    }
    if (
        !validId(value.activeShotId) ||
        !Array.isArray(value.orderedShotIds) ||
        !value.orderedShotIds.includes(value.activeShotId)
    )
        errors.push("activeShotId is invalid");
    if (!object(value.artworks)) errors.push("artworks must be a record");
    else if (
        Object.keys(value.artworks).length > 500 ||
        Object.entries(value.artworks).some(
            ([id, artwork]) => !validArtwork(artwork, id)
        )
    )
        errors.push("artworks contains invalid entries");
    try {
        if (JSON.stringify(value).length > 2_000_000)
            errors.push("project exceeds the 2 MB model limit");
    } catch {
        errors.push("project must be serializable");
    }
    return errors;
}

export function parseVideoProject(value: unknown): VideoProjectV1 {
    const errors = validateVideoProject(value);
    if (errors.length)
        throw new VideoModelError("INVALID_VIDEO_PROJECT", errors.join("; "));
    return immutableCopy(value as VideoProjectV1);
}

export function projectWithRevision(
    value: VideoProjectV1,
    revision: number
): VideoProjectV1 {
    return parseVideoProject({ ...value, revision });
}

export function isHexColor(value: string): boolean {
    return COLOR.test(value);
}
