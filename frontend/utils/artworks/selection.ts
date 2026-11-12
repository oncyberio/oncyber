/** Free-cursor browsing can select nearby art without changing camera/audio focus. */
export function hoveredArtwork(
    candidate: any,
    cameraPosition: any,
    enabled: boolean
) {
    if (
        !enabled ||
        !candidate?.isArtwork ||
        candidate.isPlaceholder ||
        candidate.wasDisposed
    )
        return null;
    const distance = cameraPosition.distanceTo(candidate.position);
    return distance <= candidate.maxLookatDistance() * 1.5 ? candidate : null;
}
