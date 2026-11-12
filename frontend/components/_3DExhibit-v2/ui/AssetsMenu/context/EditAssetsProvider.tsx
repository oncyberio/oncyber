import {
    createContext,
    Dispatch,
    SetStateAction,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    Experience,
    KitBashData,
    PortalData,
    Stylekit,
} from "@uitypes/experience";
import { useAssetsContext } from "@components/context/AssetsContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { UserContext } from "@components/context/UserContext";
import { useSnackbar } from "@components/Snackbar";
import {
    ACTION_FAIL_MESSAGES,
    ACTION_MESSAGES,
    ACTION_SUCCESS_MESSAGES,
    SNACKBAR_DURATION,
} from "../constants";
import { DEFAULT_SNACKBAR_DURATION } from "@components/Snackbar/useSnackbar";
import { fetchAssetById } from "@utils/fetchAssets";
import { formatAsset } from "@utils/formatAssets";
import { getAssetMediaInfo } from "@utils/media/mediaInfo";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import Events from "@3events";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { FetchedAsset } from "@uitypes/Asset";
import {
    uploadAssetMedia,
    uploadAssetMediaFile,
    uploadExhibitHeroImg,
} from "@utils/media/mediaUploader";
import { DRAG_MIMES, EDITION_ACTIONS } from "@3constants";
import { useProfile } from "@components/hooks/useProfile";
import { RoomParameters } from "@uitypes/roomParameters";
import type { EDITOR_ACTION } from "@components/_3DExhibit-v2/three/factory/editor/actions";
import type { SpaceItem } from "@3factory/abstract/spaceitem";
import { DatabaseHandler } from "@components/_3DExhibit-v2/utils/db";
import { fetchManifoldMetadata } from "../../ControlPanel/Mint/mint/manifold/metadata";
import { fetchSoundMetadata } from "../../ControlPanel/Mint/mint/sound/metadata";
import { fetchEthereumNftOwners } from "@utils/ethereumAssets";
import { useValidatedAccounts } from "@components/hooks/useValidatedAccounts";
import { delay } from "@utils/js";

export interface SetPortalResult {
    heroImg?: string;
    heroImg360?: string;
    update?: PortalData;
}

export type SubmitState = "Idle" | "Submitting" | "SlowSubmitting";

export type SubmitStep = "fetch" | "upload" | "save";

export interface AddState {
    addState: SubmitState;
    type: "nft" | "portal";
    step?: SubmitStep;
}

export const FREE_ASSET = "@free-asset";

const SLOW_ADDING_TIMEOUT = 3000;

const BIG_MEDIA_SIZE = 25 * 1024 * 1024;

type ReactSetter<T> = Dispatch<SetStateAction<T>>;

export const EditModes = {
    studio: "studio",
    kitbash: "kitbash",
} as const;

export type EditMode = typeof EditModes[keyof typeof EditModes];

export type DatabasHandler = (
    action: any,
    editorAction?: EDITOR_ACTION
) => Promise<void>;

export interface EditAssetsContext {
    // From props
    exhibit: Partial<Experience>;
    destination: RoomParameters;
    stylekit?: Stylekit;
    databaseHandler: DatabasHandler;
    selectedMesh: SpaceItem;
    mode: EditMode;

    // State of assets being currently added
    addState: Record<string, AddState>;
    setAddState: (key: string, addState: AddState) => void;

    isDraggingAsset: boolean;

    handleDragStart: (e: DragEvent, mime: string, data: any) => void;

    handleAddArtwork: (
        artwork,
        keepPlaceholder?: boolean,
        target?: any
    ) => Promise<void>;

    handleAddYoutubeEmbed: (
        data,
        keepPlaceholder?: boolean,
        target?: any
    ) => Promise<void>;

    handleAddPortal: (
        data,
        keepPlaceholder?: boolean,
        target?: any,
        isElevator?: boolean
    ) => Promise<void>;

    handleAddText: (
        data,
        keepPlaceholder?: boolean,
        target?: any
    ) => Promise<void>;

