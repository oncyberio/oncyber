import React, {
    forwardRef,
    MouseEvent,
    useEffect,
    useRef,
    ReactNode,
    useState,
} from "react";
import styled, { css } from "styled-components";
import { SimpleDropzone } from "@utils/dropzone/index";
import ProgressBar from "@ui/components/ProgressBar";
import GlbFile from "@ui/icons/files/Glb";
import { Button } from "@components/Form";

export interface UploadGlbProps {
    message?: ReactNode;
    display?: "column" | "row";
    isKitbash?: boolean;
    onFileSelect: (file: File) => unknown;
}

export const DropGlb = forwardRef<HTMLDivElement, UploadGlbProps>(
    ({ display = "column", onFileSelect, message, isKitbash = false }) => {
        //
        const inputRef = useRef<HTMLInputElement>(null);
        const dropRef = useRef(null);

        useEffect(() => {
            if (inputRef.current == null || dropRef.current === null) {
                return;
            }

            const dropzone = new SimpleDropzone(
                dropRef.current,
                inputRef.current
            );

            dropzone.on("drop", async ({ files }) => {
                //
                let glbFile: File;

                Array.from(files).forEach(([path, file]) => {
                    if (file.name.match(/\.(gltf|glb)$/)) {
                        glbFile = file;
                    }
                });

                if (inputRef?.current) {
                    inputRef.current.value = "";
                }

                if (glbFile != null) {
                    onFileSelect(glbFile);
                }
            });
        }, [inputRef.current, dropRef.current]);

        const handleSelectFile = (event: MouseEvent<HTMLButtonElement>) =>
            inputRef.current.click();

        return (
            <div>
                <DragDrop ref={dropRef} display={display}>
                    <div>
                        <GlbFile />

                        <>
                            {message ?? (
                                <p>
                                    Drop your <b>.glb</b> file here
                                </p>
                            )}

                            {!isKitbash ? (
                                <span style={{ fontSize: 10 }}>
                                    Learn how to create a space{" "}
                                    <a
                                        style={{ textDecoration: "underline" }}
                                        href="https://docs.oncyber.io/world-builders-guide/getting-started"
                                        target="_blank"
                                    >
                                        here
                                    </a>
                                </span>
                            ) : (
                                <span style={{ fontSize: 10 }}>
                                    Learn how to create a Kit{" "}
                                    <a
                                        style={{ textDecoration: "underline" }}
                                        href="https://docs.oncyber.io/custom-spaces/kit-requirements"
                                        target="_blank"
                                    >
                                        here
                                    </a>
                                </span>
                            )}

                            <span className="hr">
                                <div></div>
                                <div>or</div>
                                <div></div>
                            </span>
                            <Button onClick={handleSelectFile}>
                                Select file
                            </Button>
                        </>
                    </div>
                </DragDrop>
                <input
                    style={{ display: "none" }}
                    ref={inputRef}
                    accept=".gltf, .glb"
                    type="file"
                />
            </div>
        );
    }
);

const DragDrop = styled.div<{ display: "row" | "column" }>`
    height: 100%;
    display: flex;

    ${({ display }) =>
        display === "row"
            ? css`
                  flex-direction: row;
                  justify-content: space-evenly;
                  padding: 16px;
              `
            : css`
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
              `}

    & > div {
        display: flex;
        flex-direction: column;
        align-items: center;

        & > span.hr {
            width: 140px;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;

            div {
                font-weight: 400;
                font-size: 14px;
                line-height: 26px;
                color: #070707;

                @media (max-width: 800px) {
                    font-size: 12px;
                }

                &:first-child,
                &:last-child {
                    flex: 1;
                    position: relative;

                    &:before {
                        content: " ";
                        position: absolute;
                        top: 50%;
                        left: 0px;
                        right: 0px;
                        height: 1px;
                        background-color: #1d1d1d;
                    }
                }

                &:first-child {
                    margin-right: 20px;
                }

                &:last-child {
                    margin-left: 20px;
                }
            }
        }

        & > p {
            padding: 0 !important;
            font-style: normal;
            font-weight: 400;
            font-size: 18px;
            line-height: 18px;
            letter-spacing: -0.02em;
            color: #070707;

            @media (max-width: 800px) {
                font-size: 16px;
            }

            &.file {
                font-weight: 500;
                font-size: 14px;
                line-height: 24px;
                color: #070707;

                @media (max-width: 800px) {
                    font-size: 12px;
                }
            }

            & > b {
                font-weight: 600;
                color: #070707;
            }
        }

        & > button {
            margin-top: 15px;
            background-color: transparent;
            border: 1px solid #1d1d1d;
            border-radius: 50px;
            font-style: normal;
            font-weight: 500;
            font-size: 14px;
            text-align: center;
            color: #070707;
            width: 120px;
            height: 40px;

            @media (max-width: 800px) {
                font-size: 12px;
            }
        }
    }
`;
