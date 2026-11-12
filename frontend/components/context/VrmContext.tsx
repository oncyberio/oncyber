import { readTravelAvatar, rememberTravelAvatar } from "@utils/travelAvatar";
import React, { useContext, useEffect, useRef, useState } from "react";
import VrmApi from "@api/vrm/_api";
import { NOTNYC_getUser } from "@utils/partnerships/notnyc";
import { showConfirm, showError } from "@components/Dialogs";
import { UserContext } from "./UserContext";

import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useEventCallback } from "@components/hooks/useEventCallback";
import {
    ERROR_CODES,
    LOD_MESHES_MAX,
} from "@components/_3DExhibit-v2/three/constants";
import { WorldProvider } from "@components/_3DExhibit-v2/context/WorldProvider";
import debounce from "lodash/debounce";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { User } from "@uitypes/user";
import { uploadFile } from "@utils/media/mediaUploader";
import { getVrmNftClient } from "@utils/vrmNftClient";
import {
    amplitude_logAnalyticsEvent,
    amplitude_setIndetity,
} from "@utils/analytics";
import { useCyberTranslation } from "./I18nContext";
import VRM_PARTNERS from "@utils/vrmPartners";

import VRMS from "@3/three/factory/player/vrms.json";
import { Experience } from "@uitypes/experience";
import { RoomParameters } from "@uitypes/roomParameters";
import { checkUrlResponse, cloudinary } from "@utils/urlUtils";

const maxFileSize = 8;

const ErrorMap = {
    [ERROR_CODES.INVALID_VRM_FILE]:
        "There is no VRM data available in this file.",
    [ERROR_CODES.VRM_MESHES_OVERCOUNT_ERROR]: `Mesh Count (:count) exceeds maximum allowed (${LOD_MESHES_MAX}). Please reduce the amount of meshes on your vrm and try again.`,
};

export const DEFAULT_VRMS = Object.values(VRMS);

interface OwnedVrm {
    id: string;
    url: string;
    name: string;
    image: string;
    description: string;
    hidden?: boolean;
    owned?: boolean;
    isOwnedMetadataNotLoaded?: boolean;
}

interface Vrm extends OwnedVrm {
    scale?: number;
    hidden?: boolean;
    fileHash?: string;
    isHighQuality?: boolean;
    userId?: string;
    count?: number;
    hasPFP?: boolean;
    score?: {
        box?: {
            x: number;
            y: number;
            z: number;
        };
        drawCalls?: number;
        maxTextureSize?: number;
        nbTextures?: number;
        nbVertices?: number;
        normalMap?: number;
        pbrMaterials?: number;
        perfScore?: number;
    };
}

type VrmType = "DEFAULT" | "OWNED" | "UPLOADED";

export const SLIDER_STEP = 0.01;

export interface VrmContextState {
    uploadedVrms: Vrm[];
    activeVrm?: Vrm;
    loading: boolean;
    ownedVrms: OwnedVrm[];
    defaultScale: number;
    loadingOwned: boolean;
    loadingUpload: boolean;
    currentModal: ModalState;
    disableCancel: boolean;
    //
    onCancel: () => void;
    initVrm: (
        user: Partial<User>,
        isAnonymous: boolean,
        _exhibit?: Partial<Experience>,
        _roomParams?: Partial<RoomParameters>
    ) => Promise<Vrm | undefined>;
    onEdit: (id: string) => void;
    setActiveVrm: React.Dispatch<Vrm>;
    onSelectVrm: (vrmId: string, type: VrmType) => void;
    onDelete: (id: string) => Promise<void>;
    onSubmitUpload: (payload: Vrm) => void;
    onUploadVrm: (file: File) => Promise<void>;
    onSubmitEdit: (payload: Vrm) => void;
    _settings: React.MutableRefObject<any>;
    _handleSettings: React.MutableRefObject<any>;
    _handleSaveSettings: React.MutableRefObject<any>;
    onScale: (scale: number) => Promise<void>;
    setDisableCancel: React.Dispatch<React.SetStateAction<boolean>>;
    setCurrentModal: React.Dispatch<React.SetStateAction<ModalState>>;
}

type ModalState =
    | { type: "none" }
    | { type: "edit"; metadata: Vrm }
    | { type: "upload"; metadata: Vrm };

