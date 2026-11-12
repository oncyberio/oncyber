import { useEventCallback } from "@components/hooks/useEventCallback";
import { WorldProvider } from "@components/_3DExhibit-v2/context/WorldProvider";
import { RoomParameters, Spline } from "@uitypes/roomParameters";
import dynamic from "next/dynamic";
import React, { useContext, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { UploadSuccess } from "./Modals/UploadSuccess";
import { Destinations } from "@uitypes/destinations";
import { UserContext } from "@components/context/UserContext";
import {
    cancelReview,
    getCinematic,
    updateCinematic,
    updateDestination,
    updateRoomParameters,
    getStylekitByRoom,
    updateStylekit,
    resetKitBash,
} from "@utils/saveToDb";

import { UploadMetadata } from "./Modals/Loader";
import { showError } from "@components/Dialogs";
import { uploadFile } from "@utils/media/mediaUploader";
import { useRouter } from "next/router";
import { Kitbash, Stylekit } from "@uitypes/experience";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { isBlobUrl } from "@utils/js";

const EditScene = dynamic(() => import("./EditScene"), {
    ssr: false,
});

const EditMetadata = dynamic(() => import("./Modals/EditMetadata"), {
    ssr: false,
});

const UploadLoader = dynamic(() => import("./Modals/Loader"), {
    ssr: false,
});

const SceneUpdating = dynamic(() => import("./Modals/SceneUpdating"), {
    ssr: false,
});

const SubmitForReview = dynamic(() => import("./Modals/SubmitForReview"), {
    ssr: false,
});

const Mint = dynamic(() => import("./Modals/Mint"), {
    ssr: false,
});

type ModalState =
    | { type: "none" }
    | { type: "metadata" }
    | { type: "uploader"; metadata: UploadMetadata }
    | { type: "upload_success"; slug: string }
    | { type: "physics_update_modal"; step: "success" | "pending" }
    | {
          type: "submit_review";
          destination: Destination;
          callback: UploaderCallback;
      }
    | {
          type: "mint";
          destination: Destination;
          callback: UploaderCallback;
      };

export type Destination = Destinations;

export interface GlbUpload {
    fileURL: string;
    // file: File;
}

type PhysicsEvent =
    | "PhysicsUpdateSuccess"
    | "UploadSuccess"
    | "SubmitForReview"
    | "CancelReview"
    | "Mint";

type UploaderCallback = (
    destination: Destination,
    event: PhysicsEvent
) => unknown;

export type SceneState = {
    type: "SceneEdit";
    destination: Destination;
    stylekit?: Stylekit;
    newUpload: GlbUpload;
    spline: Spline;
    callback?: UploaderCallback;
};
// | {
//       type: "Kitbash";
//       stylekit: Stylekit;
//       destination: Destination;
//       callback?: UploaderCallback;
//   };

export interface UploaderContextState {
    //
    editPhysics: (
        destination: Destination,
        newUpload: GlbUpload,
        callback?: UploaderCallback
    ) => void;

    // editKitbash: (
    //     destination: Destination,
    //     callback?: UploaderCallback
    // ) => void;

    submitForReview: (
        destination: Destination,
        callback?: UploaderCallback
    ) => void;

    cancelReviewSubmission: (roomId: string) => Promise<Destination>;

    reSubmission: (roomId: string) => Promise<Destination>;

    mint: (destination: Destination, callback?: UploaderCallback) => void;

    isModal: boolean;
}

const UploaderContext = React.createContext<UploaderContextState>(null);

function checkServerError(response, defaultMsg = "Unknown Error") {
    if (!response.success) {
        throw new Error(response.error || response.message || defaultMsg);
    }
}

function UploaderProvider_Child({
    children,
    initSceneState = null,
    fallbackRoute = null,
}) {
    //

    const { token } = useContext(UserContext);

    const router = useRouter();

    const isModal =
        router.asPath != "/destinations" && router.asPath != "/studio";

    const world = useWorld();

    const [sceneState, setSceneState] = useState<SceneState>(initSceneState);

    const [splinesState, setSplinesState] = useState<Spline>(null);

    const [currentModal, setCurrentModal] = useState<ModalState>({
        type: "none",
    });

    // The name typed into the Upload form. After a failed upload is closed,
    // the next Upload press shows it again instead of an empty form. Dropped
    // once the space is uploaded, and with the scene it belongs to.
    const [typedName, setTypedName] = useState<{
        name: string;
        slug: string;
    }>(null);

    const handleSceneSubmit = useEventCallback(
        //
        async (
            newParams: RoomParameters,
            newKitbash: Stylekit["kitbash"],
            splines: Spline
        ) => {
            //
            if (
                // @ts-ignore
                newParams?.background_type === "image" &&
                newParams?.backgroundMap?.id === "custom" &&
                !newParams?.backgroundMap?.path
            ) {
                //
                showError(
                    "Upload unsuccessful. Please select a preset background to continue."
                );
                return;
            }

            if (
                newParams?.enableReflector &&
                newParams?.reflectorOptions?.normalmap?.images?.id ===
                    "custom" &&
                !newParams?.reflectorOptions?.normalmap?.images?.path
            ) {
                showError(
                    "Upload unsuccessful. Please select a floor image to continue."
                );
                return;
            }

            if (
                // @ts-ignore
                newParams?.environnement_type === "image" &&
                newParams?.envMap?.id === "custom" &&
                !newParams?.envMap?.path
            ) {
                showError(
                    "Upload unsuccessful. Please select a preset image to continue."
                );
                return;
            }

            const nbElements = world.current.getKitBashTypes().length;

            setSceneState((state) => {
                return {
                    ...state,
                    destination: {
                        ...state.destination,
                        nbElements,
                        params: {
                            ...state.destination.params,
                            ...newParams,
                        },
                    },
                    stylekit: state.stylekit
                        ? {
                              ...state.stylekit,
                              kitbash: newKitbash,
                          }
                        : null,
                };
            });

            setSplinesState(splines);

            if (sceneState.newUpload) {
                //

                if (
                    !sceneState?.destination?._id ||
                    sceneState?.destination?.status === "tested"
                ) {
                    //
                    setCurrentModal({ type: "metadata" });
                } else {
                    //

                    handleEditMetadataSubmit({
                        name: sceneState?.destination?.name,
                        slug: sceneState?.destination?.slug,
                    });
                }
            } else {
                //

                setCurrentModal({
                    type: "physics_update_modal",
                    step: "pending",
                });

                const _id = sceneState.destination._id;

                const { uPath, ...rest } = newParams;

                if (splines) {
                    try {
                        console.log("splines", splines);

                        const cinematic = await updateCinematic(
                            splines,
                            sceneState.destination?.slug
                        );

                        if (!cinematic?.success) {
                            throw "Failed to update spline";
                        }
                    } catch (error) {
                        setCurrentModal({ type: "none" });
                        console.error(error);

                        showError("Failed to update spline");
                        return;
                    }
                }

                if (sceneState.stylekit) {
                    try {
                        console.log("kitbash reset", newKitbash);
                        await updateStylekit(
                            sceneState.stylekit.id,
                            resetKitBash(newKitbash),
                            token
                        );
                    } catch (err) {
                        setCurrentModal({ type: "none" });
                        console.error(err);
                        showError("Failed to update stylekit");
                        return;
                    }
                }

                try {
                    const hasEnvMapChanged =
                        newParams?.envMap?.path &&
                        newParams.envMap.path !==
                            sceneState.destination?.params?.envMap?.path;

                    if (
                        newParams?.envMap?.id === "custom" &&
                        isBlobUrl(newParams?.envMap?.path) &&
                        hasEnvMapChanged
                    ) {
                        const path = newParams?.envMap?.path;
                        const mimeType = newParams?.envMap?.mimeType;
                        const id = `envMap-${Date.now()}`;

                        let file = await fetch(path).then((r) => r.blob());

                        const result = await uploadFile({
                            file,
                            mimeType,
                            token,
                            id,
                        });

                        if (mimeType) {
                            delete newParams?.envMap?.mimeType;
                        }

                        const url = result?.secure_url;

                        newParams.envMap.path = url;
                        newParams.envMap.image = url;
                    }

                    const hasBackgroundMapChanged =
                        newParams?.backgroundMap?.path &&
                        newParams.backgroundMap.path !==
                            sceneState.destination?.params?.backgroundMap?.path;

                    if (
                        newParams?.backgroundMap?.id === "custom" &&
                        isBlobUrl(newParams?.backgroundMap?.path) &&
                        hasBackgroundMapChanged
                    ) {
                        const path = newParams?.backgroundMap?.path;
                        const mimeType = newParams?.backgroundMap?.mimeType;
                        const id = `envMap-${Date.now()}`;

                        let file = await fetch(path).then((r) => r.blob());

                        const result = await uploadFile({
                            file,
                            mimeType,
                            token,
                            id,
                        });

                        if (mimeType) {
                            delete newParams?.backgroundMap?.mimeType;
                        }

                        const url = result?.secure_url;

                        newParams.backgroundMap.path = url;
                        newParams.backgroundMap.image = url;
                    }

                    const hasNormalMapChanged =
                        newParams?.reflectorOptions?.normalmap?.images?.path &&
                        newParams.reflectorOptions.normalmap.images.path !==
                            sceneState.destination?.params?.reflectorOptions
                                ?.normalmap?.images?.path;

                    if (
                        newParams?.reflectorOptions?.normalmap?.images?.id ===
                            "custom" &&
                        isBlobUrl(
                            newParams?.reflectorOptions?.normalmap?.images?.path
                        ) &&
                        hasNormalMapChanged
                    ) {
                        const path =
                            newParams?.reflectorOptions?.normalmap?.images
                                ?.path;
                        const mimeType =
                            newParams?.reflectorOptions?.normalmap?.images
                                ?.mimeType;
                        const id = `normalMap-${Date.now()}`;

                        let file = await fetch(path).then((r) => r.blob());

                        const result = await uploadFile({
                            file,
                            mimeType,
                            token,
                            id,
                        });

                        if (mimeType) {
                            delete newParams?.reflectorOptions?.normalmap
                                ?.images?.mimeType;
                        }

                        const url = result?.secure_url;

                        newParams.reflectorOptions.normalmap.images.path = url;
                        newParams.reflectorOptions.normalmap.images.image = url;
                    }

                    //  Do not generate thumbnail when space is deployed
                    if (sceneState?.destination?.status !== "active") {
                        const file = await world.current.takeBase64Screenshot();

                        const id = sceneState.destination?.slug.concat(
                            `-thumbnail-${_id}`
                        );

                        const result = await uploadFile({
                            file,
                            mimeType: "image/*",
                            token,
                            id,
                            isUnique: true,
                        });

                        const thumbnail = result?.secure_url;

                        if (!thumbnail) {
                            throw "Unable to upload thumbnail";
                        } else {
                            const response = await updateDestination(
                                _id,
                                token,
                                {
                                    thumbnail,
                                    nbElements,
                                }
                            );

                            if (!response?.success) {
                                throw "Unable to save thumbnail";
                            }
                        }
                    }

                    const response = await updateRoomParameters(token, _id, {
                        ...rest,
                    });

                    if (!response?.success) {
                        throw new Error(
                            response?.error ||
                                response?.message ||
                                "Unknow error"
                        );
                    }

                    sceneState.callback?.(
                        response.data,
                        "PhysicsUpdateSuccess"
                    );

                    setCurrentModal({
                        type: "physics_update_modal",
                        step: "success",
                    });
                } catch (error) {
                    setCurrentModal({ type: "none" });
                    console.error(error);

                    showError("Failed to update room parameters");
                }
            }
        },
        []
    );

    const handleEditMetadataSubmit = useEventCallback((metadata) => {
        //

        setTypedName({ name: metadata.name, slug: metadata.slug });

        setCurrentModal({
            type: "uploader",
            metadata: {
                ...metadata,
                id: sceneState.destination._id,
                fileURL:
                    sceneState.type === "SceneEdit"
                        ? sceneState?.newUpload?.fileURL
                        : null,
            },
        });
    }, []);

    const handleSceneCancel = useEventCallback(() => {
        //
        setCurrentModal({ type: "none" });
        setTypedName(null);
        if (fallbackRoute != null) {
            router.push(fallbackRoute);
        } else {
            setSceneState(null);
        }
    }, []);

    // Leaves the upload window after a failed deploy. Unlike
    // handleSceneCancel, the scene stays open with the visitor's file, and
    // the name they typed is kept for their next Upload press.
    const handleUploadClose = useEventCallback(() => {
        setCurrentModal({ type: "none" });
    }, []);

    const handleUploadSuccess = useEventCallback((destination: Destination) => {
        //

        setTypedName(null);

        setCurrentModal({ type: "upload_success", slug: destination.slug });

        sceneState.callback?.(destination, "UploadSuccess");
    }, []);

    const handleUploadSuccessClose = useEventCallback(() => {
        setCurrentModal({ type: "none" });
        if (initSceneState == null) {
            setSceneState(null);
        } else if (fallbackRoute) {
            router.push(fallbackRoute);
        }
    }, []);

    const handleSubmitForReviewResult = useEventCallback(
        (destination: Destination | null) => {
            //
            if (currentModal.type !== "submit_review") return;

            if (destination) {
                currentModal.callback(destination, "SubmitForReview");
            }

            setCurrentModal({ type: "none" });
        },
        []
    );

    const handleMintResult = useEventCallback(
        (destination: Destination | null) => {
            //
            if (currentModal.type !== "mint") return;

            if (destination) {
                currentModal.callback(destination, "Mint");
            }

            setCurrentModal({ type: "none" });
        },
        []
    );

    // Provider Methods
    const editPhysics = useEventCallback(
        async (
            destination: Destination,
            newUpload: GlbUpload,
            callback: UploaderCallback
        ) => {
            if (!isModal) {
                const isNew = destination.paths?.low == null;

                // create a temp slug and push it to session storage
                // We need to keep the destination data while nextjs reloads

                const pathname = isNew
                    ? "/destinations/new"
                    : `/destinations/${destination.slug}/edit`;

                const query: any = {};

                if (newUpload) {
                    query.file = newUpload.fileURL;
                }

                if (destination.params.isFuture) {
                    query.future = true;
                }

                const asPath = { pathname, query };

                router.push(asPath);
            } else {
                try {
                    const loadStylekit =
                        destination.params.isFuture && !newUpload;

                    const [spline, stylekit] = await Promise.all([
                        getCinematic(null, destination.slug),
                        loadStylekit
                            ? getStylekitByRoom(destination.slug)
                            : null,
                    ]);

                    // Another scene: a name typed for the last one is not
                    // this one's.
                    setTypedName(null);

                    setSceneState({
                        type: "SceneEdit",
                        destination,
                        stylekit,
                        newUpload,
                        callback,
                        spline: spline?.cinematic,
                    });
                } catch (error) {
                    console.error(error);
                    showError("Failed to load spline, Please try later");
                }
            }
        },
        []
    );

    const submitForReview = useEventCallback(
        (destination: Destination, callback?: UploaderCallback) => {
            setCurrentModal({
                type: "submit_review",
                destination,
                callback,
            });
        },
        []
    );

    const cancelReviewSubmission = useEventCallback(async (roomId: string) => {
        //
        let response = await cancelReview(roomId, token);

        checkServerError(response);

        return response.data;
    }, []);

    const reSubmission = useEventCallback(async (roomId: string) => {
        //
        let response = await updateDestination(roomId, token, {
            status: "submitted",
        });

        checkServerError(response);

        return response.data;
    }, []);

    const handleCancelMetadata = () => {
        setCurrentModal({ type: "none" });
    };

    const mint = useEventCallback(
        (destination: Destination, callback?: UploaderCallback) => {
            setCurrentModal({
                type: "mint",
                destination,
                callback,
            });
        },
        []
    );

    const value: UploaderContextState = {
        editPhysics,
        submitForReview,
        cancelReviewSubmission,
        reSubmission,
        mint,
        isModal,
    };

    return (
        <UploaderContext.Provider value={value}>
            {children}

            {sceneState?.type === "SceneEdit" &&
                ReactDOM.createPortal(
                    <EditScene
                        spline={sceneState.spline}
                        stylekit={sceneState.stylekit}
                        destination={sceneState.destination}
                        newUpload={sceneState.newUpload}
                        submitAction={sceneState.newUpload ? "Upload" : "Save"}
                        onSubmit={handleSceneSubmit}
                        onCancel={handleSceneCancel}
                    />,
                    document.body
                )}

            {/* {sceneState?.type === "Kitbash" &&
                    ReactDOM.createPortal(
                        <EditKitbash
                            destination={sceneState.destination}
                            onClose={handleSceneCancel}
                        />,
                        document.body
                    )} */}

            {currentModal.type === "metadata" && (
                <EditMetadata
                    destination={
                        // The form starts from the destination's name. A
                        // remembered name takes its place, and as it was
                        // already checked as free on the first press, the
                        // form checks again only if it is changed.
                        typedName
                            ? { ...sceneState.destination, ...typedName }
                            : sceneState.destination
                    }
                    onSubmit={handleEditMetadataSubmit}
                    onCancel={handleCancelMetadata}
                />
            )}

            {currentModal.type === "uploader" && (
                <UploadLoader
                    mode="submit"
                    metadata={currentModal.metadata}
                    destination={sceneState.destination}
                    onSuccess={handleUploadSuccess}
                    onCancel={handleUploadClose}
                    splines={splinesState}
                />
            )}

            {currentModal.type === "upload_success" && (
                <UploadSuccess
                    slug={currentModal.slug}
                    closeLabel="View Uploads"
                    onClose={handleUploadSuccessClose}
                />
            )}

            {currentModal.type === "physics_update_modal" && (
                <SceneUpdating
                    onClose={handleUploadSuccessClose}
                    step={currentModal.step}
                />
            )}

            {currentModal.type === "submit_review" && (
                <SubmitForReview
                    destination={currentModal.destination}
                    onSuccess={(d) => handleSubmitForReviewResult(d)}
                    onCancel={() => handleSubmitForReviewResult(null)}
                />
            )}

            {currentModal.type === "mint" && (
                <Mint
                    destination={currentModal.destination}
                    onSuccess={() => handleMintResult(currentModal.destination)}
                    onCancel={() => handleMintResult(null)}
                />
            )}
        </UploaderContext.Provider>
    );
}

export function UploaderProvider(props) {
    const world = useRef(null);

    return (
        <WorldProvider world={world}>
            <UploaderProvider_Child {...props} />
        </WorldProvider>
    );
}

export function useUploader() {
    return useContext(UploaderContext);
}
