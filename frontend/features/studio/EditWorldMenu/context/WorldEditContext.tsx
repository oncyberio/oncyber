import React, {
    createContext,
    useContext,
    useEffect,
    useReducer,
    useRef,
    useState,
} from "react";

import { useSnackbar } from "@components/Snackbar";
import { DEFAULT_SNACKBAR_DURATION } from "@components/Snackbar/useSnackbar";

import {
    ArtworkData,
    Experience,
    KitBashData,
    LockData,
    Script,
} from "@uitypes/experience";
import { RoomParameters } from "@uitypes/roomParameters";
import { UserContext } from "@components/context/UserContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { ExhibitEditorService } from "../../services/editor";
import { CANVAS, DRAG_MIMES, EDITION_ACTIONS } from "@3constants";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import Events from "@3events";
import {
    ACTION_FAIL_MESSAGES,
    ACTION_MESSAGES,
    ACTION_SUCCESS_MESSAGES,
    SNACKBAR_DURATION,
} from "../../utils/constants";
import { useWorldSelection } from "@components/_3DExhibit-v2/hooks/useWorldSelectedMesh";
import { fetchAssetById } from "@utils/fetchAssets";
import { formatAsset } from "@utils/formatAssets";
import { getAssetMediaInfo } from "@utils/media/mediaInfo";
import { useAssetsContext } from "./AssetsContext";
import { useWalletContext } from "./WalletContext";
import { Asset, FetchedAsset } from "@uitypes/Asset";
import type { SpaceItem } from "@3factory/abstract/spaceitem";
import type { SpaceArtwork } from "@3factory/artwork/abstract";
import {
    uploadAssetMedia,
    uploadAssetMediaFile,
} from "@utils/media/mediaUploader";
import {
    EditableMesh,
    canChangeLock,
    canReplace,
    fetchAssetIfNeeded,
    getNftId,
    isArtwork,
    isArtworkPlaceholder,
    isEmptyPlacholder,
    isKitbash,
    isNft,
    preprocessNftAsset,
} from "../utils";
import {
    currentOpt,
    EditWorldEvent,
    editWorldReducer,
    EditWorldState,
} from "./editWorldReducer";
import { leaseTarget, TargetLease } from "./targetLease";
import { Coords, XYZ } from "@gltypes";
import { ChangeTextOpts } from "@features/studio/services/editor/ChangeTextCommand";
import { usePlacedAssets } from "@components/hooks/usePlacedAssets";
import { fetchEthereumNftOwners } from "@utils/ethereumAssets";
import { useExhibitOwners } from "../AddAsset/shared/useExhibitOwners";
import { useValidatedAccounts } from "@components/hooks/useValidatedAccounts";
import { useWorldHandler } from "@components/_3DExhibit-v2/hooks/useWorldHandler";
import { AssetOption, NftOpt, PortalOpt } from "../AddAsset/shared/AssetTypes";
import { useImmer } from "use-immer";
import {
    deepClone,
    delay,
    eachKey,
    isObject,
    noop,
    isBlobUrl,
} from "@utils/js";
import { showConfirm, showError } from "@components/Dialogs";
import styled from "styled-components";
import ReactPortal from "@components/Snackbar/Portal";
import type { Portal } from "@components/_3DExhibit-v2/three/factory/portal/portal";
import conf from "@components/_3DExhibit-v2/three/utils/params";
import { useContentAssets } from "../AddAsset/Nft/useContentAssets";
import { UseAssetsData } from "@components/hooks/useAssets";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import {
    useEditorService,
    useEditorState,
} from "@features/studio/context/ExhibitEditorContext";
import { Commands } from "@features/studio/services/editor/CommandMap";
import { AddArtworkCommand } from "@features/studio/services/editor/AddArtworkCommand";
import { CHECK_ABORT_SIGNAL, IS_ABORT_ERROR } from "@utils/abort";
import { getMimeType, isUploadable } from "@utils/mimeUtils";
import {
    checkUploadSizeLimit,
    formatUploadedAsset,
    getSWRUploadKey,
    getUploadErrorMsg,
    getUploader,
} from "../AddAsset/Upload/utils";
import { useWorldState } from "@components/_3DExhibit-v2/hooks/useWorldState";
import {
    TransformMode,
    useUserPrefTransformMode,
} from "../hooks/useUserPrefTransformMode";
import type { Component3D } from "@3factory/space/kits/abstract";
import type { SpaceComponent } from "@3factory/abstract/spacecomponent";
import type { PresetData } from "@3factory/space/kits/types";
import { reachedAnonLimits } from "@utils/anon";
import { endPerf, startPerf } from "@utils/perf";
import { getDefaultMimePreview } from "@features/studio/utils";
import { useOnClickOutside } from "@components/hooks/useClickOutside";
import { useScreenSize } from "@components/hooks/useScreenSize";

import { mutate } from "swr";

export type WorldEditScope = "studio" | "uploader";

export interface WorldEditProps {
    children: React.ReactNode;
    setStartLoadingAssets: React.Dispatch<React.SetStateAction<boolean>>;
    scope: WorldEditScope;
}

export type SubmitStep = "fetch" | "3d" | "upload" | "save";

export type SubmittingState = {
    type: "Submitting";
    isSlow?: boolean;
    step: SubmitStep;
};

export type SubmitState =
    | { type: "Idle" }
    | SubmittingState
    | { type: "Success" }
    | { type: "Error"; error: string };

export type NftAddState = {
    state: SubmitState;
    assetId: string;
    targetMeshId: string;
};

export type PortalAddState = {
    state: SubmitState;
    targetExhibitId: string;
    targetMeshId: string;
};

const SLOW_ADDING_TIMEOUT = 3000;

const BIG_MEDIA_SIZE = 25 * 1024 * 1024;

export const FREE_ASSET = "@free-asset";

async function checkOwnerOrCreator(
    asset: FetchedAsset,
    accounts: string[],
    permissionless = false
) {
    //

    // const url = new URL(window.location.href);

    // const permissionValue = url.searchParams.get("permissionless");

    if (permissionless) return true;

    const checkedWallets = {};

    accounts.forEach((it) => {
        checkedWallets[it.toLowerCase()] = true;
    });

    if (asset.owner?.address == null) {
        const result = await fetchEthereumNftOwners(
            asset.contract_address,
            asset.token_id
        );

        if (result.success) {
            asset.owner = result.data[0];
        } else {
            throw new Error("Failed to retreive ownership info", {
                cause: "fetch",
            });
        }
    }

    let wallet = asset.creator?.address;

    if (!checkedWallets[wallet]) {
        wallet = asset.owner?.address;

        if (!checkedWallets[wallet]) {
            throw new Error(
                "To add this asset, the owner or the creator must be set as a co-curator of this space",
                { cause: "auth" }
            );
        }
    }

    return true;
}

const getAssetPayload = (asset, baseEvent = {}) => ({
    ...baseEvent,
    token_id: asset.token_id,
    contract_address: asset.contract_address,
    collection: asset.collection?.name,
    asset_type: asset.mime_type,
    chain: asset.blockchain,
    marketplace: asset.marketplace,
});

function sendAddArtworkAnalyticsEvent(
    baseEvent: object,
    asset: any,
    source: string,
    type: "success" | "error",
    bulk = false
) {
    //
    let event = type === "error" ? "failed_hang_artwork" : "hang_artwork";

    let payload = bulk
        ? { payloads: asset.map((asset) => getAssetPayload(asset, baseEvent)) }
        : getAssetPayload(asset, baseEvent);

    if (bulk) {
        event += "_bulk";
    }

    amplitude_logAnalyticsEvent(event, {
        ...payload,
        source,
    });
}

function sendEditArtworkAnalyticsEvent(data: any, type: "success" | "error") {
    //
    let event = type === "error" ? "failed_edit_asset" : "edit_asset";

    if (data.source == null) {
        data = { ...data, source: "asset_edit" };
    }

    amplitude_logAnalyticsEvent(event, data);
}

async function valdiateAddPostPro(exhibit: Experience, type: string) {
    //
    if (type === "postprocessing") {
        //
        const hasCss = Object.values(exhibit.artworks || {}).some((it) => {
            //
            return it.data.mime_type?.startsWith("embed");
        });

        if (hasCss) {
            //
            const ok = await showConfirm(
                "This will disable all Youtube videos and embedded websites in your space. Are you sure you want to continue?",
                {
                    yes: "Continue",
                    no: "Cancel",
                }
            );

            return ok;
        }
    }

    return true;
}

async function valdiateAddCSSEmbed(exhibit: Experience) {
    //
    if (exhibit.kitbash?.postprocessing?.enabled) {
        //
        //
        const ok = await showConfirm(
            `Youtube Videos and Websites do not work when filters are enabled. Are you sure you want to continue?`,
            {
                yes: "Continue",
                no: "Cancel",
            }
        );

        return ok;
    }

    return true;
}

type LockOpts = {
    [K in keyof LockData]: boolean;
};

type AddAssetSource = "drag" | "click" | "ai";

export interface WorldEditState extends Omit<WorldEditProps, "children"> {
    //
    uiState: EditWorldState;

    uiDispatch: React.Dispatch<EditWorldEvent>;

    selectedItems: SpaceComponent[];

    selectedMesh: SpaceComponent;

    clickRef: React.MutableRefObject<any>;

    addTogglerRef: (id: any, el: any) => void;

    setSelectedItems: (items: SpaceComponent[]) => unknown;

    exhibit: Experience;
    destination: RoomParameters;

    isDraggingAsset: boolean;

    addState: {
        nft: Record<string, NftAddState>;
        portal: Record<string, PortalAddState>;
    };

    editorState: EditorState;

    lockedTargets: Set<SpaceComponent>;

    artworkMessages: Record<string, { message: string; isError: boolean }>;

    placedAssets: Record<string, boolean>;

    setStartLoadingAssets: React.Dispatch<React.SetStateAction<boolean>>;

    assetsData: {
        currentUserAssets: UseAssetsData;
        queriedAssets: UseAssetsData;
        isRemoteQuery: boolean;
        assetsData: UseAssetsData;
        shownAssets: any[];
    };

    setQuery: React.Dispatch<React.SetStateAction<string>>;

    query: string;

    canEditLock: (
        mesh: SpaceItem,
        incoming: Record<keyof LockData, unknown>
    ) => boolean;

    setActiveOpt: (option: AssetOption) => void;

    handleDragStart: (e: DragEvent, mime: string, data: any) => void;

    handleAddNftBulk: (opts: {
        assets: FetchedAsset[];
        keepPlaceholder?: boolean;
        placeholderIds?: string[];
        sharedBy?: string;
        source?: AddAssetSource;
    }) => Promise<boolean>;

