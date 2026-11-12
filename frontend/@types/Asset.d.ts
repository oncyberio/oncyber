import { Ownership } from "@dapp/types/Ownership";
import { AudioType, VideoPlaybackType } from "@gltypes";
import { Blockchain } from "dApp/connect";

export interface AssetAccount {
    address?: string;
    username?: string;
    user: {
        username?: string;
        profile_img_url?: string;
    };
    profile_img_url?: string;
}

export type OptimiseModelFiles = {
    high: Blob;
    low: Blob;
    mid: Blob;
    origin: Blob;
    lowCompressed: Blob;
};

export interface FetchedAsset {
    provider?: string;
    __transient?: boolean;
    account_base_url?: string;
    image_preview_url?: string;
    image_original_preview_url?: string;
    image_url?: string;
    image_original_url?: string;
    dcompressed_image_url?: string;
    compressed_image_url?: string;
    animation_url?: string;
    animation_original_url?: string;
    dcompressed_animation_url?: string;
    d_optimized_files?: {
        high: string;
        low: string;
        low_compressed: string;
    };
    compressed_animation_url?: string;
    d_optimized_files?: {
        high: string;
        low: string;
        low_compressed: string;
    };
    original_animation_url?: string;
    name?: string;
    description?: string;
    external_link?: string;
    openSeaLink?: string;
    token_address?: string;
    contract_address?: string;
    contract?: {
        name?: string;
        schema_name?: string;
    };
    token_id?: string;
    blockchain: Blockchain;
    marketplace?: string;
    collection?: {
        name?: string;
        image_url?: string;
        external_url?: string;
    };
    creator?: AssetAccount;
    owner?: AssetAccount;
    mime_type?: string;
    cover_mime_type?: string; // cover image for audios
    original_mime_type?: string;
    isCreatorButNotOwned?: boolean;
    isOwned?: boolean;
    supply?: number;
    ownerships?: Array<{ owner: AssetAccount; quantity: number }>;
    sell_orders?: Array<any>;
    buy_orders?: Array<any>;
    raw_asset?: any;
    params?: any;
    customData?: any;
    raffleId?: number;
    mintable?: boolean;
    source?: {
        blockchain: string;
        api: string;
    };
    addedBy?: string;
    needsRefetch?: boolean;
    shape?: string;
}

export type AssetReaction = "fire" | "party" | "clap" | "heart";

export type TextTransform =
    | "none"
    | "lowercase"
    | "uppercase"
    | "capitalize"
    | "togglecase";

export type TextAlign = "left" | "right" | "center";

export interface AssetStats {
    views: number;
    reactions: Record<AssetReaction, number>;
}

export interface TextAsset {
    font?: string;
    visible?: boolean;
    text?: string;
    textColor?: [number, number, number];
    align?: TextAlign;
    width?: number;
    lineHeight?: number;
    textTransform?: TextTransform;
}

export interface Asset extends FetchedAsset {
    id: string;
    placeholderId: string;
    addedBy?: string;
    sharedBy?: string;
    curatorNotes?: string;
    hasBorder?: any;
    borderColor?: any;
    size?: any;
    scale?: number;
    dimensions?: [number, number];
    videoDimensions?: [number, number];
    metric?: string;
    properties?: any;

    hdImage?: boolean;

    isBackgroundAudio?: any;
    volume?: any;

    enableHTMLView?: boolean;
    foreverPlay?: boolean;
    videoPlayback?: VideoPlaybackType;
    isBackgroundAudio?: any;
    audioType?: AudioType;
    animations?: object;
    stats?: AssetStats;
    incompatible?: boolean;
    visible?: boolean;

    isCollider?: boolean;
    // text
    font?: string;
    text?: string;
    textColor?: [number, number, number];
    align?: TextAlign;
    width?: number;
    lineHeight?: number;
    textTransform?: TextTransform;

    token_metadata?: string;
    prev_mime_type?: string;
    source?: {
        blockchain: string;
        api: string;
    };
    files?: Array<{
        url: string;
        type: string;
        compressed_url: string;
    }>;

    shape?: string;
}

export type OpenSeaChain =
    | "ethereum"
    | "matic"
    | "klaytn"
    | "solana"
    | "arbitrum"
    | "bsc"
    | "avalanche"
    | "zora"
    | "base"
    | "optimism";
