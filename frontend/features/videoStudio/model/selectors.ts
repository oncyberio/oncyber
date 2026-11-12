import { DEMO_SET_OPTIONS, findSetOption } from "./catalog";
import type {
    SetOption,
    VideoArtwork,
    VideoProjectV1,
    VideoShot,
} from "./types";

export function selectActiveShot(project: VideoProjectV1): VideoShot {
    return project.shots[project.activeShotId];
}

export function selectOrderedShots(
    project: VideoProjectV1
): readonly VideoShot[] {
    return project.orderedShotIds.map((id) => project.shots[id]);
}

export function selectCurrentSet(
    project: VideoProjectV1,
    catalog: readonly SetOption[] = DEMO_SET_OPTIONS
): SetOption | undefined {
    return findSetOption(project.setId, catalog);
}

export function selectAvailableSets(
    project: VideoProjectV1,
    catalog: readonly SetOption[] = DEMO_SET_OPTIONS
): readonly SetOption[] {
    const byId = new Map(catalog.map((set) => [set.id, set]));
    Object.values(project.sets ?? {}).forEach((set) => byId.set(set.id, set));
    return [...byId.values()];
}

export function selectResolvedSetId(
    project: VideoProjectV1,
    shotId = project.activeShotId
): string {
    return project.shots[shotId]?.setId ?? project.setId;
}

export function selectSetForShot(
    project: VideoProjectV1,
    shotId = project.activeShotId,
    catalog: readonly SetOption[] = DEMO_SET_OPTIONS
): SetOption | undefined {
    return findSetOption(
        selectResolvedSetId(project, shotId),
        selectAvailableSets(project, catalog)
    );
}

export function selectArtworksForSet(
    project: VideoProjectV1,
    setId: string
): readonly VideoArtwork[] {
    return selectArtworks(project).filter(
        (artwork) => (artwork.setId ?? project.setId) === setId
    );
}

export function selectArtworksForShot(
    project: VideoProjectV1,
    shotId = project.activeShotId
): readonly VideoArtwork[] {
    return selectArtworksForSet(project, selectResolvedSetId(project, shotId));
}

export function selectArtworks(
    project: VideoProjectV1
): readonly VideoArtwork[] {
    return Object.values(project.artworks);
}

export function selectExactArtworkIds(
    project: VideoProjectV1
): readonly string[] {
    return selectArtworks(project)
        .filter((artwork) => artwork.protection === "exact")
        .map((artwork) => artwork.id);
}

export function selectDurationTicks(project: VideoProjectV1): number {
    return selectOrderedShots(project).reduce(
        (total, shot) => total + shot.durationTicks,
        0
    );
}
