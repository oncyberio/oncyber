import styled from "styled-components";
import { useState, useRef, useEffect, useContext } from "react";
import { amplitude_logAnalyticsEvent } from "../utils/analytics";
import { uploadFile } from "@utils/factory/httpPinata";
import { UserContext } from "./context/UserContext";
import { useAsyncAction } from "@components/hooks/useAsyncAction";
import IconImg from "@ui/components/IconImg";
import Spinner from "@ui/components/Spinner";

/**
 * The round upload button over a preview picture.
 *
 * It tells its parent how every upload ends: `onUploadStarted`, then either
 * `onUploadFinished(url)` or `onUploadFailed(retry)`. The button is too small
 * to explain a failure itself, so the parent shows it beside the preview and
 * calls `retry` to send the same picture again (see docs/feedback.md). A
 * parent that keeps its own "uploading" flag must clear it in both endings.
 */
export default function ImageUploader({
    onUploadFinished,
    onUploadFailed,
    exhibitId,
    onProgress,
    onUploadStarted,
    ...rest
}) {
    const { user, token } = useContext(UserContext);

    const fileRef = useRef(null);
    const imagePreviewRef = useRef(null);

    const [imageSrc, setImageSrc] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [progress, setProgress] = useState(0);

    // The upload and this button's spinner: useAsyncAction ends every run in
    // done or failed, so the spinner cannot stay on.
    const upload = useAsyncAction(async (file: File) => {
        onUploadStarted(true);

        try {
            onProgress(20);

            const pinata = await uploadFile(file);

            const ipfsHash = pinata?.IpfsHash;

            if (!ipfsHash) throw new Error("Failed to upload file");

            const url = `https://cyber.mypinata.cloud/ipfs/${ipfsHash}`;

            amplitude_logAnalyticsEvent("upload_asset", {
                user_id: user.id,
                exhibit_id: exhibitId,
            });

            onProgress(100);
            onUploadFinished(url);
        } catch (e) {
            onProgress(0);
            // The parent heard that an upload started. It has to hear that
            // it ended too, or its own busy state never clears.
            onUploadFailed(() => upload.run(file));
            throw e;
        }
    });

    const loading = upload.status === "pending";

    useEffect(() => {
        if (imageSrc && imageFile) upload.run(imageFile);
    }, [imageSrc, imageFile]);

    const handleDisplayImage = (e) => {
        setImageFile(e.target.files[0]);
        // Forget the last picture until this one has loaded, or the new file
        // would be sent twice: once now, beside the old picture, and again
        // when it loads.
        setImageSrc("");
        if (!e.target.files[0]) return;

        var reader = new FileReader();
        reader.readAsDataURL(e.target.files[0]);

        reader.addEventListener(
            "load",
            function () {
                var image = new Image();
                image.src = reader.result as string;
                image.onload = function () {
                    setImageSrc(reader.result as string);
                    // onPreview(reader.result);
                };
            },
            false
        );
    };

    return (
        <Container
            onClick={() => {
                const event = document.createEvent("MouseEvent");
                event.initEvent("click", false, true);
                fileRef.current.dispatchEvent(event);
            }}
            {...rest}
        >
            <IconWrapper>
                {loading ? (
                    <Spinner width={18} />
                ) : (
                    <IconImg name="upload" mode="light" size={18} />
                )}
            </IconWrapper>

            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                disabled={loading}
                onChange={handleDisplayImage}
                hidden
            />
        </Container>
    );
}

ImageUploader.defaultProps = {
    onUploadFinished: () => {},
    onUploadFailed: () => {},
    onPreview: () => {},
    defaultImage: "",
};

const IconWrapper = styled.div`
    border: 1px solid #fff;
    border-radius: 50%;
    padding: 6px;
    cursor: pointer;
    width: 32px;
    min-width: 32px;
    height: 32px;
    min-height: 32px;
`;
const Container = styled.div``;

const ProgressBar = styled.div<{ progress: string | number }>`
    width: ${(props) => props.progress}%;
    height: 8px;
    background: #00ffd4;
    transition: 0.3s all ease;
    position: absolute;
    top: 0;
    left: 0;
    opacity: ${({ progress }) => (progress < 100 ? "1" : "0")};
`;
