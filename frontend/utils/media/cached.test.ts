import { cachedMediaLOD } from "./cached";
const data = {
    blockchain: "ethereum",
    contract_address: "0xABC",
    token_id: "1",
    image_url: "https://original.test/art.png",
    media_variants: {
        version: 1,
        identity: "ethereum:0xabc:1",
        images: [
            { url: "https://cache.test/large.webp", width: 1024, height: 512 },
            { url: "https://cache.test/small.webp", width: 256, height: 128 },
        ],
        animation: { url: "https://cache.test/movie.mp4" },
    },
};
test("cached derivatives are used directly with original fallback and correct aspect ratio", () => {
    const lod = cachedMediaLOD(data, "IMAGE_MEDIA");
    expect(lod.lo.urls).toEqual(["https://cache.test/small.webp"]);
    expect(lod.hi.urls).toEqual([
        "https://cache.test/large.webp",
        data.image_url,
    ]);
    expect(data.media_variants.images[0].width).toBe(1024);
});
test("videos use static posters until upgraded", () => {
    const lod = cachedMediaLOD(data, "VIDEO_MEDIA");
    expect(lod.lo.type).toBe("IMAGE_MEDIA");
    expect(lod.hi.urls[0]).toBe("https://cache.test/movie.mp4");
});
test("replacing the NFT cannot reuse the previous artwork's derivatives", () => {
    expect(
        cachedMediaLOD({ ...data, token_id: "2" }, "IMAGE_MEDIA")
    ).toBeNull();
});
test("malformed manifests fall back to normal media loading", () => {
    expect(
        cachedMediaLOD(
            {
                ...data,
                media_variants: {
                    ...data.media_variants,
                    images: [{ url: "javascript:bad", width: 1, height: 1 }],
                },
            },
            "IMAGE_MEDIA"
        )
    ).toBeNull();
});
