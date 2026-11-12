import { EDIT_MODE } from "@components/_3DExhibit-v2/three/constants";
import {
    getMediaType,
    IMAGE_MEDIA,
    PANORAMA_MEDIA,
} from "@components/_3DExhibit-v2/three/utils/mediatype";
import { isWebmSupported } from "@3utils/platform";
import {
    artworkDepth,
    DEFAULTS,
} from "@components/_3DExhibit-v2/three/utils/spaceutils";
import { getMime } from "@utils/formatAssets";
import { removeDuplicates } from "@utils/js";
import { GET_SINGLE_DISPLAY_EXPERIENCE } from "@utils/partnerships/singledisplay";
import { SOTHEBYS_ROOM_SLUG } from "@utils/partnerships/sothebys";
import { formatAsset } from "@utils/partnerships/sothebys/formatAsset";
import { upgradeObjktAsset } from "@utils/tezosAssets";
import {
    pinata,
    resize,
    cloudinary,
    isUrlResizable,
    isSeadnUrl,
    fixCloudinaryBehindProxy,
} from "@utils/urlUtils";
import AssetService from "@api/anyUpload/_api";
import { recoverArtworkMedia } from "@utils/media/recoverArtwork";
import { dropCroppedMediaCache, isRetiredMediaUrl } from "@utils/media/recovery";
import { cachedMediaLOD } from "@utils/media/cached";

/**
 *
 * @param { any } roomParameters
 * @param { import("@uitypes/experience").ArtworkData } item
 * @returns
 */
export default async function reformatAsset(roomParameters, item) {
    if (roomParameters?.info?.room === SOTHEBYS_ROOM_SLUG) {
        formatAsset(item);
    }

    if (item?.data && !item.data.mime_type) {
        item.data.mime_type = getMime(item.data);
    }

    dropCroppedMediaCache(item.data);

    // Invalidate derived media before URL resizing/legacy normalization changes
    // the in-memory sources. Originals stay unchanged in the stored gallery.
    if (item.data.media_variants?.source_urls && Object.entries(item.data.media_variants.source_urls).some(
        ([field, value]) => (item.data[field] || null) !== value
    )) {
        delete item.data.media_variants;
        delete item.data.mediaCache;
    }

    fixUploadUrls(item.data);

    await recoverArtworkMedia(item.data);
    await recoverUploadedModel(item.data);

    await recoverUploadedModel(item.data);

    if (item.data.blockchain === "tezos") {
        await upgradeObjktAsset(item.data);
    }

    if (item?.overwrite) {
        item.overwrite.url = item.overwrite.url
            .replace("/upload/", "/upload/fl_keep_dar,w_512,h_512,c_limit/")
            .replace("http://", "https://");
        // item.overwrite.url = item.overwrite.url.replace(".mov", ".mp4");
        //     if (item.overwrite.mediaType.startsWith("video")) {
        //         item.data.image_url = item.overwrite.url;
        //         item.data.mime_type = "video/mp4";
        //         // item.data.mime_type = getMime(item.data);
        //     }
        //     if (item.overwrite.mediaType.startsWith("image")) {
        //         item.data.image_url = item.overwrite.url;
        //         item.data.mime_type = "image/png";
        //         // item.data.mime_type = getMime(item.data);
        //     }
    }

    if (
        item.data.contract_address ===
        "0x7948f7ff1158b338a898e80ce8b1c3c964a80cec"
    ) {
        switch (item.data.token_id) {
            case "1":
                item.data.animation_url =
                    "https://cyber.mypinata.cloud/ipfs/QmSBRdTK11JLg2DAVwfN9wp43Jp214EmJHaqYHBdZGRJon?filename=1.mp4";
                break;
            case "4":
                item.data.animation_url =
                    "https://cyber.mypinata.cloud/ipfs/QmdZdDLdVwDX6DxBdttbT5bUYrTYR5tGgoYmFv3PCxRq8H?filename=4.mp4";
                break;

            case "6":
                item.data.animation_url =
                    "https://cyber.mypinata.cloud/ipfs/Qmc24AygdbEuaSae1S2LZGoakNZW16sXDPYiubCnnTUhwX?filename=6.mp4";
                break;

            case "7":
                item.data.animation_url =
                    "https://cyber.mypinata.cloud/ipfs/QmbaHXg1h9J7q4NxUx2TiEou5ChzpeyNgEdkYi7LbUmfGm?filename=7.mp4";
                break;
        }
    }

    resizeUrls(item);

    // Placeholder ids

    try {
        var asset = item?.data;

        if (
            asset?.contract_address ==
                "0x86825dfca7a6224cfbd2da48e85df2fc3aa7c4b1" &&
            asset.token_id == "1"
        ) {
            item.data.animation_url =
                "https://cyber.mypinata.cloud/ipfs/QmczCMtfeUoLMkLJF7qHUDX5UizigLpmFq5kSwkBbCTmHY?filename=shatter3fix_1_d20k9f.glb";
            item.data.dcompressed_animation_url =
                "https://cyber.mypinata.cloud/ipfs/QmczCMtfeUoLMkLJF7qHUDX5UizigLpmFq5kSwkBbCTmHY?filename=shatter3fix_1_d20k9f.glb";

            if (item?.scale?.x > 3) {
                item.scale = {
                    x: item.scale.x / 100,
                    y: item.scale.y / 100,
                    z: item.scale.z / 100,
                };
            }

            // if (Object.keys(item?.animations).length > 0) {
            item.animations = {
                Animation: {
                    name: "Animation",
                },
            };
            // }
        }
    } catch (e) {
        console.error("ERROR REFORMATTING");
    }

    return item;
}

