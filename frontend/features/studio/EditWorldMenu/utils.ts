import type { SpaceItem } from "@3factory/abstract/spaceitem";
import type { Portal } from "@3factory/portal/portal";
import type { SpaceArtwork } from "@3factory/artwork/abstract";
import type { SpacePlaceholder } from "@3factory/artwork/placeholders/spaceplaceholder";
import { KitBashElement } from "@3factory/space/kits/kitbash/kitbashelement";
import type { Component3D } from "@3factory/space/kits/abstract";
import type { Experience, LockData, LockValue } from "@uitypes/experience";
import type { Asset, FetchedAsset, TextAsset } from "@uitypes/Asset";
import { TYPES } from "@3factory/artwork/constants";
import {
    resize,
    relay,
    isRelay,
    fixCloudinaryBehindProxy,
} from "@utils/urlUtils";
import {
    AssetOption,
    AssetType,
    ElevatorOpt,
    GlobalStreamOpt,
    IframeOpt,
    NftOpt,
    PortalOpt,
    TextOpt,
    TriggerZoneOpt,
    UploadOpt,
    YoutubeOpt,
    KitbashOpt,
    ComponentsOpt,
} from "./AddAsset/shared/AssetTypes";
import { fetchAssetById } from "@utils/fetchAssets";
import { ACTION_FAIL_MESSAGES } from "../utils/constants";
import { formatAsset } from "@utils/formatAssets";
import { icaseEq } from "@utils/js";
import { ExhibitRole } from "@uitypes/user";
import { getRoleRank } from "@utils/exhibit";
import { SpaceComponent } from "@components/_3DExhibit-v2/three/factory/abstract/spacecomponent";
import { getAssetMediaInfo } from "@utils/media/mediaInfo";
import { CHECK_ABORT_SIGNAL } from "@utils/abort";
import {
    MediaInfo,
    NotUploadableMediaInfo,
    SupportedMediaInfo,
    UploadableMediaInfo,
} from "@uitypes/mediaInfo";

//
export type EditableMesh = SpaceArtwork | Portal | Component3D;

export type Placeholder = SpacePlaceholder | Portal;

export function isArtwork(mesh: any): mesh is SpaceArtwork {
    //
    return mesh != null && mesh.isArtwork && !mesh.isPlaceholder;
}

export function canChangeFrame(mesh: SpaceItem): mesh is SpaceArtwork {
    //
    return (
        isArtwork(mesh) &&
        mesh.mediaType !== TYPES.MODEL &&
        !isText(mesh.item.data)
    );
}

export function isArtworkPlaceholder(mesh: any): mesh is SpacePlaceholder {
    //
    return mesh != null && mesh.isArtwork && mesh.isPlaceholder;
}

export function isPortal(mesh: any): mesh is Portal {
    //
    return mesh != null && mesh.isPortal;
}

export function isKitbash(mesh: any): mesh is KitBashElement {
    //
    return mesh != null && mesh.isKitBash;
}

export function isComponent3D(mesh: any): mesh is Component3D {
    //
    return mesh != null && mesh.isComponent3D;
}

export function isStaticPortal(mesh: any): mesh is Portal {
    //
    return isPortal(mesh) && mesh.spawn == null;
}

export function isEditableMesh(mesh: any): mesh is EditableMesh {
    //
    return (
        isArtwork(mesh) ||
        isNonEmptyPortal(mesh) ||
        isKitbash(mesh) ||
        isComponent3D(mesh)
    );
}

export function isNonEmptyPortal(mesh: any): mesh is Portal {
    //
    return (
        mesh != null &&
        mesh.isPortal &&
        (!(mesh as Portal).isPortalPlaceholder ||
            (mesh as Portal).opts.exhibitId != null)
    );
}

export function isEmptyPlacholder(mesh: any): mesh is Placeholder {
    //
    return (
        mesh != null &&
        (mesh.isPlaceholder || (isPortal(mesh) && mesh.opts.exhibitId == null))
    );
}

