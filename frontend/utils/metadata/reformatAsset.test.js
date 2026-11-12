jest.mock("@components/_3DExhibit-v2/three/constants", () => ({
    EDIT_MODE: false,
}));
jest.mock("@components/_3DExhibit-v2/three/utils/mediatype", () => ({
    IMAGE_MEDIA: "IMAGE_MEDIA",
    PANORAMA_MEDIA: "PANORAMA_MEDIA",
    getMediaType: (mime) =>
        mime.startsWith("video")
            ? "VIDEO_MEDIA"
            : mime.startsWith("panorama")
            ? "PANORAMA_MEDIA"
            : "IMAGE_MEDIA",
}));
jest.mock("@3utils/platform", () => ({ isWebmSupported: () => false }), {
    virtual: true,
});
jest.mock("@components/_3DExhibit-v2/three/utils/spaceutils", () => ({
    artworkDepth: () => 0.1,
    DEFAULTS: {},
}));
jest.mock("@utils/formatAssets", () => ({ getMime: () => "image/png" }));
jest.mock("@utils/js", () => ({
    clamp: (x, min, max) => Math.max(min, Math.min(x, max)),
    removeDuplicates: (values) => [...new Set(values)],
}));
jest.mock("@utils/partnerships/singledisplay", () => ({
    GET_SINGLE_DISPLAY_EXPERIENCE: () => null,
}));
jest.mock("@utils/partnerships/sothebys", () => ({
    SOTHEBYS_ROOM_SLUG: "sothebys",
}));
jest.mock("@utils/partnerships/sothebys/formatAsset", () => ({
    formatAsset: jest.fn(),
}));
jest.mock("@utils/tezosAssets", () => ({ upgradeObjktAsset: jest.fn() }));
jest.mock(
    "@api/anyUpload/_api",
    () => ({ __esModule: true, default: { getAssetsByHash: jest.fn() } }),
    { virtual: true }
);
jest.mock("@utils/media/recoverArtwork", () => ({
    recoverArtworkMedia: jest.fn(),
}));
jest.mock("@env", () => ({ nodeEnv: {} }));

import { getMediaLODUrls } from "./reformatAsset";

const original =
    "https://cyber.mypinata.cloud/ipfs/QmArtwork?filename=portrait.png";
const image = { mime_type: "image/png", image_url: original };
const video = {
    mime_type: "video/mp4",
    animation_url:
        "https://cyber.mypinata.cloud/ipfs/QmMovie?filename=movie.mp4",
};
function size(url) {
    return new URL(url).searchParams.get("img-width");
}

test("Pinata starts at 256px and upgrades to bounded 512px before original fallback", async () => {
    const lod = await getMediaLODUrls(image);
    expect(size(lod.lo.urls[0])).toBe("256");
    expect(size(lod.hi.urls[0])).toBe("512");
    expect(new URL(lod.hi.urls[0]).searchParams.get("filename")).toBe(
        "portrait.png"
    );
    expect(lod.hi.urls[1]).toBe(original);
});

test("existing transforms do not bypass the nearby cap or remove unrelated parameters", async () => {
    const url =
        original + "&img-width=2048&img-fit=scale-down&img-height=2048&cache=1";
    const lod = await getMediaLODUrls({
        ...image,
        image_url: url,
        hdImage: true,
    });
    expect(size(lod.lo.urls[0])).toBe("256");
    expect(size(lod.hi.urls[0])).toBe("1024");
    expect(lod.hi.urls[1]).toBe(original + "&cache=1");
});

test("panorama projection retains its larger nearby variant", async () => {
    const lod = await getMediaLODUrls({ ...image, mime_type: "panorama/jpg" });
    expect(lod.hi.type).toBe("PANORAMA_MEDIA");
    expect(size(lod.hi.urls[0])).toBe("4096");
});

test.each([
    { image_url: video.animation_url },
    { image_url: "https://media.test/poster.mp4" },
    {
        image_url: "https://cyber.mypinata.cloud/ipfs/QmExtensionless",
        cover_mime_type: "video/mp4",
    },
])(
    "movie bytes in an image field never become a poster: %j",
    async (fields) => {
        const lod = await getMediaLODUrls({ ...video, ...fields });
        expect(lod.lo).toBeNull();
        expect(lod.hi.urls).toEqual([video.animation_url]);
    }
);

test("a real preview is still used when the cover is a movie", async () => {
    const lod = await getMediaLODUrls({
        ...video,
        image_preview_url: original,
        image_url: video.animation_url,
        cover_mime_type: "video/mp4",
    });
    expect(lod.lo.type).toBe("IMAGE_MEDIA");
    expect(size(lod.lo.urls[0])).toBe("256");
});

test("prepared static derivatives remain preferred over transformed originals", async () => {
    const lod = await getMediaLODUrls({
        ...image,
        blockchain: "ethereum",
        contract_address: "0xabc",
        token_id: "1",
        media_variants: {
            version: 1,
            identity: "ethereum:0xabc:1",
            images: [
                {
                    url: "https://cache.test/preview.webp",
                    width: 384,
                    height: 256,
                },
                {
                    url: "https://cache.test/full.webp",
                    width: 1024,
                    height: 683,
                },
            ],
        },
    });
    expect(lod.lo.urls[0]).toBe("https://cache.test/preview.webp");
    expect(lod.hi.urls[0]).toBe("https://cache.test/full.webp");
});

test("legacy OpenSea Pinata posters use the managed resized gateway", async () => {
    const lod = await getMediaLODUrls({
        ...video,
        image_preview_url: original.replace(
            "cyber.mypinata.cloud",
            "opensea.mypinata.cloud"
        ),
    });
    expect(new URL(lod.lo.urls[0]).hostname).toBe("cyber.mypinata.cloud");
    expect(size(lod.lo.urls[0])).toBe("256");
});

test("originals from hosts that cannot resize decode no larger than the resized variant", async () => {
    const arweave = {
        mime_type: "image/png",
        image_url: "https://arweave.net/abc",
    };
    const lod = await getMediaLODUrls(arweave);
    expect(lod.lo).toBeNull();
    expect(lod.hi.urls).toEqual(["https://arweave.net/abc"]);
    expect(lod.hi.decodeLimit).toEqual({ width: 512, height: 512 });
    const hd = await getMediaLODUrls({ ...arweave, hdImage: true });
    expect(hd.hi.decodeLimit).toEqual({ width: 1024, height: 1024 });
});

test("seadn portraits keep their height: only the width is capped", async () => {
    const lod = await getMediaLODUrls({
        mime_type: "image/png",
        image_url: "https://i2c.seadn.io/s/raw/files/abc.png",
    });
    expect(lod.hi.decodeLimit).toEqual({ width: 512, height: null });
});

test("panoramas keep their full projection", async () => {
    const lod = await getMediaLODUrls({ ...image, mime_type: "panorama/jpg" });
    expect(lod.hi.decodeLimit).toBeUndefined();
});

test("Cloudinary artworks are asked for WebP at both levels of detail", async () => {
    const lod = await getMediaLODUrls({
        mime_type: "image/jpeg",
        image_url: "https://res.cloudinary.com/demo/image/upload/v1/art.jpg",
    });
    expect(lod.lo.urls[0]).toContain("w_256,f_webp/");
    expect(lod.hi.urls[0]).toContain("w_512,f_webp/");
    // The stored URL stays as the fallback.
    expect(lod.hi.urls).toContain(
        "https://res.cloudinary.com/demo/image/upload/v1/art.jpg"
    );
});
