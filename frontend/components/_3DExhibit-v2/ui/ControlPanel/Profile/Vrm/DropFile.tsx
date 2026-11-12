import React, { forwardRef, useEffect, useRef } from "react";
import styled, { css } from "styled-components";
import { SimpleDropzone } from "@utils/dropzone/index";
import IconImg from "@ui/components/IconImg";
import { useCyberTranslation } from "@components/context/I18nContext";

export interface UploadGlbProps {
    iconOnly?: boolean;
    onFileSelect: (file: File) => unknown;
}

export const DropFile = forwardRef<HTMLDivElement, UploadGlbProps>(
    ({ onFileSelect, iconOnly }) => {
        //
        const inputRef = useRef<HTMLInputElement>(null);
        const dropRef = useRef(null);

        const { t } = useCyberTranslation();

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
                    if (file.name.match(/\.(vrm)$/)) {
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

            return () => {
                dropzone.destroy();
            };
        }, []);

        const handleSelectFile = (event) => inputRef.current.click();

        return (
            <>
                <DragDrop
                    ref={dropRef}
                    iconOnly={iconOnly}
                    type="button"
                    aria-label="Upload avatar"
                    onClick={handleSelectFile}
                >
                    <IconImg mode="light" size={20} name="upload-cloud" />
                    {!iconOnly && <span>{t`DROP_VRM_FILE`}</span>}
                </DragDrop>
                <input
                    style={{ display: "none" }}
                    ref={inputRef}
                    accept=".vrm"
                    type="file"
                />
            </>
        );
    }
);

const DragDrop = styled.button<{ iconOnly: boolean }>`
    ${(props) =>
        props.iconOnly
            ? css`
                  width: calc(100% - 10px);
                  min-width: 0;
                  margin: 5px;
              `
            : css`
                  width: 100%;
                  min-width: 100%;
              `}

    min-height: 88px;
    padding: 12px;
    background: var(--oc-canvas, #101010);
    color: var(--oc-secondary, #c2c2bd);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed #ffffff24;
    border-radius: 12px;
    cursor: pointer !important;

    img {
        opacity: 0.5;
    }

    & > span {
        font-weight: 400;
        font-size: 11px;
        line-height: 16px;
        display: flex;
        align-items: center;
        color: #999999;
        margin-left: 8px;
        max-width: 80%;
    }
`;
