// Old OpenSea file hosts no longer resolve in DNS (checked 2026-10-21);
// OpenSea v2 now serves the same files from raw2.seadn.io / i2c.seadn.io.
const RETIRED_HOSTS = new Set([
    "img.reservoir.tools",
    "storage.opensea.io",
    "openseauserdata.com",
    "i.seadn.io",
]);

/** Providers whose saved Oncyber URLs no longer serve media. */
export function isRetiredMediaUrl(value: unknown): boolean {
    if (typeof value !== "string") return false;
    // Session-local object URLs saved by mistake never resolve for visitors.
    if (value.startsWith("blob:")) return true;
    try {
        const url = new URL(
            value.replace("https://polar-mountain-96590.herokuapp.com/", "")
        );
        return (
            RETIRED_HOSTS.has(url.hostname) ||
            (url.hostname === "res.cloudinary.com" &&
                /^\/(oncyber-io|oncybertesting|ugc-oo-oo)\//.test(url.pathname))
        );
    } catch {
        return false;
    }
}

export function usableMediaUrl(value: unknown): string | undefined {
    if (typeof value !== "string" || isRetiredMediaUrl(value)) return;
    try {
        const url = new URL(value);
        if (url.protocol === "https:" || url.protocol === "ipfs:") return value;
    } catch {}
}

export function openSeaMedia(nft: any) {
    const first = (...urls: unknown[]) =>
        urls.map(usableMediaUrl).find(Boolean);
    const image = first(
        nft?.display_image_url,
        nft?.image_url,
        nft?.original_image_url
    );
    const imageIsVideo = /\.(mp4|webm|mov)(?:[?#]|$)/i.test(image || "");
    return {
        image: imageIsVideo ? undefined : image,
        animation: first(
            nft?.display_animation_url,
            nft?.animation_url,
            nft?.original_animation_url,
            imageIsVideo ? image : undefined
        ),
    };
}

/** The URL the model loader falls back to when no optimized variant exists. */
function modelSourceUrl(data: any) {
    return (
        data.dcompressed_animation_url ||
        data.compressed_animation_url ||
        data.animation_url ||
        data.animation_original_url ||
        data.original_animation_url
    );
}

export function recoveryIdentity(data: any, failed = false) {
    if (!/^(image|video|panorama|model)\//.test(data?.mime_type || "")) return;
    const isModel = data.mime_type.startsWith("model/");
    // Pinned optimized GLBs are served first and never need a lookup.
    if (isModel && data.d_optimized_files) return;
    if (!failed && data.mediaCache?.version === 1 &&
        (data.mediaCache.animationUrl || data.mediaCache.imageUrl)) return;
    const chain = data.blockchain === "matic" ? "polygon" : data.blockchain;
    const contract = data.contract_address || data.token_address;
    const token = String(data.token_id ?? "");
    if (
        !["ethereum", "polygon", "base", "arbitrum", "optimism"].includes(
            chain
        ) ||
        !/^0x[a-fA-F0-9]{40}$/.test(contract || "") ||
        !/^\d{1,78}$/.test(token)
    )
        return;
    const fields = isModel
        ? [modelSourceUrl(data)]
        : data.mime_type.startsWith("video")
        ? [data.animation_url, data.animation_original_url]
        : [data.image_url, data.image_original_url];
    if (!failed && !fields.some(isRetiredMediaUrl)) return;
    return { chain, contract: contract.toLowerCase(), token };
}

/** Repair media fields only; explicit failed loads may refresh primary URLs. */
export function applyRecoveredMedia(
    data: any,
    media: ReturnType<typeof openSeaMedia>,
    failed = false
) {
    for (const [url, fields] of [
        [
            usableMediaUrl(media?.image),
            [
                "image_url",
                "image_original_url",
                "image_preview_url",
                "image_original_preview_url",
            ],
        ],
        [
            usableMediaUrl(media?.animation),
            [
                "animation_url",
                "animation_original_url",
                "original_animation_url",
            ],
        ],
    ] as [string | undefined, string[]][]) {
        if (!url) continue;
        for (const field of fields) {
            if (!data[field] || isRetiredMediaUrl(data[field]))
                data[field] = url;
        }
    }
    // Loaders prefer cached copies; a dead one would shadow the repair.
    for (const field of ["dcompressed_animation_url", "compressed_animation_url"])
        if (isRetiredMediaUrl(data[field]) && usableMediaUrl(media?.animation))
            data[field] = media.animation;
    // A failed load can refresh its primary URLs without overwriting originals.
    if (failed) {
        // A stale manifest must not override the recovered URL on this retry.
        if (usableMediaUrl(media?.image) || usableMediaUrl(media?.animation))
            { delete data.media_variants; delete data.mediaCache; }
        if (usableMediaUrl(media?.image)) {
            data.image_url = media.image;
            data.image_preview_url = media.image;
            data.dcompressed_image_url = media.image;
            delete data.compressed_image_url;
        }
        if (usableMediaUrl(media?.animation)) {
            data.animation_url = media.animation;
            data.dcompressed_animation_url = media.animation;
            delete data.compressed_animation_url;
        }
    }
    // Some OpenSea records put their movie in image_url. Do not feed it to
    // createImageBitmap just because the stale record says image/png.
    if (
        !media?.image &&
        media?.animation &&
        (failed || isRetiredMediaUrl(data.image_url)) &&
        data.mime_type?.startsWith("image/") &&
        /\.(mp4|webm)(?:[?#]|$)/i.test(media.animation)
    ) {
        data.mime_type = /\.webm(?:[?#]|$)/i.test(media.animation)
            ? "video/webm"
            : "video/mp4";
    }
    return data;
}

// i2c.seadn.io serves a 500×500 centre crop unless a size is requested; with
// `w` it keeps the true aspect ratio (raw2.seadn.io always serves originals).
function isCroppedSeadnThumbnail(value: unknown): boolean {
    if (typeof value !== "string") return false;
    try {
        const url = new URL(value);
        return (
            /^(i|i2c)\.seadn\.io$/.test(url.hostname) &&
            !url.searchParams.has("w") &&
            !url.searchParams.has("h")
        );
    } catch {
        return false;
    }
}

function seadnWidth(value: string, width: number) {
    const url = new URL(value);
    url.searchParams.set("w", String(width));
    return url.toString();
}

/**
 * Cached copies made from a cropped seadn thumbnail lose the top and bottom of
 * portrait art. Replace them with the aspect-preserving seadn rendition.
 */
export function dropCroppedMediaCache(data: any) {
    const cache = data?.mediaCache;
    if (
        !cache ||
        !isCroppedSeadnThumbnail(cache.sourceUrl) ||
        !/^(image|panorama)\//.test(data.mime_type || "")
    )
        return data;
    const derived = [cache.imageUrl, cache.previewUrl].filter(Boolean);
    // i.seadn.io is gone; fall back to the remaining image fields instead.
    const live = !isRetiredMediaUrl(cache.sourceUrl);
    for (const [field, width] of [
        ["dcompressed_image_url", 1024],
        ["compressed_image_url", 1024],
        ["image_preview_url", 384],
    ] as [string, number][]) {
        if (!derived.includes(data[field])) continue;
        if (live) data[field] = seadnWidth(cache.sourceUrl, width);
        else delete data[field];
    }
    delete data.mediaCache;
    delete data.media_variants;
    return data;
}
