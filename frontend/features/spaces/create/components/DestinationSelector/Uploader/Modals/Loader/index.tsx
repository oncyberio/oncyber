import React, {
    useEffect,
    useContext,
    useReducer,
    useRef,
    forwardRef,
} from "react";
import {
    applyFactory,
    getUserDestination,
    updateFactory,
    uploadCinematic,
    updateCinematic,
} from "@utils/saveToDb";
import Step from "./Step";
import styled from "styled-components";
import { UserContext } from "@context/UserContext";
import { OptimiseModelFiles } from "@uitypes/Asset";
import { amplitude_logAnalyticsEvent, getCookie } from "@utils/analytics";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { eachKey, isBlobUrl, noop } from "@utils/js";
import Modal from "@components/modals/Modal";
import { RoundButton } from "@components/DesignSystem/buttons";
import {
    dialogButtons,
    dialogCopy,
    dialogTitle,
} from "@components/Dialogs/styles";
import { Destination, UploaderSceneData } from "@uitypes/destinations";
import { extToMime } from "@utils/mimeUtils";
import { getSlug } from "@utils/destinations";
import {
    uploadFile,
    uploadFileBatch,
    UploadFileBatchOpts,
    uploadKitbashImages,
} from "@utils/media/mediaUploader";
import { createDefaultStylekit } from "@features/spaces/create/utils";
import { Spline } from "@uitypes/roomParameters";
import isEmpty from "lodash/isEmpty";
import {
    initialUploadState,
    shouldRun,
    uploadTransition,
} from "./uploadMachine";

export interface UploadMetadata {
    id?: string;
    slug: string;
    name: string;
    email?: string;
    thumbnail?: string;
    openSeaUrl?: string;
    needReview?: boolean;
    description?: string;
    animationHash?: string;
    fileURL?: string;
}

export interface LoaderProps {
    splines?: Spline;
    mode: "submit" | "edit";
    metadata: UploadMetadata;
    destination: Destination;
    onSuccess: (destination: Destination) => unknown;
    onError?: (error: string) => unknown;
    /** Leaves the window. "Close" calls it after a deploy has failed. */
    onCancel: () => unknown;
}

