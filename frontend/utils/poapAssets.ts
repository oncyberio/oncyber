import { nodeEnv } from "../env";
import { opensea } from "./urlUtils";
import AssetService from "@api/asset/_api";

const MAX_RETRY_COUNT = 1;

function safeUrl(url: string) {
    if (url?.startsWith("ipfs")) {
        return `https://ipfs.io/ipfs/${url.split("//")[1]}`;
    } else if (url?.startsWith("https://ipfs.infura.io")) {
        return url.replace("https://ipfs.infura.io", "https://ipfs.io");
    } else {
        return opensea.toNewUrl(url);
    }
}

function getMediaUrls(image_url_raw) {
    let image_url,
        image_original_url,
        image_preview_url,
        image_original_preview_url,
        animation_url,
        animation_original_url,
        mime_type;

    let safe = safeUrl(image_url_raw);

    image_preview_url = safe;
    image_original_url = safe;
    image_url = safe;
    image_original_preview_url = safe;

    mime_type = image_url_raw?.endsWith(".gif") ? "image/gif" : "image/png";

    if (mime_type == "image/gif") {
        animation_original_url= null;
        animation_url = null;
        image_original_preview_url = null;
    }

    return {
        image_preview_url,
        image_original_url,
        image_original_preview_url,
        image_url: image_url ?? image_original_url,
        animation_original_url,
        animation_url: animation_url ?? animation_original_url,
        mime_type,
    };
}

export function formatPoapAsset(asset: any, ownerId: string) {
    let mediaUrls = getMediaUrls(asset.event.image_url);

    const payload = {
        ...mediaUrls,
        sell_orders: [],
        top_bid: {},
        name: asset.event.name,
        description: asset.event.description,
        external_link: asset.event.event_url,
        permalink: asset.event.event_url,
        asset_contract: {
            address: "0x0000000000000000000000000000000000000000",
        },
        token_id: asset.event.id+"",
        owner: {
            address: ownerId,
            user: {
                profile_img_url: "/images/avatar.png", // TODO??
            },
        },
        creator: {
            maxSupply: asset.event.supply,
            // address: "0x0000000000000000000000000000000000000000",
            // user: { profile_img_url: "/images/avatar.png" },
        },
        collection: {
            name: null,
            image_url: null,
            external_url: null,
        },
        isOwned: ownerId ? true : false,
        blockchain: "xdai",
        marketplace: "poap",
        account_base_url: "https://app.poap.xyz/scan/",
        supply: asset.event.supply,
        envmap: "",
    };
    return payload;
}

export async function fetchOwnedPoapAssets(
    ownerId: string,
) {
    var assets = [];
    let apiResult = null;
    let hasError = false;
    let error;

    try {
        do {
            let result = await AssetService.getPoapAssets({userId:ownerId})
            console.log("ResultHere",result)
            let rawAssets = result
                .map((it) => formatPoapAsset(it, ownerId));
            assets = assets.concat(rawAssets);
        } while (apiResult.continuation);
    } catch (err) {
        console.error(err);
        hasError = true;
        error = err.message;
    }

    return {
        assets,
        hasMore: false,
        hasError,
        error,
    };
}
