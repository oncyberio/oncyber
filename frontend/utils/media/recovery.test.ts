import {
    applyRecoveredMedia,
    isRetiredMediaUrl,
    openSeaMedia,
    recoveryIdentity,
    dropCroppedMediaCache,
} from "./recovery";

const dead = "https://img.reservoir.tools/old.png";
const identity = {
    blockchain: "ethereum",
    contract_address: "0x" + "a".repeat(40),
    token_id: "0",
    mime_type: "image/png",
    image_url: dead,
};

test("retired host detection is precise, including old proxy URLs", () => {
    expect(isRetiredMediaUrl(dead)).toBe(true);
    expect(
        isRetiredMediaUrl(
            "https://polar-mountain-96590.herokuapp.com/https://res.cloudinary.com/oncyber-io/image/upload/a.png"
        )
    ).toBe(true);
    expect(
        isRetiredMediaUrl(
            "https://res.cloudinary.com/another-account/image/a.png"
        )
    ).toBe(false);
    expect(
        isRetiredMediaUrl("https://img.reservoir.tools.example.com/a.png")
    ).toBe(false);
    expect(isRetiredMediaUrl({})).toBe(false);
});

test("recovery accepts token zero but rejects invalid identities and healthy media", () => {
    expect(recoveryIdentity(identity)?.token).toBe("0");
    expect(
        recoveryIdentity({ ...identity, contract_address: "../../secret" })
    ).toBeUndefined();
    expect(
        recoveryIdentity({
            ...identity,
            image_url: "https://i2c.seadn.io/a.png",
        })
    ).toBeUndefined();
    expect(
        recoveryIdentity({ ...identity, blockchain: "no-chain" })
    ).toBeUndefined();
});

test("repair retains titles, placement metadata and surviving originals", () => {
    const d = {
        ...identity,
        name: "Curator title",
        image_original_url: "ipfs://original",
        id: "placement",
    };
    applyRecoveredMedia(
        d,
        openSeaMedia({ display_image_url: "https://i2c.seadn.io/new.png" })
    );
    expect(d.image_url).toBe("https://i2c.seadn.io/new.png");
    expect(d.image_original_url).toBe("ipfs://original");
    expect(d.name).toBe("Curator title");
    expect(d.id).toBe("placement");
});

test("OpenSea movies in the image field use the video loader", () => {
    const media = openSeaMedia({
        image_url: "https://raw2.seadn.io/movie.mp4",
    });
    expect(media.image).toBeUndefined();
    expect(media.animation).toContain("movie.mp4");
    const d = applyRecoveredMedia({ ...identity }, media);
    expect(d.mime_type).toBe("video/mp4");
    expect(d.animation_url).toContain("movie.mp4");
});

test("bad provider data cannot inject non-media schemes", () => {
    expect(
        openSeaMedia({ image_url: "javascript:alert(1)", animation_url: dead })
    ).toEqual({ image: undefined, animation: undefined });
});

test("a failed OpenSea URL can be recovered while preserving originals and identity", () => {
    const d: any = {
        ...identity,
        image_url: "https://i2c.seadn.io/gone.gif",
        image_original_url: "ipfs://original",
        dcompressed_image_url: "https://cache.test/gone",
        name: "Curator title",
    };
    expect(recoveryIdentity(d)).toBeUndefined();
    expect(recoveryIdentity(d, true)?.token).toBe("0");
    applyRecoveredMedia(
        d,
        { image: "https://i2c.seadn.io/recovered.png", animation: undefined },
        true
    );
    expect(d.image_url).toBe("https://i2c.seadn.io/recovered.png");
    expect(d.dcompressed_image_url).toBe(d.image_url);
    expect(d.image_original_url).toBe("ipfs://original");
    expect(d.name).toBe("Curator title");
    expect(d.token_id).toBe("0");
});

test("old OpenSea file hosts are retired; current seadn hosts are not", () => {
    expect(isRetiredMediaUrl("https://storage.opensea.io/files/a.glb")).toBe(true);
    expect(isRetiredMediaUrl("https://openseauserdata.com/files/a.glb")).toBe(true);
    expect(isRetiredMediaUrl("https://i.seadn.io/gae/a?w=500")).toBe(true);
    expect(isRetiredMediaUrl("https://raw2.seadn.io/ethereum/a.glb")).toBe(false);
    expect(isRetiredMediaUrl("https://i2c.seadn.io/ethereum/a.png")).toBe(false);
});

