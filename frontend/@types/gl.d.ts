import { SpaceArtwork } from "@3artwork/abstract";

import { MediaType } from "@3utils/mediatype";

import { Space } from "@3factory/space/space";

import { ArtworkContainer } from "@3artwork/artworkcontainer";

import Artwork from "@artworks/Artwork";

import { PortalData as _PortalData } from "./experience";

import {
    AnimationAction,
    AnimationClip,
    AnimationMixer,
    Box3,
    BufferGeometry,
    Euler,
    Fog,
    Group,
    Material,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    PerspectiveCamera,
    PlaneBufferGeometry,
    PlaneGeometry,
    Scene,
    Texture,
    Vector3,
} from "three";

import { GLTF as _GLTF } from "three/examples/jsm/loaders/GLTFLoader";

import {
    ArtworkData,
    Experience,
    PortalData as ExpPortalData,
} from "./experience";

import { User } from "./user";

import World3D from "@3/three/world3D";

import { RoomParameters } from "./roomParameters";

import { SpaceFloor } from "@3factory/space/spacefloor";

import { PortalContainer } from "@3factory/portal/portalcontainer";

import InstancedMeshWrapper from "@3gl/abstract/instancemeshwrapper";

import { AbstractAudioController } from "@3artwork/controllers/abstractaudiocontroller";

import { VideoController } from "@3artwork/controllers/videocontroller";

import { SpaceArtworkLoader } from "@3factory/artwork/loader/spaceartworkloadermesh";

import { PortalPreviewMesh } from "@3factory/portal/previewmesh";

import OcclusionMesh from "@3gl/abstract/occlusionmesh";

import { CSSWrapper } from "@components/_3DExhibit-v2/three/factory/artwork/meshes/css/CSSwrapper";

import FutureWrapper from "@components/_3DExhibit-v2/three/factory/space/componentManager";

import { UploaderSceneData } from "./destinations";

export type Value<T, K extends keyof T> = T[K];

export interface Async {
    abort?: AbortSignal;
}

export interface World3DOptions extends Async {
    exhibit: Experience;
    roomParameters: RoomParameters;
    initTextures?: boolean;
    /** Use a prepared room variant with smaller textures for lobby entry. */
    preferLowResolution?: boolean;
}

export interface SpaceStateOptions extends World3DOptions {
    space: SpaceData;
    player?: any;
}

export interface SpaceItemOptions extends SpaceStateOptions {
    raycastMesh: Mesh;
}

export interface ItemFactoryOptions {
    exhibit: Experience;
    roomParameters: RoomParameters;
    space: SpaceData;
    mixers: AnimationMixer[];
}

export interface PortalFactoryItemOptions extends SpaceStateOptions {
    placeholderData?: PortalPlaceholderData;
    exhibitId: string;
    halo?: _PortalData["halo"];
    spawn?: ExpPortalData["spawn"];
    coords?: string;
    levels?: any;
    cHeroImg360?: string;
}

export interface XYZ {
    x: number;
    y: number;
    z: number;
}

export interface Coords {
    position?: XYZ;
    rotation?: XYZ;
    scale?: XYZ;
}

export interface PortalSpawnOptions extends SpaceStateOptions {
    spawn: ExpPortalData["spawn"];
}

export interface ArtworkOptions extends SpaceStateOptions {
    item: ArtworkData;
    preview?: SpaceArtwork;
    overrideUrl?: string;
    overrideUrlAlt?: string;
    overrideMime?: string;
    isPreview?: boolean;
    fromEdit?: boolean;
    noInstance?: boolean;
}

export interface IArtworkMesh extends OcclusionMesh<PlaneGeometry, Material> {
    isLODMesh?: boolean;
    wasDisposed: boolean;
    audioController?: AbstractAudioController;
    videoController?: VideoController;
    dispose: () => void;
}

export interface ArtworkMeshOpts extends ArtworkOptions {
    geometry: PlaneBufferGeometry;
    material: MeshBasicMaterial;
    audioController?: AbstractAudioController;
    videoController?: VideoController;
}

export interface LODVideoOpts {
    type: "VIDEO_MEDIA";
    video?: HTMLVideoElement;
    url: string;
    alternateUrl?: string;
}

export interface LODImageOpts {
    type: "IMAGE_MEDIA";
    image?: HTMLImageElement;
    url: string;
    alternateUrl?: string;
}

export type LODOpts = LODVideoOpts | LODImageOpts;

export interface LODMeshOptions extends ArtworkMeshOpts {
    lod: {
        hi: LODVideoOpts | LODImageOpts;
        lo: LODImageOpts;
    };
    materialParams: object;
}

export type ArtworkType =
    | "PLACEHOLDER"
    | "IMAGE"
    | "PANORAMA"
    | "VIDEO"
    | "AUDIO"
    | "MODEL"
    | "HTML"
    | "HTML_EMBED"
    | "YOUTUBE_EMBED"
    | "CYBER_TEXT"
    | "TRIGGER_ZONE"
    | "GLOBAL_STREAM";

export type ArtworkState = "IDLE" | "PLAYING" | "PAUSED";

export type AudioType = "lookat" | "spatial" | "constant";