    handleAddNft: (opts: {
        asset: FetchedAsset;
        keepPlaceholder?: boolean;
        targetMesh?: SpaceItem;
        source?: AddAssetSource;
        artworkDataProps?: Partial<ArtworkData>;
        autoSelect?: boolean;
        permissionless?: boolean;
    }) => Promise<boolean>;

    handleAddYoutubeEmbed: (opts: {
        asset: FetchedAsset;
        keepPlaceholder?: boolean;
        targetMesh?: SpaceItem;
        source?: AddAssetSource;
        autoSelect?: boolean;
    }) => Promise<boolean>;

    handleAddPortal: (opts: {
        targetExhibit: Experience;
        keepPlaceholder?: boolean;
        targetMesh?: SpaceItem;
        isElevator?: boolean;
        source?: AddAssetSource;
        autoSelect?: boolean;
    }) => Promise<boolean>;

    handleAddText: (
        opts: {
            text: string;
            keepPlaceholder?: boolean;
            targetMesh?: SpaceItem;
            payload?: ArtworkData;
            autoSelect?: boolean;
        },
        on3D: (res: any) => void
    ) => Promise<ArtworkData>;

    handleAddTriggerZone: (opts: {
        type: "sit";
        keepPlaceholder?: boolean;
        targetMesh?: SpaceItem;
        payload?: ArtworkData;
        autoSelect?: boolean;
    }) => Promise<boolean>;

    handleAddGlobalStream: (opts: {
        url: string;
        keepPlaceholder?: boolean;
        targetMesh?: SpaceItem;
        payload?: ArtworkData;
        autoSelect?: boolean;
    }) => Promise<boolean>;

    handleAddUpload: (opts: {
        asset: FetchedAsset;
        keepPlaceholder?: boolean;
        targetMesh?: SpaceItem;
        source?: AddAssetSource | "file";
        autoSelect?: boolean;
    }) => Promise<ArtworkData>;

    handleAddWebsiteEmbed: (opts: {
        asset: FetchedAsset;
        keepPlaceholder?: boolean;
        targetMesh?: SpaceItem;
        source?: AddAssetSource;
        autoSelect?: boolean;
    }) => Promise<boolean>;

    handleDeleteItems: (
        targetMeshIds: string[] | SpaceComponent[],
        analyticData?: any,
        autoSelect?: boolean
    ) => Promise<boolean>;

    handleDeleteSelection: (analyticData?: any) => Promise<boolean>;

    handleRefreshArtwork: (opts: { artworkId?: string }) => Promise<boolean>;

    handleDuplicate: (opts: {
        targetMeshes?: string[] | SpaceComponent[];
        source: string;
        autoSelect?: boolean;
    }) => Promise<boolean>;

    handleChangeTransform: (opts: {
        // Compatibility with old API
        targetMesh?: EditableMesh;
        position?: XYZ;
        rotation?: XYZ;
        scale?: XYZ;
        // New API should use this
        payloads?: Array<{
            targetMesh?: EditableMesh;
            coords?: Coords;
            undo?: Coords;
        }>;
        analytics?: {
            source?: string;
            edited: string[];
        };
    }) => Promise<boolean>;

    handleChangeFrame: (opts: {
        targetMeshes: SpaceArtwork[];
        color: string;
        colors?: string[];
        isRemove?: boolean;
    }) => Promise<boolean>;

    handleChangeCollider: (opts: {
        targetMesh?: SpaceArtwork;
        isCollider: boolean;
    }) => Promise<boolean>;

    handleChangeVideo: (opts: {
        targetMesh?: SpaceArtwork;
        videoPlayback: ArtworkData["videoPlayback"];
    }) => Promise<boolean>;

    handleChangeAudio: (opts: {
        targetMesh?: SpaceArtwork;
        audioType: ArtworkData["audioType"];
        volume: number;
        analytics?: {
            source?: string;
            edited: string[];
        };
    }) => Promise<boolean>;

    handleChangeEnvmap: (opts: {
        targetMesh?: SpaceArtwork;
        envmap: string;
        envmapIntensity: number;
        isRemove?: boolean;
    }) => Promise<boolean>;

    handleChangeAnimations: (opts: {
        targetMesh?: SpaceArtwork;
        animations: Record<string, boolean>;
    }) => Promise<boolean>;

    handleChangeHTMLView: (opts: {
        targetMesh?: SpaceArtwork;
        enableHTMLView: boolean;
    }) => Promise<boolean>;

    handleChangeDimensions: (opts: {
        targetMesh?: SpaceArtwork;
        dimensions: [number, number];
    }) => Promise<boolean>;

    handleChangeLock: (opts: {
        targetMesh?: SpaceItem;
        lock: LockOpts;
    }) => Promise<boolean>;

    handleChangeText: (opts: {
        targetMesh?: SpaceArtwork;
        update: ChangeTextOpts["update"];
    }) => Promise<boolean>;

    handleToggle360: (opts: {
        targetMesh?: SpaceArtwork;
        is360Active: boolean;
    }) => Promise<boolean>;

    handleUpdateArtworkData: (opts: {
        targetMesh?: SpaceArtwork;
        data: Partial<Asset>;
        analytics?: {
            source?: string;
            edited: string[];
        };
    }) => Promise<boolean>;

    handleUpdateCuratorNotes: (opts: {
        targetMesh?: SpaceArtwork;
        curatorNotes: string;
    }) => Promise<boolean>;

    handleUpdateScript: (opts: {
        id: string;
        type: Script["type"];
        script: string;
    }) => Promise<boolean>;

    handleAddKitbash: (opts: {
        ctype?: string;
        kit: string;
        preset?: PresetData;
        payload?: KitBashData;
        targetMesh?: Component3D;
        duplicate?: boolean;
        autoSelect?: boolean;
    }) => Promise<boolean>;

    // handleDeleteKitbash: (opts: { targetIds: string[] }) => Promise<boolean>;

    handleUpdateKitbash: (opts: {
        //
        id: string;
        data: any;
        source?: "gui" | "ai";
    }) => Promise<boolean>;

    handleApplyKit: (opts: {
        kit: { id: string };
        applyStylekit: boolean;
    }) => Promise<boolean>;

    undo: () => Promise<void>;
    redo: () => Promise<void>;

    droppedFile: React.MutableRefObject<File>;

    baseAnalyticsEvent: object;

    transformMode: TransformMode;

    toggleTransformMode: () => Promise<void>;
}

type This = WorldEditState;

type EditorState = ReturnType<ExhibitEditorService["getState"]>;

const WorldEditContext = createContext<WorldEditState>(null);

