import React, { useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "@components/context/UserContext";
import { LAYOUTS } from "../CinematicToggle/Cinematic/shared/constants";
import { LAYOUT_TYPES } from "@components/_3DExhibit-v2/three/modules/cinematic/composer/constants";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { APP_STATES } from "@components/_3DExhibit-v2/three/constants";
import { uploadFile } from "@utils/media/mediaUploader";
import { updateExhibitInfo } from "@utils/saveToDb";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { cloudinary } from "@utils/urlUtils";

type Step = "preview" | "processing" | "download";
type LoadingProgress = "" | "uploading" | "saving";
type Format = { width: number; height: number; format: string; type: string };
/** `canRetry` is false when recording again cannot help (no browser support). */
type RecordFailure = { message: string; canRetry: boolean };

interface CinematicContextState {
    step: Step;
    progress: number;
    videoFormat: Format;
    isRecordCompleted: boolean;
    isRecordSupported: boolean;
    cinematicStateLoaded: boolean;
    loadingProgress: LoadingProgress;
    /** Why the last recording failed, shown under Record; null otherwise. */
    recordFailure: RecordFailure;
    previewRef: React.MutableRefObject<HTMLCanvasElement>;
    bgPreviewRef: React.MutableRefObject<HTMLCanvasElement>;
    //
    enterCinematic: () => Promise<void>;
    exitCinematic: () => Promise<void>;

    play: () => void;
    cancel: () => void;
    record: () => void;
    download: () => void;
    videoFormatChange: (layout) => void;
}

const CinematicContext = React.createContext<CinematicContextState>(null);

export function CinematicProvider({ children }) {
    const world = useWorld();

    const { user, token } = useContext(UserContext);

    const { exhibit, baseAnalyticsEvent } = useCurrentExhibit();

    const previewRef = useRef<HTMLCanvasElement>(null);
    const bgPreviewRef = useRef<HTMLCanvasElement>(null);

    const [videoFormat, setVideoFormat] = useState(
        LAYOUTS[LAYOUT_TYPES.SQUARE]
    );
    const [progress, setProgress] = useState(0);
    const [step, setStep] = useState<Step>("preview");
    const [isRecordSupported, setRecordSupported] = useState(true);
    const [isRecordCompleted, setRecordCompleted] = useState(false);
    const [cinematicStateLoaded, setCinematicStateLoaded] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>("");
    const [recordFailure, setRecordFailure] = useState<RecordFailure>(null);

    useEffect(() => {
        if (step === "preview") {
            setRecordCompleted(false);
        }
    }, [step]);

    const enterCinematic = useEventCallback(async () => {
        await world.current.loadState(APP_STATES.CINEMATIC);
        await world.current.setState(APP_STATES.CINEMATIC, {
            edit: true,
        });
        await world.current.play();
        setRecordSupported(world.current?.supportWebRecorder?.());
        setCinematicStateLoaded(true);
    }, []);

    const exitCinematic = useEventCallback(async () => {
        // await world.current.setState(APP_STATES.SPACE, { edit: true });
    }, []);

    async function play() {
        //
        try {
            if (!cinematicStateLoaded) return;
            await world.current.setState(APP_STATES.CINEMATIC, {
                play: true,
            });
            world.current.play();

            amplitude_logAnalyticsEvent("play_cinematic", baseAnalyticsEvent);
        } catch (err) {
            console.error(err);

            amplitude_logAnalyticsEvent("error_cinematic", {
                ...baseAnalyticsEvent,
                error: err?.message || "Failed to play",
            });
        }
    }

    async function cancel() {
        setProgress(0);
        world.current.setState(APP_STATES.CINEMATIC, {
            cancel: true,
        });
        setStep("preview");
    }

    async function record() {
        setRecordFailure(null);

        if (!isRecordSupported) {
            //
            setRecordFailure({
                message: "This browser can't record video.",
                canRetry: false,
            });

            amplitude_logAnalyticsEvent("error_cinematic", {
                ...baseAnalyticsEvent,
                error: "Reroding unsupported",
            });

            return;
        }

        try {
            setProgress(0);

            setStep("processing");

            await world.current.removeCinematicPreviewSize({
                mode: videoFormat.type,
            });

            await world.current.play();

            const contexts = [
                previewRef?.current.getContext("2d"),
                bgPreviewRef?.current.getContext("2d"),
            ];

            await world.current.setState(APP_STATES.CINEMATIC, {
                records: true,
                callback: async (res) => {
                    if (res?.bitmap) {
                        contexts.forEach((ctx, index) => {
                            ctx?.drawImage(
                                res?.bitmap,
                                0,
                                0,
                                videoFormat.width,
                                videoFormat.height
                            );
                            ctx.filter =
                                index === 0 ? "blur(5px)" : "blur(10px)";
                        });
                    }
                    setProgress(Math.floor((res?.progression || 0) * 100));

                    if (res?.blobFile) {
                        setStep("download");

                        setRecordCompleted(true);

                        setLoadingProgress("uploading");

                        const publicId = cloudinary.sanitizePublicID(
                            exhibit?.info?.headline || exhibit.id
                        );

                        // One thing we can is to use cloudinary metadata to fetch the previous
                        // saved assets and purge them after or before we upload the new asset.
                        const cloudinaryJob = await uploadFile({
                            file: res.blobFile,
                            token,
                            mimeType: "video/mp4",
                            id: `${user.id}/${publicId}`,
                        });

                        let path = "";

                        if (videoFormat.type === "SQUARE") {
                            path = "fVideoSquare";
                        } else if (videoFormat.type === "LANDSCAPE") {
                            path = "fVideoLandscape";
                        } else if (videoFormat.type === "PORTRAIT") {
                            path = "fVideoPortrait";
                        }

                        setLoadingProgress("saving");

                        await updateExhibitInfo(
                            exhibit.id,
                            { [path]: cloudinaryJob.secure_url },
                            token
                        );

                        setLoadingProgress("");

                        //console.log("cloudinary job", cloudinaryJob.secure_url);

                        amplitude_logAnalyticsEvent(
                            "record_cinematic",
                            baseAnalyticsEvent
                        );
                    }
                },
            });
        } catch (err) {
            console.error(err);

            amplitude_logAnalyticsEvent("error_cinematic", {
                ...baseAnalyticsEvent,
                error: err?.message || "Failed to record",
            });

            let msg =
                loadingProgress === "uploading"
                    ? "Couldn't upload the video."
                    : loadingProgress === "saving"
                    ? "Couldn't save the video."
                    : "Couldn't record the video.";

            // The preview comes back with the message under Record.
            setRecordFailure({ message: msg, canRetry: true });

            setStep("preview");
        }
    }

    async function download() {
        if (!isRecordCompleted || !cinematicStateLoaded) return;
        world.current.setState(APP_STATES.CINEMATIC, {
            download: true,
        });
    }

    function videoFormatChange(layout) {
        const payload = LAYOUTS[layout];
        setVideoFormat(payload);
    }

    const state = {
        step,
        progress,
        previewRef,
        videoFormat,
        bgPreviewRef,
        loadingProgress,
        recordFailure,
        isRecordCompleted,
        isRecordSupported,
        cinematicStateLoaded,
        //
        enterCinematic,
        exitCinematic,
        play,
        record,
        cancel,
        download,
        videoFormatChange,
    };

    return (
        <CinematicContext.Provider value={state}>
            {children}
        </CinematicContext.Provider>
    );
}

export function useCinematic() {
    return useContext(CinematicContext);
}
