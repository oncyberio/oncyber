import styled from "styled-components";
import { useRef, useContext, useState, useEffect } from "react";
import { AssetIcon } from "../shared/AssetIcon";
import { libraryCard } from "../shared/Library";
import InlineError from "@ui/components/InlineError";
import { UserContext } from "@components/context/UserContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { extToMime, getMimeType } from "@utils/mimeUtils";
import { getUploadErrorMsg, getUploader } from "./utils";
import { useEditWorld } from "../../context/WorldEditContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { reachedAnonLimits } from "@utils/anon";

//
const acceptedMimes = Object.keys(extToMime)
    .filter((ext) => {
        //
        let mime = extToMime[ext];
        return (
            mime.startsWith("image") ||
            mime.startsWith("video") ||
            mime.startsWith("audio") ||
            mime.startsWith("model")
        );
    })
    .map((ext) => `.${ext}`)
    .join(",");

/**
 * What to tell the visitor when an upload fails, and whether sending the
 * same file again can help. The `title`/`message` pair from
 * `getUploadErrorMsg` still goes to analytics unchanged.
 */
export function uploadFailure(err: Error): {
    message: string;
    canRetry: boolean;
} {
    switch (err?.message) {
        case "exists":
            return {
                message: "You have already uploaded this file.",
                canRetry: false,
            };
        case "mime":
            return {
                message:
                    "This kind of file can't be added. Use an image, a video, audio or a GLB model.",
                canRetry: false,
            };
        case "size-limit":
            return {
                message:
                    "This file is too large. Images can be up to 10 MB, 3D models, video and audio up to 30 MB.",
                canRetry: false,
            };
        default:
            return { message: "Couldn't upload the file.", canRetry: true };
    }
}

export interface UploadAssetProps {
    onUploadFinished: (opts: {
        url: string;
        name: string;
        hash: string;
        mimeType: string;
    }) => unknown;
}

