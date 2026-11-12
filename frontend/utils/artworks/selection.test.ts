import { hoveredArtwork } from "./selection";
const art = { isArtwork: true, position: {}, maxLookatDistance: () => 4 };
const camera = (distance: number) => ({ distanceTo: () => distance });
test("a nearby hovered artwork can show info with the cursor unlocked", () => {
    expect(hoveredArtwork(art, camera(3), true)).toBe(art);
});
test("locked camera mode, distant artworks and disposed meshes cannot steal selection", () => {
    expect(hoveredArtwork(art, camera(3), false)).toBeNull();
    expect(hoveredArtwork(art, camera(8), true)).toBeNull();
    expect(
        hoveredArtwork({ ...art, wasDisposed: true }, camera(3), true)
    ).toBeNull();
    expect(hoveredArtwork(null, camera(3), true)).toBeNull();
});
