import React, {
    useRef,
    useState,
    useEffect,
    forwardRef,
    CSSProperties,
    useContext,
} from "react";
import { useTheme } from "styled-components";
import Plus from "@ui/icons/Plus";
import { useAsyncAction } from "@components/hooks/useAsyncAction";
import InlineError from "@ui/components/InlineError";
import ProgressBar from "@ui/components/ProgressBar";
import { uploadFile as uploadFilePinata } from "@utils/factory/httpPinata";
import { Area, StyledVideo, StyledVideoProps } from "./styles";
import { UserContext } from "@components/context/UserContext";

type CoverImageProps = StyledVideoProps &
    React.HTMLAttributes<HTMLDivElement & HTMLSpanElement> & {
        src?: string;
        accept?: string;
        showIcon?: boolean;
        style?: CSSProperties;
        cloudinary?: boolean;
        onValidate?: () => void;
        onUpload: (url: string, cloudinary_url?: string) => void;
    };

const VideoUpload = forwardRef(
    (props: CoverImageProps, ref: React.Ref<HTMLDivElement>) => {
        const { src, cloudinary, accept, onUpload, onValidate } = props;

        const { token } = useContext(UserContext);

        const fileRef = useRef(null);

        // The picker follows the page theme unless told otherwise, and so
        // does the failure shown under it.
        const theme = useTheme() as { type?: string } | undefined;

        const isLight = (props.overrideTheme || theme?.type) === "light";

        const [videoFile, setVideoFile] = useState(null);
        const [progress, setProgress] = useState(0);
        const [url, setUrl] = useState(src);

        // The upload and its progress bar. useAsyncAction ends every run in
        // done or failed, so the bar cannot stay up; a failure is shown under
        // the picker with Retry. See docs/feedback.md.
        const upload = useAsyncAction(async (file: File) => {
            onValidate?.();

            setProgress(20);

            const pinataJob = await uploadFilePinata(file);

            if (!pinataJob) {
                throw "err";
            }

            const ipfsHash = pinataJob?.IpfsHash;

            if (!ipfsHash) {
                throw "Ipfs hash not found";
            }

            const pinata_url = `https://cyber.mypinata.cloud/ipfs/${ipfsHash}`;

            onUpload(ipfsHash, pinata_url);

            setUrl(ipfsHash);

            setProgress(100);
        });

        const loading = upload.status === "pending";

        useEffect(() => {
            setUrl(src);
        }, [src]);

        useEffect(() => {
            if (videoFile) upload.run(videoFile);
        }, [videoFile]);

        const handleDisplayVideo = (e) => {
            if (e.target.files[0]) return setVideoFile(e.target.files[0]);
        };

        function handleClick() {
            const event = document.createEvent("MouseEvent");
            event.initEvent("click", false, true);
            fileRef.current.dispatchEvent(event);
        }

        return (
            <>
                <StyledVideo ref={ref} {...props}>
                    {loading && (
                        <ProgressBar
                            progress={progress}
                            style={{ zIndex: 9999 }}
                        />
                    )}

                    {url && (
                        <video
                            className="animation"
                            muted
                            loop
                            autoPlay
                            src={`https://cyber.mypinata.cloud/ipfs/${url}`}
                        />
                    )}

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
                        onChange={handleDisplayVideo}
                    />
                </StyledVideo>
                <InlineError
                    message={
                        upload.status === "failed" &&
                        "Couldn't upload the video."
                    }
                    onRetry={() => upload.run(videoFile)}
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

VideoUpload.defaultProps = {
    src: "",
    showIcon: true,
    accept: "video/*",
    onUpload: () => {},
};

export default VideoUpload;
