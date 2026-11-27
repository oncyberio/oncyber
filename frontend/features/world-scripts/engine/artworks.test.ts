/** @jest-environment node */
import { Group, Object3D } from "three";

jest.mock("./facade", () => ({
    liveArtworks: jest.fn(() => []),
    artworkId: (artwork: any) => String(artwork?.data?.id ?? ""),
    artworkName: (artwork: any) => String(artwork?.data?.name ?? ""),
    artworkType: (artwork: any) => String(artwork?.mediaType ?? ""),
}));

import { liveArtworks } from "./facade";
import { createArtworks } from "./artworks";

/** An artwork hung in a wall that is itself moved, as in a real space. */
function hung() {
    const wall = new Group();
    wall.position.set(10, 0, 0);
    const artwork: any = new Object3D();
    artwork.data = { id: "art-1", name: "Stars" };
    artwork.mediaType = "image";
    artwork.position.set(0, 2, 0);
    wall.add(artwork);
    wall.updateMatrixWorld(true);
    (liveArtworks as jest.Mock).mockReturnValue([artwork]);
    return artwork as Object3D;
}

describe("the space's artworks, for a script", () => {
    test("each is told by id, with where it is in the world", () => {
        hung();
        expect(createArtworks().list()).toEqual([
            {
                id: "art-1",
                name: "Stars",
                type: "image",
                position: [10, 2, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                visible: true,
            },
        ]);
    });

    test("one without an id is not offered", () => {
        (liveArtworks as jest.Mock).mockReturnValue([new Object3D()]);
        expect(createArtworks().list()).toEqual([]);
    });

    test("a script moves one in world coordinates, and it is put back as it was", () => {
        const artwork = hung();
        const artworks = createArtworks();
        artworks.set("art-1", {
            position: [12, 3, 1],
            rotation: [0, 1, 0],
            scale: [2, 2, 2],
            visible: false,
        });
        // In its wall's own frame.
        expect(artwork.position.toArray()).toEqual([2, 3, 1]);
        expect(artwork.rotation.y).toBe(1);
        expect(artwork.visible).toBe(false);
        artworks.reset();
        expect(artwork.position.toArray()).toEqual([0, 2, 0]);
        expect(artwork.rotation.y).toBe(0);
        expect(artwork.scale.toArray()).toEqual([1, 1, 1]);
        expect(artwork.visible).toBe(true);
    });

    test("a moved artwork is still told as the space saved it", () => {
        hung();
        const artworks = createArtworks();
        const before = artworks.list();
        artworks.set("art-1", {
            position: [0, 9, 0],
            scale: [3, 3, 3],
            visible: false,
        });
        // A restart begins from the same place every time.
        expect(artworks.list()).toEqual(before);
        // And a second change does not forget where it first was.
        artworks.set("art-1", { position: [5, 5, 5] });
        artworks.reset();
        expect(artworks.list()).toEqual(before);
    });

    test("an id the space does not have changes nothing", () => {
        const artwork = hung();
        const artworks = createArtworks();
        artworks.set("nope", { visible: false });
        expect(artwork.visible).toBe(true);
        expect(() => artworks.reset()).not.toThrow();
    });
});
