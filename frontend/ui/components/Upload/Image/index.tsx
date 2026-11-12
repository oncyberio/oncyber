import React, {
    useRef,
    useState,
    useEffect,
    forwardRef,
    useContext,
    CSSProperties,
} from "react";
import { useTheme } from "styled-components";
import Plus from "@ui/icons/Plus";
import { UserContext } from "@context/UserContext";
import { useAsyncAction } from "@components/hooks/useAsyncAction";
import InlineError from "@ui/components/InlineError";
import ProgressBar from "@ui/components/ProgressBar";
import { uploadFile as UploadPinata } from "@utils/factory/httpPinata";
import { Area, StyledCoverImage, StyledCoverImageProps } from "./styles";

type CoverImageProps = StyledCoverImageProps &
    React.HTMLAttributes<HTMLDivElement & HTMLSpanElement> & {
        src?: string;
        accept?: string;
        showIcon?: boolean;
        style?: CSSProperties;
        onValidate?: () => void;
        onUpload: (url: string) => void;
    };

const ImageUpload = forwardRef(
    (props: CoverImageProps, ref: React.Ref<HTMLDivElement>) => {
        const { src, accept, onUpload, onValidate } = props;

        const { token } = useContext(UserContext);

        const fileRef = useRef(null);

        // The picker follows the page theme unless told otherwise, and so
        // does the failure shown under it.
        const theme = useTheme() as { type?: string } | undefined;

        const isLight = (props.overrideTheme || theme?.type) === "light";

        const [imageFile, setImageFile] = useState(null);
        const [progress, setProgress] = useState(0);
        const [url, setUrl] = useState(src);

        // The upload and its progress bar. useAsyncAction ends every run in
        // done or failed, so the bar cannot stay up; a failure is shown under
        // the picker with Retry. See docs/feedback.md.
        const upload = useAsyncAction(async (file: File) => {
            onValidate?.();

            setProgress(20);

            const pinata = await UploadPinata(file);

            const ipfsHash = pinata?.IpfsHash;

            if (!ipfsHash) throw new Error("Failed to upload file");

            const url = `https://cyber.mypinata.cloud/ipfs/${ipfsHash}`;

            setProgress(100);

            setUrl(url);

            onUpload(url);
        });

        const loading = upload.status === "pending";

        useEffect(() => {
            setUrl(src);
        }, [src]);

        useEffect(() => {
            if (imageFile) upload.run(imageFile);
        }, [imageFile]);

        const handleDisplayImage = (e) => {
            setImageFile(e.target.files[0]);
        };

        function handleClick() {
            const event = document.createEvent("MouseEvent");
            event.initEvent("click", false, true);
            fileRef.current.dispatchEvent(event);
        }

        return (
            <>
                <StyledCoverImage ref={ref} {...props} url={url}>
                    {loading && <ProgressBar progress={progress} />}

                    {props.showIcon ? (
                        <span onClick={handleClick}>
                            <Plus width="14" height="14" color="#999999" />
                        </span>
                    ) : (
                        <Area onClick={handleClick} />
                    )}

                    <input
                        hidden
                        type="file"
                        ref={fileRef}
                        accept={accept}
                        disabled={loading}
                        onChange={handleDisplayImage}
                    />
                </StyledCoverImage>
                <InlineError
                    message={
                        upload.status === "failed" &&
                        "Couldn't upload the image."
                    }
                    onRetry={() => upload.run(imageFile)}
                    surface={isLight ? "light" : "dark"}
                    style={{
                        width: props.style?.width || props.width,
                        maxWidth: "100%",
                        marginTop: 8,
                    }}
                />
            </>
        );
    }
);

ImageUpload.defaultProps = {
    src: "",
    showIcon: true,
    accept: "image/*",
    onUpload: () => {},
};

export default ImageUpload;
