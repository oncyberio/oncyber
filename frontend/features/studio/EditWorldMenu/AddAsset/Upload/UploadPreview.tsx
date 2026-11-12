import styled from "styled-components";
import { useState, useRef, useEffect, useContext } from "react";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { Preview } from "../shared/Preview";
import { UploadAction, UploadActions } from "./UploadActions";
import { getPreviewUrl, getUploader } from "./utils";
import Spinner from "@ui/components/Spinner";
import InlineError from "@ui/components/InlineError";
import IconImg from "@ui/components/IconImg";
import { UserContext } from "@components/context/UserContext";
import { getDefaultMimePreview } from "@features/studio/utils";

type PreviewState =
    | { type: "Idle" }
    | { type: "Submitting" }
    | { type: "Renaming"; value: string };

export function UploadPreview({
    upload,
    onClick,
    onChange,
    onDrag,
    isPlaced,
    isOptimized = false,
    dragReady = true,
}) {
    //
    const { isAnonymous } = useContext(UserContext);

    const uploader = getUploader(isAnonymous);

    const { url, name: _name, hash, mimeType } = upload;

    const [name, setName] = useState(_name);

    const [hasError, setHasError] = useState(false);

    const [state, setState] = useState<PreviewState>({ type: "Idle" });

    // A delete or rename that failed, shown in the row under this card with
    // a Retry that runs it again (docs/feedback.md).
    const [failure, setFailure] = useState<{
        message: string;
        retry: () => void;
    }>(null);

    const inputRef = useRef(null);

    const previewUrl =
        getPreviewUrl(url, mimeType) || getDefaultMimePreview(mimeType);

    useEffect(() => setHasError(false), [url, mimeType]);

    const handleClick = useEventCallback((e) => {
        //
        if (state.type !== "Idle") return;

        onClick(e);
    }, []);

    const handleAction = useEventCallback(async (action: UploadAction) => {
        //
        if (state.type !== "Idle") return;

        if (action === "rename") {
            //
            setState({ type: "Renaming", value: name });
        } else if (action === "delete") {
            //
            await deleteUpload();
        }
    }, []);

    const deleteUpload = useEventCallback(async () => {
        //
        try {
            //
            setFailure(null);

            setState({ type: "Submitting" });

            await uploader.deleteUpload(upload);

            onChange("delete", upload);
            //
        } catch (err) {
            console.error(err);

            setFailure({
                message: "Couldn't delete this file.",
                retry: () => deleteUpload(),
            });
            //
        } finally {
            //
            setState({ type: "Idle" });
        }
    }, []);

    // Saves `newName` and shows it; a failure puts the old name back.
    const saveName = useEventCallback(async (newName: string) => {
        //
        const previous = name;

        try {
            //
            setFailure(null);

            setName(newName);

            setState({ type: "Submitting" });

            await uploader.updateUpload(hash, { name: newName });

            onChange("rename", { ...upload, name: newName });
            //
        } catch (err) {
            console.error(err);

            setName(previous);

            setFailure({
                message: "Couldn't rename this file.",
                retry: () => saveName(newName),
            });
        } finally {
            //
            setState({ type: "Idle" });
        }
    }, []);

    const handleRenameChange = useEventCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            //
            if (state.type !== "Renaming") return;

            console.log("change", e);

            setState({ type: "Renaming", value: e.target.value });
            //
        },
        []
    );

    const handleRenameUpdate = useEventCallback(async () => {
        //
        if (state.type !== "Renaming") return;

        await saveName(inputRef.current.value);
    }, []);

    const handleDragStart = useEventCallback((e) => {
        //
        onDrag(upload, previewUrl, e);
    }, []);

    const actions = (
        <ActionWrapper>
            <UploadActions onAction={handleAction} />
        </ActionWrapper>
    );

    let prevEl;

    if ((isAnonymous && mimeType.startsWith("video")) || url.endsWith(".mp4")) {
        //
        prevEl = hasError ? (
            <img draggable={false} src={getDefaultMimePreview(mimeType)} />
        ) : (
            <video
                draggable={false}
                src={url}
                controls={false}
                autoPlay
                muted
                loop
                onError={() => setHasError(true)}
            />
        );
    } else {
        prevEl = hasError ? (
            <img draggable={false} src={getDefaultMimePreview(mimeType)} />
        ) : (
            <img
                draggable={false}
                src={previewUrl}
                onError={() => setHasError(true)}
            />
        );
    }

    const imgPreview = (
        <>
            <div className="imgBox">
                {prevEl}
                {isPlaced && (
                    <Notice>
                        <IconImg size={16} name="check-white-bg" />
                    </Notice>
                )}
                {isOptimized && (
                    <div style={{ position: "absolute", left: 2, bottom: 2 }}>
                        <IconImg size={16} name="blue-check" />
                    </div>
                )}
                {state.type === "Submitting" && (
                    <Loader>
                        <Spinner isLightTheme={false} width={18} />
                    </Loader>
                )}
            </div>
        </>
    );

    const title = (
        <Title>
            <>
                {state.type === "Renaming" && (
                    <input
                        ref={(el) => {
                            if (!el) {
                                console.log("ref unmount", el);
                                return;
                            }

                            inputRef.current = el;
                            console.log("ref", el);
                            el.selectionStart = 0;
                            el.selectionEnd = el.value.length;
                            el.focus();
                        }}
                        defaultValue={state.value}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setState({ type: "Idle" });
                            } else if (e.key === "Enter") {
                                handleRenameUpdate();
                            }
                        }}
                        onBlur={(e) => {
                            setState({ type: "Idle" });
                        }}
                    />
                )}
                <div
                    title={"Click to edit name"}
                    onClick={() => handleAction("rename")}
                    style={{
                        visibility:
                            state.type === "Renaming" ? "hidden" : "visible",
                    }}
                >
                    {name}
                </div>
            </>
        </Title>
    );

    return (
        <>
            <Container draggable={dragReady} onDragStart={handleDragStart}>
                <Preview
                    key={name}
                    label={`Add ${name}`}
                    image={imgPreview}
                    content={actions}
                    title={title}
                    onClick={handleClick}
                />
            </Container>
            {/* A sibling of the card: the upload grid gives it a row. */}
            <InlineError message={failure?.message} onRetry={failure?.retry} />
        </>
    );
}

const Container = styled.div`
    min-width: 0;
    .imgBox {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
        aspect-ratio: 1;
        & > img,
        & > video {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
    }
`;

const ActionWrapper = styled.div`
    position: absolute;
    top: 0;
    right: 0;
`;

const Loader = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    cursor: not-allowed;

    display: flex;
    align-items: center;
    justify-content: center;
`;

const Title = styled.div`
    font-size: 11px;
    & > input {
        z-index: 1;
        position: absolute;
        border: none;
        border: 1px solid #ffffff;
        border-radius: 4px;
        color: #fff;
        background: #27282c;
        outline: none;
        width: 100%;
    }
`;

const Notice = styled.span`
    position: absolute;
    left: 2px;
    top: 2px;
`;
