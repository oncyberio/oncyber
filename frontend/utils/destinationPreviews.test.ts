import {
    destinationPreviews,
    previewForRoom,
    hasDefaultGalleryCover,
} from "./destinationPreviews";
import { CYBER_WAREHOUSE_COVER } from "./destinationCover";

it("uses original destination artwork with legacy room IDs and thumbnail fallbacks", () => {
    const previews = destinationPreviews([
        {
            slug: "example-gallery",
            image: "https://images.test/example-gallery-2048.jpg",
            thumbnail: "/small.jpg",
        },
        { slug: "room", thumbnail: "ipfs://room-cover" },
    ]);
    expect(previewForRoom(previews, "example-gallery_v2")).toEqual([
        "https://images.test/example-gallery-2048.jpg",
        "/small.jpg",
    ]);
    expect(previewForRoom(previews, "room")).toEqual([
        "https://cyber.mypinata.cloud/ipfs/room-cover",
    ]);
    expect(previewForRoom(previews, "missing")).toEqual([]);
});

it("preserves the approved Warehouse cover without restoring its old artwork", () => {
    expect(
        destinationPreviews([{ slug: "cyberwarehouse", image: "/old-cat.jpg" }])
    ).toEqual({ cyberwarehouse: [CYBER_WAREHOUSE_COVER] });
});

it("never treats custom exhibit covers as defaults", () => {
    expect(hasDefaultGalleryCover([])).toBe(true);
    expect(hasDefaultGalleryCover(["/models/whitecube/basic.gltf.png"])).toBe(
        true
    );
    expect(hasDefaultGalleryCover(["https://uploads.test/my-world.jpg"])).toBe(
        false
    );
    expect(
        hasDefaultGalleryCover(["/models/room.png", "/my-custom-cover.jpg"])
    ).toBe(false);
});

it("rejects unsafe image schemes and ignores model and panorama fields", () => {
    expect(
        destinationPreviews([
            { slug: "bad", image: "javascript:alert(1)" },
            {
                slug: "360",
                heroImg360: "https://images.test/360.jpg",
                path: "/model.glb",
            } as any,
        ])
    ).toEqual({});
    expect(previewForRoom({ room: ["javascript:alert(1)"] }, "room")).toEqual(
        []
    );
});

it("serves restored previews for missing-cover galleries, including legacy room IDs", () => {
    const slugs = [
        "white-cube",
        "wolfgang-n2",
        "wolfgang-n2-dark",
        "loft",
        "classic",
        "altitude",
    ];
    const previews = destinationPreviews(
        slugs.map((slug) => ({
            slug,
            image: "https://images.test/blurry-original.png",
            thumbnail: "https://images.test/tiny-thumbnail.png",
        }))
    );
    for (const slug of slugs) {
        expect(previewForRoom(previews, slug)).toEqual([
            `/landing-build/gallery-previews/${slug}-gpt-1280.webp`,
        ]);
        expect(previewForRoom(previews, `${slug}_v2`)).toEqual(
            previewForRoom(previews, slug)
        );
    }
});

it("prefers the restored gallery fallback over a stale catalog thumbnail", () => {
    const expected = ["/landing-build/gallery-previews/altitude-gpt-1280.webp"];
    expect(previewForRoom({}, "altitude_v2")).toEqual(expected);
    expect(
        previewForRoom({ altitude: ["/old-low-res.png"] }, "altitude_v2")
    ).toEqual(expected);
});
