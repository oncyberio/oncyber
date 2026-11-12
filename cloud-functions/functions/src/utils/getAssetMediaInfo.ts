import { Asset, MediaInfo } from "./types";

async function tryHead(url: string) {
    try {
        const response = await fetch(url, { method: "HEAD" });
        if (response.ok) return response;
    } catch (err) {
        console.error(err);
    }
}

interface HeadInfo {
    url: string;
    response: Response;
}

async function checkUrls(urls: string[]): Promise<HeadInfo> {
    //
    for (let i = 0; i < urls.length; i++) {
        try {
            let url = urls[i];
            let response = await tryHead(url);
            if (response != null) {
                return {
                    response,
                    url,
                };
            }
        } catch (err) {
            console.error(err);
        }
    }
}

async function checkMedia(urls: AssetUrl[]): Promise<{
    // media_type: string;
    url: string;
    urlField: string;
    size: number;
} | null> {
    //
    for (let i = 0; i < urls.length; i++) {
        //
        let url = urls[i];

        let result = await checkUrls(url.urls);

        if (result != null) {
            //

            let size = +result.response.headers.get("Content-Length");

            return {
                urlField: url.urlField,
                url: result.url,
                size: isFinite(size) ? size : 0,
            };
        }
    }
}

async function getMediaInfo(
    mime_type: string,
    urls: AssetUrl[]
): Promise<MediaInfo | null> {
    //
    let res = await checkMedia(urls);

    if (res != null) {
        return {
            mime_type,
            ...res,
        };
    } else {
        return null;
    }
}

function isObjktAsset(asset: Asset) {
    return asset.blockchain === "tezos" && asset.marketplace === "objkt";
}

function preprocessUrl(asset: Asset, url: string) {
    //
    return [url];

    // let alts = [];

    // const cid = ipfsCID(url);

    // if (cid != null) {
    //     //
    //     alts.push(...IPFS.gateway(cid, "cyber", "autograph", "ipfs"));
    // } else {
    //     //
    //     alts.push(url);
    // }

    // return alts;
}

interface AssetUrl {
    urlField: string;
    urls: string[];
}

export function getUrls(asset: Asset, isCover = false): AssetUrl[] {
    //
    let urlFields: string[] = [];

    if (asset.mime_type.startsWith("image") || isCover) {
        //
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

    let urls: AssetUrl[] = urlFields
        .map((urlField) => {
            //
            const url = asset[urlField] as string;

            if (!url) return null;

            return {
                urlField,
                urls: preprocessUrl(asset, url),
            };
        })
        .filter((it) => it != null);

    return urls;
}

export async function getAssetMediaInfo(
    asset: Asset
): Promise<{ mediaInfo: MediaInfo; coverMediaInfo?: MediaInfo }> {
    //
    if (asset.mime_type == null) {
        throw new Error("Asset " + asset.name + " has no mime_type");
    }

    let mediaInfo: MediaInfo;
    let coverMediaInfo: MediaInfo;

    let urls = getUrls(asset);

    if (urls.length == 0) {
        throw new Error(
            "No media info was found in the metadata for the asset" + asset.name
        );
    }

    mediaInfo = await getMediaInfo(asset.mime_type, urls);

    const checkCover = mediaInfo && asset.cover_mime_type;

    if (checkCover) {
        //
        let coverUrls = getUrls(asset, true);

        coverMediaInfo = await getMediaInfo(asset.cover_mime_type, coverUrls);

        if (coverMediaInfo == null) {
            // Don't abort optimization of mediaInfo
            console.error(
                "couldn't get mime type of audio' cover image for asset " +
                    asset.name
            );
        }
    }

    return { mediaInfo, coverMediaInfo };
}