const Loader = forwardRef<HTMLDivElement, LoaderProps>(
    (
        {
            mode,
            metadata,
            splines,
            destination,
            onSuccess,
            onError = noop,
            onCancel,
        },
        ref
    ) => {
        //

        const {
            id,
            name,
            slug,
            email,
            thumbnail,
            needReview,
            description,
            animationHash,
            fileURL,
        } = metadata;

        const destinationParameters = destination.params;

        const world = useWorld();

        const { user, token } = useContext(UserContext);

        const prevUpload = destination.paths?.low;

        // The three steps, whether the attempt failed, and how many "Try
        // again" presses: one state (uploadMachine.ts).
        const [deploy, dispatchDeploy] = useReducer(
            uploadTransition,
            initialUploadState
        );

        // A failed deploy stays in the window, which then offers a way out.
        const failed = deploy.status === "failed";

        // What the finished steps produced. "Try again" resumes at the step
        // that failed and reuses these, so a model that was already prepared
        // or uploaded is not prepared or uploaded a second time.
        const kept = useRef<{
            done: {
                /** The cinematic was saved; adding it again is refused. */
                cinematic: boolean;
            };
            /** A request to create the destination went out. */
            createSent: boolean;
            coverImage: string;
            kitbashImgs: Record<string, string>;
            payload: {
                thumbnail: string;
                paths: Record<string, Object>;
                files: OptimiseModelFiles;
            };
        }>({
            done: { cinematic: false },
            createSent: false,
            coverImage: undefined,
            kitbashImgs: {},
            payload: {
                thumbnail: null,
                paths: {},
                files: {
                    high: null,
                    low: null,
                    mid: null,
                    origin: null,
                    lowCompressed: null,
                },
            },
        }).current;

        const handleClose = () => {
            // The deploy hides the frames for the cover shot. The editor the
            // visitor returns to shows them again, as its settings say.
            world.current?.setShowPlaceholders?.(
                destinationParameters?.showPlaceholders !== false
            );
            onCancel();
        };

        // Finished steps keep their tick. The failed one waits again.
        const handleRetry = () => dispatchDeploy({ type: "retry" });

        useEffect(() => {
            const { payload, kitbashImgs } = kept;

            // The state this attempt starts from: what earlier ones finished.
            const resume = deploy;

            doUpload().catch((err) => {
                console.error(err);
                dispatchDeploy({ type: "failed" });
                onError(err.message || "Unknown Error");
            });

            const placeholderKey = (
                p: UploaderSceneData["placeholders"][number]
            ) => {
                return p.position.concat(p.rotation).join("X");
            };

            // async function validateNewSceneData(sceneData: UploaderSceneData) {
            //     //

            //     console.log("validateNewSceneData");

            //     let warning: string;

            //     const prevSceneData = await world.current.getSceneData({
            //         url: prevUpload,
            //     });

            //     let placeholderMap = {};

            //     let portalMap = {};

            //     sceneData.placeholders.forEach((it) => {
            //         placeholderMap[placeholderKey(it)] = true;
            //     });

            //     sceneData.portals.forEach((it) => {
            //         placeholderMap[it] = true;
            //     });

            //     const hasMissingPlaceholders = prevSceneData.placeholders.some(
            //         (p) => {
            //             return placeholderMap[placeholderKey(p)] == null;
            //         }
            //     );

            //     warning = hasMissingPlaceholders
            //         ? "Frames positions has changed, it may bug already deployed spaces."
            //         : null;

            //     if (!hasMissingPlaceholders) {
            //         //
            //         const hasMissingPortals = prevSceneData.portals.some(
            //             (id) => {
            //                 return portalMap[id] == null;
            //             }
            //         );

            //         warning = hasMissingPortals
            //             ? "Portals position has changed, it may bug already deployed spaces."
            //             : null;
            //     }

            //     if (warning) {
            //         let ok = await showConfirm(
            //             <>
            //                 <p>{warning}</p>
            //                 <p>Are you sure you want to continue?</p>
            //             </>
            //         );

            //         if (!ok) {
            //             onCancel();
            //             return false;
            //         }
            //     }

            //     return true;
            // }

            async function doUpload() {
                //
                const sceneData = await world.current.getSceneData();

                // let shouldContinue = true;

                // if (prevUpload) {
                //     //
                //     try {
                //         setStepLoader((prev) => ({
                //             ...prev,
                //             compatibility: "progress",
                //         }));

                //         shouldContinue = await validateNewSceneData(sceneData);

                //         setStepLoader((prev) => ({
                //             ...prev,
                //             compatibility: "success",
                //         }));
                //     } catch (err) {
                //         amplitude_logAnalyticsEvent("space_submit_error", {
                //             sessionId: getCookie("uploader"),
                //             message: "Failed to check compatibility",
                //             type: "compatibility_fail",
                //         });

                //         setStepLoader((prev) => ({
                //             ...prev,
                //             compatibility: "error",
                //         }));
                //         throw err;
                //     }
                // }

                // if (!shouldContinue) return;

                if (destinationParameters.isPointerLockControls) {
                    delete destinationParameters.isPointerLockControls;
                }

                // "Try again" comes back here. The steps that finished on an
                // earlier attempt are skipped: their results are in `kept`.
                if (shouldRun(resume, "quality_model")) await prepareModels();

                if (shouldRun(resume, "upload_cdn")) await uploadToCdn();

                await uploadToDb(sceneData);
            }

            async function prepareModels() {
                try {
                    dispatchDeploy({ type: "started", step: "quality_model" });

                    await world.current.setShowPlaceholders(false);

                    if (destination?.status !== "active") {
                        kept.coverImage =
                            await world.current.takeBase64Screenshot({
                                background: destinationParameters?.background,
                                resetPosition: true,
                            });
                    }

                    if (fileURL) {
                        //
                        const response = await fetch(fileURL);

                        const data = await response.arrayBuffer();

                        const origin = new Blob([data], {
                            type: "model/gltf+binary;charset=utf-8",
                        });

                        // console.log( destinationParameters )
                        // console.log( destinationParameters )
                        // console.log( destinationParameters )

                        const { default: Optimiser } = await import(
                            "@components/_3DExhibit-v2/three/modules/optimiser"
                        );
                        const files = await Optimiser.get(
                            fileURL,
                            destinationParameters
                        );

                        payload.files = {
                            ...files,
                            origin,
                        };
                    }

                    dispatchDeploy({ type: "done", step: "quality_model" });
                } catch (err) {
                    amplitude_logAnalyticsEvent("space_submit_error", {
                        sessionId: getCookie("uploader"),
                        message: "Failed to optimize file",
                        type: "optimizer_fail",
                    });

                    dispatchDeploy({
                        type: "failed-step",
                        step: "quality_model",
                    });
                    throw err;
                }
            }

            async function uploadToCdn() {
                try {
                    dispatchDeploy({ type: "started", step: "upload_cdn" });

                    // The models are dropped once they are on the CDN, so a
                    // retry after that point has only the thumbnail left.
                    if (fileURL && payload.files) {
                        //
                        const { low, mid, high, origin, lowCompressed } =
                            payload.files;

                        const mimeType = extToMime["glb"];

                        try {
                            let low_result = await uploadFile({
                                file: low,
                                mimeType,
                                token,
                                id: `${slug}-low-.glb`,
                            });

                            let mid_result = await uploadFile({
                                file: mid,
                                mimeType,
                                token,
                                id: `${slug}-mid.glb`,
                            });

                            let high_result = await uploadFile({
                                file: high,
                                mimeType,
                                token,
                                id: `${slug}-high.glb`,
                            });

                            let origin_result = await uploadFile({
                                file: origin,
                                mimeType,
                                token,
                                id: `${slug}-origin.glb`,
                            });

                            let lowcompressed_result = await uploadFile({
                                file: lowCompressed,
                                mimeType,
                                token,
                                id: `${slug}-low-compressed.glb`,
                            });

                            if (destination.params.isFuture) {
                                //
                                let kitImages =
                                    world.current.getKitbashImages();

                                let rawkitbashImages = Object.keys(
                                    kitImages
                                ).map((key) => {
                                    return {
                                        type: key,
                                        image: kitImages[key],
                                    };
                                });

                                let imgUploads = await uploadKitbashImages(
                                    slug,
                                    rawkitbashImages,
                                    token
                                );

                                imgUploads.forEach((it, i) => {
                                    const { type } = rawkitbashImages[i];
                                    kitbashImgs[type] = it.url;
                                });
                            }

                            payload.paths = {
                                low: low_result.secure_url,
                                mid: mid_result.secure_url,
                                high: high_result.secure_url,
                                original_path: origin_result.secure_url,
                                low_compressed: lowcompressed_result.secure_url,
                            };

                            if (payload?.files) {
                                delete payload.files;
                            }
                        } catch (err) {
                            //
                            console.error(err);

                            amplitude_logAnalyticsEvent("space_submit_error", {
                                sessionId: getCookie("uploader"),
                                message: "Uploading files to our CDN failed",
                                type: "cdn_fail",
                            });

                            throw new TypeError(
                                "Uploading files to our CDN failed"
                            );
                        }
                    }

                    if (mode === "submit" || mode === "edit") {
                        //
                        if (kept.coverImage) {
                            //
                            try {
                                const thumbnail_result = await uploadFile({
                                    token,
                                    file: kept.coverImage,
                                    mimeType: "image/jpeg",
                                    id: `${slug}-thumb`,
                                });

                                payload.thumbnail = thumbnail_result.secure_url;
                            } catch (err) {
                                //
                                console.error(err);

                                amplitude_logAnalyticsEvent(
                                    "space_submit_error",
                                    {
                                        sessionId: getCookie("uploader"),
                                        message:
                                            "Uploading thumbnail to our CDN failed",
                                        type: "upload_thumbnail_fail",
                                    }
                                );

                                throw new TypeError(
                                    "Uploading thumbnail to our CDN failed"
                                );
                            }
                        }
                    }

                    dispatchDeploy({ type: "done", step: "upload_cdn" });
                    //
                } catch (err) {
                    amplitude_logAnalyticsEvent("space_submit_error", {
                        sessionId: getCookie("uploader"),
                        message: "Failed to upload to cdn",
                        type: "upload_cdn_fail",
                    });

                    dispatchDeploy({ type: "failed-step", step: "upload_cdn" });

                    throw err;
                }
            }

            async function uploadToDb(sceneData: {
                placeholdersSize?: number;
            }) {
                try {
                    dispatchDeploy({ type: "started", step: "upload_db" });

                    if (destination.params.isFuture) {
                        let _kitbashDatas = world.current.getKitBashData();

                        let kitbashDatas = eachKey(_kitbashDatas, (it: any) => {
                            return {
                                ...it,
                                addedBy: user.id,
                            };
                        });

                        const stylekit = await createDefaultStylekit(
                            slug,
                            kitbashDatas,
                            kitbashImgs,
                            user.id,
                            token
                        );
                    }

                    // Saved once: adding a cinematic that exists is refused.
                    if (!isEmpty(splines) && !kept.done.cinematic) {
                        const cinematicUpload =
                            mode === "submit"
                                ? uploadCinematic
                                : updateCinematic;

                        const cinematic = await cinematicUpload(splines, slug);

                        if (!cinematic?.success) {
                            throw "Failed to upload spline";
                        }

                        kept.done.cinematic = true;
                    }

                    let response = null;

                    if (destinationParameters?.uPath) {
                        delete destinationParameters.uPath;
                    }

                    const envMap = destinationParameters?.envMap;
                    const envMapPath = envMap?.path;

                    if (
                        envMap?.id === "custom" &&
                        envMapPath &&
                        isBlobUrl(envMapPath)
                    ) {
                        const mimeType = envMap?.mimeType;
                        const id = `envMap-${Date.now()}`;

                        let file = await fetch(envMapPath).then((r) =>
                            r.blob()
                        );

                        const result = await uploadFile({
                            file,
                            mimeType,
                            token,
                            id,
                        });

                        if (mimeType) {
                            delete envMap?.mimeType;
                        }

                        const url = result?.secure_url;

                        destinationParameters.envMap.path = url;
                        destinationParameters.envMap.image = url;
                    }

                    const backgroundMap = destinationParameters?.backgroundMap;
                    const backgroundMapPath = backgroundMap?.path;

                    if (
                        backgroundMap?.id === "custom" &&
                        backgroundMapPath &&
                        isBlobUrl(backgroundMapPath)
                    ) {
                        const mimeType = backgroundMap?.mimeType;
                        const id = `envMap-${Date.now()}`;

                        let file = await fetch(backgroundMapPath).then((r) =>
                            r.blob()
                        );

                        const result = await uploadFile({
                            file,
                            mimeType,
                            token,
                            id,
                        });

                        if (mimeType) {
                            delete backgroundMap?.mimeType;
                        }

                        const url = result?.secure_url;

                        destinationParameters.backgroundMap.path = url;
                        destinationParameters.backgroundMap.image = url;
                    }

                    const normalMapImage =
                        destinationParameters?.reflectorOptions?.normalmap
                            ?.images;

                    const normalMapImagePath = normalMapImage?.path;

                    if (
                        normalMapImage?.id === "custom" &&
                        normalMapImagePath &&
                        isBlobUrl(normalMapImagePath)
                    ) {
                        const mimeType = normalMapImage?.mimeType;
                        const id = `normalMap-${Date.now()}`;
                        let file = await fetch(normalMapImagePath).then((r) =>
                            r.blob()
                        );

                        const result = await uploadFile({
                            file,
                            mimeType,
                            token,
                            id,
                        });

                        if (mimeType) {
                            delete normalMapImage?.mimeType;
                        }

                        const url = result?.secure_url;

                        destinationParameters.reflectorOptions.normalmap.images.path =
                            url;
                        destinationParameters.reflectorOptions.normalmap.images.image =
                            url;
                    }

                    const nbElements = world.current.getKitBashTypes().length;

                    const body = {
                        name,
                        paths: {
                            ...payload.paths,
                        },
                        ...(payload?.thumbnail && {
                            thumbnail: payload.thumbnail,
                        }),
                        params: {
                            ...destinationParameters,
                            artworkScale: 150,
                            capacity: sceneData?.placeholdersSize || 0,
                        },
                        author: {
                            id: user?.id,
                        },
                        nbElements,
                    };

                    if (mode === "submit") {
                        //
                        if (prevUpload) {
                            response = await updateFactory(token, id, body);
                        } else {
                            // An earlier create may have been saved although
                            // its answer never arrived. Sending it again
                            // would make a second destination with the same
                            // name, so a retry first looks for that one.
                            const saved = kept.createSent
                                ? await getUserDestination(
                                      token,
                                      user?.id,
                                      getSlug(name)
                                  )
                                : null;

                            if (saved?.success && saved.data) {
                                response = {
                                    status: "success",
                                    destination: saved.data,
                                };
                            } else {
                                kept.createSent = true;
                                response = await applyFactory(token, body);
                            }
                        }
                    } else if (mode === "edit") {
                        response = await updateFactory(token, id, {
                            ...body,
                            author: {
                                id: user?.id,
                                ...(email && { email }),
                            },
                            needReview,
                            ...(thumbnail && { thumbnail }),
                            ...(description && { description }),
                            ...(animationHash && { animationHash }),
                        });
                    }

                    const { status } = response;

                    if (status !== "success") {
                        amplitude_logAnalyticsEvent("space_submit_error", {
                            sessionId: getCookie("uploader"),
                            message: "Uploading to DB failed",
                            type: "db_upload_fail",
                        });

                        throw new TypeError("Uploading to DB failed");
                    }

                    dispatchDeploy({ type: "done", step: "upload_db" });

                    amplitude_logAnalyticsEvent("successful_space_submit", {
                        sessionId: getCookie("uploader"),
                        name,
                        link: `/destinations/${slug}`,
                    });

                    onSuccess(response.destination);
                } catch (err) {
                    amplitude_logAnalyticsEvent("space_submit_error", {
                        sessionId: getCookie("uploader"),
                        message: "Did not manage to submit... Try again later.",
                        type: "upload_fail",
                    });

                    dispatchDeploy({ type: "failed-step", step: "upload_db" });
                    throw err;
                }
            }
        }, [deploy.attempt]);

        return (
            <Modal
                hasBackground
                toggle={noop}
                isShowing={true}
                isBackdrop={false}
                noShowClose={true}
                // The shared dark dialog surface (see Dialogs/styles).
                className="dialog-window"
                style={{
                    margin: "0",
                    padding: "0",
                    width: "565px",
                    maxWidth: "90%",
                    maxHeight: "90%",
                    overflowY: "auto",
                    overflowX: "hidden",
                }}
            >
                <Container
                    ref={ref}
                    data-machine="upload"
                    data-state={deploy.status}
                >
                    <div>
                        {!failed && (
                            <div>
                                <div className="dot-flashing" />
                            </div>
                        )}
                        <h1>
                            {failed
                                ? "We couldn’t finish deploying your space"
                                : "Deploying your space…"}
                        </h1>
                        <span className="deploy-steps">
                            {/* {prevUpload && (
                                <Step
                                    status={stepLoader.compatibility}
                                    description={
                                        "Checking new Model compatiblity"
                                    }
                                />
                            )} */}
                            <Step
                                status={deploy.steps.quality_model}
                                description={
                                    "Preparing different quality models"
                                }
                            />
                            <Step
                                status={deploy.steps.upload_cdn}
                                description={"Uploading files to our CDN"}
                            />
                            <Step
                                status={deploy.steps.upload_db}
                                description={"Uploading to DB"}
                            />
                        </span>
                        {failed && (
                            <span className="deploy-actions">
                                <RoundButton
                                    className="btn"
                                    onClick={handleClose}
                                >
                                    Close
                                </RoundButton>
                                <RoundButton
                                    className="btn primary"
                                    onClick={handleRetry}
                                >
                                    Try again
                                </RoundButton>
                            </span>
                        )}
                    </div>
                </Container>
            </Modal>
        );
    }
);

