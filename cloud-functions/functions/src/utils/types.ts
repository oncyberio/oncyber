export interface AssetAccount {
    address?: string;
    username?: string;
    user: {
        username?: string;
        profile_img_url?: string;
    };
    profile_img_url?: string;
}

export interface Asset {
    id: string;
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
    compressed_animation_url?: string;
    original_animation_url?: string;
    d_optimized_files?: {
        high: string;
        low: string;
        low_compressed: string;
    };
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
    blockchain: string;
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
    sell_orders?: Array<any>;
    buy_orders?: Array<any>;
    raw_asset?: any;
    params?: any;
    customData?: any;
    raffleId?: number;
    mintable?: boolean;
    addedBy?: string;
    type?: string;
    url?: string;
    source?: {
        blockchain: string;
        api: string;
    };
}

export interface MediaInfo {
    mime_type: string;
    urlField: string;
    url: string;
    size: number;
}

export type Result<T> =
    | { success: true; value: T }
    | { success: false; error: string };

export function Success<T>(value: T): Result<T> {
    return { success: true, value };
}

export function Error(error = "Unknown error"): Result<any> {
    return { success: false, error };
}

export function is3DModel(asset: Asset) {
    //
    return asset.mime_type?.startsWith("model/gltf");
}

export function isUpload(asset: Asset) {
    return (
        asset.source?.blockchain === "none" && asset.source?.api === "oncyber"
    );
}
