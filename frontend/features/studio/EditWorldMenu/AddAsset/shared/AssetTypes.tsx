import { WorldToolArtwork } from "./WorldToolArtwork";
import { AssetIcon } from "./AssetIcon";
import { TextToolArtwork } from "./TextToolArtwork";

export const NftOpt = {
    title: "NFTs",
    description: "Add NFTs",
    value: "nft",
    icon: (
        <img
            className="nft-art-frame"
            src="/studio-assets/nft-original-frame-badge.png"
            width={44}
            height={44}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
        />
    ),
    // key: "N",
    disabled: false,
    hidden: false,
} as const;

export const UploadOpt = {
    title: "Upload",
    description: "Custom uploads",
    value: "upload",
    icon: (
        <img
            className="upload-folder"
            src="/studio-assets/upload-folder.png"
            width={44}
            height={44}
            alt=""
            aria-hidden="true"
            draggable={false}
            decoding="async"
        />
    ),
    // key: "U",
    disabled: false,
    hidden: false,
} as const;

export const PortalOpt = {
    title: "Portal",
    description: "Add Portals to other oncyber Worlds",
    value: "portal",
    icon: <AssetIcon name="portal" />,
    // key: "P",
    disabled: false,
    hidden: false,
} as const;

export const YoutubeOpt = {
    title: "YouTube",
    description: "Add/Stream Youtube Videos",
    value: "youtube",
    icon: (
        <img
            className="youtube-play"
            src="/studio-assets/youtube-logo.svg"
            alt=""
            aria-hidden="true"
            draggable={false}
        />
    ),
    // key: "Y",
    disabled: false,
    hidden: false,
} as const;

export const TextOpt = {
    title: "Text",
    description: "Add Text",
    value: "text",
    icon: <TextToolArtwork />,
    // key: "T",
    disabled: false,
    hidden: false,
} as const;

export const ElevatorOpt = {
    title: "Elevator",
    description: "Add Elevator",
    value: "elevator",
    icon: <AssetIcon name="elevator" />,
    disabled: false,
    hidden: false,
} as const;

export const IframeOpt = {
    title: "Websites",
    description: "Add Websites",
    value: "iframe",
    icon: <AssetIcon name="iframe" />,
    // key: "I",
    disabled: false,
    hidden: false,
} as const;

export const PlacedAssetsOpt = {
    title: "Placed Assets",
    description: "Placed Assets",
    value: "placedAssets",
    icon: <AssetIcon name="placedAssets" />,
    // key: null,
    disabled: false,
    hidden: false,
} as const;

export const TriggerZoneOpt = {
    title: "Interactivity Zones",
    description: "Add Interactivity Zones",
    value: "triggerZone",
    icon: <AssetIcon name="triggerZone" />,
    // key: null,
    disabled: false,
    hidden: false,
} as const;

export const GlobalStreamOpt = {
    title: "Global Stream",
    description: "Add Audio Streams",
    value: "globalStream",
    icon: <AssetIcon name="globalStream" />,
    tooltip:
        "Professional Live audio streaming in your space. \nSupports any audio broadcast URL (ie: Icecast, SHOUTCast..) at any bitrate.",
    // key: null,
    disabled: false,
    hidden: false,
} as const;

export const KitbashOpt = {
    title: "Kit Assets",
    description: "Build with Blocks",
    value: "kitbash",
    icon: <AssetIcon name="kitbash" />,
    //key: null,
    disabled: false,
    hidden: true,
} as const;

export const ComponentsOpt = {
    title: "World settings",
    description: "Adjust World Settings",
    value: "component",
    icon: <WorldToolArtwork />,
    //key: null,
    disabled: false,
    hidden: false,
} as const;

export const AvatarOpt = {
    title: "Avatars",
    description: "Avatars",
    value: "avatar",
    icon: <AssetIcon name="avatar" />,
    disabled: false,
    hidden: false,
} as const;

export const AddAssetOpts = [
    AvatarOpt,
    NftOpt,
    UploadOpt,
    TextOpt,
    YoutubeOpt,
    IframeOpt,
    PortalOpt,
    ComponentsOpt,
    KitbashOpt,
    TriggerZoneOpt,
    GlobalStreamOpt,
    // ElevatorOpt,
    // PlacedAssetsOpt,
] as const;

export type AssetOption = (typeof AddAssetOpts)[number];

export type AssetType = AssetOption["value"];

/** Source tool ordering and expansion, shared by both engine hosts. */
export function assetDockOptions(
    mobile: boolean,
    expanded = false
): AssetOption[] {
    const options = [...AddAssetOpts].filter((option) => !option.hidden);
    const order = [
        "nft",
        "avatar",
        "upload",
        "text",
        "component",
        "youtube",
        "iframe",
        "portal",
        "triggerZone",
        "globalStream",
    ];
    options.sort((a, b) => {
        const x = order.indexOf(a.value),
            y = order.indexOf(b.value);
        return (x < 0 ? order.length : x) - (y < 0 ? order.length : y);
    });
    return mobile || expanded ? options : options.slice(0, 5);
}
