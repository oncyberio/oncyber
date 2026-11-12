import { UserContext } from "@components/context/UserContext";
import IconImg from "@ui/components/IconImg";
import Spinner from "@ui/components/Spinner";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { uploadFile } from "@utils/media/mediaUploader";
import { useContext, useRef, useState } from "react";
import styled, { css } from "styled-components";

export default function CollectionImageUploader({
    path,
    onUploadFinish = (url: string) => {},
    onUploadStarted = () => {},
    /**
     * Called with one sentence when the picked image cannot be used, and with
     * a retry when uploading it again can help. The caller shows it beside
     * the picker (docs/feedback.md).
     */
    onUploadFail = (message: string, retry?: () => void) => {},
    originalSrc,
    sizeLimit = 0, // in mo
}) {
    const [imageSrc, setImageSrc] = useState("");

    const [loading, setLoading] = useState(false);

    const fileRef = useRef(null);

    const { user, token } = useContext(UserContext);

    function handleUpload(e) {
        const file = e.target.files[0];

        if (!file) return setImageSrc("");

        if (sizeLimit) {
            const sizeInMo = file.size / 1024 / 1024;

            if (sizeInMo > sizeLimit) {
                return onUploadFail(
                    `This image is larger than ${sizeLimit} MB. Choose a smaller one.`
                );
            }
        }

        var reader = new FileReader();
        reader.readAsDataURL(file);

        reader.addEventListener(
            "load",
            function () {
                var image = new Image();
                image.src = reader.result as string;
                image.onload = function () {
                    setImageSrc(reader.result as string);
                    send(file);
                };
            },
            false
        );
    }

    async function send(file: File) {
        try {
            setLoading(true);

            amplitude_logAnalyticsEvent("upload_image_to_cloudinary_started", {
                user_id: user.id,
            });

            onUploadStarted();

            // upload image to Pinata
            const upload = await uploadFile({
                file,
                token,
                mimeType: "image/jpeg",
                id: path,
                isUnique: true,
            });

            onUploadFinish(upload.secure_url);
        } catch (err) {
            console.error("[CollectionImageUploader]", err);
            onUploadFail("Couldn't upload the image.", () => send(file));

            amplitude_logAnalyticsEvent("upload_image_to_cloudinary_fail", {
                user_id: user.id,
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Container>
            <UploadWrapper background={imageSrc || originalSrc}>
                <IconWrapper
                    onClick={() => {
                        if (loading) return;
                        const event = document.createEvent("MouseEvent");
                        event.initEvent("click", false, true);
                        fileRef.current.dispatchEvent(event);
                    }}
                >
                    {loading ? (
                        <Spinner width={12} />
                    ) : (
                        <IconImg mode="light" name="upload" size={18} />
                    )}
                </IconWrapper>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    disabled={loading}
                    onChange={handleUpload}
                    hidden
                />
                <Overlay />
            </UploadWrapper>
        </Container>
    );
}

const Container = styled.div`
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
`;

const Overlay = styled.div`
    position: absolute;
    background-color: rgba(0, 0, 0, 0.2);
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
`;

const UploadWrapper = styled.div<{
    background: string;
}>`
    width: 100%;
    height: 100%;

    ${({ background }) => {
        return css`
            background: url(${background});
            background-repeat: no-repeat;
            background-size: cover;
            background-position: center center;
        `;
    }}
`;

const IconWrapper = styled.div`
    border-radius: 50%;
    backdrop-filter: blur(2px);
    background-color: rgba(15, 20, 25, 0.15);
    z-index: 1;
    cursor: pointer;
    padding: 12px;
    width: 42px;
    height: 42px;
    min-height: 42px;
    min-width: 42px;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    transition: 0.2s all ease;

    &:hover {
        background-color: rgba(15, 20, 25, 0.75);
    }
`;