function resizeUrls(item) {
    //
    const is3D = item.data.mime_type?.startsWith("model/gltf");

    // console.log("mime", item.data.mime_type)

    if (is3D) {
        return item;
    }

    const isUpload = isUploadedAsset(item.data);

    const imgUrlFields = [
        "image_url",
        "dcompressed_image_url",
        "image_original_url",
    ];

    for (let imgUrlField of imgUrlFields) {
        let imgUrl = item.data[imgUrlField];


        const shouldSkip = item.data?.cover_mime_type === "video/mp4" && pinata.isPinataUrl(imgUrl)

        if (isUrlResizable(imgUrl) && !shouldSkip) {
            //
            const size = !EDIT_MODE && item.data.hdImage ? 1024 : 512;

            item.data[imgUrlField] = resize(
                imgUrl,
                item.data.mime_type === "panorama/jpg" ? 4096 : size
            );
            //
        }
    }

    if (item.data.mime_type?.startsWith("video")) {
        //
        let animUrlFields = [
            "animation_url",
            "dcompressed_animation_url",
            "animation_original_url",
        ];

        for (let key of animUrlFields) {
            let animUrl = item.data[key];

            if (cloudinary.isCloudinaryUrl(animUrl)) {
                //
                let url = cloudinary.res(animUrl, 512);

                if (isWebmSupported()) {
                    url = cloudinary.toExt(url, "webm");
                }

                item.data[key] = url;
            }
        }
    }
}

/**
 *
 * @param {import("@uitypes/Asset").Asset} asset
 * @returns
 */
export function isUploadedAsset(asset) {
    return (
        // @ts-ignore
        asset.blockchain === "no-chain" && asset.source?.api === "oncyber"
    );
}

/**
 *
 * @param {import("@uitypes/Asset").Asset} asset
 * @returns
 */
export function isNft(asset) {
    //
    if (
        asset.mime_type === "cyber/text" ||
        asset.mime_type === "cyber/globalstream" ||
        asset.mime_type?.startsWith("embed")
    )
        return false;

    if (asset.source?.blockchain === "none") return false;

    return true;
}

/**
 *
 * @param {import("@uitypes/Asset").Asset} data
 */
const MODEL_URL_FIELDS = [
    "dcompressed_animation_url",
    "compressed_animation_url",
    "animation_url",
    "animation_original_url",
    "original_animation_url",
];

/**
 * Uploaded models saved before the Cloudinary account was retired may only
 * reference dead URLs. Their upload-hash record still has the pinned copies.
 */
