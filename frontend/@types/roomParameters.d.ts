import { TeleportState } from "@gltypes";
import { ColorSpace, Vector3 } from "three";
import { KitBashData } from "./experience";

export interface RoomSkin {
    name: string;
    path: string;
    image: string;
    background?: string;
    nonFungible?: boolean;
    collection?: string;
    blockchain?: string;
    contract_address?: string;
    token_id?: number;
    paths?: object;
}

export type envMapObj = {
    id: string;
    name: string;
    path: string;
    format: string;
};

export type DestinationTag =
    | "featured"
    | "curated"
    | "factory"
    | "free"
    | "uploaded"
    | "collectibles"
    | string;

export interface RoomParameters {
    _id: string;
    isFuture?: boolean;
    kitbash?: Record<string, KitBashData>;
    slug: string;
    name: string;
    path: string;
    path_low: string;
    path_mid?: string;
    path_high?: string;
    type?: string;
    paths?: any;
    uPath?: any;
    params: Record<string, any>;
    skins?: Record<string, RoomSkin>;
    image?: string;
    thumbnail?: string;
    capacity: number;
    user_height?: number;
    nonFungible?: boolean;
    near: number;
    far: number;
    scale?: number;
    showPlaceholders?: boolean;
    distributionType?: string;
    outputEncoding: ColorSpace;
    usePostProcessing?: boolean;
    fog?: any;
    fogNear?: number;
    fogFar?: number;
    cameraFar?: number;

    staticCamera?: boolean;
    reflector?: boolean;
    applyEnvMap?: boolean;
    envMap?: {
        id: string;
        name: string;
        path: string;
        image: string;
        format: string;
        mimeType?: string;
    };
    capsuleRadius?: number;
    usesPhysicallyCorrectLights?: boolean;
    cursorRadius?: number;
    placeholderSize?: [number, number, number];
    artworkScale?: number;
    initialPlayerPosition?: { x: number; y: number; z: number };
    initialPlayerRotation?: { x: number; y: number; z: number };
    mobile_initialPlayerPosition?: { x: number; y: number; z: number };
    mobile_initialPlayerRotation?: { azimuthAngle: number; polarAngle: number };
    playerSpeed?: number;
    sunposition: { x: number; y: number; z: number };
    up: { x: number; y: number; z: number };
    near_fog?: number;
    background?: string;
    enableSky?: boolean;
    enableWater?: boolean;
    enableReflector?: boolean;
    applyEnvMapBackground?: boolean;
    author?: {
        name: string;
        id: string;
        userId?: string;
        twitter?: string;
        email?: string;
    };
    version?: 1 | 2;
    desktop_user_height?: number;
    hidden?: boolean;
    mouseControlsOnly?: boolean;
    gravity?: number;
    jump?: number;
    quidditch?: boolean;
    editmodePlayerSpeed?: number;
    turbidity?: number;
    rayhigh?: number;
    token_id?: number;
    editions?: number | "∞";
    collection?: string;
    openseaLink?: string;
    price?: number;
    blockchain?: "ethereum" | "polygon" | "tezos";
    contract_address?: string;
    pass?: "Ape Pass" | "Cat Pass";
    tag: DestinationTag[];
    status?: string;
    description?: string;
    thumbHash?: string;
    destHash?: string;
    animationHash?: string;
    quantity?: any;
    contractName?: string;
    startTime?: string;
    endTime?: string;
    shareCyber?: any;
    project: string;
    tmp_ownerBalance?: number;
    spline?: string;
    whitelist?: {
        data: Array<{ address: string; amount: string }>;
        fileName: string;
    };
    whitelist_url?: string;
    backgroundMap?: {
        id: string;
        name: string;
        path: string;
        format: string;
        image?: string;
        mimeType?: string;
    };
    reflectorOptions?: {
        blur?: boolean;
        color?: string;
        opacity?: number;
        scale?: {
            x?: number;
            z?: number;
        };
        position?: {
            x?: number;
            y?: number;
            z?: number;
        };
        normalmap?: {
            tiles?: number;
            enabled?: boolean;
            strength?: number;
            images?: Record<string, any>;
        };
    };
}

export type Spline = {
    export: Array<{
        duration: number;
        position: number[];
        lookat: number[];
    }>;
};
