import {
    VIDEO_FPS,
    VIDEO_TICKS_PER_FRAME,
    immutableCopy,
    type Vec3,
    type VideoProjectV1,
} from "../model";
import { sampleChordalSpline } from "./spline";

export interface CameraManifestFrame {
    readonly index: number;
    readonly tick: number;
    readonly timestampUs: number;
    readonly progress: number;
    readonly position: Vec3;
    readonly target: Vec3;
    readonly focalLengthMm: number;
    readonly rollDeg: number;
}

export interface CameraManifestV1 {
    readonly schemaVersion: 1;
    readonly projectId: string;
    readonly projectRevision: number;
    readonly shotId: string;
    readonly setId: string;
    readonly fps: typeof VIDEO_FPS;
    readonly timebase: number;
    readonly ticksPerFrame: number;
    readonly durationTicks: number;
    readonly frameCount: number;
    readonly frames: readonly CameraManifestFrame[];
}

function clean(value: number): number {
    const rounded = Math.round(value * 1_000_000) / 1_000_000;
    return Object.is(rounded, -0) ? 0 : rounded;
}

function cleanVec(value: Vec3): Vec3 {
    return [clean(value[0]), clean(value[1]), clean(value[2])];
}

/**
 * Samples an editable shot into an engine-independent 30 fps control manifest.
 * The final encoded frame reaches the final spline point while timestamps remain
 * in the ordinary [0, duration) video interval.
 */
export function createCameraManifest(
    project: VideoProjectV1,
    shotId = project.activeShotId
): CameraManifestV1 {
    const shot = project.shots[shotId];
    if (!shot) throw new Error(`Shot ${shotId} was not found.`);
    if (project.fps !== VIDEO_FPS)
        throw new Error("Video Lab camera manifests are fixed at 30 fps.");
    const ticksPerFrame = project.timebase / VIDEO_FPS;
    if (
        ticksPerFrame !== VIDEO_TICKS_PER_FRAME ||
        shot.durationTicks % ticksPerFrame !== 0
    )
        throw new Error("Shot duration is not aligned to the 30 fps timebase.");
    const frameCount = shot.durationTicks / ticksPerFrame;
    const frames = Array.from({ length: frameCount }, (_, index) => {
        const progress = frameCount === 1 ? 0 : index / (frameCount - 1);
        return {
            index,
            tick: index * ticksPerFrame,
            timestampUs: Math.round((index * 1_000_000) / VIDEO_FPS),
            progress: clean(progress),
            position: cleanVec(
                sampleChordalSpline(shot.camera.position, progress)
            ),
            target: cleanVec(sampleChordalSpline(shot.camera.target, progress)),
            focalLengthMm: clean(shot.camera.focalLengthMm),
            rollDeg: clean(shot.camera.rollDeg),
        };
    });
    return immutableCopy({
        schemaVersion: 1,
        projectId: project.id,
        projectRevision: project.revision,
        shotId,
        setId: shot.setId ?? project.setId,
        fps: VIDEO_FPS,
        timebase: project.timebase,
        ticksPerFrame,
        durationTicks: shot.durationTicks,
        frameCount,
        frames,
    });
}

function stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value)
            .sort()
            .map(
                (key) =>
                    `${JSON.stringify(key)}:${stable(
                        (value as Record<string, unknown>)[key]
                    )}`
            )
            .join(",")}}`;
    }
    return JSON.stringify(value);
}

export function serializeCameraManifest(manifest: CameraManifestV1): string {
    return stable(manifest);
}

/** Stable non-cryptographic identifier for UI caches and the mock provider. */
export function fingerprint(value: unknown): string {
    const input = stable(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index++) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}
