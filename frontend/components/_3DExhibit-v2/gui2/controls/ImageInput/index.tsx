import React, { useRef, useState } from "react";
import IconImg from "@ui/components/IconImg";
import styled from "styled-components";
import { uploadOrCacheFile } from "@utils/media/mediaUploader";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { fileReaderPromisify } from "@utils/fileReader";
import { showError } from "@components/Dialogs";
import checkHDRDimensions from "@components/_3DExhibit-v2/three/utils/hdrmetadata";
import { CURRENT_USER } from "@3constants";

const MAX_UPLOAD_SIZE = 6; // MB

const MAX_IMAGE_DIMENSIONS = {
    width: 4096,
    height: 2048,
};

export async function checkImageDimensionsConstraints(
    file: File,
    buffer: ArrayBuffer,
    format: string,
    { width, height }: { width: number; height: number }
): Promise<boolean> {
    //
    if (format == ".hdr") {
        //
        const metadata = checkHDRDimensions(new Uint8Array(buffer));

        if (typeof metadata === "number") {
            //
            throw new Error("Failed to parse HDR metadata.");
        }

        return !(metadata.width <= width && metadata.height <= height);
        //
    } else {
        //
        return new Promise((resolve, reject) => {
            //
            const img = new Image();

            const blob = new Blob([buffer], {
                type: file?.type,
            });

            const url = URL.createObjectURL(blob);

            img.onload = () => {
                // console.log({ w: img.width, h: img.height });
                const isTooLarge = !(
                    img.width <= width && img.height <= height
                );

                resolve(isTooLarge);

                URL.revokeObjectURL(img.src);
            };

            img.onerror = () => {
                reject("Failed to load image.");

                URL.revokeObjectURL(img.src);
            };

            img.src = url;
        });
    }
}

