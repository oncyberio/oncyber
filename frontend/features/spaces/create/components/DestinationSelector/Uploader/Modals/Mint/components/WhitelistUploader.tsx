import React, {
    useState,
    useEffect,
    useRef,
    ChangeEvent,
    MouseEvent,
} from "react";
import { Theme } from "@ui/types";
import styled from "styled-components";
import { SimpleDropzone } from "@utils/dropzone";
import ProgressBar from "@ui/components/ProgressBar";
import Plus from "@ui/icons/Plus";
import { showError } from "@components/Dialogs";
import { nodeEnv } from "@env";
import { ethers } from "ethers";

type StyledWhitelistProps = {
    url?: string;
};

const provider = new ethers.providers.JsonRpcProvider(nodeEnv.ETH_RPC);

export default function WhitelistUploader({
    url,
    onUpload,
    onRemove,
    onError,
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const dropRef = useRef(null);

    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState("");
    const [isUploaded, setIsUploaded] = useState(false);
    const [publicId, setPulicId] = useState(null);

    useEffect(() => {
        if (!url) return;
        const publicId = url.split("/").pop();
        const [_, ...nameSegments] = publicId.split("-");
        const fileName = nameSegments.join(" ");
        setFileName(fileName);
        setIsUploaded(true);
        setPulicId(publicId);
    }, [url]);

    useEffect(() => {
        if (inputRef.current == null || dropRef.current === null) {
            return;
        }

        const dropzone = new SimpleDropzone(dropRef.current, inputRef.current);

        dropzone.on("drop", async ({ files }) => {
            //
            let rootFile: File;

            Array.from(files).forEach(([_, file]) => {
                if (file.name.match(/\.(csv)$/)) {
                    rootFile = file;
                }
            });

            if (inputRef?.current) {
                inputRef.current.value = "";
            }

            if (rootFile != null) {
                onFileSelect(rootFile);
            }
        });
    }, [inputRef.current, dropRef.current]);

    const onFileSelect = (rootFile: File) => {
        console.log("file", rootFile);
        if (!rootFile) showError("You must upload the file first!");

        const fileReader = new FileReader();

        fileReader.onload = function () {
            handleFileUpload(fileReader.result as string, rootFile.name);
        };

        fileReader.readAsText(rootFile);
    };

    const onParseFile = async (content: string) => {
        let lines = [];

        let maxTokensMinted = 0;

        const linesArray = content.split("\n");

        linesArray.forEach((e: any) => {
            const row = e
                .replace(/[\s]+[,]+|[,]+[\s]+/g, ",")
                .replaceAll('"', "")
                .trim();
            if (row) lines.push(row);
        });

        const result = [];

        const headers = lines[0].split(",");

        if (lines[0].trim() !== "address,amount" || lines?.length < 2) {
            throw "Invalid csv file, Please try again";
        }

        for (let i = 1; i < lines.length; i++) {
            const obj = {};

            const currentline = lines[i].split(",");

            const addressExists = result.some((item) => {
                return (
                    item?.address?.toLowerCase() ==
                    currentline[0]?.toLowerCase()
                );
            });

            if (addressExists) {
                throw `Invalid csv file, Only one-time wallet addresses are allowed.`;
            }

            const amount = parseInt(currentline[1]);

            if (!Number.isInteger(amount)) {
                throw "Amount must be an integer value";
            }

            maxTokensMinted += amount;

            for (let j = 0; j < headers.length; j++) {
                let row = currentline[j] as string;

                if (!headers[j] || !row) {
                    throw "Invalid csv file, Please try again";
                }

                if (j === 0 && row.endsWith(".eth")) {
                    const ensName = await provider.resolveName(currentline[0]);
                    if (ensName) row = ensName;
                }

                if (!Number.isInteger(amount)) {
                    throw "Amount must be an integer value";
                }

                obj[headers[j]] = currentline[j];
            }

            result.push(obj);
        }

        return [result, maxTokensMinted];
    };

    const handleFileUpload = async (result: string, fileName: string) => {
        if (!result) return;

        try {
            setLoading(true);

            setIsUploaded(false);

            setFileName(fileName);

            const [content, maxTokens] = await onParseFile(result);

            const fileBlob = new Blob([JSON.stringify(content)], {
                type: "application/json",
            });

            const id = fileName.replace(".csv", ".json").replace(/\s+/g, "-");

            setPulicId(id);

            setProgress(20);

            await onUpload(id, fileBlob, maxTokens);

            setIsUploaded(true);
        } catch (error) {
            console.error(error);

            onError(error);

            showError(error || "Failed to upload list of wallet addresses");
        } finally {
            setProgress(0);
            setLoading(false);
        }
    };

    const handleSelectFile = () => inputRef.current.click();

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files[0];
        onFileSelect(file);
    };

    const handleRemoveFile = (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        setLoading(false);
        setIsUploaded(null);
        setPulicId(null);

        try {
            onRemove(publicId);
        } catch (error) {
            showError(error || "Failed to delete file");
        }
    };

    const name = fileName.replace(".json", ".csv");

    return (
        <Container>
            {!isUploaded ? (
                <StyledArea>
                    {loading && <ProgressBar progress={progress} />}
                    <span onClick={handleSelectFile}>
                        <Plus width="14" height="14" color="#999999" />
                    </span>
                </StyledArea>
            ) : (
                <StyledFileInfo>
                    <span>{name}</span>
                    <a onClick={handleRemoveFile}>Remove File</a>
                </StyledFileInfo>
            )}

            <input
                type="file"
                ref={inputRef}
                accept={".csv"}
                style={{ display: "none" }}
                onChange={handleFileChange}
            />
        </Container>
    );
}

const Container = styled.div<StyledWhitelistProps>`
    width: 100%;
    color: #000;
    display: flex;
    font-weight: 400;
    position: relative;
    align-items: center;
    margin: 15px 0px 0px 0px;
    justify-content: center;
`;

type AreaProps = {
    height?: string;
    background?: string;
    overrideTheme?: Theme;
};

const StyledArea = styled.div<AreaProps>`
    width: 100%;
    height: 76px;
    display: flex;
    cursor: pointer;
    border-radius: 6px;
    align-items: center;
    background: #f5f5f5;
    justify-content: center;
    height: ${({ height }) => height};

    & > span {
        padding: 8px;
        display: flex;
        cursor: pointer;
        align-items: center;
        border-radius: 999px;
        background: #ffffff;
        justify-content: center;
    }
`;

StyledArea.defaultProps = {
    height: "80px",
};

const StyledFileInfo = styled.div`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;

    & > span {
        font-weight: 600;
        font-size: 14px;
        line-height: 24px;
        color: #777980;
        max-width: 400px;
        overflow: hidden;
        margin-right: 16px;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    & > a {
        font-weight: 500;
        font-size: 12px;
        line-height: 100%;
        color: #070707;
        cursor: pointer;
    }
`;
