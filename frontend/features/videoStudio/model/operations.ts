import { DEMO_SET_OPTIONS, findSetOption } from "./catalog";
import { cloneValue } from "./immutable";
import { parseVideoProject, VideoModelError } from "./project";
import type {
    SetOption,
    VideoOperation,
    VideoProjectV1,
    VideoShot,
} from "./types";

export interface ApplyOperationsOptions {
    readonly expectedRevision?: number;
    readonly catalog?: readonly SetOption[];
}

export class VideoRevisionConflict extends VideoModelError {
    constructor(readonly expected: number, readonly actual: number) {
        super(
            "VIDEO_REVISION_CONFLICT",
            `Expected project revision ${expected}, received ${actual}.`
        );
        this.name = "VideoRevisionConflict";
    }
}

function shot(project: VideoProjectV1, id: string): VideoShot {
    const value = project.shots[id];
    if (!value)
        throw new VideoModelError(
            "SHOT_NOT_FOUND",
            `Shot ${id} was not found.`
        );
    return value;
}

function artwork(project: VideoProjectV1, id: string) {
    const value = project.artworks[id];
    if (!value)
        throw new VideoModelError(
            "ARTWORK_NOT_FOUND",
            `Artwork ${id} was not found.`
        );
    return value;
}

function replaceShot(
    project: VideoProjectV1,
    id: string,
    next: VideoShot
): VideoProjectV1 {
    return { ...project, shots: { ...project.shots, [id]: next } };
}

function projectCatalog(
    project: VideoProjectV1,
    catalog: readonly SetOption[]
): readonly SetOption[] {
    return [...catalog, ...Object.values(project.sets ?? {})];
}

function expectSet(
    project: VideoProjectV1,
    setId: string,
    catalog: readonly SetOption[]
) {
    if (!findSetOption(setId, projectCatalog(project, catalog)))
        throw new VideoModelError(
            "SET_NOT_FOUND",
            `Set ${setId} is not in this project or the active catalog.`
        );
}

/** Pin legacy records to the previous default before changing that default. */
function materializeLegacySetReferences(
    project: VideoProjectV1
): VideoProjectV1 {
    const hasLegacyShots = Object.values(project.shots).some(
        (value) => value.setId === undefined
    );
    const hasLegacyArtwork = Object.values(project.artworks).some(
        (value) => value.setId === undefined
    );
    if (!hasLegacyShots && !hasLegacyArtwork) return project;
    return {
        ...project,
        shots: Object.fromEntries(
            Object.entries(project.shots).map(([id, value]) => [
                id,
                value.setId === undefined
                    ? { ...value, setId: project.setId }
                    : value,
            ])
        ),
        artworks: Object.fromEntries(
            Object.entries(project.artworks).map(([id, value]) => [
                id,
                value.setId === undefined
                    ? { ...value, setId: project.setId }
                    : value,
            ])
        ),
    };
}

function changeSpline(
    project: VideoProjectV1,
    shotId: string,
    spline: "position" | "target",
    change: (points: Array<readonly [number, number, number]>) => void
): VideoProjectV1 {
    const current = shot(project, shotId);
    const points = current.camera[spline].points.map(
        (point) => [...point] as const
    );
    change(points);
    if (points.length < 2)
        throw new VideoModelError(
            "SPLINE_TOO_SHORT",
            "A camera spline needs at least two points."
        );
    return replaceShot(project, shotId, {
        ...current,
        camera: {
            ...current.camera,
            [spline]: { ...current.camera[spline], points },
        },
    });
}