// The surface (panel, border, corners, shadow, font and the colour
// variables) comes from the "dialog-window" class on the modal.
const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: auto;
    font-style: normal;
    padding: 40px clamp(24px, 12vw, 6.25rem) !important;

    & > div {
        display: flex;
        flex-direction: column;
        align-items: center;

        & > div {
            width: 60px;
            height: 60px;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50px;
            margin-bottom: 15px;
            border: none;

            @media (max-width: 800px) {
                width: 40px;
                height: 40px;
                border-radius: 999px;
            }

            div.dot-flashing {
                position: relative;
                width: 4px;
                height: 4px;
                border-radius: 5px;
                background-color: #292929;
                color: #292929;
                animation: dotFlashing 1s infinite linear alternate;
                animation-delay: 0.5s;

                &::before,
                &::after {
                    content: "";
                    display: inline-block;
                    position: absolute;
                    top: 0;
                }

                &::before {
                    left: -15px;
                    width: 4px;
                    height: 4px;
                    border-radius: 5px;
                    background-color: #292929;
                    color: #292929;
                    animation: dotFlashing 1s infinite alternate;
                    animation-delay: 0s;
                }

                &::after {
                    left: 15px;
                    width: 4px;
                    height: 4px;
                    border-radius: 5px;
                    background-color: #292929;
                    color: #292929;
                    animation: dotFlashing 1s infinite alternate;
                    animation-delay: 1s;
                }
            }

            @keyframes dotFlashing {
                0% {
                    background-color: #292929;
                }
                50% {
                    background-color: #7a7a7a;
                }
                100% {
                    background-color: #ebe6ff;
                }
            }
        }

        & > .deploy-steps {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
            margin-top: 32px;
        }

        & > .deploy-actions {
            display: flex;
            flex-direction: row;
            gap: 8px;
            margin-top: 32px;

            ${dialogButtons}
        }

        & > h1 {
            ${dialogTitle}
        }

        & > p {
            ${dialogCopy}
        }

        & > button {
            margin-top: 25px;
            padding: 15px 25px;
            font-weight: 700;
            font-size: 16px;
            line-height: 100%;
            text-align: center;
            color: #ffffff;
            background-color: transparent;
            border: 1px solid #292929;
            border-radius: 50px;

            @media (max-width: 800px) {
                font-size: 14px;
            }
        }
    }
`;

export default Loader;