    handleAddKitBash: (data, target?: any) => Promise<void>;
    handleResetKitBash: (data: KitBashData[]) => Promise<void>;
    handleAddMintAsset: (
        data,
        keepPlaceholder?: boolean,
        target?: any
    ) => Promise<void>;

    showArtworks: boolean;
    setShowArtworks: ReactSetter<boolean>;
    placedAssets: {};
    close: () => void;
}

export const EditAssetsMenuContext = createContext<EditAssetsContext>(null);

export interface EditAssetsProviderProps {
    isPlaying: boolean;
    exhibit: Experience;
    stylekit?: Stylekit;
    destination: RoomParameters;
    databaseHandler: DatabasHandler;
    selectedMesh: SpaceItem;
    mode: EditMode;
    close: () => void;
}

async function checkOwnerOrCreator(asset: FetchedAsset, accounts: string[]) {
    //
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
            throw new Error("Failed to retreive ownership info");
        }
    }

    let wallet = asset.creator?.address;

    if (!checkedWallets[wallet]) {
        wallet = asset.owner?.address;

        if (!checkedWallets[wallet]) {
            throw new Error(
                "To add this asset, the owner or the creator must be set as a co-curator of this space"
            );
        }
    }

    return true;
}

export const EditAssetsProvider: React.FC<EditAssetsProviderProps> = ({
    selectedMesh,
    exhibit,
    stylekit,
    destination,
    databaseHandler,
    mode,
    children,
    close,
}) => {
    const world = useWorld();

    // used to reset isAddAsset
    const [lastSelectedMeshProp, setLastSelectedMeshProp] =
        useState(selectedMesh);

    const [isAddAsset, setIsAddAsset] = useState(false);

    const [isDraggingAsset, setIsDraggingAsset] = useState(false);

    const [addState, _setAddState] = useState<Record<string, AddState>>({});

    const { user, exhibits, token } = useContext(UserContext);

    const validatedAccounts = useValidatedAccounts();

    const [openSnackbar, closeSnackbar] = useSnackbar({
        position: "top-right",
    });

    const [showArtworks, setShowArtworks] = useState(true);

    const {
        currentWalletId,
        setAssetsContext,
        delegatorWalletId,
        currentActiveTab,
    } = useAssetsContext();

    const placedAssets = useMemo(() => {
        let result = {};

        Object.values(exhibit.artworks || {}).forEach((current) => {
            result[`${current.data.token_address}/${current.data.token_id}`] =
                true;
        });

        return result;
    }, [exhibit.artworks]);

    const allOwners = useMemo(() => {
        //
        const exhibitMeta = exhibits?.find?.(
            (_exhibit) => exhibit?.id === _exhibit?.id
        );

        const otherOwners =
            exhibitMeta?.otherOwners?.concat?.(exhibitMeta.owner) || [];

        const allOwners = otherOwners.concat(exhibit.editors);

        return allOwners.filter((c, index) => {
            return allOwners.indexOf(c) === index;
        });
    }, [exhibits, exhibit.id, exhibit.editors]);

    const ownerProfile = useProfile({ id: currentWalletId });

    useEffect(() => {
        if (world.current) {
            const handleEditorDrop = (opts) => {
                //
                console.log("handle editor drop", opts);

                setIsAddAsset(false);

                if (opts.mime === DRAG_MIMES.NFT) {
                    handleAddArtwork(
                        opts.data,
                        opts.keepPlaceholder,
                        opts.target
                    );
                } else if (opts.mime === DRAG_MIMES.YOUTUBE) {
                    handleAddYoutubeEmbed(
                        opts.data,
                        opts.keepPlaceholder,
                        opts.target
                    );
                } else if (opts.mime === DRAG_MIMES.PORTAL) {
                    handleAddPortal(
                        opts.data,
                        opts.keepPlaceholder,
                        opts.target,
                        opts.isElevator
                    );
                }
            };

            world.current.setEventListener(
                Events.EDITOR_DROP,
                handleEditorDrop
            );

            return () => {
                world.current.setEventListener(Events.EDITOR_DROP, null);
            };
        }
    }, [world.current]);

    if (lastSelectedMeshProp !== selectedMesh) {
        setIsAddAsset(false);
        setLastSelectedMeshProp(selectedMesh);
    }

    useEffect(() => {
        function handleKeydown(e: KeyboardEvent) {
            // console.log("add asset menu", e);
            if (!e.repeat && e.shiftKey && (e.key === "o" || e.key === "O")) {
                setIsAddAsset(true);
            }
        }

        window.addEventListener("keydown", handleKeydown);

        return () => {
            window.removeEventListener("keydown", handleKeydown);
        };
    }, []);

    const setAddState = (key: string, addState: AddState) => {
        _setAddState((s) => {
            //
            if (addState === null) {
                let newS = { ...s };
                delete newS[key];
                return newS;
            }

            return {
                ...s,
                [key]: {
                    ...s[key],
                    ...addState,
                },
            };
        });
    };

    const setArtworkMessage = (
        id: string,
        isError: boolean,
        message: string
    ) => {
        setAssetsContext((state) => ({
            ...state,
            artworkMessage: {
                ...state.artworkMessage,
                [id]: { isError, message },
            },
        }));
    };

    const handleAddArtwork = useEventCallback(
        async (artwork, keepPlaceholder = false, targetMesh = selectedMesh) => {
            //
            let key = targetMesh?.userData.id || FREE_ASSET;
            let addState: SubmitState = "Submitting";

            setAddState(key, {
                addState,
                step: "fetch",
                type: "nft",
            });

            let addingTimeout = setTimeout(() => {
                addState = "SlowSubmitting";
                setAddState(key, { addState, type: "nft" });
            }, SLOW_ADDING_TIMEOUT);

            if (artwork.needsEthRecheck) {
                //
                try {
                    await checkOwnerOrCreator(
                        artwork,
                        validatedAccounts.concat(allOwners)
                    );
                } catch (error) {
                    console.error(error);

                    openSnackbar(
                        error.message,
                        SNACKBAR_DURATION,
                        null,
                        "error"
                    );
                    return;
                }
            }

            const sharedBy = artwork?.sharedBy;

            const analyticsPayload = {
                user_id: user.id,
                token_id: artwork?.token_id,
                contract_address: artwork?.contract_address,
                collection: artwork?.collection?.name,
                asset_type: artwork?.mime_type,
                chain: artwork?.blockchain,
                marketplace: artwork?.marketplace,
                ownership: sharedBy
                    ? "none"
                    : artwork?.creator?.address?.toLowerCase?.() ===
                      user.id.toLowerCase()
                    ? "minted"
                    : "owned",
                exhibitId: exhibit.id,
                destination: exhibit?.info?.room,
                ownerId: exhibit.owner,
                collab: exhibit?.editors?.length > 1,
            };

            try {
                amplitude_logAnalyticsEvent("hang_artwork", analyticsPayload);

                closeSnackbar();

                if (
                    exhibit.owner !== currentWalletId &&
                    targetMesh?.userData?.addedBy &&
                    targetMesh?.userData?.addedBy.toLowerCase() !==
                        currentWalletId.toLowerCase()
                ) {
                    openSnackbar(
                        ACTION_FAIL_MESSAGES.UNAUTHORIZED_REPLACE,
                        DEFAULT_SNACKBAR_DURATION,
                        null,
                        "error"
                    );
                    return;
                }

                if (artwork.needsRefetch) {
                    const { success, asset: freshAsset } = await fetchAssetById(
                        currentActiveTab === "curated"
                            ? delegatorWalletId
                            : currentWalletId,
                        artwork.contract_address,
                        artwork.token_id,
                        artwork.marketplace,
                        artwork.customData
                    );
                    if (success) {
                        if (!freshAsset.owner) {
                            // polygon assets do not have owner field, so we reuse
                            // the one we already have
                            freshAsset.owner = artwork.owner;
                        }
                        artwork = formatAsset(freshAsset);
                    } else {
                        // We can't continue further if we don't have complete metadata
                        openSnackbar(
                            ACTION_FAIL_MESSAGES.REFETCH,
                            DEFAULT_SNACKBAR_DURATION,
                            null,
                            "error"
                        );
                        return;
                    }
                }

                const { mediaInfo, coverMediaInfo } = await getAssetMediaInfo(
                    artwork,
                    true
                );

                // Case 1: Media not found
                if (mediaInfo.type === "NoTypeInfo") {
                    openSnackbar(
                        ACTION_FAIL_MESSAGES.MEDIA_NOT_FOUND,
                        DEFAULT_SNACKBAR_DURATION,
                        null,
                        "error"
                    );
                    return;
                }

                // Case 2: Media found but not supported
                if (mediaInfo.type === "Unsupported") {
                    openSnackbar(
                        ACTION_FAIL_MESSAGES.MEDIA_UNSUPPORTED,
                        DEFAULT_SNACKBAR_DURATION,
                        null,
                        "error"
                    );
                    return;
                }

                // Case 3: Slow media
                // In case the file might take some time to upload, display a notice

                // Not sure we need this with the timeout
                if (
                    mediaInfo.url.includes("ipfs.io/ipfs") ||
                    mediaInfo.size > BIG_MEDIA_SIZE
                ) {
                    clearTimeout(addingTimeout);
                    addState = "SlowSubmitting";
                    setAddState(key, { addState, type: "nft" });
                }

                artwork = {
                    ...artwork,
                    [mediaInfo.urlField]: mediaInfo.url,
                    mime_type: mediaInfo.mime_type,
                    addedBy: currentWalletId.toLocaleLowerCase(),
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

                let isGif =
                    mediaInfo.mime_type === "image/gif" ||
                    (coverMediaInfo?.type === "Uploadable" &&
                        coverMediaInfo?.mime_type === "image/gif");

                let isModel = mediaInfo.mime_type?.startsWith("model/gltf");

                let newkey;

                let editorAction = {
                    type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
                    placeholderId: targetMesh?.userData.id,
                    asset: artwork,
                    keepPlaceholder,
                };

                let { data, rotation, position, envmap, version, file } =
                    await world.current.edit(editorAction);

                newkey = data.id;

                clearTimeout(addingTimeout);
                setAddState(key, null);
                key = newkey;
                setAddState(key, {
                    addState,
                    step: "save",
                    type: "nft",
                });

                let assetId = data.id;

                setArtworkMessage(
                    assetId,
                    false,
                    isGif
                        ? ACTION_MESSAGES.GIF_CONVERTING
                        : isModel
                        ? ACTION_MESSAGES.MODEL_FIXING
                        : ACTION_MESSAGES.COMPRESSING
                );

                let currentWallet = currentWalletId.toLowerCase();

                const payload: any = {
                    version,
                    data: {
                        ...data,
                        addedBy: currentWallet,
                    },
                    rotation,
                    position,
                    addedBy: currentWallet,
                };

                if (envmap) {
                    payload.envmap = envmap;
                }

                // changeSelectedMesh(mesh);

                await databaseHandler(
                    {
                        type: "ADD_ARTWORK",
                        payload,
                    },
                    editorAction
                );

                openSnackbar(
                    ACTION_SUCCESS_MESSAGES.ADD,
                    SNACKBAR_DURATION,
                    null,
                    "success"
                );

                setAddState(key, null);

                if (
                    mediaInfo.type === "Uploadable" ||
                    coverMediaInfo?.type === "Uploadable"
                ) {
                    try {
                        if (file && mediaInfo.type === "Uploadable") {
                            await uploadAssetMediaFile({
                                exhibitId: exhibit.id,
                                asset: data,
                                file,
                                mediaInfo,
                                token,
                            });
                        } else {
                            await uploadAssetMedia({
                                exhibitId: exhibit.id,
                                assetId,
                                token,
                            });
                        }
                        setArtworkMessage(assetId, false, "Done!");
                        setTimeout(() => {
                            setArtworkMessage(assetId, false, null);
                        }, SNACKBAR_DURATION);
                    } catch (error) {
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
            } catch (err) {
                amplitude_logAnalyticsEvent(
                    "failed_hang_artwork",
                    analyticsPayload
                );

                const isRaceError = err.message === "race_error";
                let msg = isRaceError
                    ? ACTION_FAIL_MESSAGES.PLACEHOLDER_IN_USE
                    : ACTION_FAIL_MESSAGES.ADD;

                openSnackbar(msg, SNACKBAR_DURATION, null, "error");

                // console.log("THERE WAS AN ERROR WHILE ADDING ARTWORK");
                console.error("Error while adding artwork", err);
            } finally {
                clearTimeout(addingTimeout);
                setAddState(key, null);
            }
        },
        []
    );

    const handleAddYoutubeEmbed = useEventCallback(
        async (
            artworkData: FetchedAsset,
            keepPlaceholder = false,
            target = selectedMesh
        ) => {
            closeSnackbar();

            const analyticsPayload = {
                user_id: user.id,
                token_id: artworkData?.token_id,
                collection: artworkData.collection?.name,
                asset_type: artworkData?.mime_type,
                exhibitId: exhibit.id,
                destination: exhibit?.info?.room,
                ownerId: exhibit.owner,
                collab: exhibit?.editors?.length > 1,
            };

            try {
                amplitude_logAnalyticsEvent("hang_artwork", analyticsPayload);

                const editorAction = {
                    type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
                    placeholderId: target?.userData.id,
                    asset: artworkData,
                    keepPlaceholder,
                };

                const { data, rotation, position } = await world.current.edit(
                    editorAction
                );

                let currentWallet = currentWalletId.toLowerCase();
                await databaseHandler(
                    {
                        type: "ADD_ARTWORK",
                        payload: {
                            data: {
                                ...data,
                                addedBy: currentWallet,
                            },
                            rotation,
                            position,
                            addedBy: currentWallet,
                        },
                    },
                    editorAction
                );

                openSnackbar(
                    "Successfully added Youtube video",
                    DEFAULT_SNACKBAR_DURATION,
                    null,
                    "success"
                );
            } catch (err) {
                amplitude_logAnalyticsEvent(
                    "failed_hang_artwork",
                    analyticsPayload
                );

                console.error(err);
                openSnackbar(
                    "Failed to add Youtube video",
                    DEFAULT_SNACKBAR_DURATION,
                    null,
                    "error"
                );
            }
        },
        []
    );

    const handleAddText = useEventCallback(
        async (asset, keepPlaceholder = false, targetMesh = selectedMesh) => {
            try {
                // const artwork =  as any;

                const sharedBy = asset?.sharedBy;

                amplitude_logAnalyticsEvent("hang_artwork", {
                    user_id: user.id,
                    asset_type: asset?.mime_type,
                    ownership: sharedBy
                        ? "none"
                        : asset?.creator?.address?.toLowerCase?.() ===
                          user.id.toLowerCase()
                        ? "minted"
                        : "owned",
                    exhibitId: exhibit.id,
                    destination: exhibit?.info?.room,
                    ownerId: exhibit.owner,
                    collab: exhibit?.editors?.length > 1,
                });

                let editorAction = {
                    type: EDITION_ACTIONS.EDITOR_ADD_ARTWORK,
                    placeholderId: targetMesh?.userData.id,
                    asset: asset,
                    keepPlaceholder,
                };

                var { data, rotation, position, envmap, version } =
                    await world.current.edit(editorAction);

                const currentWallet = currentWalletId.toLowerCase();

                const payload: any = {
                    version,
                    data: {
                        ...data,
                        addedBy: currentWallet,
                    },
                    rotation,
                    position,
                    addedBy: currentWallet,
                };

                if (envmap) {
                    payload.envmap = envmap;
                }

                await databaseHandler(
                    { type: "ADD_ARTWORK", payload },
                    editorAction
                );

                openSnackbar(
                    ACTION_SUCCESS_MESSAGES.ADD,
                    SNACKBAR_DURATION,
                    null,
                    "success"
                );
            } catch (err) {
                console.error(err);
                openSnackbar(
                    ACTION_FAIL_MESSAGES.ADD,
                    SNACKBAR_DURATION,
                    null,
                    "error"
                );
            }
        },
        []
    );

    const handleAddMintAsset = useEventCallback(
        async (e, keepPlaceholder = false, targetMesh = selectedMesh) => {
            try {
                let metadata;

                if (e.contractType === "manifold") {
                    metadata = await fetchManifoldMetadata(
                        e.contractAddress
                    );
                }

                if (e.contractType === "sound.xyz") {
                    metadata = await fetchSoundMetadata(e.contractAddress);
                }

                if (!metadata) {
                    openSnackbar(
                        "Failed to find the asset to mint.",
                        DEFAULT_SNACKBAR_DURATION,
                        null,
                        "error"
                    );

                    return;
                }

                await handleAddArtwork(
                    {
                        user_id: e.userId,
                        contractType: e.contractType,
                        contractAddress: e.contractAddress,
                        token_id: metadata.creator.id,
                        contract_address:
                            e.contractType === "sound.xyz"
                                ? metadata?.token
                                : metadata?.requirements
                                      ?.creatorContractAddress,
                        collection:
                            e.contractType === "sound.xyz"
                                ? "sound.xyz"
                                : metadata?.requirements?.address,
                        asset_type:
                            e.contractType === "sound.xyz"
                                ? "sound.xyz"
                                : metadata?.requirements?.claimType,
                        chain: "ethereum",
                        marketplace: e.contractType,
                        image_url: metadata.image,
                        mintable: true,
                        name: metadata.name,
                        ...(metadata.format || {}),
                    },
                    keepPlaceholder,
                    targetMesh
                );
            } catch (err) {
                openSnackbar(
                    "Something wrong happened.",
                    DEFAULT_SNACKBAR_DURATION,
                    null,
                    "error"
                );

                console.log("error", err);
            }
        },
        []
    );

    const handleAddPortal = useEventCallback(
        async (
            targetExhibit: Experience,
            keepPlaceholder = false,
            target = selectedMesh,
            isElevator = false
        ) => {
            //
            if (!target) target = selectedMesh;

            let key = target?.userData.id || FREE_ASSET;
            let addState: SubmitState = "Submitting";

            setAddState(key, {
                addState,
                step: "fetch",
                type: "portal",
            });

            // await delay(300_000);

            let addingTimeout = setTimeout(() => {
                addState = "SlowSubmitting";
                setAddState(key, { addState, type: "portal" });
            }, SLOW_ADDING_TIMEOUT);

            let portalId;
            try {
                const exhibitId = targetExhibit.id;

                const coords = targetExhibit.info.coords || null;

                closeSnackbar();

                // TODO: clarify this
                // if (targetExhibit.owner !== currentWalletId) {
                //     openSnackbar(
                //         ACTION_FAIL_MESSAGES.UNAUTHORIZED_REPLACE,
                //         DEFAULT_SNACKBAR_DURATION,
                //         null,
                //         "error"
                //     );
                //     return;
                // }

                const placeholderId = target?.userData.id;

                const editorAction = {
                    type: EDITION_ACTIONS.EDITOR_ADD_PORTAL,
                    placeholderId,
                    exhibitId,
                    coords,
                    keepPlaceholder,
                };

                // TODO: Add proper typing for portal edit return value
                const result = (await world.current.edit(editorAction)) as any;

                if (result == null) {
                    throw new Error("addPortal returned null");
                }

                portalId = result.update?.spawn?.portalId || placeholderId;

                setAddState(key, null);

                key = portalId;

                setAddState(key, {
                    addState,
                    step: "upload",
                    type: "portal",
                });

                let cHeroImg, cHeroImg360;

                if (result?.heroImg || result?.heroImg360) {
                    let uploadResult = await uploadExhibitHeroImg(
                        {
                            exhibitId: exhibit.id,
                            portalId: isElevator
                                ? `${portalId}+${exhibitId}`
                                : portalId,
                            heroImg: result?.heroImg,
                            heroImg360: result?.heroImg360,
                        },
                        token
                    );

                    if (uploadResult.success === true) {
                        cHeroImg = uploadResult.value.url;
                        cHeroImg360 = uploadResult.value.url360;
                    } else {
                        console.error(
                            "Failed to upload hero img",
                            uploadResult.error
                        );
                        openSnackbar(
                            ACTION_FAIL_MESSAGES.UPLOAD_PORTAL_IMG,
                            DEFAULT_SNACKBAR_DURATION,
                            null,
                            "error"
                        );
                        await world.current.edit({
                            type: EDITION_ACTIONS.EDITOR_DELETE_PORTAL,
                            portalId,
                        });

                        return;
                    }
                }

                setAddState(key, {
                    addState,
                    step: "save",
                    type: "portal",
                });

                const update: any = {
                    type: "SET_PORTAL",
                    payload: {
                        id: portalId,
                        exhibitId,
                        ...(result?.update || {}),
                        addedBy: user.id,
                        cHeroImg: cHeroImg || "",
                        cHeroImg360: cHeroImg360 || "",
                        isElevator,
                    },
                };

                if (cHeroImg) {
                    update.cHeroImg = cHeroImg;
                }

                if (cHeroImg360) {
                    update.cHeroImg360 = cHeroImg360;
                }

                const level =
                    (exhibit?.portals?.[portalId]?.levels || []).length + 1;

                if (isElevator) {
                    const payload = {
                        exhibitId,
                        cHeroImg,
                        cHeroImg360,
                        level,
                        name: exhibitId,
                        id: `${exhibitId}.${level}`,
                    };

                    if (!exhibit?.portals?.[portalId]?.levels) {
                        update.payload.levels = [payload];
                    } else {
                        update.payload.levels =
                            exhibit?.portals?.[portalId]?.levels.concat(
                                payload
                            );
                    }
                }

                await databaseHandler(update, {
                    ...editorAction,
                    remotePayload: update.payload,
                });

                setIsAddAsset(false);

                openSnackbar(
                    ACTION_SUCCESS_MESSAGES.ADD,
                    SNACKBAR_DURATION,
                    null,
                    "success"
                );

                amplitude_logAnalyticsEvent("add_portal", {
                    user_id: user.id,
                    owner: exhibit.owner,
                    exhibit_id: exhibit.id,
                    target_exhibit_id: targetExhibit?.id,
                    reuse_placeholder: keepPlaceholder,
                    target_exhibit_destination: targetExhibit?.info?.room,
                    target_exhibit_owner: targetExhibit?.owner,
                    target_exhibit_headline: targetExhibit?.info?.headline,
                    is_owner:
                        targetExhibit?.owner?.toLowerCase?.() ===
                        user?.id?.toLowerCase?.(),
                    isElevator,
                });
            } catch (err) {
                console.error(err);
                if (portalId) {
                    await world.current.edit({
                        type: EDITION_ACTIONS.EDITOR_DELETE_PORTAL,
                        portalId,
                    });
                }
                openSnackbar(
                    "Failed to set Exhibit portal. " + err.message,
                    DEFAULT_SNACKBAR_DURATION,
                    null,
                    "error"
                );

                amplitude_logAnalyticsEvent("failed_add_portal", {
                    user_id: user.id,
                    owner: exhibit.owner,
                    exhibit_id: exhibit.id,
                    target_exhibit_id: targetExhibit?.id,
                    reuse_placeholder: keepPlaceholder,
                    target_exhibit_destination: targetExhibit?.info?.room,
                    target_exhibit_owner: targetExhibit?.owner,
                    target_exhibit_headline: targetExhibit?.info?.headline,
                    is_owner:
                        targetExhibit?.owner?.toLowerCase?.() ===
                        user?.id?.toLowerCase?.(),
                });
            } finally {
                clearTimeout(addingTimeout);
                setAddState(key, null);
            }
        },
        []
    );

    const handleResetKitBash = async (data: KitBashData[]) => {
        try {
            const action = {
                type: EDITION_ACTIONS.EDITOR_RESET_KITBASH,
                data,
            };

            const newData = await world.current.edit(action);

            const payload: Record<string, KitBashData> = {};

            newData.forEach((data) => {
                payload[data.id] = data.addedBy
                    ? data
                    : {
                          ...data,
                          addedBy: currentWalletId,
                      };
            });

            //console.log(payload);
            await databaseHandler({ type: "RESET_KITBASH", payload }, action);

            openSnackbar(
                ACTION_SUCCESS_MESSAGES.ADD,
                SNACKBAR_DURATION,
                null,
                "success"
            );
        } catch (err) {
            console.error(err);
            openSnackbar(
                ACTION_FAIL_MESSAGES.ADD,
                SNACKBAR_DURATION,
                null,
                "error"
            );
        }
    };

    const handleAddKitBash = async (kbType, targetMesh = selectedMesh) => {
        //

        try {
            let editorAction = {
                type: EDITION_ACTIONS.EDITOR_ADD_KITBASH,
                kbType,
                id: targetMesh?.userData.id,
            };

            let data = await world.current.edit(editorAction);

            const currentWallet = currentWalletId.toLowerCase();

            const payload: any = {
                ...data,
                addedBy: currentWallet,
            };

            await databaseHandler(
                {
                    type: "UPDATE_KITBASH",
                    payload,
                },
                editorAction
            );

            openSnackbar(
                ACTION_SUCCESS_MESSAGES.ADD,
                SNACKBAR_DURATION,
                null,
                "success"
            );
        } catch (err) {
            console.error(err);

            openSnackbar(
                ACTION_FAIL_MESSAGES.ADD,
                SNACKBAR_DURATION,
                null,
                "error"
            );
        }
    };

    const handleDragStart = useEventCallback(
        (e: DragEvent, mime: string, data: any) => {
            e.dataTransfer.setData(mime, mime);

            (window as any).$dragData = data;

            let blankCanvas = (window as any).$dragPreview;

            if (blankCanvas == null) {
                blankCanvas = document.createElement("canvas");

                blankCanvas.style.position = "absolute";
                blankCanvas.style.width = "1";
                blankCanvas.style.height = "1";

                document.body?.appendChild(blankCanvas);

                (window as any).$dragPreview = blankCanvas;
            }

            (window as any).$dragData = data;

            e.dataTransfer.setDragImage(blankCanvas, 0, 0);

            e.dataTransfer.effectAllowed = "move";

            e.target.addEventListener("dragend", handleDragEnd, { once: true });

            setTimeout(() => {
                setIsDraggingAsset(true);
            });
        },
        []
    );

    const handleDragEnd = useEventCallback((e) => {
        console.log("drag end", e);

        (window as any).$dragData = null;

        setIsDraggingAsset(false);
    }, []);

    const payload = {
        exhibit,
        destination,
        stylekit,
        databaseHandler,
        selectedMesh,
        mode,

        handleAddArtwork,
        handleAddYoutubeEmbed,
        handleAddPortal,
        handleAddText,
        handleAddKitBash,
        handleResetKitBash,
        handleAddMintAsset,

        addState,
        setAddState,

        showArtworks,
        setShowArtworks,

        placedAssets,
        close,

        isDraggingAsset,
        handleDragStart,
    };

    return (
        <EditAssetsMenuContext.Provider value={payload}>
            {children}
        </EditAssetsMenuContext.Provider>
    );
};
