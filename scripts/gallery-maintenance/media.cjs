const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const {
    hash,
    isPublicGallery,
    artworkInputs,
} = require("../../cloud-functions/artist-index/core");
const { EVM_CHAINS } = require("../../cloud-functions/artist-index/opensea");
const {
    mediaURL,
    retiredURL,
    download,
    readJSON,
    request,
} = require("./network.cjs");
const { optimize } = require("./optimize.cjs");
const admin = require("firebase-admin");
const { auditPinataImage } = require("./cdn.cjs");
const { assertDocumentFits } = require("../../cloud-functions/artist-index/document-size");

const SOURCE_FIELDS = [
    "image_url",
    "image_original_url",
    "animation_url",
    "animation_original_url",
    "original_animation_url",
    "metadata_url",
];
function mediaFingerprint(data) {
    return hash({
        identity: artworkInputs({ artworks: { a: { data } } })[0]?.nft || null,
        mime: data.mediaCache?.originalMime || data.mime_type || "",
        urls: Object.fromEntries(
            SOURCE_FIELDS.map((k) => [k, data[k] || null])
        ),
    });
}
function candidates(data, remote = {}, original = {}) {
    const unique = (values) => [
        ...new Set(values.map(mediaURL).filter(Boolean)),
    ];
    return {
        image: unique([
            original.image,
            original.image_url,
            remote.original_image_url,
            remote.image_url,
            data.image_original_url,
            data.image_url,
            remote.display_image_url,
            data.image_preview_url,
        ]),
        animation: unique([
            original.animation_url,
            remote.original_animation_url,
            remote.animation_url,
            remote.display_animation_url,
            data.animation_original_url,
            data.original_animation_url,
            data.animation_url,
        ]),
    };
}

async function uploadDerivative(bucket, file, key) {
    const name = `gallery-media/v1/${key}/${path.basename(file)}`;
    const contentType = file.endsWith(".webp")
        ? "image/webp"
        : file.endsWith(".mp4")
        ? "video/mp4"
        : "video/webm";
    try {
        await bucket.upload(file, {
            destination: name,
            resumable: false,
            ...(process.env.PUBLIC_READ_BUCKET &&
            bucket.name === process.env.PUBLIC_READ_BUCKET
                ? { predefinedAcl: "publicRead" }
                : {}),
            preconditionOpts: { ifGenerationMatch: 0 },
            metadata: {
                contentType,
                cacheControl: "public,max-age=31536000,immutable",
            },
        });
    } catch (error) {
        if (error.code !== 412) throw error;
    }
    return `https://storage.googleapis.com/${bucket.name}/${name}`;
}

