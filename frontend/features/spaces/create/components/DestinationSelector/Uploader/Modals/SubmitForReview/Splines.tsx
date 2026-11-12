import React, {
    useRef,
    useState,
    useEffect,
    forwardRef,
    MouseEvent,
    CSSProperties,
} from "react";
import {
    getCinematic,
    uploadCinematic,
    deleteCinematic,
} from "@utils/saveToDb";
import Icon from "@ui/icons/files/Glb";
import {
    StyledFile,
    StyledWrapper,
    StyledFileProps,
    ProgressContainer,
} from "@ui/components/Upload/Glb/styles";
import { Button } from "@components/Form";
import ProgressBar from "@ui/components/ProgressBar";
import { SimpleDropzone } from "@utils/dropzone/index";
import styled from "styled-components";
import { actionTokens as action } from "@styles/tokens/action";

type SplineUploadProps = StyledFileProps &
    React.HTMLAttributes<HTMLDivElement & HTMLSpanElement> & {
        id?: string;
        slug: string;
        src?: string;
        accept?: string;
        style?: CSSProperties;
        onStart?: () => void;
        onError?: (err: string) => void;
        onValidate?: () => void;
        onUpload: () => void;
    };

const SplineUpload = forwardRef(
    (props: SplineUploadProps, ref: React.Ref<HTMLDivElement>) => {
        const {
            id,
            slug,
            display,
            accept,
            onStart,
            onError,
            onUpload,
            onValidate,
        } = props;

        const fileRef = useRef(null);

        const [src, setSrc] = useState(null);

        const [file, setFile] = useState(null);

        const [progress, setProgress] = useState(0);

        useEffect(() => {
            if (file) handleUpload();
        }, [file]);

        useEffect(() => {
            handleFetchCinematic();
        }, [slug]);

        useEffect(() => {
            const dataI = document.getElementById(id);
            const dataD = document.getElementById(`${id}-file-dropzone`);

            const dropzone = new SimpleDropzone(dataD, dataI);

            dropzone.on("drop", ({ files }) => {
                setFile(null);

                let rootFile;
                let rootPath;

                Array.from(files).forEach(([path, file]: [string, File]) => {
                    rootFile = file;
                    rootPath = path.replace(file.name, "");
                });

                const fileReader = new FileReader();

                fileReader.onload = function (file) {
                    setFile(fileReader.result);
                };

                fileReader.readAsText(rootFile);
            });
        }, []);

        const handleFetchCinematic = async () => {
            try {
                if (!slug) return;
                const response = await getCinematic(null, slug);
                if (response?.success) {
                    setProgress(100);
                    setSrc(response?.cinematic);
                }
            } catch (err) {
                console.error(err);
            }
        };

        const handleInputSelect = (e) => {
            setFile(null);

            if (e.target.files[0]) return setFile(e.target.files[0]);

            const reader = new FileReader();
            reader.readAsText(e.target.files[0]);

            reader.addEventListener(
                "load",
                function () {
                    setFile(reader.result);
                },
                false
            );
        };

        const handleUpload = async () => {
            // Only the effect above calls this, once a file is picked.
            if (!file) return;

            try {
                onStart?.();

                onValidate?.();

                setProgress(20);

                const _file = file.toString();

                const response = await uploadCinematic(JSON.parse(_file), slug);

                if (!response?.success) {
                    throw (
                        response?.message ||
                        "Failed to upload spline, Please try later"
                    );
                }

                setProgress(100);

                setSrc(_file);

                onUpload();
            } catch (e) {
                console.error(e);
                setSrc(null);
                setFile(null);
                setProgress(0);
                onError?.(e);
            }
        };

        const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
            const event = document.createEvent("MouseEvent");
            event.initEvent("click", false, true);
            fileRef.current.dispatchEvent(event);
        };

        const handleRemove = async (e: MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();

            try {
                const response = await deleteCinematic(slug);
                if (!response?.success) {
                    throw "Failed to remove spline, Please try later";
                }
                setProgress(0);
                setFile(null);
                setSrc(null);
                fileRef.current.value = null;
            } catch (e) {
                console.error(e);
                onError?.(e);
            }
        };

        return (
            <DarkFile ref={ref} id={`${id}-file-dropzone`} display={display}>
                <StyledWrapper>
                    <Icon />

                    {!src ? (
                        <>
                            <p>
                                Drop your <b>.json</b> file here
                            </p>
                            <span className="hr">
                                <div></div>
                                <div>or</div>
                                <div></div>
                            </span>

                            <Button onClick={handleClick}>Select file</Button>
                        </>
                    ) : (
                        <>
                            <p className="file">
                                {progress === 100
                                    ? "File is uploaded"
                                    : "Uploading spline…"}
                            </p>
                            <ProgressContainer>
                                <ProgressBar
                                    progress={progress}
                                    borderRadius="999px"
                                    background={action.white.fill}
                                />
                                {progress === 100 ? (
                                    <a onClick={handleRemove}>Remove File</a>
                                ) : (
                                    <span>{progress}% done</span>
                                )}
                            </ProgressContainer>
                        </>
                    )}
                </StyledWrapper>

                <input
                    id={id}
                    type="file"
                    ref={fileRef}
                    accept={accept}
                    onClick={handleInputSelect}
                    style={{ display: "none" }}
                />
            </DarkFile>
        );
    }
);

SplineUpload.defaultProps = {
    accept: ".json, application/json",
    onValidate: () => {},
    onUpload: () => {},
    onStart: () => {},
    onError: () => {},
    id: "input",
};

// The shared drop zone (ui/components/Upload/Glb) is drawn for a light
// panel; this one sits in the dark Submit for review window, so it reads the
// dialog's colour variables instead. "&&" outranks the shared rules.
const DarkFile = styled(StyledFile)`
    && {
        background: var(--field-bg-color);
        border-color: var(--border-color);
    }
    && p,
    && p > b,
    && span.hr div {
        color: var(--title-color);
    }
    && span.hr div:first-child:before,
    && span.hr div:last-child:before {
        background-color: var(--border-color);
    }
    && button {
        border-color: var(--btn-border-color);
        color: var(--btn-secondary-color);
    }
    && a,
    && span {
        color: var(--content-color);
    }
    && ${ProgressContainer} {
        background: var(--border-color);
    }
`;

export default SplineUpload;