export function UploadAsset({ onUploadFinished }: UploadAssetProps) {
    //
    const { token, isAnonymous } = useContext(UserContext);

    const uploader = getUploader(isAnonymous);

    const { baseAnalyticsEvent, droppedFile } = useEditWorld();

    const [uploadState, setUploadState] = useState<{ progress: number }>(null);

    const fileRef = useRef<HTMLInputElement>(null);

    const [isDragging, setIsDragging] = useState(false);

    // The last upload's failure, shown under the upload card. `retry` is set
    // when sending the same file again can help (docs/feedback.md).
    const [failure, setFailure] = useState<{
        message: string;
        retry?: () => void;
    }>(null);

    useEffect(() => {
        //
        const file = droppedFile.current;

        if (file) {
            //
            droppedFile.current = null;

            onFile(file, true);
        }
    }, [droppedFile.current]);

    const onFile = async (file: File, autoAdd = false) => {
        //

        if (file == null) return;

        // A new attempt replaces the old message.
        setFailure(null);

        let mime = getMimeType(file.name);

        let maxSize = 8 * 1024 * 1024;

        if (
            mime.includes("model/gltf-binary") ||
            mime.includes("model/gltf+json")
        ) {
            maxSize = 30 * 1024 * 1024;
        }

        if (file.size > maxSize) {
            setFailure({
                message: `This file is too large. The limit is ${
                    maxSize / 1024 / 1024
                } MB.`,
            });
            return;
        }

        if (
            isAnonymous &&
            (await reachedAnonLimits({ uploads: true, allUploads: true }))
        ) {
            //
            return;
        }

        setUploadState({ progress: 0 });

        try {
            const result = await uploader.saveUpload({
                file,
                mime,
                token,
                onProgress: (progress) => {
                    setUploadState({ progress });
                },
            });

            if (result.exists) {
                throw new Error("exists");
            }

            onUploadFinished(result);

            amplitude_logAnalyticsEvent("upload_custom_asset", {
                ...baseAnalyticsEvent,
                type: mime,
            });

            //
        } catch (e) {
            //
            console.error(e);

            const { message } = getUploadErrorMsg(e);

            amplitude_logAnalyticsEvent("failed_upload_custom_asset", {
                ...baseAnalyticsEvent,
                type: mime || "",
                error: message,
            });

            const shown = uploadFailure(e);

            setFailure({
                message: shown.message,
                retry: shown.canRetry ? () => onFile(file, autoAdd) : undefined,
            });
        } finally {
            //
            setUploadState(null);

            //reset file input
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const handleZoneDargOver = useEventCallback((e) => {
        e.preventDefault();
        if (e.dataTransfer?.types?.includes("Files")) setIsDragging(true);
    }, []);

    const handleZoneDrop = useEventCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        if (uploadState) return;
        onFile(e.dataTransfer?.files?.[0]);
    }, []);

    const handleZoneClick = useEventCallback((e) => {
        //
        if (uploadState) return;
        fileRef.current.click();
    }, []);

    const handleInputClick = useEventCallback((e) => {
        //
        if (uploadState) return;
        onFile(e.target.files?.[0]);
    }, []);

    return (
        <>
            <Container
                onDragOver={handleZoneDargOver}
                onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setIsDragging(false);
                    }
                }}
                onDrop={handleZoneDrop}
                $isDragging={isDragging}
                aria-busy={uploadState != null}
            >
                {uploadState ? (
                    <Loader role="status" aria-live="polite">
                        <p>Uploading…</p>
                        <Progress
                            role="progressbar"
                            aria-label="Upload progress"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={uploadState.progress}
                        >
                            <ProgressThumb
                                style={{ width: `${uploadState.progress}%` }}
                            />
                        </Progress>
                        <span className="progress-label">
                            {Math.round(uploadState.progress)}%
                        </span>
                    </Loader>
                ) : (
                    <button
                        className="prompt"
                        type="button"
                        onClick={handleZoneClick}
                        aria-label="Upload files"
                        title="Upload images, video, audio or 3D models"
                    >
                        <span className="upload-symbol">
                            <AssetIcon name="upload" />
                        </span>
                        <span>{isDragging ? "Drop file" : "Upload file"}</span>
                    </button>
                )}

                <input
                    ref={fileRef}
                    type="file"
                    accept={acceptedMimes}
                    disabled={uploadState != null}
                    onChange={handleInputClick}
                    hidden={true}
                />
            </Container>
            {/* A sibling of the card: the upload grid gives it a row. */}
            <InlineError
                className="upload-error"
                message={failure?.message}
                onRetry={failure?.retry}
            />
        </>
    );
}

const Container = styled.div<{ $isDragging: boolean }>`
    ${libraryCard}
    width: 100%;
    min-height: 122px;
    display: flex;
    align-items: stretch;
    background: ${(props) =>
        props.$isDragging ? "var(--studio-hover)" : "var(--studio-inset)"};
    border-color: ${(props) =>
        props.$isDragging ? "var(--studio-muted)" : "var(--studio-line)"};
    .prompt {
        appearance: none;
        border: 0;
        background: transparent;
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 8px 2px;
        color: var(--studio-secondary);
        font: 400 11px/15px var(--studio-font);
        cursor: pointer;
    }
    .upload-symbol {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--studio-surface);
        border: 1px solid var(--studio-line);
        box-shadow: var(--studio-edge);
        svg {
            width: 17px;
            height: 17px;
        }
    }
`;

const Loader = styled.div`
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;

    & > p {
        margin: 0;
        color: var(--studio-ink);
        font-size: 11px;
    }
    & > .progress-label {
        color: var(--studio-muted);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
    }
`;

const Progress = styled.div`
    width: 100%;
    height: 4px;
    overflow: hidden;
    background: var(--studio-line);
    border-radius: 4px;
`;

const ProgressThumb = styled.div`
    height: 100%;
    border-radius: inherit;
    background: var(--studio-ink);
    transition: width 150ms ease;
`;