function _ImageInput({
    value,
    onChange,
    accept = "*",
    action = "upload",
    maxDimensions = MAX_IMAGE_DIMENSIONS,
    maxSize = MAX_UPLOAD_SIZE,
}) {
    //
    // console.log("rendering Image...");

    const fileRef = useRef<HTMLInputElement>(null);

    const [isUploading, setUploading] = useState(false);

    const checkImageConstraints = async (
        file: File,
        buffer: ArrayBuffer,
        format: string
    ) => {
        //
        if (maxSize && file.size > maxSize * 1024 * 1024) {
            throw new Error(
                `The Image exceeds the maximum file size limit of ${maxSize}MB`
            );
        }

        if (maxDimensions?.width && maxDimensions?.height) {
            //
            const isTooLarge = await checkImageDimensionsConstraints(
                file,
                buffer,
                format,
                maxDimensions
            );

            if (isTooLarge) {
                //
                throw new Error(
                    `The Image exceeds the maximum dimensions of ${maxDimensions.width}x${maxDimensions.height}`
                );
            }
        }
    };

    const handleFileSelect = useEventCallback(
        //
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            // @ts-ignore
            if (isUploading) return;

            setUploading(true);

            try {
                const file = e.target?.files[0];

                if (!file) return;

                const name = file?.name;

                const mimeType = file?.type || "raw";

                const format = "." + name.split(".").pop();

                if (!name) {
                    showError(
                        "Please upload a file with a valid name and extension."
                    );
                    return;
                }

                let buffer = await fileReaderPromisify(file, {
                    type: "buffer",
                });

                try {
                    //
                    await checkImageConstraints(file, buffer, format);
                    //
                } catch (err) {
                    //
                    console.error(err);

                    showError(err.message);

                    return;
                }

                let path;

                if (action === "upload") {
                    //
                    try {
                        //
                        if (buffer == null) {
                            buffer = await fileReaderPromisify(file, {
                                type: "buffer",
                            });
                        }

                        const blob = new Blob([buffer], {
                            type: file?.type,
                        });

                        const result = await uploadOrCacheFile(
                            {
                                file: blob,
                                id: name,
                                mimeType,
                                token: undefined,
                                isUnique: true,
                            },
                            CURRENT_USER.isAnonymous
                        );

                        path = result.secure_url;

                        // @ts-ignore
                        fileRef.current.value = null;
                        //
                    } catch (err) {
                        //
                        console.error(err);

                        showError("Error uploading file.");

                        return;
                        //
                    }
                } else if (action === "dataUrl") {
                    //
                    const readerResult = await fileReaderPromisify(file, {
                        type: "dataUrl",
                    });

                    path = readerResult;
                    //
                }
                // else if ((action = "buffer")) {
                //     //
                //     contst readerResult = await fileReaderPromisify(file, {
                //         type: "buffer",
                //     });

                //     image = readerResult;
                //     //
                // }
                else if (action === "file") {
                    //
                    path = URL.createObjectURL(file);
                }

                onChange({
                    id: "custom",
                    name,
                    path,
                    image: path,
                    format,
                    mimeType,
                });
            } catch (err) {
                //
                console.error(err);

                showError("Error processing file.");
            } finally {
                //
                setUploading(false);
            }
        },
        []
    );

    const handleUploadClick = () => {
        // @ts-ignore
        fileRef.current.click();
    };

    const name = value?.name || value?.path?.split("/").pop() || "Untitled";

    return (
        <Container>
            {isUploading && <span className="loading">Uploading…</span>}
            {!isUploading && value?.path && (
                <Uploaded>
                    <div className="file-wrapper" onClick={handleUploadClick}>
                        <div className="file-img">
                            <img src={value.path} />
                        </div>
                        <div className="file-name">
                            {name || "Uploaded Image"}
                        </div>
                    </div>
                    {/* <div
                        className="delete"
                        onClick={() => {
                            onChange(null);
                            fileRef.current.value = null;
                        }}
                    >
                        <IconImg mode="light" size={12} name="trash" />
                    </div> */}
                </Uploaded>
            )}
            {!isUploading && !value?.path && (
                <Upload onClick={handleUploadClick}>Upload Image</Upload>
            )}

            <input
                data-noundo={true}
                hidden
                type="file"
                ref={fileRef}
                accept={accept}
                onChange={handleFileSelect}
            />
        </Container>
    );
}

export const ImageInput = React.memo(_ImageInput);

const Container = styled.div`
    width: 100%;
    height: 30px;
    display: flex;
    flex-direction: column;
    justify-content: center;

    & > .loading {
        font-weight: 400;
        font-size: 13px;
        line-height: 24px;
        color: #777980;
        overflow: hidden;
        white-space: nowrap;
        text-transform: capitalize;
    }
`;

const Upload = styled.div`
    width: 100%;
    height: 24px;
    border: 1px dashed #777980;
    border-radius: 6px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: 500;
    font-size: 11px;
    line-height: 24px;
    display: flex;
    align-items: center;
    text-align: center;
    color: #777980;
    cursor: pointer;
    margin-top: 2px;
`;

const Uploaded = styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    cursor: pointer;

    & > .file-wrapper {
        gap: 8px;
        display: flex;
        margin-left: 8px;
        align-items: center;
        justify-content: space-between;

        & > .file-name {
            font-weight: 400;
            font-size: 12px;
            line-height: 24px;
            color: #777980;
            text-transform: capitalize;
            max-width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        & > .delete {
            flex: 0;
            display: flex;
            height: 24px;
            cursor: pointer;
            align-items: center;
            justify-content: center;
            margin-left: auto;
        }

        & > .file-img {
            flex: 0;
            display: flex;
            align-items: center;
            justify-content: flex-start;

            & > img {
                width: 24px;
                height: 24px;
                border-radius: 6px;
            }

            & > span {
                max-width: 60px;
                font-weight: 500;
                font-size: 12px;
                line-height: 24px;
                color: #ffffff;
                margin-left: 8px;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }
        }
    }
`;
