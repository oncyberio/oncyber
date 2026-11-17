import { UserContext } from "@components/context/UserContext";
import { useAsyncAction } from "@components/hooks/useAsyncAction";
import { IconButton } from "@ui/components/IconButton.tsx";
import IconImg from "@ui/components/IconImg";
import InlineError from "@ui/components/InlineError";
import Spinner from "@ui/components/Spinner";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { updateAvatar } from "@utils/saveToDb";
import { useContext, useRef, useState } from "react";
import styled, { css, useTheme } from "styled-components";

const PICTURE_SIZE = 512;

const dataUrlBytes = (dataUrl: string) =>
    Math.ceil(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

/** The picked picture as a JPEG no larger than the avatar ever shows it. */
function profileJpeg(image: HTMLImageElement, original: string) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return original;
    const scale = Math.min(1, PICTURE_SIZE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return original;
    // JPEG has no transparency: see-through pixels would turn black.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL("image/jpeg", 0.9);
    return jpeg.startsWith("data:image/jpeg") ? jpeg : original;
}

export default function UploaderAvatar({
    currentAvatar,
    onImageReady = (url: string) => {},
}) {
    const fileRef = useRef(null);

    const [imageSrc, setImageSrc] = useState("");
    const [imageFile, setImageFile] = useState(null);

    // A picture over the size limit is explained under the picker; a failed
    // upload too, with Retry. See docs/feedback.md.
    const [tooLarge, setTooLarge] = useState(false);
    const [unreadable, setUnreadable] = useState(false);

    const { user } = useContext(UserContext);

    // The picture follows the page theme, and so does the failure under it.
    const theme = useTheme() as { type?: string } | undefined;

    const upload = useAsyncAction(async (dataUrl: string) => {
        amplitude_logAnalyticsEvent("upload_avatar", {
            user_id: user?.id,
        });
        let avatar;
        try {
            avatar = await updateAvatar(dataUrl, user.id, 1);
        } catch (err) {
            amplitude_logAnalyticsEvent("upload_avatar_fail", {
                user_id: user?.id,
            });
            throw err;
        }
        if (!avatar?.success) {
            amplitude_logAnalyticsEvent("upload_avatar_fail", {
                user_id: user?.id,
            });
            throw new Error("Failed to upload avatar.");
        }
        amplitude_logAnalyticsEvent("upload_avatar_success", {
            user_id: user?.id,
        });
        onImageReady(avatar.url);
    });

    const loading = upload.status === "pending";

    const handleDisplayImage = (e) => {
        setTooLarge(false);
        setUnreadable(false);
        upload.reset();

        setImageFile(e.target.files[0]);
        if (!e.target.files[0]) return setImageSrc("");

        var reader = new FileReader();
        reader.readAsDataURL(e.target.files[0]);

        reader.addEventListener(
            "load",
            function () {
                var image = new Image();
                image.onload = function () {
                    // Saved as a small JPEG whatever was picked (AVIF, HEIC,
                    // WebP, a large photo): every browser and the avatar
                    // texture can read that.
                    const picture = profileJpeg(image, reader.result as string);
                    // request size limit of vercel 1mo
                    if (dataUrlBytes(picture) / 1024 / 1024 > 0.9)
                        return setTooLarge(true);
                    setImageSrc(picture);
                    upload.run(picture);
                };
                image.onerror = function () {
                    setUnreadable(true);
                };
                image.src = reader.result as string;
            },
            false
        );
    };

    return (
        <Container>
            <UploadWrapper background={imageSrc || currentAvatar}>
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
                    onChange={handleDisplayImage}
                    hidden
                />
                <Overlay />
            </UploadWrapper>
            <InlineError
                message={
                    tooLarge
                        ? "This picture is larger than 900 KB. Choose a smaller one."
                        : unreadable
                        ? "This browser can't read that picture. Choose a JPEG or PNG."
                        : upload.status === "failed" &&
                          "Couldn't upload your picture."
                }
                onRetry={
                    tooLarge || unreadable
                        ? undefined
                        : () => upload.run(imageSrc)
                }
                surface={theme?.type === "light" ? "light" : "dark"}
                style={{ maxWidth: "100%", marginTop: 8 }}
            />
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
`;

const Overlay = styled.div`
    position: absolute;
    background-color: rgba(0, 0, 0, 0.2);
    width: 100%;
    height: 100%;
`;

const UploadWrapper = styled.div<{
    background: string;
}>`
    position: relative;
    border-radius: 50%;
    width: 96px;
    height: 96px;
    min-width: 96px;
    min-height: 96px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: default;
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

    transition: 0.2s all ease;

    &:hover {
        background-color: rgba(15, 20, 25, 0.75);
    }
`;