export function canReplace(
    exhibit: Experience,
    asset: Asset,
    wallets: string[]
) {
    //
    return wallets.some((walletId) => {
        //
        walletId = walletId.toLowerCase();

        return (
            exhibit.owner.toLowerCase() == walletId ||
            !asset?.addedBy ||
            asset.addedBy.toLowerCase() === walletId
        );
    });
}

export function canChangeLock(
    current: LockData,
    incoming: Record<keyof LockData, unknown>,
    userId: string,
    roles: Record<string, ExhibitRole>
) {
    //
    if (current != null) {
        //
        const userRole = roles[userId.toLowerCase()];

        for (let key in incoming) {
            //
            let currentLockValue = current[key];

            if (currentLockValue == null) continue;

            // if we don't have roles info yet, assume highest
            const lockerRole =
                roles[currentLockValue.lockedBy.toLowerCase()] || "owner";

            if (icaseEq(currentLockValue.lockedBy, userId)) continue;

            if (getRoleRank(userRole) <= getRoleRank(lockerRole)) {
                return false;
            }
        }
    }

    return true;
}

export function isNft(asset: Asset) {
    //

    if (!asset.mime_type && asset.token_address && asset.token_id) return true;

    if (
        !asset.mime_type ||
        asset.mime_type === "cyber/text" ||
        asset.mime_type?.startsWith("embed") ||
        asset.mime_type === "cyber/globalstream" ||
        asset.mime_type === "cyber/triggerzone"
    )
        return false;

    if (asset.source?.blockchain === "none") return false;

    return true;
}

export function isOptEnabledForMesh(opt: AssetType, mesh: SpaceComponent) {
    //
    if (mesh == null || !isPortal(mesh) || mesh.spawn) return true;

    return opt === "portal";
}

export function getNftId(asset: FetchedAsset) {
    return `${asset?.token_address}/${asset?.token_id}`;
}

export function isText(asset: Asset) {
    return asset.mime_type === "cyber/text";
}

export function isUpload(asset: Asset) {
    return (
        asset.source?.blockchain === "none" && asset.source?.api === "oncyber"
    );
}

export function isYoutube(asset: Asset) {
    return asset.mime_type === "embed/youtube";
}

export function isWebsite(asset: Asset) {
    return asset?.mime_type?.startsWith?.("embed/html");
}

export function isTriggerZone(asset: Asset) {
    return asset.mime_type === "cyber/triggerzone";
}

export function isGlobalStream(asset: Asset) {
    return asset.mime_type === "cyber/globalstream";
}

export function getAssetType(mesh: SpaceItem | Component3D): AssetOption {
    const asset = mesh.userData as any;

    //
    if (isPortal(mesh)) {
        //
        //if(mesh.isElevator) return ElevatorOpt

        return PortalOpt;
    }

    if (isKitbash(mesh)) {
        return KitbashOpt;
    }

    if (isComponent3D(mesh)) {
        return ComponentsOpt;
    }

    if (isNft(asset)) {
        return NftOpt;
    }

    if (isUpload(asset)) {
        return UploadOpt;
    }

    if (isYoutube(asset)) {
        return YoutubeOpt;
    }

    if (isText(asset)) {
        return TextOpt;
    }

    if (isWebsite(asset)) {
        return IframeOpt;
    }

    if (isTriggerZone(asset)) {
        return TriggerZoneOpt;
    }

    if (isGlobalStream(asset)) {
        return GlobalStreamOpt;
    }

    console.log("okokok");
}

export function getTextProps(asset: Asset) {
    //
    if (asset.mime_type !== "cyber/text") {
        //
        throw new Error("Not a text");
    }

    const { addedBy, id, placeholderId, ...props } = asset;

    return props as TextAsset;
}

export async function fetchAssetIfNeeded(asset: FetchedAsset, ownerId: string) {
    //
    if (asset.needsRefetch) {
        const { success, asset: freshAsset } = await fetchAssetById(
            ownerId,
            asset.contract_address,
            asset.token_id,
            asset.marketplace,
            asset.customData
        );

        if (!success) {
            // We can't continue further if we don't have complete metadata
            throw new Error(ACTION_FAIL_MESSAGES.REFETCH, {
                cause: "refetch",
            });
        }

        if (!freshAsset.owner) {
            // polygon assets do not have owner field, so we reuse
            // the one we already have
            freshAsset.owner = asset.owner;
        }

        asset = formatAsset(freshAsset);

        // endPerf(ts, "refetch");
    }

    return asset;
}