export const VrmContext = React.createContext<VrmContextState>(null);

function VrmProvider_Child({ children, isSceneLoaded, vrmUrl }) {
    //

    const [loading, setLoading] = useState(false);
    const [activeVrm, setActiveVrm] = useState(null);
    const [loadingOwned, setLoadingOwned] = useState(false);
    const [disableCancel, setDisableCancel] = useState(false);
    const [loadingUpload, setLoadingUpload] = useState(false);
    const [ownedVrms, setOwnedVrms] = useState<OwnedVrm[]>([]);
    const [uploadedVrms, setUploadedVrms] = useState<Vrm[]>([]);
    const [roomParams, setRoomParams] = useState(null);

    const [currentModal, setCurrentModal] = useState<ModalState>({
        type: "none",
    });

    const [defaultScale, setDefaultScale] = useState(null);

    const { userData, exhibit, user, token, defaultWallet, linkedWallets } =
        useContext(UserContext);

    const _handleSaveSettings = useRef(null);
    const _handleSettings = useRef(null);
    const _settings = useRef(null);
    const _sceneLoader = useRef(false);

    const { MultiplayerService, room } = useMultiplayer();

    const { i18n } = useCyberTranslation();

    const world = useWorld();

    const lastVrmRef = useRef(null);
    const prevActiveVrm = useRef(null);

    useEffect(() => {
        if (!user?.id) return;

        fetchOwnedVrms().catch(console.error);

        //
    }, [user?.id]);

    useEffect(() => {
        (async function () {
            if (
                activeVrm?.url &&
                isSceneLoaded?.current &&
                world?.current?.changeVRM
            ) {
                await world.current.changeVRM(activeVrm.url);

                setLoading(false);

                if (vrmUrl?.current) {
                    vrmUrl.current = activeVrm.url;
                }

                await loadScale();
            }
        })();
    }, [
        activeVrm,
        world?.current,
        isSceneLoaded?.current,
        defaultScale,
        userData?.avatarContractAddress,
    ]);

    useEffect(() => {
        const validVrmIds = ["check", "square"];

        let vrmId = userData?.settings?.vrm;

        if (validVrmIds.includes(vrmId)) {
            switch (vrmId) {
                case "check":
                case "square":
                    if (
                        !userData?.avatarContractAddress ||
                        userData?.avatarContractAddress === "0xnotanaddress"
                    ) {
                        vrmId = "square";
                    } else {
                        vrmId = "check";
                    }
                    break;
            }

            const selectedVrm = DEFAULT_VRMS.find((vrm) => vrm.id === vrmId);

            setActiveVrm(selectedVrm);
        }
    }, [userData?.avatarContractAddress]);

    const setSaveDebounced = useRef(
        debounce((cb) => {
            if (typeof cb === "function") {
                cb();
            }
        }, 1000)
    );

    async function fireEvent(vrm) {
        const currentExhibit = room?.currentExhibit;

        const payload = {
            label: "Avatar",
            value: vrm.url,
            exhibitId: currentExhibit?.id,
            destination: currentExhibit?.info?.room,
            ownerId: currentExhibit?.owner,
            collab: currentExhibit?.editors?.length > 1,
        };

        amplitude_logAnalyticsEvent("change_in_world_setting", payload);

        const settings = _settings?.current;

        amplitude_setIndetity("settings", {
            p_quality: settings?.quality,
            p_camera: settings?.camera,
            p_avatar: settings?.avatar,
            p_language: i18n,
            p_vrm_url: vrm?.url,
            p_vrm_name: vrm?.name,
        });
    }

    function isValidVrm(item) {
        return (
            item?.metadata?.vrm ||
            item?.metadata?.vrm_url ||
            (item?.metadata?.asset &&
                item?.metadata?.asset?.endsWith(".vrm")) || //only folder ipfs cids have extension, this won't catch per token cid
            item?.metadata?.assets
                ?.filter?.((x) => x?.media_type === "model")?.[0]
                ?.files?.filter?.((x) => x?.file_type == "model/vrm")?.[0]
        );
    }

    function urlOfVrmMetadata(metadata) {
        let url = metadata?.vrm || metadata?.vrm_url;
        if (!url) {
            url = metadata?.assets
                ?.filter?.((x) => x?.media_type === "model")?.[0]
                ?.files?.filter?.((x) => x?.file_type == "model/vrm")?.[0]?.url;
        }
        if (!url) url = metadata?.asset;
        return url;
    }

    async function fetchVrmsPerChain(chain: "eth" | "polygon") {
        let nfts = [];
        let allNfts = [];

        await Promise.all(
            linkedWallets.map(async (wallet) => {
                try {
                    const client = await getVrmNftClient(chain);
                    let lastKey = null;
                    let data;

                    const payload = {
                        owner: wallet,
                        withMetadata: true,
                    };

                    do {
                        if (lastKey) {
                            // @ts-ignore
                            payload.pageKey = lastKey;
                        }

                        data = await client.alchemy.getNfts(payload);

                        const ownedNfts = data?.ownedNfts;

                        allNfts = allNfts.concat(ownedNfts);

                        if (ownedNfts?.length) {
                            const filtersMetadata = ownedNfts
                                .map((item) => {
                                    const partnerItem =
                                        VRM_PARTNERS?.[
                                            item?.contract?.address?.toLowerCase?.()
                                        ]?.(item);
                                    return partnerItem || item;
                                })
                                .filter(isValidVrm)
                                .map((item) => item?.metadata);

                            nfts = nfts.concat(filtersMetadata);
                        }

                        lastKey = data?.pageKey;
                    } while (lastKey);
                } catch (err) {
                    console.log("[ERROR loading VRMs]", err);
                }
            })
        );

        return nfts;
    }

    async function fetchOwnedVrms() {
        setLoadingOwned(true);

        let nfts = [];
        let results = [];

        try {
            nfts = await fetchVrmsPerChain("eth");
            nfts = nfts.concat(await fetchVrmsPerChain("polygon"));

            for (const metadata of nfts) {
                let url = urlOfVrmMetadata(metadata);

                if (url) {
                    const id = await generateHash(url);

                    if (id) {
                        let isSaved = false;

                        try {
                            const response = await VrmApi.getVrm({
                                type: "owned",
                                id,
                            });

                            // @ts-ignore
                            const _url = response?.url;

                            if (
                                _url &&
                                !cloudinary.isBrokenCloudinaryUrl(_url)
                            ) {
                                isSaved = true;
                                url = _url;
                            }

                            const vrm = {
                                id,
                                url,
                                isSaved,
                                owned: true,
                                name: metadata?.name,
                                description: metadata?.description,
                                image: metadata?.image || metadata?.image_url,
                            };

                            //
                            if (vrm?.image && vrm.image.startsWith("ipfs://")) {
                                //
                                vrm.image = vrm.image.replace(
                                    "ipfs://",
                                    "https://cyber.mypinata.cloud/ipfs/"
                                );
                            }

                            if (vrm?.url && vrm.url.startsWith("ipfs://")) {
                                vrm.url = vrm.url.replace(
                                    "ipfs://",
                                    "https://cyber.mypinata.cloud/ipfs/"
                                );
                            }

                            results = [...results, vrm];

                            if (
                                id === userData?.settings?.vrm &&
                                id !== activeVrm?.id
                            ) {
                                setActiveVrm(vrm);
                            }
                            //
                        } catch (error) {
                            console.error(
                                "[Error fetching hash from collection]",
                                id,
                                error
                            );
                        }
                    }
                }
            }

            //
        } catch (error) {
            console.error(error);
        } finally {
            //
            setOwnedVrms(results);
            setLoadingOwned(false);
        }
    }

    async function initVrm(
        userData,
        isAnon,
        _exhibit = null,
        _roomParams = null
    ) {
        //

        try {
            const travellingAvatar = readTravelAvatar(userData);
            let vrmId = travellingAvatar?.id || userData?.settings?.vrm;

            let customVrms, avatar;

            if (!travellingAvatar && !isAnon && userData?.walletId) {
                customVrms = await VrmApi.getVrms({});
            }

            // const user_not_nyc = NOTNYC_getUser({
            //     userData,
            //     exhibit,
            // });

            // if (user_not_nyc) {
            //     vrmId = user_not_nyc?.vrm;
            // }

            switch (vrmId) {
                case "check":
                case "square":
                    if (
                        !userData?.avatarContractAddress ||
                        userData?.avatarContractAddress === "0xnotanaddress"
                    ) {
                        vrmId = "square";
                    } else {
                        vrmId = "check";
                    }
                    break;
            }

            avatar =
                travellingAvatar ||
                DEFAULT_VRMS.find((vrm) => vrm?.id === vrmId);

            if (customVrms?.length) {
                //
                if (!avatar) {
                    avatar = customVrms.find((vrm) => vrm?.id === vrmId);
                }

                // remove ones that has old cloudinary
                const uploadedVrms = customVrms.filter((item) => {
                    return !cloudinary.isBrokenCloudinaryUrl(item.url);
                });

                setUploadedVrms(uploadedVrms);
            }

            if (ownedVrms?.length) {
                if (!avatar) {
                    avatar = ownedVrms.find((vrm) => vrm?.id === vrmId);
                }
            } else if (!avatar && vrmId) {
                // An already-resolved built-in/uploaded avatar needs no owned lookup.
                // TODO (Refactor later) Required for fast owned vrm loading.
                try {
                    const response = await VrmApi.getVrm({
                        type: "owned",
                        id: vrmId,
                    });

                    // @ts-ignore
                    if (response && response?.id && response?.url) {
                        const isOk = await checkUrlResponse(response.url);
                        if (isOk) {
                            avatar = {
                                ...response,
                                isOwnedMetadataNotLoaded: true,
                            };
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            }

            if (!avatar) {
                avatar = DEFAULT_VRMS.find((item) => {
                    if (_exhibit?.info?.room === "paladinpunks") {
                        return item.id === "paladinpunks";
                    }

                    return (
                        item?.id ==
                        (!userData?.avatarContractAddress ||
                        userData?.avatarContractAddress === "0xnotanaddress"
                            ? "square"
                            : "check")
                    );
                });
            }

            if (vrmUrl?.current) {
                vrmUrl.current = avatar.url;
            }

            setActiveVrm(avatar);

            if (_roomParams) setRoomParams(_roomParams);

            const default_vrm_scale =
                _exhibit?.params?.avatarSize ||
                _roomParams?.avatarSize ||
                userData?.settings?.default_vrm_scale;

            //
            if (
                default_vrm_scale !== null ||
                typeof defaultScale === "undefined"
            ) {
                setDefaultScale(default_vrm_scale);
            }

            return avatar;
        } catch (error) {
            console.error(error);
        }
    }

    async function generateHash(str: string) {
        const buffer = new TextEncoder().encode(str);
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        const hash = Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        return hash;
    }

    async function loadScale() {
        const isCustomVrm = activeVrm?.userId;

        let scale = null;

        if (exhibit?.params?.avatarSize) {
            if (typeof exhibit.params.avatarSize === "number") {
                scale = exhibit.params.avatarSize;
            }
        } else if (roomParams?.avatarSize) {
            if (typeof roomParams.avatarSize === "number") {
                scale = roomParams.avatarSize;
            }
        } else if (isCustomVrm) {
            if (typeof activeVrm?.scale === "number") {
                scale = activeVrm.scale;
            }
        } else {
            scale = defaultScale;
        }

        if (scale == null || typeof scale === "undefined") {
            scale = world.current.getVRMScale();

            if (isCustomVrm) {
                //
                setUploadedVrms((prevState) => {
                    const newState = prevState.map((obj) => {
                        if (activeVrm?.id === obj?.id) {
                            const data = { ...obj, scale };

                            if (activeVrm !== prevActiveVrm?.current) {
                                setActiveVrm(data);
                                prevActiveVrm.current = data;
                            }

                            return data;
                        }
                        return obj;
                    });

                    return newState;
                });
            } else {
                setDefaultScale(scale);
            }
        }

        await world.current.scaleVRM(scale);

        return scale;
    }

    const onUploadVrm = useEventCallback(async (file: File) => {
        try {
            setLoadingUpload(true);

            if (file.size > maxFileSize * 1024 * 1024) {
                throw new Error(
                    `The VRM file you are attempting to upload exceeds the maximum file size limit of ${maxFileSize}MB`
                );
            }

            const fileURL = URL.createObjectURL(file);

            const { thumbnail: image, ...response } =
                await world.current.changeVRM(fileURL, {
                    demo: true,
                });

            // force switch camera third_person!
            if (_settings?.current?.camera !== "third_person")
                await _handleSettings?.current("camera", "third_person");

            lastVrmRef.current = activeVrm;

            const scale = world.current.getVRMScale();

            setCurrentModal({
                type: "upload",
                metadata: {
                    ...response,
                    fileURL,
                    image,
                    scale,
                },
            });
        } catch (err) {
            console.error(err);
            const code = err?.code;

            let mappedErrors = ErrorMap[code];

            if (err?.count) {
                mappedErrors = mappedErrors.replace(":count", err.count);
            }

            showError(
                mappedErrors ||
                    err?.message ||
                    "Failed to upload your VRM. Please try again later"
            );
        } finally {
            setLoadingUpload(false);
        }
    }, []);

    const onSubmitUpload = useEventCallback(async (payload: Vrm) => {
        setActiveVrm(payload);

        setUploadedVrms((prevState) => [...prevState, payload]);

        if (payload?.id !== _settings?.current?.vrm) {
            await _handleSaveSettings?.current("vrm", payload.id);
        }

        if (MultiplayerService?.current?.roomService?.room?.send) {
            await MultiplayerService.current.roomService.room.send(
                "scale",
                payload?.scale
            );
        }

        setCurrentModal({ type: "none" });
    }, []);

    const onSelectVrm = useEventCallback(
        async (vrmId: string, type: VrmType) => {
            //

            setLoading(true);

            try {
                switch (vrmId) {
                    case "check":
                    case "square":
                        if (
                            !userData?.avatarContractAddress ||
                            userData?.avatarContractAddress === "0xnotanaddress"
                        ) {
                            vrmId = "square";
                        } else {
                            vrmId = "check";
                        }
                        break;
                }

                let vrms = [];

                switch (type) {
                    case "DEFAULT":
                        vrms = DEFAULT_VRMS;
                        break;

                    case "OWNED":
                        vrms = ownedVrms;
                        break;

                    case "UPLOADED":
                        vrms = uploadedVrms;
                        break;
                }

                let selectedVrm = vrms.find((vrm) => vrm?.id === vrmId);

                if (
                    user?.id &&
                    selectedVrm?.id &&
                    selectedVrm.id !== _settings?.current?.vrm
                ) {
                    await _handleSaveSettings?.current("vrm", selectedVrm.id);
                }

                setActiveVrm(selectedVrm);
                rememberTravelAvatar(userData, selectedVrm);

                if (MultiplayerService?.current?.roomService?.room?.send) {
                    const _scale = selectedVrm?.userId
                        ? selectedVrm?.scale
                        : defaultScale;
                    await MultiplayerService.current.roomService.room.send(
                        "scale",
                        _scale
                    );
                }

                if (selectedVrm?.owned && !selectedVrm?.isSaved) {
                    await saveOwned(selectedVrm.id, selectedVrm.url);
                }

                fireEvent(selectedVrm);
            } catch (err) {
                console.error(err);
            }
        },
        []
    );

    const saveOwned = async (id: string, fileUrl: string) => {
        try {
            const file = await fetch(fileUrl).then((r) => r.blob());

            const cloudinary = await uploadFile({
                file,
                token,
                id,
                mimeType: "model/vrml",
            });

            const url = cloudinary?.secure_url;

            if (!url) {
                throw new Error(
                    "Oops! Something went wrong with the VRM upload. Please refresh the page and try again."
                );
            }

            await VrmApi.addOwnedVrm({ url, id });

            setOwnedVrms((prevState) => {
                const newState = prevState.map((obj) => {
                    if (id === obj?.id) {
                        const data = { ...obj, url };
                        return data;
                    }
                    return obj;
                });

                return newState;
            });
        } catch (error) {
            console.error(error);
        }
    };

    const onCancel = useEventCallback(() => {
        if (disableCancel) return;

        setActiveVrm({ ...lastVrmRef.current });

        setCurrentModal({ type: "none" });
    }, []);

    const onEdit = useEventCallback(async (id: string) => {
        lastVrmRef.current = activeVrm;

        const metadata = uploadedVrms.find((item) => item?.id === id);

        setCurrentModal({ type: "edit", metadata });
    }, []);

    const onSubmitEdit = useEventCallback(async (payload: Vrm) => {
        setUploadedVrms((prevState) => {
            const newState = prevState.map((obj) => {
                if (payload?.id === obj?.id) {
                    const data = { ...obj, ...payload };

                    lastVrmRef.current = data;

                    if (activeVrm?.id === payload.id) {
                        setActiveVrm(data);
                    }

                    return data;
                }
                return obj;
            });

            return newState;
        });

        if (MultiplayerService?.current?.roomService?.room?.send) {
            await MultiplayerService.current.roomService.room.send(
                "scale",
                payload?.scale
            );
        }

        setCurrentModal({ type: "none" });
    }, []);

    const onScale = async (scale: number) => {
        try {
            const id = activeVrm?.id;
            const isUploadedVrm = activeVrm?.userId;

            if (id) {
                if (isUploadedVrm) {
                    setUploadedVrms((prevState) => {
                        const newState = prevState.map((obj) => {
                            if (id === obj?.id) {
                                const data = { ...obj, scale };

                                lastVrmRef.current = data;

                                if (activeVrm?.id === id) {
                                    setActiveVrm(data);
                                }

                                return data;
                            }
                            return obj;
                        });

                        return newState;
                    });
                } else {
                    setDefaultScale(scale);
                }

                setSaveDebounced.current(async () => {
                    if (MultiplayerService?.current?.roomService?.room?.send) {
                        await MultiplayerService.current.roomService.room.send(
                            "scale",
                            scale
                        );
                    }

                    if (user?.id) {
                        if (isUploadedVrm) {
                            await VrmApi.updateVrm({
                                id,
                                scale,
                            });
                        } else {
                            await _handleSaveSettings.current(
                                "default_vrm_scale",
                                scale
                            );
                        }
                    }

                    console.log("saved settings...");
                });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const onDelete = useEventCallback(async (id: string) => {
        //
        const ok = await showConfirm("Are you sure you want to delete?", {
            type: "Question",
        });

        if (ok) {
            try {
                await VrmApi.destroyVrm({ id });

                if (activeVrm?.id === id) {
                    //

                    let vrmId;

                    // const user = NOTNYC_getUser({
                    //     userData,
                    //     exhibit,
                    // });

                    // if (user) {
                    //     vrmId = user?.vrm;
                    // } else {
                    vrmId =
                        !userData?.avatarContractAddress ||
                        userData?.avatarContractAddress === "0xnotanaddress"
                            ? "square"
                            : "check";
                    // }

                    const avatar = DEFAULT_VRMS.find(
                        (vrm) => vrm?.id === vrmId
                    );

                    setActiveVrm(avatar);

                    await _handleSaveSettings.current("vrm", vrmId);
                }

                const filteredVrms = uploadedVrms.filter(
                    (vrm) => vrm?.id !== id
                );

                setUploadedVrms(filteredVrms);

                setCurrentModal({ type: "none" });
            } catch (err) {
                console.error(err);
                showError(
                    err?.message ||
                        "Oops, we were unable to remove your VRM at this time. Please try again later"
                );
            }
        }
    }, []);

    const value = {
        uploadedVrms,
        loading,
        ownedVrms,
        activeVrm,
        defaultScale,
        currentModal,
        loadingUpload,
        loadingOwned,
        disableCancel,
        setDisableCancel,
        //
        initVrm,
        onEdit,
        onScale,
        onCancel,
        onDelete,
        setUploadedVrms,
        onUploadVrm,
        onSelectVrm,
        setActiveVrm,
        onSubmitEdit,
        onSubmitUpload,
        setCurrentModal,
        _handleSaveSettings,
        _handleSettings,
        _settings,
        _sceneLoader,
    };

    return <VrmContext.Provider value={value}>{children}</VrmContext.Provider>;
}

export default function VrmProvider(props) {
    const world = useRef(null);

    return (
        <WorldProvider world={world}>
            <VrmProvider_Child {...props} />
        </WorldProvider>
    );
}

export function useVrm() {
    const context = useContext(VrmContext);

    if (!context) {
        throw Error("useVrm needs to be called within VrmContext.");
    }

    return context;
}
