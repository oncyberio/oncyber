/** Immutable derivatives generated once by the gallery media backfill. */
export function cachedMediaLOD(data: any, type: string) {
    const media = data?.media_variants;
    const identity = `${data?.blockchain}:${String(
        data?.contract_address || data?.token_address || ""
    ).toLowerCase()}:${data?.token_id}`;
    if (media?.version !== 1 || media.identity !== identity) return null;
    const images = (Array.isArray(media.images) ? media.images : [])
        .filter(
            (image) =>
                /^https:\/\//.test(image?.url || "") &&
                image.width > 0 &&
                image.height > 0
        )
        .sort(
            (a, b) => Math.max(a.width, a.height) - Math.max(b.width, b.height)
        );
    if (!images.length) return null;
    const lo = images[0].url;
    if (type === "VIDEO_MEDIA") {
        if (!/^https:\/\//.test(media.animation?.url || "")) return null;
        return {
            hi: {
                type,
                urls: [
                    media.animation.url,
                    data.animation_url,
                    data.animation_original_url,
                ].filter(Boolean),
            },
            lo: { type: "IMAGE_MEDIA", urls: [lo] },
        };
    }
    if (type !== "IMAGE_MEDIA" && type !== "PANORAMA_MEDIA") return null;
    return {
        hi: {
            type,
            urls: [
                images[images.length - 1].url,
                data.image_url,
                data.image_original_url,
            ].filter(Boolean),
        },
        lo: { type, urls: [lo] },
    };
}