export function WorldEditProvider({
    children,
    scope,
    setStartLoadingAssets,
}: WorldEditProps) {
    //

    const [uiState, _uiDispatch] = useReducer(editWorldReducer, {
        type: "IDLE",
    });

    const uiDispatch = (event: EditWorldEvent) => {
        //
        console.groupCollapsed(
            "%c EDIT UI EVENT: " + event.type,
            "background: #444; color: #bada55"
        );

        console.log(event);

        console.groupEnd();

        _uiDispatch(event);
    };

    const world = useWorld();

    const worldState = useWorldState();

    const { selectedMesh, selectedItems, setSelectedItems } =
        useWorldSelection();

    const { currentWalletId, currentWalletType, userProfile } =
        useWalletContext();

    const { currentUserStatus } = useAssetsContext();

    const [openSnackbar, closeSnackbar] = useSnackbar({
        position: "top-right",
    });

    const [isDraggingAsset, setIsDraggingAsset] = useState(false);

    const [addState, updateAddState] = useImmer<This["addState"]>({
        nft: {},
        portal: {},
    });

    const { width } = useScreenSize();

    const isMobile = width < 600;

    const [lockedTargets, setLockedTargets] = useState<This["lockedTargets"]>(
        new Set()
    );

    const [artworkMessages, updateArtworksMessges] = useImmer<
        This["artworkMessages"]
    >({});

    const setArtworkMessage = (
        id: string,
        isError: boolean,
        message: string
    ) => {
        //
        updateArtworksMessges((draft) => {
            //
            if (message == null) {
                //
                delete draft[id];
            } else {
                //
                draft[id] = {
                    isError,
                    message,
                };
            }
        });
    };

    const { exhibits, user, token, isAnonymous } = useContext(UserContext);

    const {
        exhibit,
        roles,
        exhibitStore,
        baseAnalyticsEvent,
        destination,
        setDestination,
    } = useCurrentExhibit();

    const [query, setQuery] = useState("");

    const assetsData = useContentAssets(query, exhibit);

    const placedAssets = usePlacedAssets(exhibit);

    const editorService = useEditorService();

    const editorState = useEditorState(editorService);

    const allOwners = useExhibitOwners(exhibit);

    const validAccounts = useValidatedAccounts();

    const currentAbort = useRef<AbortController>(null);

    const [transformMode, toggleTransformMode] = useUserPrefTransformMode();

    const checkOffline = useEventCallback(() => {
        //
        if (!navigator.onLine) {
            openSnackbar(
                "You are offline. Please check your internet connection.",
                DEFAULT_SNACKBAR_DURATION,
                null,
                "error"
            );

            return false;
        }

        return true;
    }, []);

    useWorldHandler(
        Events.EDITOR_DROP,
        (opts: {
            data: any;
            keepPlaceholder: boolean;
            mime: string;
            event: DragEvent;
            target: SpaceItem;
            abort?: () => void;
            permissionless?: boolean;
        }) => {
            //
            if (worldState.mode !== "edit") return;

            if (opts.mime === DRAG_MIMES.NFT) {
                //
                uiDispatch({ type: "opt-on", option: NftOpt });

                handleAddNft({
                    asset: opts.data,
                    keepPlaceholder: opts.keepPlaceholder,
                    targetMesh: opts.target,
                    source: "drag",
                    autoSelect: true,
                    permissionless: opts.permissionless,
                });
                //
            } else if (opts.mime === DRAG_MIMES.YOUTUBE) {
                //
                handleAddYoutubeEmbed({
                    asset: opts.data,
                    keepPlaceholder: opts.keepPlaceholder,
                    targetMesh: opts.target,
                    source: "drag",
                    autoSelect: true,
                });
                //
            } else if (opts.mime === DRAG_MIMES.UPLOAD) {
                //

                if (opts.data.$$dragfile) {
                    //
                    const item = opts.event.dataTransfer.items[0];

                    if (item?.kind === "file") {
                        //
                        const file = item.getAsFile();

                        const ext = handleAddPreUpload(
                            file,
                            opts.target,
                            opts.abort
                        );
                    }
                    //
                } else {
                    handleAddUpload({
                        asset: opts.data,
                        keepPlaceholder: opts.keepPlaceholder,
                        targetMesh: opts.target,
                        source: "drag",
                        autoSelect: true,
                    });
                }
                //
            } else if (opts.mime === DRAG_MIMES.PORTAL) {
                //
                uiDispatch({ type: "opt-on", option: PortalOpt });

                handleAddPortal({
                    targetExhibit: opts.data,
                    keepPlaceholder: opts.keepPlaceholder,
                    targetMesh: opts.target,
                    source: "drag",
                    autoSelect: true,
                });
            } else if (opts.mime === DRAG_MIMES.KITBASH) {
                //
                handleAddKitbash({ ...opts?.data, autoSelect: true });
                //
            }
        }
    );

    useWorldHandler(Events.KITBASH_DUPLICATE, (element: Component3D) => {
        //
        handleDuplicate({
            targetMeshes: [element],
            source: "gui",
            autoSelect: true,
        });
    });

    useWorldHandler(Events.KITBASH_DATA_CHANGED, (opts: any) => {
        //
        if (!opts.isProgress) {
            //
            // console.log("data", e);

            handleUpdateKitbash({
                id: opts.component.data.id,
                data: opts.component.data,
                source: "gui",
            });
        }
    });

    const droppedFile = useRef<File>(null);

    const { addTogglerRef, clickRef } = useOnClickOutside({
        handler,
    });

    function handler() {
        if (isMobile) setActiveOpt(null);
    }

    const handleAddPreUpload = async (file: File, targetMesh, abort = noop) => {
        //
        if (checkOffline() === false) return;

        if (
            isAnonymous &&
            (await reachedAnonLimits({
                uploads: true,
                allUploads: true,
                assets: true,
            }))
        ) {
            //
            abort();

            return;
        }

        let mime: string;
        try {
            mime = getMimeType(file.name);

            if (mime == null || !isUploadable(mime)) {
                //
                throw new Error("mime");
            }

            if (!checkUploadSizeLimit(mime, file.size)) {
                //
                throw new Error("size-limit");
            }

            const url = URL.createObjectURL(file);

            const upload = { url, hash: url, name: file.name, mimeType: mime };

            const asset = await formatUploadedAsset(
                upload,
                currentWalletId,
                userProfile
            );

            asset.__transient = true;

            const initArt = await handleAddUpload({
                asset,
                targetMesh,
                keepPlaceholder: false,
                autoSelect: true,
                source: "file",
            });

            const id = initArt.data.id;

            const uploader = getUploader(isAnonymous);

            let res = await uploader.saveUpload({
                file,
                mime,
                token,
                onProgress: noop,
            });

            if (!res.exists) {
                //
                mutate(getSWRUploadKey(user?.id));
            }

            amplitude_logAnalyticsEvent("upload_custom_asset", {
                ...baseAnalyticsEvent,
                type: mime,
            });

            if (res.exists) {
                console.log(
                    "saveUpload: file ",
                    file.name,
                    "was already uploaded"
                );
            }

            let newAsset = await formatUploadedAsset(
                res,
                currentWalletId,
                userProfile
            );

            let currentArt = exhibitStore.exhibit.artworks[id];

            // Artwork was deleted in the meantime
            if (currentArt) {
                //
                const mime_type = newAsset.mime_type;

                exhibitStore
                    .updateExhibit((ex) => {
                        //
                        const art = ex.artworks[id];

                        art.data.mime_type = newAsset.mime_type;

                        art.data.animation_url = newAsset.animation_url;

                        art.data.image_url = newAsset.image_url;

                        art.data.dcompressed_image_url =
                            newAsset.dcompressed_image_url;

                        art.data.dcompressed_animation_url =
                            newAsset.dcompressed_animation_url;

                        art.data.image_preview_url = newAsset.image_preview_url;

                        art.data.token_id = newAsset.token_id;

                        delete art.data.__transient;
                    })
                    .then(() => {
                        //
                        if (
                            !isAnonymous &&
                            mime_type.startsWith("model/gltf") &&
                            !newAsset.d_optimized_files
                        ) {
                            // optimization for 3D assets
                            uploadAssetMedia({
                                exhibitId: exhibit.id,
                                assetId: id,
                                token,
                            }).then((res) => {
                                //
                                if (
                                    res.success === true &&
                                    res.value.d_optimized_files
                                ) {
                                    //
                                    mutate(getSWRUploadKey(user?.id));
                                }
                            });
                        }
                    });

                exhibitStore.toggleTransientState(id);

                const mediaInfo: any = {
                    mime_type,
                    url: mime_type.startsWith("image")
                        ? newAsset.image_url
                        : newAsset.animation_url,
                };

                world.current.edit({
                    type: EDITION_ACTIONS.EDITOR_UPDATE_ARTWORK_MEDIA,
                    artworkId: id,
                    mediaInfo,
                });
            }
        } catch (err) {
            //
            console.error(err);

            abort();

            const { title, message } = getUploadErrorMsg(err);

            amplitude_logAnalyticsEvent("failed_upload_custom_asset", {
                ...baseAnalyticsEvent,
                type: mime || "",
                error: message,
            });

            showError(message, title);
        }
    };

    const onDragEnter = useEventCallback((e: DragEvent) => {
        //
        if (worldState.mode !== "edit") return;

        e.preventDefault();

        try {
            //

            const item = e.dataTransfer.items?.[0];

            console.log(
                "dragenter",
                e.target,
                e.currentTarget,
                item?.type,
                item,
                "file",
                item?.getAsFile()
            );

            if (e.target !== CANVAS) return;

            if (item?.kind === "file") {
                //
                if (item.type && !isUploadable(item.type)) {
                    //
                    e.dataTransfer.dropEffect = "none";

                    return;
                }

                const previewUrl = item.type
                    ? getDefaultMimePreview(item.type)
                    : null;

                handleDragStart(e as any, DRAG_MIMES.UPLOAD, {
                    previewUrl,
                    asset: {
                        $$dragfile: true,
                        mime_type: item.type,
                    },
                    isFileSystem: true,
                    mime: DRAG_MIMES.UPLOAD,
                });
            }

            // uiDispatch({ type: "opt-off" });
        } catch (err) {
            //
            console.error(err);
        }
    }, []);

    useEffect(() => {
        //
        window.addEventListener("offline", checkOffline);

        document.addEventListener("dragenter", onDragEnter, { capture: true });

        return () => {
            //
            window.removeEventListener("offline", checkOffline);

            document.removeEventListener("dragenter", onDragEnter, {
                capture: true,
            });
        };
    }, []);

    useEffect(() => {
        //
        if (isArtworkPlaceholder(selectedMesh)) {
            //
            amplitude_logAnalyticsEvent(
                "select_placeholder",
                baseAnalyticsEvent
            );
        }
        //
    }, [selectedMesh]);

    const handleDragStart = useEventCallback(
        //
        (event: DragEvent, mime: string, data: any) => {
            //

            const preloadAsset = !data.isFileSystem;

            world.current.edit({
                type: EDITION_ACTIONS.HANDLE_DRAG_START,
                event,
                mime,
                data: {
                    ...data,
                    mime_type: data.asset?.mime_type,
                    preloadAsset,
                },
            });

            event.target.addEventListener("dragend", handleDragEnd, {
                once: true,
            });

            setTimeout(() => {
                setIsDraggingAsset(true);
            });
        },
        []
    );

    const handleDragEnd = useEventCallback((event) => {
        //
        console.log("drag end", event);

        world.current.edit({
            type: EDITION_ACTIONS.HANDLE_DRAG_END,
            event,
        });

        setIsDraggingAsset(false);
    }, []);

    const lockTarget = useEventCallback(
        //
        (mesh: SpaceComponent, isLocked: boolean) => {
            //
            if (mesh == null) return true;

            if (isLocked && editorService.lockedTargets.has(mesh)) {
                //
                console.error("Target mesh is locked");

                return false;
            }

            if (isArtworkPlaceholder(mesh)) {
                //
                mesh.setLoading(isLocked);
            }

            editorService.lockUndo(mesh, isLocked);

            setLockedTargets((set) => {
                //
                if (isLocked) {
                    set.add(mesh);
                } else {
                    set.delete(mesh);
                }

                return new Set(set);
            });

            return true;
        },
        []
    );

    const checkReplaceRights = useEventCallback(
        (targetMesh: SpaceComponent) => {
            if (
                !canReplace(
                    exhibit,
                    targetMesh?.userData as any,
                    validAccounts.concat([user.id])
                )
            ) {
                throw new Error(ACTION_FAIL_MESSAGES.UNAUTHORIZED_REPLACE, {
                    cause: "auth",
                });
            }
        },
        []
    );

    const handleAddNftBulk = useEventCallback<This["handleAddNftBulk"]>(
        async (opts) => {
            //
            let {
                assets,
                placeholderIds,
                keepPlaceholder,
                sharedBy,
                source = "click",
            } = opts;

            let baseEvent = {
                ...baseAnalyticsEvent,
            };

            try {
                closeSnackbar();

                let results = await Promise.all(
                    assets.map(async (asset) => {
                        //
                        return preprocessNftAsset({
                            asset,
                            sharedBy,
                            userId: user.id,
                            walletId: currentWalletId,
                        });
                    })
                );

                const infos = await Promise.all(
                    assets.map((asset) => {
                        return getAssetMediaInfo(asset, true);
                    })
                );

                const artworks = results.map((it) => it.artwork);

                let cmd = editorService.getCommand(Commands.AddArtworkBulk, {
                    artworks,
                    keepPlaceholder,
                    placeholderIds,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendAddArtworkAnalyticsEvent(
                    baseEvent,
                    artworks,
                    source,
                    "success",
                    true
                );

                infos.forEach(async ({ mediaInfo, coverMediaInfo }, index) => {
                    //
                    const placeholderId = placeholderIds[index];

                    await cmd.dbUpdateId(placeholderId);

                    if (
                        mediaInfo.type === "Uploadable" ||
                        coverMediaInfo?.type === "Uploadable"
                    ) {
                        try {
                            // const file = cmd.files[placeholderId];

                            const data = cmd.payloads[placeholderId].data;

                            // if (file && mediaInfo.type === "Uploadable") {
                            //     //
                            //     await uploadAssetMediaFile({
                            //         exhibitId: exhibit.id,
                            //         asset: data,
                            //         file,
                            //         mediaInfo,
                            //         token,
                            //     });
                            // } else {
                            await uploadAssetMedia({
                                exhibitId: exhibit.id,
                                assetId: data.id,
                                token,
                            });
                            // }
                        } catch (error) {
                            //
                            console.error(error);
                        }
                    }
                });

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                if (IS_ABORT_ERROR(err)) {
                    return false;
                }

                sendAddArtworkAnalyticsEvent(
                    baseEvent,
                    assets,
                    source,
                    "error",
                    true
                );

                return false;
                //
            }
        },
        []
    );

    const defReplaceTarget = () => {
        //
        if (selectedMesh && !selectedMesh.isComponent3D) return selectedMesh;

        return null;
    };

    const handleAddNft = useEventCallback<This["handleAddNft"]>(
        async (opts) => {
            //
            let {
                asset: rawAsset,
                keepPlaceholder = false,
                targetMesh = defReplaceTarget(),
                autoSelect,
                source = "click",
                artworkDataProps,
            } = opts;

            let sharedBy = currentWalletId;

            let ts: any = {};

            startPerf(ts, "global");

            let key = getNftId(rawAsset);

            let addingTimeout = setTimeout(() => {
                //
                updateAddState((draft) => {
                    //
                    const ref = draft.nft[key];

                    if (ref.state.type === "Submitting") {
                        //
                        ref.state.isSlow = true;
                    }
                });
            }, SLOW_ADDING_TIMEOUT);

            closeSnackbar();

            let baseEvent = {
                ...baseAnalyticsEvent,
            };

            let lease: TargetLease;

            try {
                // One operation per frame at a time. An add that is turned
                // away must leave the running add's lock, and its abort
                // handle, alone: see targetLease.ts.
                lease = leaseTarget(lockTarget, targetMesh);

                if (!lease.acquired) {
                    //
                    return;
                }

                currentAbort.current = new AbortController();

                updateAddState((draft) => {
                    draft.nft[key] = {
                        state: { type: "Submitting", step: "fetch" },
                        assetId: key,
                        targetMeshId: String(targetMesh?.id),
                    };
                });

                checkReplaceRights(targetMesh);

                if ((rawAsset as any).needsEthRecheck) {
                    //
                    startPerf(ts, "check");

                    await checkOwnerOrCreator(
                        rawAsset,
                        validAccounts.concat(allOwners),
                        opts.permissionless
                    );

                    endPerf(ts, "check");

                    CHECK_ABORT_SIGNAL(currentAbort.current?.signal);
                }

                closeSnackbar();

                checkReplaceRights(targetMesh);

                startPerf(ts, "preprocess");

                const { artwork, mediaInfo, coverMediaInfo, ownership } =
                    await preprocessNftAsset({
                        asset: rawAsset,
                        userId: currentWalletId,
                        walletId: currentWalletId,
                        sharedBy,
                        // abort: currentAbort.current?.signal,
                    });

                endPerf(ts, "preprocess");

                if (
                    mediaInfo.url.includes("ipfs.io/ipfs") ||
                    mediaInfo.size > BIG_MEDIA_SIZE
                ) {
                    clearTimeout(addingTimeout);

                    updateAddState((draft) => {
                        //
                        const ref = draft.nft[key];

                        if (ref.state.type === "Submitting") {
                            //
                            ref.state.isSlow = true;
                        }
                    });
                }

                let isGif =
                    mediaInfo.mime_type === "image/gif" ||
                    (coverMediaInfo?.type === "Uploadable" &&
                        coverMediaInfo?.mime_type === "image/gif");

                let isModel = mediaInfo.mime_type?.startsWith("model/gltf");

                let cmd = editorService.getCommand(Commands.AddArtwork, {
                    artwork,
                    keepPlaceholder,
                    targetMeshId: targetMesh?.userData.id,
                    abort: currentAbort.current?.signal,
                    artworkDataProps: artworkDataProps,
                    autoSelect,
                });

                startPerf(ts, "3d");

                await cmd.run();

                endPerf(ts, "3d");

                currentAbort.current = null;

                editorService.pushCommand(cmd);

                lease.release();

                const assetId = cmd.payload?.data?.id;

                clearTimeout(addingTimeout);

                updateAddState((draft) => {
                    //
                    delete draft.nft[key];
                });

                setArtworkMessage(
                    assetId,
                    false,
                    isGif
                        ? ACTION_MESSAGES.GIF_CONVERTING
                        : isModel
                        ? ACTION_MESSAGES.MODEL_FIXING
                        : ACTION_MESSAGES.COMPRESSING
                );

                endPerf(ts, "global");

                console.log("AddNft/perfs", ts);

                baseEvent["ownership"] = ownership;

                sendAddArtworkAnalyticsEvent(
                    baseEvent,
                    artwork,
                    source,
                    "success"
                );

                await cmd.dbUpdate;

                if (
                    mediaInfo.type === "Uploadable" ||
                    coverMediaInfo?.type === "Uploadable"
                ) {
                    try {
                        // const file = cmd.file;

                        // const data = cmd.payload.data;

                        // if (file && mediaInfo.type === "Uploadable") {
                        //     //
                        //     await uploadAssetMediaFile({
                        //         exhibitId: exhibit.id,
                        //         asset: data,
                        //         file,
                        //         mediaInfo,
                        //         token,
                        //     });
                        // } else {
                        await uploadAssetMedia({
                            exhibitId: exhibit.id,
                            assetId,
                            token,
                        });
                        // }

                        setArtworkMessage(assetId, false, "Done!");

                        setTimeout(() => {
                            setArtworkMessage(assetId, false, null);

                            //
                        }, SNACKBAR_DURATION);
                    } catch (error) {
                        //
                        console.error(error);

                        setArtworkMessage(
                            assetId,
                            true,
                            isGif
                                ? ACTION_FAIL_MESSAGES.GIF_CONVERSION
                                : ACTION_FAIL_MESSAGES.COMPRESSION
                        );
                    }
                }

                // console.log(ts);

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                if (IS_ABORT_ERROR(err)) {
                    // Cancelled (undo during the add): a choice, not a
                    // failure, so the tile just goes back to how it was.
                    // Left as "Submitting", it kept its spinner and ignored
                    // clicks until the panel was reopened.
                    updateAddState((draft) => {
                        delete draft.nft[key];
                    });

                    return false;
                }

                sendAddArtworkAnalyticsEvent(
                    baseEvent,
                    rawAsset,
                    source,
                    "error"
                );

                const isRaceError = err.message === "race_error";

                let msg = isRaceError
                    ? ACTION_FAIL_MESSAGES.PLACEHOLDER_IN_USE
                    : err.message || ACTION_FAIL_MESSAGES.ADD;

                updateAddState((draft) => {
                    //
                    if (!draft.nft[key]) return;

                    draft.nft[key].state = { type: "Error", error: msg };
                });

                openSnackbar(msg, SNACKBAR_DURATION, null, "error");

                return false;
                //
            } finally {
                clearTimeout(addingTimeout);

                // A no-op for an add that was turned away, and for one that
                // already unlocked when its artwork reached the scene.
                lease?.release();
            }
        },
        []
    );

    const handleAddYoutubeEmbed = useEventCallback<
        This["handleAddYoutubeEmbed"]
    >(async (opts) => {
        //
        if (isAnonymous && (await reachedAnonLimits({ assets: true }))) return;

        if (!(await valdiateAddCSSEmbed(exhibit))) return;

        const {
            asset,
            keepPlaceholder = false,
            targetMesh = defReplaceTarget(),
            source = "click",
            autoSelect,
        } = opts;

        closeSnackbar();

        let lease: TargetLease;

        try {
            checkReplaceRights(targetMesh);

            lease = leaseTarget(lockTarget, targetMesh);

            if (!lease.acquired) {
                //
                return;
            }

            let cmd = editorService.getCommand(Commands.AddArtwork, {
                artwork: {
                    ...asset,
                    addedBy: user.id.toLowerCase(),
                },
                keepPlaceholder,
                targetMeshId: targetMesh?.userData.id,
                autoSelect,
            });

            await cmd.run();

            editorService.pushCommand(cmd);

            sendAddArtworkAnalyticsEvent(
                baseAnalyticsEvent,
                asset,
                source,
                "success"
            );

            return true;
            //
        } catch (err) {
            //
            console.error(err);

            sendAddArtworkAnalyticsEvent(
                baseAnalyticsEvent,
                asset,
                source,
                "error"
            );

            openSnackbar(
                "Failed to add Youtube video",
                DEFAULT_SNACKBAR_DURATION,
                null,
                "error"
            );

            return false;
        } finally {
            //
            lease?.release();
        }
    }, []);

    const handleAddPortal = useEventCallback<This["handleAddPortal"]>(
        async (opts) => {
            //
            if (
                isAnonymous &&
                (await reachedAnonLimits({ assets: true, portals: true }))
            )
                return;

            const {
                targetExhibit,
                keepPlaceholder = false,
                targetMesh = defReplaceTarget(),
                isElevator = false,
                source = "click",
                autoSelect,
            } = opts;

            let key = targetExhibit.id;

            const updateSubmitState = (state: Partial<SubmittingState>) => {
                //
                updateAddState((draft) => {
                    //
                    const ref = draft.portal[key];

                    if (ref?.state.type === "Submitting") {
                        //
                        ref.state = {
                            ...ref.state,
                            ...state,
                        };
                    }
                });
            };

            let addingTimeout = setTimeout(() => {
                //
                updateSubmitState({ isSlow: true });
                //
            }, SLOW_ADDING_TIMEOUT);

            const analyticsPayload = {
                ...baseAnalyticsEvent,
                target_exhibit_id: targetExhibit?.id,
                reuse_placeholder: keepPlaceholder,
                target_exhibit_destination: targetExhibit?.info?.room,
                target_exhibit_owner: targetExhibit?.owner,
                target_exhibit_headline: targetExhibit?.info?.headline,
                is_owner:
                    targetExhibit?.owner?.toLowerCase?.() ===
                    user?.id?.toLowerCase?.(),
                isElevator,
                source,
            };

            let lease: TargetLease;

            //
            try {
                lease = leaseTarget(lockTarget, targetMesh);

                if (!lease.acquired) {
                    //
                    return;
                }

                checkReplaceRights(targetMesh);

                updateAddState((draft) => {
                    draft.portal[key] = {
                        state: { type: "Submitting", step: "fetch" },
                        targetExhibitId: targetExhibit.id,
                        targetMeshId: String(targetMesh?.userData.id),
                    };
                });

                closeSnackbar();

                let cmd = editorService.getCommand(Commands.SetPortal, {
                    targetExhibit,
                    targetMeshId: targetMesh?.userData.id,
                    keepPlaceholder,
                    isElevator,
                    autoSelect,
                });

                cmd.once("3d", () => {
                    //
                    clearTimeout(addingTimeout);

                    updateSubmitState({
                        step: "upload",
                    });
                });

                cmd.once("upload", () => {
                    //
                    clearTimeout(addingTimeout);

                    updateSubmitState({
                        step: "save",
                    });
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                amplitude_logAnalyticsEvent("add_portal", analyticsPayload);

                updateAddState((draft) => {
                    //
                    delete draft.portal[key];
                });

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                updateAddState((draft) => {
                    //
                    if (!draft.portal[key]) return;

                    draft.portal[key].state = {
                        type: "Error",
                        error: err.message,
                    };
                });

                openSnackbar(
                    err.message,
                    DEFAULT_SNACKBAR_DURATION,
                    null,
                    "error"
                );

                amplitude_logAnalyticsEvent(
                    "failed_add_portal",
                    analyticsPayload
                );

                return false;
                //
            } finally {
                //
                clearTimeout(addingTimeout);

                lease?.release();
            }
        },
        []
    );

    const handleAddText = useEventCallback<This["handleAddText"]>(
        //
        async (opts, on3D) => {
            //
            if (isAnonymous && (await reachedAnonLimits({ assets: true })))
                return;

            const {
                text,
                keepPlaceholder = false,
                targetMesh = defReplaceTarget(),
                autoSelect,
            } = opts;

            const artwork = {
                mime_type: "cyber/text",
                text,
                addedBy: user.id.toLocaleLowerCase(),
            } as any;

            let lease: TargetLease;

            try {
                // const artwork =  as any;

                lease = leaseTarget(lockTarget, targetMesh);

                if (!lease.acquired) {
                    //
                    return;
                }

                let cmd = editorService.getCommand(Commands.AddArtwork, {
                    artwork,
                    keepPlaceholder:
                        keepPlaceholder || !isArtworkPlaceholder(targetMesh),
                    targetMeshId: targetMesh?.userData.id,
                    autoSelect,
                });

                cmd.once("3d", on3D);

                await cmd.run();

                editorService.pushCommand(cmd);

                return cmd.payload;
                //
            } catch (err) {
                console.error(err);

                sendAddArtworkAnalyticsEvent(
                    baseAnalyticsEvent,
                    artwork,
                    "click",
                    "error"
                );

                openSnackbar(
                    ACTION_FAIL_MESSAGES.ADD,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return null;
            } finally {
                //
                lease?.release();
            }
        },
        []
    );

    const handleAddTriggerZone = useEventCallback<This["handleAddTriggerZone"]>(
        async (opts) => {
            //
            if (isAnonymous && (await reachedAnonLimits({ assets: true })))
                return;

            const {
                type,
                keepPlaceholder = false,
                targetMesh = defReplaceTarget(),
                autoSelect,
            } = opts;

            const artwork = {
                mime_type: "cyber/triggerzone",
                type,
                addedBy: user.id.toLocaleLowerCase(),
            } as any;

            let lease: TargetLease;

            try {
                lease = leaseTarget(lockTarget, targetMesh);

                if (!lease.acquired) {
                    //
                    return;
                }

                let cmd = editorService.getCommand(Commands.AddArtwork, {
                    artwork,
                    keepPlaceholder:
                        keepPlaceholder || !isArtworkPlaceholder(targetMesh),
                    targetMeshId: targetMesh?.userData.id,
                    autoSelect,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendAddArtworkAnalyticsEvent(
                    baseAnalyticsEvent,
                    type,
                    "click",
                    "success"
                );

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                sendAddArtworkAnalyticsEvent(
                    baseAnalyticsEvent,
                    type,
                    "click",
                    "error"
                );

                openSnackbar(
                    "Failed to add website frame",
                    DEFAULT_SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            } finally {
                //
                lease?.release();
            }
        },
        []
    );

    const handleAddGlobalStream = useEventCallback<
        This["handleAddGlobalStream"]
    >(async (opts) => {
        //
        if (isAnonymous && (await reachedAnonLimits({ assets: true }))) return;

        const {
            url,
            keepPlaceholder = false,
            targetMesh = defReplaceTarget(),
            autoSelect,
        } = opts;

        const artwork = {
            mime_type: "cyber/globalstream",
            url,
            addedBy: user.id.toLocaleLowerCase(),
        } as any;

        let lease: TargetLease;

        try {
            lease = leaseTarget(lockTarget, targetMesh);

            if (!lease.acquired) {
                //
                return;
            }

            let cmd = editorService.getCommand(Commands.AddArtwork, {
                artwork,
                keepPlaceholder:
                    keepPlaceholder || !isArtworkPlaceholder(targetMesh),
                targetMeshId: targetMesh?.userData.id,
                autoSelect,
            });

            await cmd.run();

            editorService.pushCommand(cmd);

            sendAddArtworkAnalyticsEvent(
                baseAnalyticsEvent,
                url,
                "click",
                "success"
            );

            return true;
            //
        } catch (err) {
            //
            console.error(err);

            sendAddArtworkAnalyticsEvent(
                baseAnalyticsEvent,
                url,
                "click",
                "error"
            );

            openSnackbar(
                "Failed to add website frame",
                DEFAULT_SNACKBAR_DURATION,
                null,
                "error"
            );

            return false;
        } finally {
            //
            lease?.release();
        }
    }, []);

    const handleAddUpload = useEventCallback<This["handleAddUpload"]>(
        async (opts) => {
            //
            // upload limit is checked before this call (cf UploadContent, handleAddPreUpload)
            if (isAnonymous && (await reachedAnonLimits({ assets: true })))
                return;

            let {
                asset,
                keepPlaceholder = false,
                targetMesh = defReplaceTarget(),
                source = "click",
                autoSelect,
            } = opts;
            //
            closeSnackbar();

            const baseEvent = baseAnalyticsEvent;

            let lease: TargetLease;

            try {
                //

                lease = leaseTarget(lockTarget, targetMesh);

                if (!lease.acquired) {
                    //
                    return;
                }

                let cmd = editorService.getCommand(Commands.AddArtwork, {
                    artwork: {
                        ...asset,
                        addedBy: user.id.toLowerCase(),
                    },
                    keepPlaceholder,
                    targetMeshId: targetMesh?.userData.id,
                    autoSelect,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendAddArtworkAnalyticsEvent(
                    baseEvent,
                    asset,
                    source,
                    "success"
                );

                if (
                    !isAnonymous &&
                    !asset.__transient &&
                    asset.mime_type.startsWith("model/gltf") &&
                    !isBlobUrl(asset.animation_url) &&
                    asset.d_optimized_files == null
                ) {
                    //
                    cmd.dbUpdate.then(() => {
                        //
                        uploadAssetMedia({
                            exhibitId: exhibit.id,
                            assetId: cmd.payload.data.id,
                            token,
                        }).then((res) => {
                            //

                            if (
                                res.success === true &&
                                res.value.d_optimized_files
                            ) {
                                //
                                mutate(getSWRUploadKey(user?.id));
                            }
                        });
                    });
                }

                return cmd.payload;
                //
            } catch (err) {
                //
                console.error(err);

                sendAddArtworkAnalyticsEvent(baseEvent, asset, source, "error");

                openSnackbar(
                    "Failed to add website frame",
                    DEFAULT_SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return null;
            } finally {
                //
                lease?.release();
            }
        },
        []
    );

    const handleAddWebsiteEmbed = useEventCallback<
        This["handleAddWebsiteEmbed"]
    >(async (opts) => {
        //
        if (isAnonymous && (await reachedAnonLimits({ assets: true }))) return;

        if (!(await valdiateAddCSSEmbed(exhibit))) return;

        const {
            asset,
            keepPlaceholder = false,
            targetMesh = defReplaceTarget(),
            source = "click",
            autoSelect,
        } = opts;
        //
        closeSnackbar();

        const baseEvent = {
            ...baseAnalyticsEvent,
            websiteName: asset?.name,
            websiteUrl: asset.animation_url,
        };

        let lease: TargetLease;

        try {
            //
            lease = leaseTarget(lockTarget, targetMesh);

            if (!lease.acquired) {
                //
                return;
            }

            let cmd = editorService.getCommand(Commands.AddArtwork, {
                artwork: { ...asset, addedBy: user.id.toLowerCase() },
                keepPlaceholder,
                targetMeshId: targetMesh?.userData.id,
                autoSelect,
            });

            await cmd.run();

            editorService.pushCommand(cmd);

            sendAddArtworkAnalyticsEvent(baseEvent, asset, source, "success");

            return true;
            //
        } catch (err) {
            //
            console.error(err);

            sendAddArtworkAnalyticsEvent(baseEvent, asset, source, "error");

            openSnackbar(
                "Failed to add website frame",
                DEFAULT_SNACKBAR_DURATION,
                null,
                "error"
            );

            return false;
        } finally {
            //
            lease?.release();
        }
    }, []);

    const handleDeleteItems = useEventCallback<This["handleDeleteItems"]>(
        //
        async (targetMeshesOrIds, analyticData, autoSelect) => {
            //
            // @ts-ignore
            let targetMeshes: SpaceComponent[] =
                typeof targetMeshesOrIds[0] == "string"
                    ? targetMeshesOrIds.map((id) => {
                          //
                          const item: SpaceComponent =
                              world.current.getItem(id) ??
                              world.current.getComponentById(id);

                          if (item == null) {
                              throw new Error("Artwork not found " + id);
                          }

                          return item;
                      })
                    : targetMeshesOrIds;

            if (
                targetMeshes.some((mesh) => {
                    //
                    return isEmptyPlacholder(mesh);
                    //
                })
            )
                return;

            targetMeshes = targetMeshes.filter((mesh) => {
                //
                return (
                    (mesh.isArtwork && !mesh.isPlaceholder) ||
                    mesh.isPortal ||
                    (mesh.isComponent3D && !(mesh as any).isRequired)
                );
            });

            closeSnackbar();

            const exhibitMetadata =
                Object.values(exhibits || {}).find((_exhibit) => {
                    return _exhibit.id === exhibit.id;
                }) || {};

            if (
                !exhibitMetadata.isAdminCurator &&
                exhibit.owner !== user.id &&
                targetMeshes.some((mesh) => {
                    mesh?.userData?.addedBy &&
                        mesh?.userData?.addedBy.toLowerCase() !==
                            user.id.toLowerCase();
                })
            ) {
                openSnackbar(
                    ACTION_FAIL_MESSAGES.UNAUTHORIZED_REPLACE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );
                return;
            }

            try {
                //
                let targetMeshIds = targetMeshes.map(
                    (mesh) => mesh?.userData?.id
                );

                const cmd = editorService.getCommand(Commands.RemoveItems, {
                    targetMeshIds,
                    autoSelect,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                amplitude_logAnalyticsEvent("remove_items", {
                    ...baseAnalyticsEvent,
                    mesh_ids: targetMeshIds,
                    types: targetMeshes.map((mesh) => {
                        //
                        if (mesh.isComponent3D)
                            return "comoponent " + mesh.userData.type;
                        if (mesh.isArtwork)
                            return "artwork " + mesh.userData.mime_type;
                        if (mesh.isPortal)
                            return "portal " + mesh.userData.exhibitId;
                    }),
                    chain: targetMeshes.map(
                        (mesh) => mesh?.userData?.blockchain
                    ),
                    marketplace: targetMeshes.map(
                        (mesh) => mesh?.userData?.marketplace
                    ),
                    ...analyticData,
                });

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                openSnackbar(
                    ACTION_FAIL_MESSAGES.DELETE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            }
        },
        []
    );

    const handleDeleteSelection = useEventCallback<
        This["handleDeleteSelection"]
    >((analyticData) => {
        //
        return handleDeleteItems(selectedItems, analyticData, true);
    }, []);

    const handleRefreshArtwork = useEventCallback<This["handleRefreshArtwork"]>(
        async ({ artworkId = selectedMesh?.userData?.id }) => {
            //

            let artwork = exhibit.artworks[artworkId];

            if (artwork == null) {
                throw new Error("Can't find artwork " + artworkId);
            }

            let currentData = artwork.data;

            if (!isNft(currentData)) {
                console.error("Not an nft", currentData);
                return false;
            }

            closeSnackbar();

            if (
                !canReplace(
                    exhibit,
                    currentData,
                    validAccounts.concat([user.id])
                )
            ) {
                openSnackbar(
                    ACTION_FAIL_MESSAGES.UNAUTHORIZED_REPLACE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );
                return;
            }

            try {
                //
                amplitude_logAnalyticsEvent("refresh_asset", {
                    token_id: currentData?.token_id,
                    contract_address: currentData?.contract_address,
                    collection: currentData?.collection?.name,
                    asset_type: currentData?.mime_type,
                    chain: currentData?.blockchain,
                });

                // Do the refresh
                // 1- fetch latest metadata
                let asset: FetchedAsset;
                const { success, asset: freshAsset } = await fetchAssetById(
                    currentData.owner.address || currentData.contract_address,
                    currentData.contract_address,
                    currentData.token_id,
                    currentData.marketplace,
                    currentData?.customData
                );
                if (!success) {
                    throw new Error("Failed to fetch asset metdata");
                }
                asset = formatAsset(freshAsset);
                // polygon assets do not have owner field, so we reuse
                // the one we already have
                asset.owner = currentData.owner;
                asset.creator = currentData.creator;

                console.log("[ REFRESH GET CLOUDINARY MEDIA INFO ]");

                // 2- update clouadinary
                const { mediaInfo, coverMediaInfo } = await getAssetMediaInfo(
                    asset,
                    true
                );

                // if svg or model unsupported etc
                if (
                    mediaInfo.type === "Unsupported" ||
                    mediaInfo.type === "NoTypeInfo"
                ) {
                    throw new Error(
                        "Format not supported. We currently support images, videos and GLTF/GLB 3D models."
                    );
                }

                asset = {
                    ...asset,
                    [mediaInfo.urlField]: mediaInfo.url,
                    mime_type: mediaInfo.mime_type,
                };

                if (
                    coverMediaInfo &&
                    coverMediaInfo.type !== "NoTypeInfo" &&
                    coverMediaInfo.type !== "Unsupported"
                ) {
                    asset.image_url = coverMediaInfo.url;
                    asset.cover_mime_type = coverMediaInfo.mime_type;
                }

                const cmd = editorService.getCommand(Commands.RefreshArtwork, {
                    artwork: asset,
                    artworkId,
                });

                await cmd.run();

                if (mediaInfo.type === "Uploadable") {
                    //
                    await cmd.dbUpdate;

                    let isGif =
                        mediaInfo.mime_type === "image/gif" ||
                        (coverMediaInfo?.type === "Uploadable" &&
                            coverMediaInfo?.mime_type === "image/gif");

                    let isModel = mediaInfo.mime_type?.startsWith("model/gltf");

                    try {
                        setArtworkMessage(
                            artworkId,
                            false,
                            isGif
                                ? ACTION_MESSAGES.GIF_CONVERTING
                                : isModel
                                ? ACTION_MESSAGES.MODEL_FIXING
                                : ACTION_MESSAGES.COMPRESSING
                        );

                        console.log("[ REFRESH UPLOAD TO CLOUDINARY ]");

                        const file = cmd.file;

                        const asset = cmd.data;

                        if (file && mediaInfo.type === "Uploadable") {
                            await uploadAssetMediaFile({
                                exhibitId: exhibit.id,
                                asset,
                                file,
                                mediaInfo,
                                token,
                            });
                        } else {
                            await uploadAssetMedia({
                                exhibitId: exhibit.id,
                                assetId: artworkId,
                                token,
                            });
                        }

                        setArtworkMessage(artworkId, false, "Done!");
                        setTimeout(() => {
                            setArtworkMessage(artworkId, false, null);
                        }, SNACKBAR_DURATION);
                    } catch (error) {
                        //
                        console.error(error);
                        //
                        setArtworkMessage(
                            artworkId,
                            true,
                            isGif
                                ? ACTION_FAIL_MESSAGES.GIF_CONVERSION
                                : ACTION_FAIL_MESSAGES.COMPRESSION
                        );
                    }
                }

                // openSnackbar(
                //     ACTION_SUCCESS_MESSAGES.UPDATE,
                //     SNACKBAR_DURATION,
                //     null,
                //     "success"
                // );

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                openSnackbar(
                    ACTION_FAIL_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            }
        },
        []
    );

    const handleDuplicate = useEventCallback<This["handleDuplicate"]>(
        async ({ targetMeshes: targetMeshesOrIds, source, autoSelect }) => {
            //
            if (isAnonymous && (await reachedAnonLimits({ assets: true })))
                return;

            let targetMeshes: SpaceComponent[] =
                typeof targetMeshesOrIds[0] == "string"
                    ? targetMeshesOrIds.map((id) => {
                          //
                          const item: SpaceComponent =
                              world.current.getItem(id) ??
                              world.current.getComponentById(id);

                          if (item == null) {
                              throw new Error("Artwork not found " + id);
                          }

                          return item;
                      })
                    : (targetMeshesOrIds as SpaceComponent[]);

            targetMeshes = targetMeshes.filter((mesh) => {
                //
                return (
                    (mesh.isArtwork && !mesh.isPlaceholder) || mesh.isKitBash
                );
            });

            //
            let targetMeshIds = targetMeshes.map((mesh) => mesh?.userData?.id);

            try {
                //

                let cmd = editorService.getCommand(Commands.DuplicateItems, {
                    targetMeshIds,
                    autoSelect,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                amplitude_logAnalyticsEvent("duplicate_items", {
                    ...baseAnalyticsEvent,
                    meshIds: targetMeshIds,
                    source,
                });

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                amplitude_logAnalyticsEvent("duplicate_items_failed", {
                    ...baseAnalyticsEvent,
                    meshIds: targetMeshIds,
                    source,
                });

                openSnackbar(
                    "Failed to duplicate",
                    DEFAULT_SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return null;
            }
        },
        []
    );

    const handleChangeTransform = useEventCallback<
        This["handleChangeTransform"]
    >(
        //
        async (opts) => {
            //
            const event = {
                ...baseAnalyticsEvent,
                ...opts.analytics,
            };

            try {
                closeSnackbar();

                let payloads = opts.payloads ?? [
                    {
                        targetMesh: opts.targetMesh ?? selectedMesh,
                        coords: {
                            position: opts.position,
                            rotation: opts.rotation,
                            scale: opts.scale,
                        } as Coords,
                    },
                ];

                let updates = payloads.map((it) => {
                    //
                    return {
                        id: it.targetMesh.userData.id,
                        coords: it.coords,
                        undo: it.undo,
                    };
                });

                const cmd = editorService.getCommand(Commands.ChangeTransform, {
                    updates,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendEditArtworkAnalyticsEvent(event, "success");

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                sendEditArtworkAnalyticsEvent(event, "error");

                openSnackbar(
                    ACTION_SUCCESS_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "success"
                );

                return false;
            }
        },
        []
    );

    const handleChangeFrame = useEventCallback<This["handleChangeFrame"]>(
        //
        async ({ targetMeshes = [selectedMesh], color, colors }) => {
            //
            const event = {
                ...baseAnalyticsEvent,
                edited: ["border"],
                ...getAssetPayload(targetMeshes[0].userData),
            };

            try {
                closeSnackbar();

                const cmd = editorService.getCommand(Commands.ChangeFrame, {
                    targetMeshIds: targetMeshes.map((mesh) => mesh.userData.id),
                    color,
                    colors,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendEditArtworkAnalyticsEvent(event, "success");

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                sendEditArtworkAnalyticsEvent(event, "error");

                openSnackbar(
                    ACTION_SUCCESS_MESSAGES.CHANGE_BORDER_COLOR,
                    SNACKBAR_DURATION,
                    null,
                    "success"
                );

                return false;
            }
        },
        []
    );

    const handleChangeHTMLView = useEventCallback<This["handleChangeHTMLView"]>(
        //
        async ({ targetMesh = selectedMesh, enableHTMLView }) => {
            const event = {
                ...baseAnalyticsEvent,
                edited: ["enableHTMLView"],
                ...getAssetPayload(targetMesh.userData),
            };

            try {
                //
                closeSnackbar();

                const cmd = editorService.getCommand(Commands.ChangeHTML, {
                    targetMeshId: targetMesh.userData.id,
                    enableHTMLView,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendEditArtworkAnalyticsEvent(event, "success");

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                sendEditArtworkAnalyticsEvent(event, "error");

                openSnackbar(
                    ACTION_FAIL_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            }
        },
        []
    );

    const handleChangeDimensions = useEventCallback<
        This["handleChangeDimensions"]
    >(
        //
        async ({ targetMesh = selectedMesh, dimensions }) => {
            //
            const event = {
                ...baseAnalyticsEvent,
                edited: ["dimensions"],
                ...getAssetPayload(targetMesh.userData),
            };

            try {
                //
                closeSnackbar();

                const cmd = editorService.getCommand(
                    Commands.ChangeDimensions,
                    {
                        targetMeshId: targetMesh.userData.id,
                        dimensions,
                    }
                );

                await cmd.run();

                editorService.pushCommand(cmd);

                sendEditArtworkAnalyticsEvent(event, "success");

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                sendEditArtworkAnalyticsEvent(event, "error");

                openSnackbar(
                    ACTION_SUCCESS_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "success"
                );

                return false;
            }
        },
        []
    );

    const handleChangeLock = useEventCallback<This["handleChangeLock"]>(
        //
        async ({ targetMesh = selectedMesh, lock: lockOpts }) => {
            //
            const event = {
                ...baseAnalyticsEvent,
                edited: ["lock"],
                ...getAssetPayload(targetMesh.userData),
            };

            let lock = {
                ...targetMesh.userData.lock,
                ...eachKey(lockOpts, (value) => ({ value, lockedBy: user.id })),
            };

            try {
                //
                closeSnackbar();

                if (
                    !canChangeLock(
                        targetMesh?.userData.lock,
                        lock,
                        user.id,
                        roles
                    )
                ) {
                    throw new Error(
                        ACTION_FAIL_MESSAGES.UNAUTHORIZED_LOCK_CHANGE,
                        {
                            cause: "auth",
                        }
                    );
                }

                // If we uncomment this, it means that anybody can place back a lock
                // after it was removed by a higher role like owner
                // for (let key in lock) {
                //     if (!lock[key].value) {
                //         delete lock[key];
                //     }
                // }

                const cmd = editorService.getCommand(Commands.ChangeLock, {
                    targetMeshId: targetMesh.userData.id,
                    lock,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendEditArtworkAnalyticsEvent(event, "success");

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                sendEditArtworkAnalyticsEvent(event, "error");

                openSnackbar(err.message, SNACKBAR_DURATION, null, "error");

                return false;
            }
        },
        []
    );

    const handleChangeText = useEventCallback<This["handleChangeText"]>(
        //
        async ({ targetMesh = selectedMesh, update }) => {
            //
            const sendEvent = (type) => {
                //
                sendEditArtworkAnalyticsEvent(
                    {
                        ...baseAnalyticsEvent,
                        edited: ["update_cyber_text"],
                        ...getAssetPayload(targetMesh.userData),
                    },
                    "success"
                );
            };

            try {
                //
                closeSnackbar();

                const cmd = editorService.getCommand(Commands.ChangeText, {
                    targetMeshId: targetMesh.userData.id,
                    update,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendEvent("success");

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                sendEvent("error");

                openSnackbar(
                    ACTION_SUCCESS_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "success"
                );

                return false;
            }
        },
        []
    );

    const handleChangeVideo = useEventCallback<This["handleChangeVideo"]>(
        async ({ targetMesh = selectedMesh, videoPlayback }) => {
            //

            const event = {
                ...baseAnalyticsEvent,
                edited: ["videoPlayback"],
                ...getAssetPayload(targetMesh.userData),
            };

            try {
                closeSnackbar();

                const cmd = editorService.getCommand(Commands.ChangeVideo, {
                    targetMeshId: targetMesh.userData.id,
                    videoPlayback,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendEditArtworkAnalyticsEvent(event, "success");

                return true;
            } catch (err) {
                //
                console.error(err);

                sendEditArtworkAnalyticsEvent(event, "error");

                openSnackbar(
                    ACTION_FAIL_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            }
        },
        []
    );

    const handleChangeAudio = useEventCallback<This["handleChangeAudio"]>(
        async ({ targetMesh = selectedMesh, audioType, volume, analytics }) => {
            //
            const event = {
                ...baseAnalyticsEvent,
                ...analytics,
                ...getAssetPayload(targetMesh.userData),
            };

            try {
                closeSnackbar();

                const cmd = editorService.getCommand(Commands.ChangeAudio, {
                    targetMeshId: targetMesh.userData.id,
                    audioType,
                    volume,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendEditArtworkAnalyticsEvent(event, "success");

                return true;
            } catch (err) {
                //
                console.error(err);

                sendEditArtworkAnalyticsEvent(event, "error");

                openSnackbar(
                    ACTION_FAIL_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            }
        },
        []
    );

    const handleChangeCollider = useEventCallback<This["handleChangeCollider"]>(
        async ({ targetMesh = selectedMesh, isCollider }) => {
            const event = {
                ...baseAnalyticsEvent,
                edited: ["isCollider"],
                ...getAssetPayload(targetMesh.userData),
            };

            try {
                closeSnackbar();

                const cmd = editorService.getCommand(Commands.ChangeCollider, {
                    targetMeshId: targetMesh.userData.id,
                    isCollider,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendEditArtworkAnalyticsEvent(event, "success");

                return true;
            } catch (err) {
                //
                console.error(err);

                sendEditArtworkAnalyticsEvent(event, "error");

                openSnackbar(
                    ACTION_FAIL_MESSAGES.CHANGE_COLLIDER,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            }
        },
        []
    );

    const handleChangeEnvmap = useEventCallback<This["handleChangeEnvmap"]>(
        async ({ targetMesh = selectedMesh, envmap, envmapIntensity }) => {
            //

            const event = {
                ...baseAnalyticsEvent,
                edited: ["envmap", "envmapIntensity"],
                ...getAssetPayload(targetMesh.userData),
            };

            try {
                closeSnackbar();

                const cmd = editorService.getCommand(Commands.ChangeEnvmap, {
                    targetMeshId: targetMesh.userData.id,
                    envmap,
                    envmapIntensity,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendEditArtworkAnalyticsEvent(event, "success");

                return true;
            } catch (err) {
                //
                console.error(err);

                sendEditArtworkAnalyticsEvent(event, "error");

                openSnackbar(
                    ACTION_FAIL_MESSAGES.CHANGED_MODEL_ENVMAP,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            }
        },
        []
    );

    const handleChangeAnimations = useEventCallback<
        This["handleChangeAnimations"]
    >(async ({ targetMesh = selectedMesh, animations }) => {
        //

        const event = {
            ...baseAnalyticsEvent,
            edited: ["animations"],
            ...getAssetPayload(targetMesh.userData),
        };

        try {
            closeSnackbar();

            const cmd = editorService.getCommand(Commands.ChangeAnimations, {
                targetMeshId: targetMesh.userData.id,
                animations,
            });

            await cmd.run();

            editorService.pushCommand(cmd);

            sendEditArtworkAnalyticsEvent(event, "success");

            return true;
        } catch (err) {
            //
            console.error(err);

            sendEditArtworkAnalyticsEvent(event, "error");

            openSnackbar(
                ACTION_FAIL_MESSAGES.CHANGED_MODEL_ENVMAP,
                SNACKBAR_DURATION,
                null,
                "error"
            );

            return false;
        }
    }, []);

    const handleToggle360 = useEventCallback<This["handleToggle360"]>(
        async ({ targetMesh = selectedMesh, is360Active }) => {
            //

            const event = {
                ...baseAnalyticsEvent,
                edited: ["is360Active"],
                ...getAssetPayload(targetMesh.userData),
            };

            let currentData = targetMesh.userData as any;

            let item = deepClone(exhibit.artworks[currentData.id]);

            const {
                position,
                rotation,
                scale,
                data: actualData,
                ...props
            } = item;

            if (
                item.data.token_address ===
                    "0x250ff17091c3c8beddc32c6ce66f2e896c07acb7" &&
                is360Active
            ) {
                closeSnackbar();

                try {
                    const response = await fetch(item.data.token_metadata);

                    const data = await response.json();

                    targetMesh.userData.image_original_url = data.for_oculus;

                    actualData.image_original_url = data.for_oculus;

                    actualData.animation_url = "";

                    item.data.mime_type = "image/jpeg";
                    //
                } catch (err) {
                    //
                    console.error(err);

                    openSnackbar(
                        "Failed to load 360 metadata",
                        DEFAULT_SNACKBAR_DURATION,
                        null,
                        "error"
                    );
                }
            }

            try {
                if (is360Active) {
                    actualData.prev_mime_type = actualData.mime_type;
                    actualData.mime_type = "panorama/jpg";
                } else {
                    actualData.mime_type = actualData.prev_mime_type;
                }

                const cmd = editorService.getCommand(Commands.AddArtwork, {
                    targetMeshId: targetMesh.userData.id,
                    artwork: actualData,
                    artworkDataProps: props,
                    keepPlaceholder: false,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                sendEditArtworkAnalyticsEvent(event, "success");

                if (
                    is360Active &&
                    item.data.token_address ===
                        "0x250ff17091c3c8beddc32c6ce66f2e896c07acb7"
                ) {
                    let assetId = item.data.id;

                    uploadAssetMedia({
                        exhibitId: exhibit.id,
                        assetId,
                        token,
                    });
                }

                return true;
            } catch (err) {
                //
                console.error(err);

                sendEditArtworkAnalyticsEvent(event, "error");

                openSnackbar(
                    ACTION_FAIL_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );
            }
        },
        []
    );

    const handleUpdateArtworkData = useEventCallback<
        This["handleUpdateArtworkData"]
    >(async ({ targetMesh = selectedMesh, data, analytics }) => {
        //
        try {
            closeSnackbar();

            const id = targetMesh.userData.id;

            editorService.context.exhibitStore.updateExhibit((draft) => {
                //
                const artwork = draft.artworks[id];

                for (let key in data) {
                    //
                    artwork.data[key] = data[key];
                }
            });

            targetMesh.userData = { ...targetMesh.userData, ...data };

            if (analytics) {
                //
                sendEditArtworkAnalyticsEvent(
                    {
                        ...baseAnalyticsEvent,
                        ...analytics,
                        ...getAssetPayload(targetMesh.userData),
                    },
                    "success"
                );
            }

            return true;
            //
        } catch (err) {
            //
            console.error(err);

            if (analytics) {
                //
                sendEditArtworkAnalyticsEvent(
                    {
                        ...baseAnalyticsEvent,
                        ...analytics,
                        ...getAssetPayload(targetMesh.userData),
                    },
                    "error"
                );
            }

            openSnackbar(
                ACTION_FAIL_MESSAGES.UPDATE,
                SNACKBAR_DURATION,
                null,
                "error"
            );

            return false;
        }
    }, []);

    const handleUpdateCuratorNotes = useEventCallback<
        This["handleUpdateCuratorNotes"]
    >(async ({ targetMesh = selectedMesh, curatorNotes }) => {
        //

        const event = {
            ...baseAnalyticsEvent,
            edited: ["curatorNotes"],
            ...getAssetPayload(targetMesh.userData),
        };

        try {
            closeSnackbar();

            const id = targetMesh.userData.id;

            editorService.context.exhibitStore.updateExhibit((draft) => {
                //
                draft.artworks[id].curatorNotes = curatorNotes;
            });

            selectedMesh.userData = {
                ...selectedMesh.userData,
                curatorNotes,
            };

            sendEditArtworkAnalyticsEvent(event, "success");

            return true;
            //
        } catch (err) {
            //
            console.error(err);

            sendEditArtworkAnalyticsEvent(event, "success");

            openSnackbar(
                ACTION_FAIL_MESSAGES.UPDATE,
                SNACKBAR_DURATION,
                null,
                "error"
            );

            return false;
        }
    }, []);

    const handleUpdateScript = useEventCallback<This["handleUpdateScript"]>(
        async ({ id, script, type }) => {
            //

            const event = {
                ...baseAnalyticsEvent,
                edited: ["script"],
            };

            try {
                closeSnackbar();

                editorService.context.exhibitStore.updateExhibitScripts({
                    id,
                    type,
                    script,
                    game: "default",
                });

                // sendEditArtworkAnalyticsEvent(event, "success");

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                // sendEditArtworkAnalyticsEvent(event, "success");

                openSnackbar(
                    ACTION_FAIL_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            }
        },
        []
    );

    const handleAddKitbash = useEventCallback<This["handleAddKitbash"]>(
        async ({
            targetMesh = selectedMesh,
            kit,
            preset,
            ctype,
            duplicate,
            payload,
            autoSelect,
        }) => {
            //

            const analyticsPayload = {
                user_id: user.id,
                kit: kit,
                type: ctype,
                exhibitId: exhibit.id,
                destination: exhibit?.info?.room,
                ownerId: exhibit.owner,
                collab: exhibit?.editors?.length > 1,
            };

            if (isAnonymous && (await reachedAnonLimits({ assets: true })))
                return;

            if (!(await valdiateAddPostPro(exhibit, ctype))) return;

            let targetId =
                targetMesh?.isKitBash && duplicate
                    ? targetMesh.userData.id
                    : null;

            try {
                //
                closeSnackbar();

                amplitude_logAnalyticsEvent(
                    "add_kit_component",
                    analyticsPayload
                );

                if (payload != null) {
                    //
                    kit ??= payload.kit;

                    ctype ??= payload.type;
                }

                const cmd = editorService.getCommand(Commands.AddKitbash, {
                    ctype,
                    kit,
                    preset,
                    targetId,
                    duplicate,
                    addedBy: user.id,
                    payload,
                    autoSelect,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                return true;
                //
            } catch (err) {
                //
                console.error(err);

                amplitude_logAnalyticsEvent(
                    "failed_add_kit_component",
                    analyticsPayload
                );

                openSnackbar(
                    ACTION_FAIL_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            }
        },
        []
    );

    /*
    const handleDeleteKitbash = useEventCallback<This["handleDeleteKitbash"]>(
        async ({ targetIds = [] }) => {
            //
            try {
                closeSnackbar();

                const cmd = editorService.getCommand(Commands.RemoveKitbash, {
                    targetIds,
                });

                await cmd.run();

                editorService.pushCommand(cmd);

                return true;

                //
            } catch (err) {
                //
                console.error(err);

                openSnackbar(
                    ACTION_FAIL_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            }
        },
        []
    );
    */

    const handleUpdateKitbash = useEventCallback<This["handleUpdateKitbash"]>(
        async ({ id, data, source }) => {
            //

            const analyticsPayload = {
                user_id: user.id,
                id,
                source,
                kit: data.kit,
                type: data.type,
                exhibitId: exhibit.id,
                destination: exhibit?.info?.room,
                ownerId: exhibit.owner,
                collab: exhibit?.editors?.length > 1,
            };

            try {
                //
                closeSnackbar();

                amplitude_logAnalyticsEvent(
                    "edit_kit_component",
                    analyticsPayload
                );

                function deepMergeWithDraft(draft, data) {
                    //
                    let hasChanged = false;

                    for (let key in data) {
                        //
                        const value = data[key];

                        let hasValueChanged = false;

                        if (draft[key] == null || !isObject(value)) {
                            //
                            let oldValue = draft[key];

                            draft[key] = value;

                            hasValueChanged = oldValue !== value;
                        } else {
                            hasValueChanged = deepMergeWithDraft(
                                draft[key],
                                value
                            );
                        }

                        hasChanged ||= hasValueChanged;
                    }

                    return hasChanged;
                }

                let ev = {
                    id,
                    data,
                    exData: null,
                    source,
                    hasChanged: null,
                };

                if (source === "gui") {
                    exhibitStore.updateExhibit((ex) => {
                        //
                        let hasChanged = true;

                        if (ex.kitbash[id] == null) {
                            //
                            ex.kitbash[id] = structuredClone(data);
                        } else {
                            //
                            hasChanged = deepMergeWithDraft(
                                ex.kitbash[id],
                                data
                            );
                        }

                        if (hasChanged) {
                            ex.kitbash[id]._version = Date.now();
                        }

                        ex.hasKitbash = true;

                        ev.hasChanged = hasChanged;
                    });

                    ev.exData = exhibitStore.exhibit.kitbash[id];
                } else {
                    const component = world.current.getComponentById(id);

                    if (component == null) {
                        throw new Error("Component not found " + id);
                    }

                    const oldData = structuredClone(component.data);

                    component.update(data);

                    const newData = structuredClone(component.data);

                    const action = {
                        async run() {},

                        async undo() {
                            //
                            component.update(oldData);
                        },
                        async redo() {
                            //
                            component.update(newData);
                        },
                        getLabel() {
                            //
                            return `Update Component ${component.data.type}`;
                        },
                    };

                    editorService.pushCommand(action);
                }

                if (conf.debugsave) {
                    if (window["$$btndebugsave"] == null) {
                        const btn = document.createElement("button");
                        btn.innerText = "Copy Debug";

                        btn.onclick = async () => {
                            // copy debug data to clipboard
                            btn.disabled = true;
                            console.log(window["$$debugsave"]);
                            await navigator.clipboard.writeText(
                                JSON.stringify(window["$$debugsave"])
                            );
                            btn.disabled = false;
                        };

                        btn.style.position = "fixed";
                        btn.style.bottom = "5px";
                        btn.style.left = "10px";
                        btn.style.padding = "5px";
                        btn.style.zIndex = "9999999";
                        btn.style.background = "red";
                        btn.style.color = "white";
                        btn.style.cursor = "pointer";

                        document.body.appendChild(btn);

                        window["$$btndebugsave"] = btn;
                    }

                    if (window["$$debugsave"] == null) {
                        window["$$debugsave"] = {};
                    }

                    if (window["$$debugsave"][id] == null) {
                        window["$$debugsave"][id] = [];
                    }

                    window["$$debugsave"][id].push(ev);
                }

                return true;
            } catch (err) {
                //
                console.error(err);

                amplitude_logAnalyticsEvent(
                    "failed_edit_kit_component",
                    analyticsPayload
                );

                openSnackbar(
                    ACTION_FAIL_MESSAGES.UPDATE,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );

                return false;
            }
        },
        []
    );

    const handleApplyKit = useEventCallback<This["handleApplyKit"]>(
        async ({ kit, applyStylekit }) => {
            //
            try {
                //
                setSelectedItems([]);

                const result = await editorService.updateExhibitKit({
                    ...kit,
                    applyStylekit,
                });

                setDestination(result.destination);

                return true;

                //
            } catch (err) {
                //
                // The kits tab says so beside the kit (Kits3DTab).
                console.error(err);

                return false;
            }
        },
        []
    );

    const setActiveOpt = useEventCallback((option: AssetOption) => {
        //

        let activeOpt: AssetOption = currentOpt(uiState);

        if (option === activeOpt) return;

        if (option == null) {
            //
            uiDispatch({ type: "opt-off" });
        } else {
            //

            uiDispatch({ type: "opt-on", option });
        }
    }, []);

    const undo = useEventCallback<This["undo"]>(async () => {
        //
        try {
            //
            if (currentAbort.current) {
                console.log("aborting");
                currentAbort.current.abort();
                currentAbort.current = null;
            } else {
                await editorService.undo();
            }
            //
        } catch (err) {
            //
            console.error(err);

            openSnackbar(
                "Failed to undo command",
                SNACKBAR_DURATION,
                null,
                "error"
            );
        }
    }, []);

    const redo = useEventCallback<This["redo"]>(async () => {
        //
        try {
            //
            await editorService.redo();
            //
        } catch (err) {
            //
            console.error(err);

            openSnackbar(
                "Failed to redo command",
                SNACKBAR_DURATION,
                null,
                "error"
            );
        }
    }, []);

    const canEditLock = (
        mesh: SpaceComponent,
        incoming: Record<keyof LockData, unknown>
    ) => {
        //
        if (mesh == null || mesh.isComponent3D) return false;

        return canChangeLock(mesh.userData.lock, incoming, user.id, roles);
    };

    const value: WorldEditState = {
        scope,
        uiState,
        uiDispatch,

        clickRef,
        addTogglerRef,

        selectedMesh,
        selectedItems,
        setSelectedItems,

        exhibit,
        destination,

        setActiveOpt,

        setStartLoadingAssets,
        isDraggingAsset,
        addState,
        artworkMessages,
        placedAssets,
        assetsData,
        lockedTargets,

        editorState,

        query,
        setQuery,

        canEditLock,

        handleDragStart,
        handleAddNft,
        handleAddYoutubeEmbed,
        handleAddPortal,
        handleAddText,
        handleAddWebsiteEmbed,
        handleAddUpload,
        handleAddTriggerZone,
        handleAddGlobalStream,

        handleAddNftBulk,

        handleDeleteItems,
        handleDeleteSelection,
        handleRefreshArtwork,

        handleDuplicate,

        handleChangeTransform,
        handleChangeFrame,
        handleChangeHTMLView,
        handleChangeDimensions,
        handleChangeCollider,
        handleChangeVideo,
        handleChangeAudio,
        handleChangeEnvmap,
        handleChangeAnimations,
        handleChangeText,
        handleToggle360,
        handleChangeLock,

        handleUpdateArtworkData,
        handleUpdateCuratorNotes,
        handleUpdateScript,

        handleAddKitbash,
        // handleDeleteKitbash,
        handleUpdateKitbash,

        handleApplyKit,

        undo,
        redo,

        droppedFile,

        baseAnalyticsEvent,

        transformMode,
        toggleTransformMode,
    };

    return (
        <WorldEditContext.Provider value={value}>
            <ReactPortal>
                {conf.debugundo && (
                    <Debug
                        isPaused={editorState?.isUndoPaused}
                        className="y-scroll scrollbar dark"
                    >
                        {!editorState?.undoStack.length ? (
                            <div className="cmd">Nothing</div>
                        ) : (
                            editorState.undoStack.map((cmd, index) => {
                                //
                                return (
                                    <div
                                        key={index}
                                        className={`cmd ${
                                            editorState.undoIndex === index
                                                ? "active"
                                                : ""
                                        }`}
                                    >
                                        <span>
                                            {editorState.undoingCmd === cmd &&
                                                "⌛ "}
                                        </span>
                                        {cmd.getLabel?.() ?? cmd["info"]}
                                    </div>
                                );
                            })
                        )}
                    </Debug>
                )}
            </ReactPortal>

            {children}
        </WorldEditContext.Provider>
    );
}

const Debug = styled.div<{ isPaused: boolean }>`
    position: absolute;
    left: 5px;
    bottom: 5px;
    background: #070707;
    border-radius: 8px;
    display: flex;
    flex-direction: column-reverse;
    gap: 6px;
    max-height: 200px;
    width: 200px;

    ${(props) => (props.isPaused ? `opacity: 0.3; pointer-events: none;` : "")}

    & > .cmd {
        font-size: 12px;
        padding: 6px 12px;
        color: white;

        & > span {
            white-space: nowrap;
            overflow-x: hidden;
            text-overflow: ellipsis;
        }

        &.active {
            color: #070707;
            background-color: white;
        }
    }
`;

export function useEditWorld() {
    //
    const value = useContext(WorldEditContext);

    if (value == null) {
        throw new Error("Not found WorldEdit context");
    }

    return value;
}
