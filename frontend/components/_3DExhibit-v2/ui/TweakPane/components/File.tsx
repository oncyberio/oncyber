import IconImg from "@ui/components/IconImg";
import { noop } from "@utils/js";
import React, { useRef, useState } from "react";
import styled from "styled-components";
import checkHDRDimensions from "@3utils/hdrmetadata.js";
import InlineError from "@ui/components/InlineError";

/** A file the visitor has to replace; its message is shown as it is. */
function unusable(message: string) {
    return Object.assign(new Error(message), { unusable: true });
}

const UNREADABLE = "Couldn't read this file. Choose another one.";

export default function File({
    target,
    propName,
    onUpdate,
    onChange,
    inputRef,
    accept,
    fileOpts,
}) {
    const fileRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState(target[propName]);

    // Why the picked file was not used, under the picker. The visitor picks
    // another file, so there is no Retry (docs/feedback.md).
    const [problem, setProblem] = useState("");

    const _onUpdateValue = (val): void => {
        setFile(val);

        onUpdate(val);
        onChange(val);
    };

    async function checkImageDimensions(blobURL, width, height) {
        const img = new Image();
        img.src = blobURL;
        return await new Promise((resolve, reject) => {
            img.onload = () => {
                console.log({ w: img.width, h: img.height });
                const isTooLarge = !(
                    img.width <= width && img.height <= height
                );
                resolve(isTooLarge);
            };
            img.onerror = () => reject(false);
        });
    }

    async function readFileInput(file): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.addEventListener("load", function () {
                const blob = new Blob([reader.result], {
                    type: file?.type,
                });

                resolve(blob);
            });

            reader.addEventListener("error", function () {
                reject(reader.error);
            });

            reader.readAsArrayBuffer(file);
        });
    }

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setProblem("");
        try {
            const file = e.target?.files[0];
            if (!file) return;

            if (
                fileOpts?.maxSize &&
                file.size > fileOpts.maxSize * 1024 * 1024
            ) {
                throw unusable(
                    `This file is larger than ${fileOpts.maxSize} MB. Choose a smaller one.`
                );
            }

            const name = file?.name;

            if (!name) {
                throw unusable(
                    "This file has no name. Choose a file with a name and an extension."
                );
            }

            const reader = new FileReader();
            reader.readAsArrayBuffer(file);

            const mimeType = file?.type || "raw";
            const format = "." + name.split(".").pop().toLowerCase();

            const fileExt = fileOpts?.extension;

            if (fileExt && !fileExt.includes(format)) {
                throw unusable(`Only ${fileExt.join(", ")} files work here.`);
            }

            const blob = await readFileInput(file);
            const blobURL = URL.createObjectURL(blob);

            if (!blobURL) {
                throw unusable(UNREADABLE);
            }

            var dimensions = fileOpts?.dimensions;

            const width = dimensions?.width;
            const height = dimensions?.height;

            if (!width || !height) return;

            let isTooLarge;

            if (format == ".hdr") {
                const metadata = checkHDRDimensions(
                    new Uint8Array(await blob.arrayBuffer())
                );

                isTooLarge = !(
                    metadata?.width <= width && metadata?.height <= height
                );
            } else {
                isTooLarge = await checkImageDimensions(blobURL, width, height);
            }

            if (isTooLarge) {
                throw unusable(
                    `This image is larger than ${width} × ${height} pixels. Choose a smaller one.`
                );
            }

            _onUpdateValue({
                name,
                blobURL,
                mimeType,
                format,
                path: blobURL,
            });
        } catch (error) {
            setProblem(error?.unusable ? error.message : UNREADABLE);
            console.error(error);
        } finally {
            fileRef.current.value = null;
        }
    };

    const handleSelectFile = () => fileRef.current.click();

    const imgPreview =
        file?.format === ".hdr" ? "/icons/hdr-icon.svg" : file?.path;

    return (
        <Container ref={inputRef}>
            {file?.name && file?.path ? (
                <Uploaded>
                    <span>Uploaded Image</span>
                    <div className="file-wrapper">
                        <div className="file-name">
                            <img src={imgPreview} />
                            <span>{file?.name || "custom.png"}</span>
                        </div>
                        <div
                            className="delete"
                            onClick={() => _onUpdateValue({ action: "delete" })}
                        >
                            <IconImg mode="light" size={12} name="trash" />
                        </div>
                    </div>
                </Uploaded>
            ) : (
                <Upload onClick={handleSelectFile}>Upload Image</Upload>
            )}

            <input
                hidden
                type="file"
                ref={fileRef}
                accept={accept}
                onChange={handleChange}
            />
            <InlineError
                message={problem}
                style={{ marginTop: 6, fontSize: 11 }}
            />
        </Container>
    );
}

File.defaultProps = {
    items: [],
    target: {
        default: false,
    },
    onChange: noop,
    onUpdate: noop,
    inputRef: noop,
    propName: "default",
    accept: ".png, .hdr , .jpg",
};

const Container = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
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
    justify-content: space-between;

    & > span {
        font-weight: 400;
        font-size: 12px;
        line-height: 24px;
        color: #777980;
        width: 100%;
        overflow: hidden;
        white-space: nowrap;
        text-transform: capitalize;
    }

    & > .file-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;

        & > .delete {
            display: flex;
            height: 24px;
            cursor: pointer;
            align-items: center;
            justify-content: center;
        }

        & > .file-name {
            width: 100%;
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