test("3D models with a dead OpenSea GLB are recovered from OpenSea v2", () => {
    const model: any = {
        ...identity,
        mime_type: "model/gltf-binary",
        image_url: "https://lh3.googleusercontent.com/poster",
        animation_url: "https://storage.opensea.io/files/dead.glb",
        animation_original_url: "https://storage.opensea.io/files/dead.glb",
    };
    expect(recoveryIdentity(model)?.token).toBe("0");
    const media = openSeaMedia({
        display_image_url: "https://i2c.seadn.io/poster.png",
        display_animation_url: "https://raw2.seadn.io/ethereum/live.glb",
    });
    applyRecoveredMedia(model, media);
    expect(model.animation_url).toBe("https://raw2.seadn.io/ethereum/live.glb");
    expect(model.animation_original_url).toBe(model.animation_url);
    expect(model.dcompressed_animation_url).toBeUndefined();
    expect(model.image_url).toBe("https://lh3.googleusercontent.com/poster");
    expect(model.mime_type).toBe("model/gltf-binary");
});

test("3D models served from a pinned copy or optimized files skip lookups", () => {
    const base = {
        ...identity,
        mime_type: "model/gltf-binary",
        animation_url: "https://storage.opensea.io/files/dead.glb",
    };
    expect(
        recoveryIdentity({
            ...base,
            dcompressed_animation_url: "https://cyber.mypinata.cloud/ipfs/Qm",
        })
    ).toBeUndefined();
    expect(
        recoveryIdentity({ ...base, d_optimized_files: { high: "x.glb" } })
    ).toBeUndefined();
});

test("a dead cached animation copy is replaced so it cannot shadow the repair", () => {
    const d: any = {
        ...identity,
        mime_type: "model/gltf-binary",
        dcompressed_animation_url: "https://openseauserdata.com/files/dead.glb",
    };
    expect(recoveryIdentity(d)?.token).toBe("0");
    applyRecoveredMedia(d, { image: undefined, animation: "https://raw2.seadn.io/a.glb" });
    expect(d.dcompressed_animation_url).toBe("https://raw2.seadn.io/a.glb");
});

test("caches built from a square-cropped seadn thumbnail are replaced", () => {
    const src = "https://i2c.seadn.io/ethereum/0xabc/tall.png";
    const d: any = {
        ...identity,
        image_url: "https://lh3.googleusercontent.com/tall",
        dcompressed_image_url: "https://storage.googleapis.com/c/image.webp",
        image_preview_url: "https://storage.googleapis.com/c/preview.webp",
        mediaCache: {
            sourceUrl: src,
            imageUrl: "https://storage.googleapis.com/c/image.webp",
            previewUrl: "https://storage.googleapis.com/c/preview.webp",
        },
    };
    dropCroppedMediaCache(d);
    expect(d.dcompressed_image_url).toBe(src + "?w=1024");
    expect(d.image_preview_url).toBe(src + "?w=384");
    expect(d.image_url).toBe("https://lh3.googleusercontent.com/tall");
    expect(d.mediaCache).toBeUndefined();
});

test("caches from sized seadn URLs, raw2 originals, or videos are kept", () => {
    const cache = (sourceUrl: string) => ({
        ...identity,
        dcompressed_image_url: "https://storage.googleapis.com/c/image.webp",
        mediaCache: { sourceUrl, imageUrl: "https://storage.googleapis.com/c/image.webp" },
    });
    for (const d of [
        cache("https://i2c.seadn.io/ethereum/a.png?w=500"),
        cache("https://raw2.seadn.io/ethereum/a.png"),
        { ...cache("https://i2c.seadn.io/ethereum/a.png"), mime_type: "video/mp4" },
    ]) {
        dropCroppedMediaCache(d);
        expect(d.dcompressed_image_url).toBe("https://storage.googleapis.com/c/image.webp");
        expect(d.mediaCache).toBeDefined();
    }
});

test("cropped caches from the retired i.seadn.io host fall back to other fields", () => {
    const d: any = {
        ...identity,
        image_url: "https://lh3.googleusercontent.com/tall",
        dcompressed_image_url: "https://storage.googleapis.com/c/image.webp",
        mediaCache: { sourceUrl: "https://i.seadn.io/gae/x", imageUrl: "https://storage.googleapis.com/c/image.webp" },
    };
    dropCroppedMediaCache(d);
    expect(d.dcompressed_image_url).toBeUndefined();
    expect(d.image_url).toBe("https://lh3.googleusercontent.com/tall");
});

test("saved blob: URLs are treated as unusable", () => {
    expect(isRetiredMediaUrl("blob:https://oncyber.io/6368dbfc")).toBe(true);
});