async function recoverUploadedModel(data) {
    if (
        !data.mime_type?.startsWith("model/") ||
        data.blockchain !== "no-chain" ||
        !data.token_id
    )
        return;
    const urls = [
        ...Object.values(data.d_optimized_files || {}),
        ...MODEL_URL_FIELDS.map((field) => data[field]),
    ].filter(Boolean);
    if (urls.some((url) => !isRetiredMediaUrl(url))) return;
    try {
        const record = await AssetService.getAssetsByHash({
            hash: data.token_id,
        });
        if (!record?.mimeType?.startsWith("model/")) return;
        const optimized = Object.entries(record.d_optimized_files || {}).filter(
            ([, url]) => typeof url === "string" && !isRetiredMediaUrl(url)
        );
        if (optimized.length)
            data.d_optimized_files = Object.fromEntries(optimized);
        else delete data.d_optimized_files;
        if (record.d_url && !isRetiredMediaUrl(record.d_url)) {
            for (const field of MODEL_URL_FIELDS) {
                if (isRetiredMediaUrl(data[field])) data[field] = record.d_url;
            }
        }
    } catch (error) {
        console.error("Error fetching uploaded model by hash", error);
    }
}

export function fixUploadUrls(data) {
    //
    if (data.source?.blockchain === "none" && data.source?.api === "oncyber") {
        //
        let newImgUrl = cloudinary.res(
            fixCloudinaryBehindProxy(data.image_url),
            512
        );

        if (newImgUrl != data.image_url) {
            //
            data.image_url = data.dcompressed_image_url = newImgUrl.replace(
                "http://",
                "https://"
            );
        }

        let newAnimUrl = cloudinary.res(
            fixCloudinaryBehindProxy(data.animation_url),
            512
        );

        if (newAnimUrl != data.animation_url) {
            //
            data.animation_url = data.dcompressed_animation_url =
                newAnimUrl.replace("http://", "https://").replace('https://polar-mountain-96590.herokuapp.com/', '');
        }
    }
}

/**
 * @typedef {import("@components/_3DExhibit-v2/three/factory/artwork/LODmesh/materials").LODParams} MediaLOD
 *
 *
 * @param {import("@uitypes/Asset").Asset} artworkData
 * @return { { hi: MediaLOD, lo: MediaLOD } }
 */
export async function getMediaLODUrls(artworkData) {
    //

    let res = {
        hi: { type: null, urls: [] },
        lo: null,
    };

    const mediaType = getMediaType(artworkData.mime_type);
    const cached = cachedMediaLOD(artworkData, mediaType);
    if (cached) return cached;
    res.hi.type = mediaType;

    if (mediaType === IMAGE_MEDIA || mediaType === PANORAMA_MEDIA) {
        //
        const urls = [
            artworkData.dcompressed_image_url,
            artworkData.compressed_image_url,
            artworkData.image_url,
            artworkData.image_original_url
        ]

       let filtered = urls
            .filter(it => it && !isRetiredMediaUrl(it))
            .map(url => 
                 url.replace('https://polar-mountain-96590.herokuapp.com/', '')
                .replace('https://opensea.mypinata.cloud', 'https://cyber.mypinata.cloud')
            );

        if(!filtered.length && artworkData?.blockchain === "no-chain" && artworkData?.token_id) {
            try {
                const service = await AssetService.getAssetsByHash({ hash: artworkData.token_id });
                if(
                    service?.d_url && 
                    service?.mimeType && 
                    (service.mimeType.startsWith("image") || service.mimeType.startsWith("panorama"))
                ) {
                    filtered = [service.d_url];
                }
            } catch (error) {
                console.error("Error fetching asset by hash", error);
            }

        }

        // Nearby images still use a bounded derivative. Keep the original as
        // a fallback for formats the gateway cannot resize (for example AVIF).
        const size = mediaType === PANORAMA_MEDIA ? 4096 :
            (!EDIT_MODE && artworkData.hdImage ? 1024 : 512);
        res.hi.urls = [
            ...filtered.map(url => resize(url, size, undefined, "webp")),
            ...filtered.map(originalImageUrl),
        ];

        if (mediaType === IMAGE_MEDIA) {
            // Hosts that cannot resize, and the original fallbacks, decode
            // to the size the resizing hosts return: a 4000 px original no
            // longer becomes an 85 MB texture. seadn bounds width only.
            res.hi.decodeLimit = {
                width: size,
                height: filtered.some(isSeadnUrl) ? null : size,
            };
        }

        const loUrl = filtered.find(isUrlResizable);

        if (loUrl) {
            res.lo = {
                type: mediaType,
                urls: [resize(loUrl, 256, undefined, "webp")],
            };
        }
    } else if (mediaType === "VIDEO_MEDIA") {
        // const dcompressedCloudinaryURL = cloudinary.res(artworkData.dcompressed_animation_url, 512)

        const urls = [
            artworkData.dcompressed_animation_url,
            artworkData.compressed_animation_url,
            artworkData.animation_url,
            artworkData.original_animation_url,
            artworkData.animation_original_url
        ]

         let filtered = urls
            .filter(it => it && !isRetiredMediaUrl(it))
            .map(url => 
                url.replace('https://polar-mountain-96590.herokuapp.com/', '')
                .replace('https://opensea.mypinata.cloud', 'https://cyber.mypinata.cloud')
            );

        // @ts-ignore
        if(!filtered.length && artworkData?.blockchain === "no-chain" && artworkData?.token_id) {
            //
            try {
                const service = await AssetService.getAssetsByHash({ hash: artworkData.token_id });

                if(service?.d_url && service?.mimeType === "video/mp4") {
                    filtered = [service.d_url]
                }
                
            } catch (error) {
              console.error("Error fetching asset by hash", error);   
            }
        }

        res.hi.urls = [...res.hi.urls, ...filtered];

        const poster = [
            artworkData.image_preview_url,
            artworkData.image_url,
            artworkData.image_original_url,
        ].find(url => isVideoPoster(url, artworkData, filtered));
        const normalizedPoster = poster?.replace('https://polar-mountain-96590.herokuapp.com/', '')
            .replace('https://opensea.mypinata.cloud', 'https://cyber.mypinata.cloud');
        const loUrl = artworkData.dcompressed_animation_url;
        if (poster || (cloudinary.isCloudinaryUrl(loUrl) && !isRetiredMediaUrl(loUrl))) {
            res.lo = {
                type: IMAGE_MEDIA,
                urls: [normalizedPoster ? resize(normalizedPoster, 256) : cloudinary.lod(loUrl)],
            };
            // Keep a recovered poster visible even when the movie is gone.
            if (!res.hi.urls.length) res.hi = res.lo;
        }
    }

    res.hi.urls = removeDuplicates(res.hi.urls.filter((it) => it));

    return res;
}