function applyDraft(
    current: VideoProjectV1,
    operation: VideoOperation,
    catalog: readonly SetOption[]
): VideoProjectV1 {
    if (!operation?.id || operation.id.length > 128)
        throw new VideoModelError(
            "INVALID_OPERATION",
            "Every operation needs a bounded id."
        );
    switch (operation.type) {
        case "project.rename":
            return { ...current, title: operation.title };
        case "set.select":
            expectSet(current, operation.setId, catalog);
            return { ...current, setId: operation.setId };
        case "set.create": {
            if (
                findSetOption(
                    operation.set.id,
                    projectCatalog(current, catalog)
                )
            )
                throw new VideoModelError(
                    "SET_EXISTS",
                    `Set ${operation.set.id} already exists.`
                );
            const stable = materializeLegacySetReferences(current);
            return {
                ...stable,
                setId: operation.set.id,
                sets: {
                    ...(stable.sets ?? {}),
                    [operation.set.id]: operation.set,
                },
            };
        }
        case "shot.set.assign": {
            expectSet(current, operation.setId, catalog);
            const stable = materializeLegacySetReferences(current);
            const value = shot(stable, operation.shotId);
            return {
                ...replaceShot(stable, operation.shotId, {
                    ...value,
                    setId: operation.setId,
                }),
                setId: operation.setId,
            };
        }
        case "shot.add": {
            if (current.shots[operation.shot.id])
                throw new VideoModelError(
                    "SHOT_EXISTS",
                    `Shot ${operation.shot.id} already exists.`
                );
            const orderedShotIds = [...current.orderedShotIds];
            const after = operation.afterShotId
                ? orderedShotIds.indexOf(operation.afterShotId)
                : orderedShotIds.length - 1;
            if (operation.afterShotId && after < 0)
                throw new VideoModelError(
                    "SHOT_NOT_FOUND",
                    `Shot ${operation.afterShotId} was not found.`
                );
            expectSet(current, operation.shot.setId ?? current.setId, catalog);
            orderedShotIds.splice(after + 1, 0, operation.shot.id);
            return {
                ...current,
                shots: {
                    ...current.shots,
                    [operation.shot.id]: operation.shot,
                },
                orderedShotIds,
                activeShotId: operation.shot.id,
            };
        }
        case "shot.remove": {
            shot(current, operation.shotId);
            if (current.orderedShotIds.length === 1)
                throw new VideoModelError(
                    "LAST_SHOT",
                    "A video project must keep at least one shot."
                );
            const shots = { ...current.shots };
            delete shots[operation.shotId];
            const orderedShotIds = current.orderedShotIds.filter(
                (id) => id !== operation.shotId
            );
            return {
                ...current,
                shots,
                orderedShotIds,
                activeShotId:
                    current.activeShotId === operation.shotId
                        ? orderedShotIds[0]
                        : current.activeShotId,
            };
        }
        case "shot.activate":
            shot(current, operation.shotId);
            return { ...current, activeShotId: operation.shotId };
        case "shot.rename": {
            const value = shot(current, operation.shotId);
            return replaceShot(current, operation.shotId, {
                ...value,
                name: operation.name,
            });
        }
        case "shot.prompt.set": {
            const value = shot(current, operation.shotId);
            return replaceShot(current, operation.shotId, {
                ...value,
                prompt: operation.prompt,
            });
        }
        case "shot.duration.set": {
            const value = shot(current, operation.shotId);
            return replaceShot(current, operation.shotId, {
                ...value,
                durationTicks: operation.durationTicks,
            });
        }
        case "camera.point.insert":
            return changeSpline(
                current,
                operation.shotId,
                operation.spline,
                (points) => {
                    if (operation.index < 0 || operation.index > points.length)
                        throw new VideoModelError(
                            "POINT_INDEX",
                            "Camera point insertion index is out of range."
                        );
                    points.splice(operation.index, 0, operation.point);
                }
            );
        case "camera.point.move":
            return changeSpline(
                current,
                operation.shotId,
                operation.spline,
                (points) => {
                    if (operation.index < 0 || operation.index >= points.length)
                        throw new VideoModelError(
                            "POINT_INDEX",
                            "Camera point index is out of range."
                        );
                    points[operation.index] = operation.point;
                }
            );
        case "camera.point.remove":
            return changeSpline(
                current,
                operation.shotId,
                operation.spline,
                (points) => {
                    if (operation.index < 0 || operation.index >= points.length)
                        throw new VideoModelError(
                            "POINT_INDEX",
                            "Camera point index is out of range."
                        );
                    points.splice(operation.index, 1);
                }
            );
        case "camera.spline.replace":
            return changeSpline(
                current,
                operation.shotId,
                operation.spline,
                (points) => points.splice(0, points.length, ...operation.points)
            );
        case "camera.lens.set": {
            const value = shot(current, operation.shotId);
            return replaceShot(current, operation.shotId, {
                ...value,
                camera: {
                    ...value.camera,
                    focalLengthMm: operation.focalLengthMm,
                    rollDeg: operation.rollDeg ?? value.camera.rollDeg,
                },
            });
        }
        case "artwork.add":
            if (current.artworks[operation.artwork.id])
                throw new VideoModelError(
                    "ARTWORK_EXISTS",
                    `Artwork ${operation.artwork.id} already exists.`
                );
            expectSet(
                current,
                operation.artwork.setId ?? current.setId,
                catalog
            );
            return {
                ...current,
                artworks: {
                    ...current.artworks,
                    [operation.artwork.id]: operation.artwork,
                },
            };
        case "artwork.transform.set": {
            const value = artwork(current, operation.artworkId);
            return {
                ...current,
                artworks: {
                    ...current.artworks,
                    [operation.artworkId]: {
                        ...value,
                        transform: operation.transform,
                    },
                },
            };
        }
        case "artwork.protection.set": {
            const value = artwork(current, operation.artworkId);
            return {
                ...current,
                artworks: {
                    ...current.artworks,
                    [operation.artworkId]: {
                        ...value,
                        protection: operation.protection,
                    },
                },
            };
        }
        case "artwork.visibility.set": {
            const value = artwork(current, operation.artworkId);
            return {
                ...current,
                artworks: {
                    ...current.artworks,
                    [operation.artworkId]: {
                        ...value,
                        visible: operation.visible,
                    },
                },
            };
        }
        case "artwork.remove": {
            artwork(current, operation.artworkId);
            const artworks = { ...current.artworks };
            delete artworks[operation.artworkId];
            return { ...current, artworks };
        }
        default: {
            const impossible: never = operation;
            throw new VideoModelError(
                "UNKNOWN_OPERATION",
                `Unknown operation ${(impossible as VideoOperation).type}.`
            );
        }
    }
}

/** Applies a transaction without mutating its input and bumps revision exactly once. */
export function applyOperations(
    project: VideoProjectV1,
    operations: readonly VideoOperation[],
    options: ApplyOperationsOptions = {}
): VideoProjectV1 {
    const expected = options.expectedRevision ?? project.revision;
    if (project.revision !== expected)
        throw new VideoRevisionConflict(expected, project.revision);
    if (!operations.length)
        throw new VideoModelError(
            "EMPTY_OPERATION_BATCH",
            "An operation transaction cannot be empty."
        );
    const operationIds = new Set<string>();
    let next = cloneValue(project);
    for (const operation of operations) {
        if (operationIds.has(operation.id))
            throw new VideoModelError(
                "DUPLICATE_OPERATION_ID",
                `Operation id ${operation.id} appears twice in one transaction.`
            );
        operationIds.add(operation.id);
        next = applyDraft(next, operation, options.catalog ?? DEMO_SET_OPTIONS);
    }
    return parseVideoProject({ ...next, revision: project.revision + 1 });
}

export function applyOperation(
    project: VideoProjectV1,
    operation: VideoOperation,
    options: ApplyOperationsOptions = {}
): VideoProjectV1 {
    return applyOperations(project, [operation], options);
}