async function repairArtwork({
    db,
    ref,
    artworkId,
    provider,
    bucket,
    runId,
    apply = false,
    gallery: providedGallery,
    auditCDN = auditPinataImage,
}) {
    const gallery = providedGallery || (await ref.get()).data();
    if (!isPublicGallery(gallery)) return { status: "private-or-deleted" };
    const item = gallery.artworks?.[artworkId],
        data = item?.data;
    if (
        !data ||
        item.visible === false ||
        data.visible === false ||
        item.overwrite?.url
    )
        return { status: "hidden-or-custom" };
    if (
        !/^(image|panorama|video|audio|model)\//.test(data.mime_type || "") &&
        data.mime_type !== "text/html"
    )
        return { status: "not-media" };
    const fingerprint = mediaFingerprint(data);
    if (
        data.mediaCache?.version === 1 &&
        data.mediaCache.sourceHash === fingerprint &&
        !data.mediaCache.animationUnavailable
    )
        return { status: "unchanged", cache: data.mediaCache };
    const cdnAudit = await auditCDN(data);
    if (cdnAudit) return cdnAudit;
    if (apply) assertDocumentFits(gallery, ref.path);
    const input = artworkInputs({ artworks: { [artworkId]: item } })[0];
    let remote = {},
        original = {},
        metadataError;
    if (
        input?.nft &&
        EVM_CHAINS.has(input.nft.chain) &&
        /^0x[a-f\d]{40}$/.test(input.nft.contract)
    ) {
        const n = input.nft;
        remote =
            (
                await provider.get(
                    `chain/${n.chain}/contract/${n.contract}/nfts/${n.tokenId}`
                )
            )?.media || {};
    }
    const metadata = mediaURL(remote.metadata_url || data.metadata_url);
    if (metadata)
        try {
            original = await readJSON(metadata);
        } catch (error) {
            metadataError = error.message;
        }
    const urls = candidates(data, remote, original),
        attempts = [];
    const staticOrVideo = /^(image|panorama|video)\//.test(
        data.mime_type || ""
    );
    // Interactive works/models/audio retain their original playback behavior.
    // Audit their original source; do not rewrite code or external dependencies.
    if (!staticOrVideo) {
        for (const url of [...urls.animation, ...urls.image].slice(0, 4)) {
            if (retiredURL(url)) {
                attempts.push({ url, status: "retired-host" });
                continue;
            }
            try {
                const signal = AbortSignal.timeout(12000),
                    r = await request(url, { method: "HEAD", signal });
                const status = r.statusCode;
                r.destroy();
                attempts.push({ url, status });
                if (status >= 200 && status < 300)
                    return {
                        status: "audited-original",
                        optimization: "unsupported-media-type",
                        attempts,
                        metadataError,
                    };
            } catch (error) {
                attempts.push({ url, error: error.message });
            }
        }
        return {
            status: "unresolved",
            reason: "original-unavailable-or-unsupported",
            attempts,
            metadataError,
        };
    }
    const cacheRef = db.collection("artworkMediaCache").doc(fingerprint);
    const cached = await cacheRef.get();
    let cache = cached.data()?.cache;
    if (!cache || cache.version !== 1 || cache.animationUnavailable) {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "oncyber-media-"));
        let product, source;
        try {
            const animated =
                data.mime_type.startsWith("video/") ||
                data.mime_type === "image/gif" ||
                urls.animation.some((u) =>
                    /\.(mp4|webm|mov|gif)(?:[?#]|$)/i.test(u)
                );
            const ordered = animated
                ? [...urls.animation, ...urls.image]
                : [...urls.image];
            for (const url of ordered.slice(0, 8)) {
                if (retiredURL(url)) {
                    attempts.push({ url, status: "retired-host" });
                    continue;
                }
                try {
                    const file = path.join(dir, "source");
                    const fetched = await download(url, file);
                    product = await optimize(file, dir, {
                        panorama: data.mime_type.startsWith("panorama/"),
                    });
                    source = {
                        ...fetched,
                        hash: crypto
                            .createHash("sha256")
                            .update(await fs.readFile(file))
                            .digest("hex"),
                    };
                    attempts.push({
                        url,
                        status: "decoded",
                        bytes: fetched.bytes,
                    });
                    break;
                } catch (error) {
                    attempts.push({ url, error: error.message.slice(0, 300) });
                }
            }
            if (!product)
                return {
                    status: "unresolved",
                    reason: "no-decodable-media",
                    attempts,
                    metadataError,
                };
            if (!apply)
                return {
                    status: "preview",
                    mimeType: product.mimeType,
                    source,
                    attempts,
                    metadataError,
                };
            const key = hash({
                version: 1,
                source: source.hash,
                panorama: data.mime_type.startsWith("panorama/"),
            });
            const previewUrl = await uploadDerivative(
                bucket,
                product.preview,
                key
            );
            cache = {
                version: 1,
                sourceHash: fingerprint,
                originalMime: data.mediaCache?.originalMime || data.mime_type,
                previewUrl,
                mimeType: product.mimeType,
                sourceUrl: source.url,
                sourceContentHash: source.hash,
                indexedAt: Date.now(),
                width: product.width,
                height: product.height,
                ...(product.image
                    ? {
                          imageUrl: await uploadDerivative(
                              bucket,
                              product.image,
                              key
                          ),
                      }
                    : {}),
                ...(product.animation
                    ? {
                          animationUrl: await uploadDerivative(
                              bucket,
                              product.animation,
                              key
                          ),
                          duration: product.duration,
                      }
                    : {}),
                ...(animated && !product.animation
                    ? { animationUnavailable: true }
                    : {}),
            };
            await cacheRef.set({ cache, createdAt: Date.now() });
        } finally {
            await fs.rm(dir, { recursive: true, force: true });
        }
    }
    if (!apply) return { status: "preview", cache };
    const patch = {
        mediaCache: cache,
        image_preview_url: cache.previewUrl,
        dcompressed_image_url: cache.imageUrl || cache.previewUrl,
    };
    const scaled = (max) => {
        const ratio = Math.min(1, max / Math.max(cache.width, cache.height));
        return {
            width: Math.max(1, Math.round(cache.width * ratio)),
            height: Math.max(1, Math.round(cache.height * ratio)),
        };
    };
    patch.media_variants = {
        version: 1,
        identity: `${data.blockchain}:${String(
            data.contract_address || data.token_address || ""
        ).toLowerCase()}:${data.token_id}`,
        images: [
            {
                url: cache.previewUrl,
                ...scaled(data.mime_type.startsWith("panorama/") ? 1024 : 384),
            },
            ...(cache.imageUrl
                ? [
                      {
                          url: cache.imageUrl,
                          ...scaled(
                              data.mime_type.startsWith("panorama/")
                                  ? 4096
                                  : 2048
                          ),
                      },
                  ]
                : []),
        ],
        ...(cache.animationUrl
            ? {
                  animation: {
                      url: cache.animationUrl,
                      mime_type: cache.mimeType,
                  },
              }
            : {}),
        source_urls: Object.fromEntries(
            SOURCE_FIELDS.map((key) => [key, data[key] || null])
        ),
    };
    if (cache.animationUrl) {
        patch.dcompressed_animation_url = cache.animationUrl;
        patch.mime_type = cache.mimeType;
    }
    const result = await db.runTransaction(async (tx) => {
        const latest = await tx.get(ref),
            current = latest.data();
        const currentData = current?.artworks?.[artworkId]?.data;
        if (
            !isPublicGallery(current) ||
            !currentData ||
            current.artworks[artworkId].visible === false ||
            currentData.visible === false ||
            current.artworks[artworkId].overwrite?.url ||
            mediaFingerprint(currentData) !== fingerprint
        )
            return "changed-during-repair";
        assertDocumentFits({
            ...current,
            artworks: { ...current.artworks, [artworkId]: {
                ...current.artworks[artworkId], data: { ...currentData, ...patch },
            } },
        }, ref.path);
        const previous = Object.fromEntries(
            Object.keys(patch).map((key) => [
                key,
                Object.hasOwn(currentData, key) ? currentData[key] : null,
            ])
        );
        const audit = db
            .collection("galleryMaintenanceRuns")
            .doc(runId)
            .collection("changes")
            .doc(hash({ gallery: ref.id, artworkId }));
        const existingAudit = (await tx.get(audit)).data();
        tx.set(audit, {
            galleryId: ref.id,
            artworkId,
            sourceHash: fingerprint,
            previous: existingAudit?.previous || previous,
            applied: patch,
            at: Date.now(),
        });
        tx.update(
            ref,
            ...Object.entries(patch).flatMap(([key, value]) => [
                new admin.firestore.FieldPath(
                    "artworks",
                    artworkId,
                    "data",
                    key
                ),
                value,
            ])
        );
        return "repaired";
    });
    return {
        status:
            result === "repaired" && cache.animationUnavailable
                ? "partial-preview"
                : result,
        cache,
        attempts,
        metadataError,
    };
}

module.exports = {
    repairArtwork,
    mediaFingerprint,
    candidates,
    uploadDerivative,
};
