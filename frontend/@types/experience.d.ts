import { firestore } from "firebase-admin";
import { Asset, RoomSkin } from "@uitypes/Asset";
import { User } from "./user";
import { Blockchain, WalletConnection } from "@dapp/connect";
import { AudioType, AutoPlayOpt as VideoPlaybackType } from "@gltypes";
import { RoomParameters } from "./roomParameters";

export interface XYZ {
    x: number;
    y: number;
    z: number;
}

export interface Rotation {
    _x: number;
    _y: number;
    _z: number;
}

export type Position = XYZ;

export type Scale = XYZ;

export interface LockValue {
    lockedBy: string;
    value: boolean;
}

export interface LockData {
    transform?: LockValue;
}

export interface ArtworkData {
    version: undefined | number;
    data: Asset;

    position: Position;
    rotation: Rotation;
    scale?: Scale;

    lock?: LockData;

    originalPosition?: Position;
    originalRotation?: Rotation;

    animations?: Record<string, any>;
    addedBy: string;
    curatorNotes?: string;

    videoPlayback?: VideoPlaybackType;
    audioType?: AudioType;
    // Should be deprecated by audioType
    // == Spatial
    isBackgroundAudio?: any;
    // This is sound reach for spatial audio
    volume?: any;

    envmap?: string;
    envmapIntensity?: number;

    deprecatedEnvmap?: string;
    distanceToCamera?: number;
    overwrite?: {
        mediaType: string;
        url: string;
    };
}

export interface PortalData {
    id: string;
    exhibitId: string;
    halo?: "color" | null;
    spawn?: {
        shape?: "rectangle" | "circle";
        portalId: string;
        placeholderId: string;

        position: Position;
        rotation: Rotation;
        scale?: Scale;

        lock?: LockData;

        originalPosition?: Position;
        originalRotation?: Rotation;
    };
    coords?: string;
    cHeroImg: string;
    cHeroImg360: string;
    addedBy: string;
    levels?: [
        {
            cHeroImg: string;
            cHeroImg360: string;
            coords?: string;
            exhibitId: string;
            level: number;
            name: string;
            id: string;
        }
    ];
    isElevator?: boolean;
    static?: boolean;
}

export interface KitBashData {
    id: string;
    kit: string;
    type: string;
    // previewImg?: string;
    // position?: Position;
    // rotation?: Rotation;
    addedBy?: string;
    _version?: number;
    // Tags every item produced by one generation/import pass so the studio can
    // later select/move/delete the whole batch as a unit, without a full
    // parent/child hierarchy.
    groupId?: string;
    [key: string]: any;
}

type B = WalletConnection["type"];

export interface CollectionData {
    slug: string;
    name?: string;
    address?: string;
    image?: string;
    blockchain: "ethereum" | "tezos" | "counterparty" | "solana" | "base";
    verified?: boolean;
    type?: string;
}

export type SpaceParams = Pick<
    RoomParameters,
    "initialPlayerPosition" | "initialPlayerRotation"
> & {
    pfp?: Pick<User, "avatar" | "avatarContractAddress" | "avatarTokenId">;
    enableNotifications?: boolean;
    soloExperience?: boolean;
    voiceAllowed?: boolean;
    editionAllowed?: boolean;
    cameraView?: "first" | "third";
    avatarSize?: number;
};

export interface Script {
    id: string;
    type: "module" | "artwork" | "component";
    code: string;
}

export interface Game {
    id: string;
    name: string;
    description: string;
    scripts: Record<string, Script>;
}

export interface Experience {
    /** Missing means the existing Oncyber renderer. */
    runtime?:
        | { kind: "cyber" }
        | import("@features/content-host/runtime").EmbeddedRuntime;
    version?: number;
    storageVersion?: numnber;
    pendingTransaction?: boolean;
    id: string;
    info: {
        curator: string;
        room: string;
        currentSkin?: string;
        isRainbowModeActive?: boolean;
        heroImg?: string;
        cHeroImg?: string;
        cHeroImg360?: string;
        fHeroImg?: string;
        lastUpdatedHeroImg?: number;
        headline?: string;
        customLink?: string;
        description?: string;
        coords?: string;
        roomParameters?: {
            sky?: {
                background_type: "color" | "image" | "sky";
                enableSky: boolean;
                background: string;
                backgroundMap: {
                    id: string;
                    path?: string;
                    name?: string;
                    image?: string;
                    format?: string;
                };
                applyEnvMapBackground: boolean;
                skyOptions: {
                    turbidity: number;
                    rayleigh: number;
                    mieCoefficient: number;
                    mieDirectionalG: number;
                    elevation: number;
                    azimuth: number;
                };
            };
        };
    };
    total_artworks?: number;
    artworks: Record<string, ArtworkData>;
    portals?: Record<string, PortalData>;

    // This is to optimize firebase queries/updates
    hasKitbash?: boolean;
    kitbash?: Record<string, KitBashData>;

    // createdAt: firestore.Timestamp & { _seconds: number };
    createdAt: string;
    lastUpdatedAt?: number; // timestamp
    lastContentUpdatedAt?: number; // to track assets/portals update
    number_of_visits: number;
    owner: string;
    editors: string[];
    isAdminCurator?: boolean;
    isCurator?: boolean;
    otherOwners?: string[];
    // Cached data to speed up portal loading
    ownerData?: User;
    ownerName?: string;
    portalExhibits?: Record<string, Experience>;
    portalsDestinations?: Record<string, RoomParameters>;
    portalsOwners?: Record<string, User>;
    invited?: boolean;
    spotlight?: any;
    gating?: {
        date?: { start: number; end: number }; // Timestamps
        nftOwnership?: Array<CollectionData>;
        whitelist?: Array<string>; // Wallet addresses
        noAnonymous?: boolean;
        roomCapacity?: number; // max simultaneous players allowwed in Multiplayer
        // Public shape: `message` and `rev` (random, changes with the
        // password). `password` is the plain value the studio sends when
        // setting one, and what documents from before hashing still hold;
        // reads strip it (utils/worldPassword/publicGating.ts).
        password?: {
            password?: string;
            message?: string;
            rev?: string;
        };
    };
    games?: Record<string, Game>;
    params?: SpaceParams;
    likes?: number;
    analytics?: {
        score?: number;
    };
    mock?: boolean;
    nbElements?: number;
}

export interface Stylekit {
    version: number;
    id: string;

    info: {
        curator: string;
        room: string;
    };

    kitbash?: Record<string, KitBashData>;
    kitbashImgs?: Record<string, string>;

    createdAt: number;
    lastUpdatedAt?: number; // timestamp
    lastContentUpdatedAt?: number; // to track assets/portals update
    owner: string;
    editors: string[];
}

export type Kitbash = Stylekit["kitbash"];
