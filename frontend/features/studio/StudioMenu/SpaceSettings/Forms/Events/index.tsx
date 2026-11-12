import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import Spinner from "@ui/components/Spinner";

import { UserContext } from "@components/context/UserContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { Input } from "../shared/Input";
import { useContext, useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import Dropdown from "@ui/components/Dropdown";
import { Form, FormError, FormLabel } from "../styles/Form";
import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import IconImg from "@ui/components/IconImg";
import ImageUploader from "@components/ImageUploader";
import InlineError from "@ui/components/InlineError";
import InfoCircle from "@ui/icons/InfoCircle";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { useSpaceCoverContext } from "../context/SpaceCoverContext";
import { useFormHandler, useSaveFailure } from "../context/ActionsContext";
import EventSchedulerService from "@api/eventScheduler/_api";
import moment from "moment";
import { showSuccess } from "@components/Dialogs";
import States from "@3/three/states";
import { uploadFile } from "@utils/factory/httpPinata";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

type EventScheduler = {
    title: string;
    eventType: string;
    thumbnail: string;
    startDate?: Date;
    endDate?: Date;
};

const dropdownStyle = { width: "100%", border: "none" };

type EventTypeOptions = {
    title: string;
    value: string;
    disabled: boolean;
};

const eventTypes: Array<EventTypeOptions> = [
    {
        title: "Party",
        disabled: false,
        value: "Party",
    },
    {
        title: "Art Showcase",
        disabled: false,
        value: "Art Showcase",
    },
    {
        title: "Mint",
        disabled: false,
        value: "Mint",
    },
    {
        title: "Hang",
        disabled: false,
        value: "Hang",
    },
    {
        title: "Discussion",
        disabled: false,
        value: "Discussion",
    },
    {
        title: "Co-Build",
        disabled: false,
        value: "Co-Build",
    },
];

function getTimezone() {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const now = new Date();

    const userDate = new Date(
        now.toLocaleString("en-US", { timeZone: userTimezone })
    );

    let dateFormat, timeFormat;

    const isUSA = userTimezone.toLowerCase().includes("america");

    const is24Hours = userDate
        .toLocaleString("en-US", { hour12: false })
        .includes("AM");

    if (isUSA) {
        dateFormat = "mm/dd/yyyy";
        timeFormat = "";
    } else {
        dateFormat = "dd/mm/yyyy";
        timeFormat = "HH:mm";
    }

    const textFormat = `${isUSA ? "MM/dd/yyyy" : "dd/MM/yyyy"}, ${
        !isUSA ? "HH:mm" : "hh:mm a"
    }`;

    return {
        timeFormat,
        dateFormat,
        textFormat,
    };
}

export function EventScheduler() {
    //
    const { user, token } = useContext(UserContext);

    const { exhibit, baseAnalyticsEvent, exhibitStore } = useCurrentExhibit();

    const [eventInfo, setEventInfo] = useState<EventScheduler>({
        title: "",
        eventType: "Party",
        thumbnail: "",
        startDate: null,
        // startDuration: null,
        // endDuration: null,
        endDate: null,
    });

    const userTimezone = getTimezone();

    const [isUploadHovered, setIsUploadHovered] = useState(false);

    const [warning, setWarning] = useState("");

    const [error, setError] = useState({
        timeDuration: null,
    });

    useFormHandler(async () => {
        //
        handleSave();
    }, null);

    const { is2DLoading, set2DUploading } = useSpaceCoverContext();

    const [isCoverLoading, set2DLoading] = useState(false);

    // The thumbnail upload that failed, kept so Retry can send the same
    // picture again. Cleared when an upload starts.
    const [failedUpload, setFailedUpload] = useState<{
        retry: () => void;
    }>(null);

    // Set when making the thumbnail from the current view failed.
    const [coverFailed, setCoverFailed] = useState(false);

    // Why saving the event did not go through, shown beside World
    // settings' Save button (docs/feedback.md).
    const [, setSaveFailure] = useSaveFailure();

    const [progress, setProgress] = useState(0);

    const editing = useRef({});

    const logEditInfoAnalytics = useDebouncedCallback(() => {
        //
        const edited = Object.keys(editing.current);

        editing.current = {};

        amplitude_logAnalyticsEvent("add_event_scheduler_info", {
            ...baseAnalyticsEvent,
            edited,
        });
        //
    }, 3000);

    const handleInputChange = useEventCallback((e) => {
        setError({
            timeDuration: null,
        });

        setEventInfo({
            ...eventInfo,
            [e.target.name]: e.target.value,
        });
    }, []);

    const handleGenerateCover = useEventCallback(async () => {
        try {
            setCoverFailed(false);

            set2DLoading(true);

            const dataUrl = await States.takeBase64Screenshot({
                custom: { width: 3120, height: 1280 },
            });

            const res: Response = await fetch(dataUrl);
            const blob: Blob = await res.blob();
            const imageFile = new File([blob], "File name", {
                type: "image/png",
            });

            const pinata = await uploadFile(imageFile);

            const ipfsHash = pinata?.IpfsHash;

            if (!ipfsHash) throw new Error("Failed to upload file");

            const url = `https://cyber.mypinata.cloud/ipfs/${ipfsHash}`;

            if (!url) {
                throw "Failed to generate cover image";
            }

            setEventInfo({
                ...eventInfo,
                thumbnail: url,
            });
        } catch (error) {
            console.error(error);

            setCoverFailed(true);
        } finally {
            set2DLoading(false);
        }
    }, []);

    const handleSave = useEventCallback(async () => {
        logEditInfoAnalytics();

        setSaveFailure(null);

        try {
            //

            setError({ timeDuration: null });

            const { startDate, endDate, ...rest } = eventInfo;

            const emptyField = Object.keys(eventInfo).find(
                (key) => eventInfo[key] === ""
            );

            if (emptyField) {
                setSaveFailure({
                    message: "Fill in every field before you save the event.",
                });
                return;
            }

            if (
                (!exhibit?.info?.headline ||
                    (!exhibit?.info?.heroImg && !exhibit?.info?.cHeroImg)) &&
                rest?.title &&
                rest?.thumbnail
            ) {
                await exhibitStore.updateExhibitInfo({
                    headline: rest.title,
                    heroImg: rest.thumbnail,
                });
            }

            amplitude_logAnalyticsEvent("create_event_start", {
                ...eventInfo,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });

            const startDateTimeUnix = moment(startDate).unix();

            const endDateTimeUnix = moment(endDate).unix();

            if (endDateTimeUnix <= startDateTimeUnix) {
                //
                setError({
                    timeDuration: true,
                });
                return;
            }

            const twoDaysAfterStart = moment
                .unix(startDateTimeUnix)
                .add(2, "days")
                .unix();

            if (endDateTimeUnix > twoDaysAfterStart) {
                //
                setSaveFailure({
                    message:
                        "An event can last up to 2 days. Pick an earlier end date.",
                });
                setError({
                    timeDuration: true,
                });
                return;
            }

            await EventSchedulerService.create({
                ...rest,
                userId: user.id,
                exhibitId: exhibit.id,
                date: startDateTimeUnix,
                endDate: endDateTimeUnix,
            });

            amplitude_logAnalyticsEvent("create_event_success", {
                ...eventInfo,
                startDate: eventInfo.startDate?.toISOString?.(),
                endDate: eventInfo.endDate?.toISOString?.(),
            });

            showSuccess("Event submitted successfully!");

            //
        } catch (err) {
            //
            console.error(err);

            amplitude_logAnalyticsEvent("create_event_failed", {
                ...eventInfo,
                startDate: eventInfo.startDate?.toISOString?.(),
                endDate: eventInfo.endDate?.toISOString?.(),
            });

            setSaveFailure({
                message: "Couldn't create the event.",
                retry: () => handleSave(),
            });
        }
    }, []);

    function getMinMaxTime() {
        const startDateMinTime = new Date();
        startDateMinTime.setHours(0);
        startDateMinTime.setMinutes(0);

        const startDateMaxTime = new Date();

        const isSameDay =
            eventInfo.endDate?.getDate?.() === eventInfo.startDate?.getDate?.();

        startDateMaxTime.setHours(
            !eventInfo?.endDate
                ? 23
                : isSameDay
                ? eventInfo?.endDate?.getHours()
                : 23
        );
        startDateMaxTime.setMinutes(
            !eventInfo?.endDate
                ? 59
                : isSameDay
                ? eventInfo?.endDate?.getMinutes()
                : 59
        );

        const endDateMinTime = new Date();
        endDateMinTime.setHours(
            !eventInfo.startDate
                ? 0
                : isSameDay
                ? eventInfo.startDate.getHours()
                : 0
        );
        endDateMinTime.setMinutes(
            !eventInfo.startDate
                ? 0
                : isSameDay
                ? eventInfo.startDate.getMinutes()
                : 0
        );

        const endDateMaxTime = new Date();
        endDateMaxTime.setHours(23);
        endDateMaxTime.setMinutes(59);

        return {
            startDate: {
                minTime: startDateMinTime,
                maxTime: startDateMaxTime,
            },
            endDate: {
                minTime: endDateMinTime,
                maxTime: endDateMaxTime,
            },
        };
    }

    return (
        <Container>
            {warning && (
                <div className="alert">
                    <InfoCircle strokeColor="#ffffff" />
                    {warning}
                </div>
            )}

            {/* <HeaderInfo>
                Fill a title to make it public in oncyber discovery. Regenerate
                its previews (bottom) to update listing and portal appearance.
            </HeaderInfo> */}

            <Form>
                <FormLabel>Event Title</FormLabel>
                <Input
                    maxLength={30}
                    name="title"
                    placeholder="e.g. Nyc"
                    onChange={handleInputChange}
                    value={eventInfo?.title || ""}
                />
            </Form>

            <Form inline style={{ gap: 16, alignItems: "baseline" }}>
                <Form className="timepicker_container full-form">
                    <FormLabel>Set start date</FormLabel>

                    <DatePicker
                        selected={eventInfo.startDate}
                        onChange={(date) =>
                            setEventInfo((state) => {
                                return {
                                    ...state,
                                    startDate: date,
                                    endDate:
                                        state.endDate && date > state.endDate
                                            ? null
                                            : state.endDate,
                                };
                            })
                        }
                        calendarStartDay={1}
                        placeholderText={`${userTimezone.dateFormat} ${userTimezone.timeFormat}`}
                        showTimeSelect
                        minDate={new Date()}
                        // maxDate={eventInfo.endDate}
                        timeIntervals={15}
                        dateFormat={userTimezone.textFormat}
                        timeFormat={userTimezone.timeFormat}
                        minTime={getMinMaxTime().startDate.minTime}
                        maxTime={getMinMaxTime().startDate.maxTime}
                    />

                    {/* <FormError className="error">Invalid date</FormError> */}
                </Form>

                <Form className="timepicker_container full-form">
                    <FormLabel>Set end date</FormLabel>

                    <DatePicker
                        selected={eventInfo.endDate}
                        onChange={(date) => {
                            setEventInfo((state) => {
                                return {
                                    ...state,
                                    endDate: date,
                                    startDate:
                                        state.startDate &&
                                        date < state.startDate
                                            ? null
                                            : state.startDate,
                                };
                            });
                        }}
                        calendarStartDay={1}
                        placeholderText={`${userTimezone.dateFormat} ${userTimezone.timeFormat}`}
                        showTimeSelect
                        minDate={eventInfo.startDate}
                        timeIntervals={15}
                        dateFormat={userTimezone.textFormat}
                        timeFormat={userTimezone.timeFormat}
                        minTime={getMinMaxTime().endDate.minTime}
                        maxTime={getMinMaxTime().endDate.maxTime}
                    />
                    {/* <DurarionContainer>
                        <DatePicker
                            selected={eventInfo.startDuration}
                            onChange={(date) => {
                                setError({
                                    timeDuration: null,
                                });

                                if (
                                    eventInfo?.endDuration &&
                                    date.getTime() >
                                        eventInfo.endDuration.getTime()
                                ) {
                                    return;
                                }

                                setEventInfo((state) => ({
                                    ...state,
                                    ["startDuration"]: date,
                                }));
                            }}
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            timeCaption="time"
                            dateFormat="HH:mm"
                            showTimeSelectOnly
                            placeholderText="HH:mm"
                            minTime={new Date(
                                new Date().setHours(0)
                            ).setMinutes(0)}
                            maxTime={new Date(
                                new Date().setHours(
                                    !eventInfo?.endDuration
                                        ? 23
                                        : eventInfo?.endDuration?.getHours()
                                )
                            ).setMinutes(
                                !eventInfo?.endDuration
                                    ? 59
                                    : eventInfo?.endDuration?.getMinutes()
                            )}
                        />

                        <span className="duration-separator"> - </span>

                        <DatePicker
                            selected={eventInfo.endDuration}
                            minTime={new Date(
                                new Date().setHours(
                                    !eventInfo.startDuration
                                        ? 0
                                        : eventInfo.startDuration.getHours()
                                )
                            ).setMinutes(
                                !eventInfo.startDuration
                                    ? 0
                                    : eventInfo.startDuration.getMinutes()
                            )}
                            maxTime={new Date(
                                new Date().setHours(23)
                            ).setMinutes(59)}
                            onChange={(date) => {
                                setError({
                                    timeDuration: null,
                                });

                                if (
                                    eventInfo?.startDate &&
                                    eventInfo.startDate.getTime() >
                                        date.getTime()
                                ) {
                                    return;
                                }

                                setEventInfo((state) => ({
                                    ...state,
                                    ["endDuration"]: date,
                                }));
                            }}
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            timeCaption="time"
                            placeholderText="HH:mm"
                            dateFormat="HH:mm"
                            minDate={new Date()}
                            showTimeSelectOnly
                        />
                    </DurarionContainer> */}

                    {error?.timeDuration && (
                        <FormError className="error err">
                            Invalid date
                        </FormError>
                    )}
                </Form>
            </Form>

            <Form inline style={{ gap: 16 }}>
                <Form className="full-form">
                    <FormLabel>Event type</FormLabel>
                    <Dropdown
                        background="#27282c"
                        style={dropdownStyle}
                        dropdownIconPosition="right"
                        overrideTheme="dark"
                        items={eventTypes}
                        value={eventInfo?.eventType}
                        onChange={(eventType) =>
                            setEventInfo({
                                ...eventInfo,
                                eventType,
                            })
                        }
                    />
                </Form>

                <Form className="full-form">
                    <FormLabel>Event Location</FormLabel>
                    <Input
                        readOnly
                        maxLength={30}
                        name="title"
                        placeholder={
                            exhibit?.info?.headline || exhibit?.id || ""
                        }
                    />
                </Form>
            </Form>

            <Form style={{ zIndex: 0 }}>
                <FormLabel>Event Thumbnail</FormLabel>

                <GenerateImageWrapper>
                    <PreviewWrapper>
                        <ImageWrapper>
                            <IconsContainer>
                                <IconWrapper
                                    loading={
                                        is2DLoading ||
                                        isCoverLoading ||
                                        is2DLoading
                                    }
                                    style={{ marginRight: 8 }}
                                >
                                    {isCoverLoading ? (
                                        <Spinner width={18} />
                                    ) : eventInfo?.thumbnail ? (
                                        <div
                                            onClick={() =>
                                                setEventInfo({
                                                    ...eventInfo,
                                                    thumbnail: "",
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
                                        <div onClick={handleGenerateCover}>
                                            <IconImg
                                                name="refresh-cw"
                                                mode="light"
                                                size={18}
                                            />
                                        </div>
                                    )}
                                </IconWrapper>

                                <ImageUploader
                                    exhibitId={exhibit?.id}
                                    onProgress={(progress) =>
                                        setProgress(progress)
                                    }
                                    onUploadFinished={(url) => {
                                        set2DUploading(false);
                                        setEventInfo({
                                            ...eventInfo,
                                            thumbnail: url,
                                        });
                                    }}
                                    onMouseEnter={() =>
                                        setIsUploadHovered(true)
                                    }
                                    onMouseLeave={() =>
                                        setIsUploadHovered(false)
                                    }
                                    onUploadFailed={(retry) => {
                                        // A failed upload is over too. Left
                                        // on, this flag stops the space's
                                        // banner from being generated.
                                        set2DUploading(false);
                                        setFailedUpload({ retry });
                                    }}
                                    onUploadStarted={() => {
                                        set2DUploading(true);
                                        setFailedUpload(null);
                                    }}
                                />
                            </IconsContainer>
                            <CustomImage src={eventInfo?.thumbnail} />
                        </ImageWrapper>
                        <Progress progress={progress} />
                    </PreviewWrapper>
                </GenerateImageWrapper>
                <InlineError
                    message={failedUpload && "Couldn't upload the image."}
                    onRetry={() => failedUpload.retry()}
                />
                <InlineError
                    message={
                        !isCoverLoading &&
                        coverFailed &&
                        "Couldn't make a thumbnail from the current view."
                    }
                    onRetry={handleGenerateCover}
                />
                {isUploadHovered && (
                    <span className="aspect-ratio-warning">
                        Use a 1:1 aspect ratio for best results
                    </span>
                )}
            </Form>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 18px;

    .aspect-ratio-warning {
        font-size: 10px;
        color: #777980;
    }

    .full-form {
        width: 100%;
    }

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

const DateInput = styled(Input)`
    ::-webkit-calendar-picker-indicator {
        filter: invert(0.5);
        margin: 0;
    }

    &:invalid {
        border-color: orange;
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

const DurarionContainer = styled.div`
    width: 100%;
    display: flex;
    color: #c0c0c6;
    align-items: center;
    border-radius: 6px;
    background: #27282c;
    justify-content: space-between;

    & > span.duration-separator {
        color: #c0c0c6;
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

    background: linear-gradient(
        180deg,
        rgba(0, 0, 0, 0) 0%,
        rgba(0, 0, 0, 0.18) 100%
    );

    background: linear-gradient(0deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2));

    border-radius: 5px;

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
    border-radius: 5px;
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

// TODO:
// min, max
