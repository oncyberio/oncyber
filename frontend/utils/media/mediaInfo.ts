import { MediaInfo } from "@uitypes/mediaInfo";
import { FetchedAsset } from "@uitypes/Asset";
import { getMime } from "../formatAssets";
import { isUploadable, supportedMimes, withCover } from "../mimeUtils";
import { IPFS, ipfsCID, relay } from "../urlUtils";

// On the server, asset URLs come from users: probe them through publicFetch.
async function head(url: string): Promise<Response> {
    if (typeof window !== "undefined") return fetch(url, { method: "HEAD" });
    const { publicFetch } = await import("../net/publicFetch");
    const r = await publicFetch(url, { method: "HEAD", maxBytes: 0, timeoutMs: 10000 });
    const headers = new Headers();
    for (const [k, v] of Object.entries(r.headers)) if (typeof v === "string") headers.set(k, v);
    return new Response(null, { status: r.status, headers });
}

const MAX_CHECK_RETRY_COUNT = 1;

async function tryHead(url: string): Promise<Response> {
    //
    for (let i = 0; i < MAX_CHECK_RETRY_COUNT; i++) {
        try {
            const response = await head(url);
            if (response.ok) return response;
            else {
                console.info(
                    "tryHead",
                    url,
                    "returned with code ",
                    response.status,
                    response.statusText
                );
            }
        } catch (err) {
            console.error(err);
        }
    }
}

interface HeadInfo {
    url: string;
    media_type: string;
    size: number;
}

async function headAlts(urls: string[]): Promise<HeadInfo> {
    //
    for (let i = 0; i < urls.length; i++) {
        try {
            let url = urls[i];

            let response = await tryHead(url);

            if (response != null) {
                let media_type = response.headers
                    .get("Content-Type")
                    ?.split(";")[0];

                if (media_type == "png") media_type = "image/png";

                let size = +response.headers.get("Content-Length");

                if (
                    supportedMimes.includes(media_type) &&
                    url.endsWith(".bin")
                ) {
                    media_type = "image/bmp";
                }

                return {
                    media_type,
                    size,
                    url,
                };
            }
        } catch (err) {
            console.error(err);
        }
    }
}

async function checkMedia(urls: AssetUrl[]): Promise<{
    media_type: string;
    url: string;
    urlField: string;
    size: number;
} | null> {
    //
    for (let i = 0; i < urls.length; i++) {
        //
        let url = urls[i];

        let result = await headAlts(url.urls);

        if (result?.media_type != null) {
            //
            return {
                media_type: result.media_type,
                urlField: url.urlField,
                url: result.url,
                size: isFinite(result.size) ? result.size : 0,
            };
        }
    }
}

async function getMediaInfo(
    asset: FetchedAsset,
    urls: AssetUrl[],
    isCover = false
): Promise<MediaInfo> {
    //

    if (!asset.mime_type && !isCover) {
        asset.mime_type = getMime(asset);
    }

    const result = await checkMedia(urls);

    if (result == null) {
        return { type: "NoTypeInfo" };
    }

    // always prefer the inferred mime_type if it exists. For glb files the HEAD
    // requets will result in an unsupported one: binary/octet-stream
    let mime_type: string = isCover
        ? result.media_type
        : asset.mime_type || result.media_type;

    let { url, urlField, size } = result;

    if (!supportedMimes.includes(mime_type)) {
        return {
            type: "Unsupported",
            mime_type,
        };
    } else if (isUploadable(mime_type)) {
        return {
            type: "Uploadable",
            url,
            urlField,
            mime_type,
            size,
        };
    } else {
        return {
            type: "NotUploable",
            url,
            urlField,
            mime_type,
            size,
        };
    }
}

function preprocessUrl(asset: FetchedAsset, url: string, field: string) {
    let alts = [];

    const cid = ipfsCID(url);

    const isObjkt = isObjktAsset(asset);

    if (cid != null) {
        //
        alts.push(...IPFS.gateway(cid, "cyber", "autograph", "ipfs"));
    } else {
        //
        alts.push(url);
    }

    // IPFS gateways we use and Objkt CDN are CORS freindly. So no need to proxy
    const shouldRelay = cid == null && !isObjkt;

    if (shouldRelay) {
        alts.push(relay(url));
    }

    if (asset.original_mime_type === "application/x-directory") {
        alts = alts.flatMap((url) => {
            let result = [url, `${url}/index.html`];
            // Objkt CDN most likely fail on directories without explicit file url
            // So we start checking the full file path
            if (isObjkt) {
                result = result.reverse();
            }
            return result;
        });
    }

    return alts;
}

function isObjktAsset(asset: FetchedAsset) {
    return asset.blockchain === "tezos" && asset.marketplace === "objkt";
}

interface AssetUrl {
    urlField: string;
    urls: string[];
}

export function getUrls(
    asset: FetchedAsset,
    isCover: boolean,
    processUrl: boolean
): AssetUrl[] {
    //
    let urlFields: string[] = [];

    if ((isCover || !asset.animation_url) && asset.image_url) {
        // For
        urlFields = ["image_original_url", "image_url"];

        // For objkt assets, we prioritize objkt CDN urls
        if (isObjktAsset(asset)) {
            urlFields = urlFields.reverse();
        }
    } else {
        urlFields = [
            "animation_url",
            "animation_original_url",
            "original_animation_url",
        ];
    }

    let urls = urlFields
        .map((urlField) => {
            //
            const url = asset[urlField] as string;

            if (!url) return null;

            return {
                urlField,
                urls: preprocessUrl(asset, url, urlField),
            };
        })
        .filter((it) => it != null);

    return urls;
}

export async function getAssetMediaInfo(
    asset: FetchedAsset,
    processUrl = true
): Promise<{ mediaInfo: MediaInfo; coverMediaInfo?: MediaInfo }> {
    //
    let mediaInfo: MediaInfo;
    let coverMediaInfo: MediaInfo;

    let urls = getUrls(asset, false, processUrl);

    if (urls.length == 0) {
        console.error(
            "No media info was found in the metadata for the asset",
            asset.name
        );

        mediaInfo = { type: "NoTypeInfo" };
    } else {
        mediaInfo = await getMediaInfo(asset, urls);

        if (mediaInfo.type === "NoTypeInfo") {
            console.error("Error checking media info for", asset.name);
        }
    }

    const checkCover =
        (mediaInfo.type === "NotUploable" || mediaInfo.type === "Uploadable") &&
        withCover(mediaInfo.mime_type);

    if (checkCover) {
        //
        let coverUrls = getUrls(asset, true, processUrl);

        coverMediaInfo = await getMediaInfo(asset, coverUrls, true);

        if (coverMediaInfo.type === "NoTypeInfo") {
            console.error("couldn't get mime type of audio' cover image");
            coverMediaInfo = null;
        }
    }

    return { mediaInfo, coverMediaInfo };
}

// export function isAssetOptimized(asset: Asset) {
//     //
//     if (asset.mime_type == null) {
//         throw new Error(
//             `Asset has no mime-type ${asset.name}, id: ${asset.id}`
//         );
//     }

//     if (asset.mime_type.startsWith("image")) {
//         return asset.dcompressed_image_url != null;
//     } else if (asset.mime_type.startsWith("video")) {
//         return asset.dcompressed_animation_url != null;
//     } else if (asset.mime_type.startsWith("audio")) {
//         return (
//             asset.dcompressed_animation_url != null &&
//             asset.mime_type === "audio/mpeg"
//         );
//     } else if (asset.mime_type === "model/gltf-binary") {
//         return asset.dcompressed_animation_url != null;
//     }

//     return false;
// }