export type VideoPlaybackType = "manual" | "auto";

interface Disposable {
    dispose();
}

export type ThreeResource =
    | Object3D
    | Texture
    | Material
    | Disposable
    | InstancedMeshWrapper;

export interface SpaceArtworkOptions extends ArtworkOptions {
    type: ArtworkType;
    mesh?: IArtworkMesh;
    raycastMesh: Mesh;
    border?: Mesh<BufferGeometry, Material>;
    mixer?: AnimationMixer;
    resources: ThreeResource[];
}

export interface CSSEmbedOptions extends SpaceArtworkOptions {
    previewMesh?: IArtworkMesh;
    cssWrapper?: CSSWrapper;
    iframe: HTMLIFrameElement;
}

export interface VideoArtworkOptions extends SpaceArtworkOptions {}

export interface PlayControllerOptions extends ArtworkOptions {
    isGlobal: boolean;
    media: {
        play: () => any;
        pause: () => any;
    };
    artwork: SpaceArtwork;
    noUpdate?: boolean;
}

export interface VideoPlayer {
    readonly paused: boolean;
    muted: boolean;
    currentTime: number;
    src: string | null;
    volume: number;
    play: () => Promise<void>;
    pause: () => void;
}

export interface VideoControllerOptions {
    video: VideoPlayer;
    mesh: Object3D;
    videoPlayback?: VideoPlaybackType;
}

export type VideoTextureOptions = ArtworkOptions &
    VideoControllerOptions & {
        video: HTMLVideoElement;
        videoController?: VideoController;
        audioController?: AbstractAudioController;
    };

export interface AudioArtworkOptions extends SpaceArtworkOptions {
    coverImage?: SpaceArtwork;
    url: string;
}

export interface ModelArtworkOptions extends SpaceArtworkOptions {
    scene: Object3D;
    animations: AnimationClip[];
    transformedBlob?: Blob;
}

export interface HTMLArtworkOptions extends SpaceArtworkOptions {
    htmlText: string;
    baseUrl: string;
    foreverPlay?: boolean;
}

export interface CSSHTMLArtworkOptions extends CSSEmbedOptions {
    foreverPlay?: boolean;
}

export type PortalState = "EMPTY" | "LOADING" | "CLOSED" | "OPENING" | "OPEN";

export type PortalAnimation = "open" | "close";

export interface PortalData {
    exhibit?: Experience;
    roomParameters?: RoomParameters;
    user?: User;
    password?: string;
}

export interface PortalPlaceholderData {
    portalId: string;
    meshes: {
        originalPreviewMesh?: Mesh;
        previewMesh: PortalPreviewMesh;
        portalMesh?: Object3D;
        portalDoor?: Object3D;
    };
    animations?: Record<PortalAnimation, AnimationClip[]>;
}

export interface PortalPreviewOptions extends SpaceItemOptions {
    isStaticPortal: boolean;
    spawn?: PortalSpawnOptions["spawn"];
    placeholderData: PortalPlaceholderData;
    portalData: PortalData;
    exhibitId?: string;
    backState?: TeleportState;
    cHeroImg360: string;
    coords?: string;
    levels?: any;
    currentLevel?: string;
}

export interface PortalPlaceholerOptions extends World3DOptions {
    placeholderData: PortalPlaceholderData;
    loadedData: LoadedPortalData;
}

interface TeleportState {
    backPosition: Vector3;
    backDirection: Vector3;
    backRotation: {
        _y: number;
    };
}

export interface HistoryEntry3D {
    portalData: PortalData;
    backState: TeleportState;
}

export interface HistoryOptions extends World3DOptions {
    backState: TeleportState;
}

export interface Emitter {
    on(event: string, handler: Function);
    once(event: string, handler: Function);
    on_prior(event: string, handler: Function);
    off(event: string, handler: Function);
    emit(event: string, data: any, p?: any);
}

export interface SpaceData {
    isPortal?: boolean;
    scene: Space;
    kitbash?: FutureWrapper;
    kitbashImgs?: Record<string, string>;
    artworkContainer?: ArtworkContainer;
    portalContainer?: PortalContainer;
    colliders: Object3D[];
    placeholders: Object3D[];
    floors: SpaceFloor[];
    portalPlaceholders: Array<PortalPlaceholderData>;
    mixer: AnimationMixer;
    background: Color | Texture;
    cubeMap: Texture;
    far: number;
    bbox: Box3;
    cameras: Array<any>;
    fog: Fog;
}

export interface GLTF extends _GLTF {
    textures: Texture[];
    transformedBlob?: Blob;
}

export interface SpaceState {
    space: SpaceData;
    artworks: SpaceItems;
}

export interface ControlsOptions extends SpaceStateOptions {
    camera: PerspectiveCamera;
    isPreview: boolean;
}

export interface EnvironmentParams {
    id: string;
    name?: string;
    path?: string;
    format?: string;
}

export interface RaycastEvent {
    active: boolean;
    type: string;
    intersect: Intersection;
    onClick?: boolean;
}

export interface ArtworkRaycastEvent extends RaycastEvent {
    currentArtwork: SpaceArtwork;
}
