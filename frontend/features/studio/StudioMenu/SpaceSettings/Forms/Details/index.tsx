import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import Spinner from "@ui/components/Spinner";

import { UserContext } from "@components/context/UserContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSnackbar } from "@components/Snackbar";
import { DEFAULT_SNACKBAR_DURATION } from "@components/Snackbar/useSnackbar";
import { Input } from "../shared/Input";
import { TextArea } from "../shared/TextArea";
import { ChangeEvent, useContext, useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { LinkStatus, LinkStatusProps } from "../shared/LinkStatus";

import { Form, FormError, FormLabel, FormLabelWrapper } from "../styles/Form";
import { HeaderInfo } from "../styles/Header";
import { Experience } from "@uitypes/experience";
import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import { validatePath } from "@utils/rules/url";

import IconImg from "@ui/components/IconImg";
import InlineError from "@ui/components/InlineError";
import ImageUploader from "@components/ImageUploader";
import InfoCircle from "@ui/icons/InfoCircle";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { useSpaceCoverContext } from "../context/SpaceCoverContext";
import { useCustomLinkEditor } from "@features/studio/StudioMenu/context/useCustomLinkEditor";
import { CustomLinkEdit } from "../shared/CustomLinkEdit";

type ExhibitInfo = {
    heroImg?: string;
    headline?: string;
    customLink?: string;
    description?: string;
    cHeroImg360?: string;
    lastUpdatedHeroImg?: number;
};

export function Details() {
    //
    const { user, token } = useContext(UserContext);

    const { is2DLoading, set2DUploading, is360Loading, generateCover } =
        useSpaceCoverContext();

    const { exhibit, exhibitStore, userRole, baseAnalyticsEvent } =
        useCurrentExhibit();

    const [, closeSnackbar] = useSnackbar({
        position: "top-right",
    });

    // Fields whose last save failed. Each says so under itself, with a Retry
    // that saves what the field shows now. See docs/feedback.md.
    const [unsaved, setUnsaved] = useState<string[]>([]);

    // The banner upload that failed, kept so Retry can send the same picture
    // again. Cleared when an upload starts.
    const [failedUpload, setFailedUpload] = useState<{
        retry: () => void;
    }>(null);

    const [warning, setWarning] = useState("");

    const [progress, setProgress] = useState(0);

    const [exhibitInfo, setExhibitInfo] = useState<Partial<Experience["info"]>>(
        exhibit.info || {}
    );

    const editing = useRef({});

    const logEditInfoAnalytics = useDebouncedCallback(() => {
        //
        const edited = Object.keys(editing.current);

        editing.current = {};

        amplitude_logAnalyticsEvent("edit_space_info", {
            ...baseAnalyticsEvent,
            edited,
        });
        //
    }, 3000);

    const editGeneralInfo = useEventCallback(async (data: ExhibitInfo) => {
        //

        setExhibitInfo((state) => ({
            ...state,
            ...data,
        }));

        editing.current = { ...editing.current, ...data };

        logEditInfoAnalytics();

        closeSnackbar();

        const fields = Object.keys(data);

        try {
            //
            await exhibitStore.updateExhibitInfo(data);

            // Every keystroke saves, so the message stays until one succeeds.
            setUnsaved((failed) => failed.filter((it) => !fields.includes(it)));
            //
        } catch (err) {
            //
            console.error(err);

            setUnsaved((failed) =>
                failed.filter((it) => !fields.includes(it)).concat(fields)
            );
        }
        //
    }, []);

    const saveFailure = (field: keyof ExhibitInfo, message: string) => (
        <InlineError
            message={unsaved.includes(field) && message}
            onRetry={() =>
                editGeneralInfo({
                    [field]: exhibitInfo?.[field] ?? "",
                } as ExhibitInfo)
            }
        />
    );

    return (
        <Container>
            {warning && (
                <div className="alert">
                    <InfoCircle strokeColor="#ffffff" />
                    {warning}
                </div>
            )}

            <HeaderInfo>
                Fill a title to make it public in oncyber discovery. Regenerate
                its previews (bottom) to update listing and portal appearance.
            </HeaderInfo>

            <Form>
                <FormLabel>Title</FormLabel>
                <Input
                    maxLength={30}
                    placeholder="e.g. Martian"
                    onChange={(e) =>
                        editGeneralInfo({
                            headline: e.target.value,
                        })
                    }
                    value={exhibitInfo?.headline || ""}
                />
                {saveFailure("headline", "Couldn't save the title.")}
            </Form>

            <CustomLinkEdit />

            <Form>
                <FormLabel>Description</FormLabel>
                <TextArea
                    className="scrollbar-hidden"
                    maxLength={250}
                    placeholder="Enter a description..."
                    onChange={(e) =>
                        editGeneralInfo({
                            description: e.target.value,
                        })
                    }
                    value={exhibitInfo?.description || ""}
                />
                {saveFailure("description", "Couldn't save the description.")}
            </Form>

            <Form>
                <FormLabel>Preview</FormLabel>

                <GenerateImageWrapper>
                    <PreviewWrapper>
                        <ImageWrapper>
                            <IconsContainer>
                                {(is2DLoading || exhibit.info.heroImg) && (
                                    <IconWrapper
                                        loading={is2DLoading || is2DLoading}
                                        style={{ marginRight: 8 }}
                                    >
                                        {is2DLoading ? (
                                            <Spinner width={18} />
                                        ) : exhibit.info.heroImg ? (
                                            <div
                                                onClick={() =>
                                                    editGeneralInfo({
                                                        heroImg: "",
                                                    })
                                                }
                                            >
                                                <IconImg
                                                    name="trash"
                                                    mode="light"
                                                    size={18}
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() =>
                                                    generateCover("2d")
                                                }
                                            >
                                                <IconImg
                                                    name="refresh-cw"
                                                    mode="light"
                                                    size={18}
                                                />
                                            </div>
                                        )}
                                    </IconWrapper>
                                )}

                                <ImageUploader
                                    exhibitId={exhibit?.id}
                                    onProgress={(progress) =>
                                        setProgress(progress)
                                    }
                                    onUploadFinished={(url) => {
                                        set2DUploading(false);
                                        editGeneralInfo({ heroImg: url });
                                    }}
                                    onUploadFailed={(retry) => {
                                        // A failed upload is over too. Left
                                        // on, this flag stops the banner
                                        // from being generated again.
                                        set2DUploading(false);
                                        setFailedUpload({ retry });
                                    }}
                                    onUploadStarted={() => {
                                        set2DUploading(true);
                                        setFailedUpload(null);
                                    }}
                                />
                            </IconsContainer>
                            <CustomImage
                                src={
                                    exhibit.info?.heroImg ||
                                    exhibit.info?.cHeroImg
                                }
                            />
                        </ImageWrapper>
                        <Progress progress={progress} />
                        <span>2D Banner</span>
                    </PreviewWrapper>

                    {/* <PreviewWrapper>
                        <ImageWrapper>
                            <IconsContainer>
                                <IconWrapper
                                    loading={is360Loading}
                                    onClick={() => generateCover("3d")}
                                >
                                    {is360Loading ? (
                                        <Spinner width={18} />
                                    ) : (
                                        <IconImg
                                            name="refresh-cw"
                                            mode="light"
                                            size={18}
                                        />
                                    )}
                                </IconWrapper>
                            </IconsContainer>
                            <CustomImage src={exhibit.info?.cHeroImg360} />
                        </ImageWrapper>
                        <span>360° Banner (shown in portals)</span>
                    </PreviewWrapper> */}
                </GenerateImageWrapper>
                {saveFailure("heroImg", "Couldn't save the preview image.")}
                <InlineError
                    message={failedUpload && "Couldn't upload the image."}
                    onRetry={() => failedUpload.retry()}
                />
            </Form>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 18px;

    & > .alert {
        display: flex;
        flex-direction: row;
        gap: 6px;
        border-radius: 8px;
    }
`;

const IconWrapper = styled.div<{ loading: boolean }>`
    border: 1px solid #fff;
    border-radius: 50%;
    padding: 6px;
    cursor: ${(props) => (props.loading ? "progress" : "pointer")};
    width: 32px;
    min-width: 32px;
    height: 32px;
    min-height: 32px;
`;

const Progress = styled.div<{
    progress: number;
}>`
    width: ${(props) => (props.progress !== 100 ? props.progress : 0)}%;
    // width: 100%;
    left: 0;
    height: 10px;
    background: rgb(68 195 69 / 82%);
    position: absolute;
    top: 0;
    z-index: 10;
    border-top-left-radius: 5px;
    border-top-right-radius: 5px;
`;

const PreviewWrapper = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    span {
        font-weight: 500;
        font-size: 10px;
        margin-top: 8px;
        color: #7a7a7a;
    }
`;

const IconsContainer = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    position: absolute;
    z-index: 1;
`;

const GenerateCover = styled.div`
    width: 100%;
    display: flex;
    margin-top: 15px;
    align-items: center;
    justify-content: flex-start;

    & > svg {
        width: 30px;
        height: 30px;
    }

    & > span.generate {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        font-style: normal;
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        margin-left: 10px;
        line-height: 24px;
        color: var(--text-color);
    }
`;

const GenerateHeaderWrapper = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 30px;

    & > label {
        font-style: normal;
        font-weight: 400;
        font-size: 14px;
        line-height: 24px;
        color: #3d3f46;
        margin-bottom: 8px;
    }

    & > p {
        font-style: normal;
        font-weight: 400;
        font-size: 12px;
        line-height: 0px;
        color: #99999f;
        cursor: pointer;
        // min-height: 32px;
        display: flex;
        align-items: center;
    }
`;

const ImageWrapper = styled.div`
    width: 100%;
    overflow: hidden;
    height: 100px;

    position: relative;

    background: var(--studio-inset);
    border: 1px solid var(--studio-line);
    border-radius: var(--studio-radius-card);

    & > span {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        text-align: center;
        font-size: 10px;
        font-weight: 500;
        color: #7a7a7a;
        border-radius: 4px;
        white-space: nowrap;
        padding: 5px 8px;
        top: 8px;
    }
`;

const GenerateImageWrapper = styled.div`
    display: grid;
    grid-template-columns: 1.5fr 2fr;
    grid-gap: 12px;
    margin-top: 6px;
`;

const CustomImage = styled.div<{
    src: string;
}>`
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
    position: absolute;
    left: 0;
    top: 0;

    ${({ src }) => {
        if (src) {
            return css`
                background: url(${src});
                background-position: center;

                background-size: cover;
                background-repeat: no-repeat;
            `;
        }
    }}
`;