export const NFT_MADIA_ERRORS = {
    NO_MEDIA_INFO: "no-media-info",
    UNSUPPORTED_MEDIA: "unsupported-media",
};

export interface NftPreprocessResult {
    artwork: Asset;
    ownership: string;
    mediaInfo: SupportedMediaInfo;
    coverMediaInfo?: SupportedMediaInfo;
}

const nftPreproCache = new WeakMap<
    FetchedAsset,
    Promise<NftPreprocessResult>
>();

export function preprocessNftAsset(opts: {
    asset: FetchedAsset;
    userId: string;
    walletId: string;
    sharedBy?: string;
    // abort?: AbortSignal;
}) {
    //

    let result = nftPreproCache.get(opts.asset);

    if (result == null) {
        //
        result = preprocessNftAssetImp(opts);

        nftPreproCache.set(opts.asset, result);
    }

    return result;
}

const preprocessNftAssetImp: typeof preprocessNftAsset = async (opts) => {
    //
    let { asset, userId, walletId, sharedBy } = opts;

    let ownership = sharedBy
        ? "none"
        : asset?.creator?.address?.toLowerCase?.() === userId.toLowerCase()
        ? "minted"
        : "owned";

    asset = await fetchAssetIfNeeded(asset, walletId);

    const { mediaInfo, coverMediaInfo } = await getAssetMediaInfo(asset, true);

    // Case 1: Media not found
    if (mediaInfo.type === "NoTypeInfo") {
        //
        throw new Error(ACTION_FAIL_MESSAGES.MEDIA_NOT_FOUND, {
            cause: NFT_MADIA_ERRORS.NO_MEDIA_INFO,
        });
    }

    // Case 2: Media found but not supported
    if (mediaInfo.type === "Unsupported") {
        //
        throw new Error(ACTION_FAIL_MESSAGES.MEDIA_UNSUPPORTED, {
            cause: NFT_MADIA_ERRORS.UNSUPPORTED_MEDIA,
        });
    }

    // seadn (OpenSea CDN) serves a 500x500 SQUARE when no params are present, so
    // portrait/landscape NFTs would render as squares. Request a width here, at
    // placement time, so the stored image keeps its true aspect ratio (width-only
    // preserves aspect). Done at the asset/placement layer, not the 3D engine.
    //
    // seadn sends no CORS header, so the URL is almost always relayed through
    // /api/proxyv2?url=<seadn>. resize() only recognizes a bare seadn URL, so for
    // the relayed case we resize the INNER url and re-wrap it. The proxy forwards
    // the inner ?w (a 2nd "?" is part of the value, not a query delimiter).
    let placedUrl = mediaInfo.url;
    if (
        mediaInfo.urlField?.includes("image") &&
        /seadn\.io/i.test(placedUrl || "") &&
        !/[?&]w=/.test(placedUrl || "")
    ) {
        placedUrl = isRelay(placedUrl)
            ? relay(resize(fixCloudinaryBehindProxy(placedUrl), 1024))
            : resize(placedUrl, 1024);
    }

    // @ts-ignore
    const artwork: Asset = {
        ...asset,
        [mediaInfo.urlField]: placedUrl,
        mime_type: mediaInfo.mime_type,
        addedBy: userId.toLocaleLowerCase(),
        sharedBy: sharedBy || "",
    };

    if (
        coverMediaInfo &&
        coverMediaInfo?.type !== "NoTypeInfo" &&
        coverMediaInfo?.type !== "Unsupported"
    ) {
        artwork.image_url = coverMediaInfo.url;
        artwork.cover_mime_type = coverMediaInfo.mime_type;
    }

    return { artwork, ownership, mediaInfo, coverMediaInfo } as any;
};