// Remove only image transformations, preserving the CID, filename and any
// unrelated gateway parameters. Resizing failure must still reach the original.
function originalImageUrl(url) {
    if (!pinata.isPinataUrl(url)) return url;
    const source = new URL(url);
    for (const key of ["img-width", "img-height", "img-fit"]) {
        source.searchParams.delete(key);
    }
    return source.toString();
}

function isVideoPoster(url, data, videoUrls) {
    if (typeof url !== "string" || !url || isRetiredMediaUrl(url)) return false;
    if (/\.(mp4|webm|mov|m4v)(?:[?#&]|$)/i.test(url)) return false;
    if (videoUrls.some(video => originalImageUrl(video) === originalImageUrl(url))) return false;
    // Some NFT providers put a movie in image_url, with an extensionless CID.
    if (data.cover_mime_type?.startsWith("video/") &&
        [data.image_url, data.image_original_url].includes(url)) return false;
    return true;
}

const metrics = {
    inch: 2.54,
};

/**
 * @typedef {object} GetMediaDimensionsOpts
 * @property {number} width
 * @property {number} height
 * @property {import("@uitypes/Asset").Asset} artworkData
 * @property {import("@uitypes/roomParameters").RoomParameters} roomParameters
 *
 *
 *
 * @param {GetMediaDimensionsOpts} opts
 * @returns { { width: number, height: number, depth: number } }
 */
export function getMediaDimensions({
    width: mediaWidth,
    height: mediaHeight,
    artworkData,
    roomParameters,
}) {
    // let dimensions =    artworkData.videoDimensions ||
    //                     artworkData.dimensions ||
    //                     opts.preview?.userData.dimensions ||

    let depth = artworkDepth(roomParameters);

    let width = 0;

    let height = 0;

    let aspect = mediaHeight / mediaWidth;

    const singledisplay = GET_SINGLE_DISPLAY_EXPERIENCE({
        slug: roomParameters.slug,
    });

    //
    if (singledisplay) {
        //
        height = singledisplay.max_height;

        width = height / aspect;
        //
    } else {
        //
        let maxWidth = artworkData.size || DEFAULTS.MAX_SIZE;

        const scaleDown = roomParameters.artworkScale || DEFAULTS.ARTWORK_SCALE;

        let metric = metrics[artworkData.metric] || 1;

        width = (maxWidth * metric) / scaleDown;

        height = width * aspect;
    }

    return {
        width,
        height,
        depth,
    };
}
