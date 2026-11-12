import moment from "moment";
import { nodeEnv } from "@env";
import styled from "styled-components";
import Spinner from "@ui/components/Spinner";
import { showConfirm, showError } from "@components/Dialogs";
import SubscribedUsers from "./SubscribedUsers";
import {
    Dispatch,
    SetStateAction,
    useContext,
    useEffect,
    useState,
} from "react";
import { baseTokens as base } from "@styles/tokens";
import InlineError from "@ui/components/InlineError";
import { IconButton } from "@ui/components/IconButton";
import { useHome } from "@components/context/HomeContext";
import EventSchedulerService from "@api/eventScheduler/_api";
import { UserContext } from "@components/context/UserContext";
import { RoundButton } from "@components/DesignSystem/buttons";
import { getNotificationSubscription } from "@utils/notifications";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useAsyncAction } from "@components/hooks/useAsyncAction";
import Shape from "./Shape";
import IconImg from "@ui/components/IconImg";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

type EventType = {
    id: string;
    date: number;
    title: string;
    endDate: number;
    exhibitId: string;
    thumbnail: string;
    eventType: string;
    customLink: string;
    eventLocation: string;
    subscribedUsers: Array<{
        userId: string;
        notificationId?: string;
    }>;
    subscriptionNotificationId?: string;
    subscriberCount?: number;
    userId: string;
    setEvents: Dispatch<SetStateAction<any[]>>;
};

export default function Event({
    id,
    title,
    eventType,
    date,
    exhibitId,
    endDate,
    thumbnail,
    customLink,
    eventLocation,
    userId,
    subscribedUsers,
    subscriptionNotificationId,
    subscriberCount,
    setEvents,
}: EventType) {
    const { toggleAuth } = useHome();

    const { user } = useContext(UserContext);

    const [isBellHover, setBellHover] = useState(false);

    const [subscribers, setSubscribers] = useState([]);
    const [currentNotificationId, setCurrentNotificationId] = useState(subscriptionNotificationId || null);
    const [subscriberTotal, setSubscriberTotal] = useState(subscriberCount ?? subscribedUsers?.length ?? 0);

    const analyticsPayload = {
        id,
        date,
        title,
        endDate,
        exhibitId,
        thumbnail,
        eventType,
        customLink,
        eventLocation,
        subscribedUsers: subscriberTotal,
        userId,
    };

    useEffect(() => {
        setSubscribers(subscribedUsers || []);
        setCurrentNotificationId(subscriptionNotificationId || null);
        setSubscriberTotal(subscriberCount ?? subscribedUsers?.length ?? 0);
    }, [subscribedUsers, subscriptionNotificationId, subscriberCount, user?.id]);

    // Deleting and subscribing each keep their spinner in useAsyncAction, so
    // it stops however the request ends. `confirmed` is true for Retry: the
    // owner already said yes.
    const deletion = useAsyncAction(async (confirmed = false) => {
        const isYes =
            confirmed ||
            (await showConfirm("Are you sure you want to delete the event?"));

        if (!isYes) return;

        const response = await EventSchedulerService.deleteEvent({
            eventId: id,
        });

        if (!response?.success) {
            throw new Error(response?.message || "The event was not deleted");
        }

        // update the state...

        setEvents((events) => {
            return events.filter((event) => event.id !== id);
        });
    });

    const deleteLoading = deletion.status === "pending";

    const subscription = useAsyncAction(async () => {
        //

        const isSubscribed = Boolean(currentNotificationId);

        const analyticsEventType = isSubscribed
            ? "unsubscribe_event"
            : "subscribe_event";

        try {
            amplitude_logAnalyticsEvent(
                analyticsEventType + "_started",
                analyticsPayload
            );

            if (isSubscribed) {
                //
                const updatedItems = subscribers.filter(
                    (id, i) => id?.userId !== user.id
                );

                const notificationId = currentNotificationId;

                if (!notificationId) {
                    throw new Error("Invalid notification id");
                }

                const response = await EventSchedulerService.cancelNotification({
                    eventId: id,
                    notificationId,
                });
                if (!response.success) throw new Error("Failed to cancel notification");
                setSubscribers(updatedItems);
                setCurrentNotificationId(null);
                setSubscriberTotal((count) => Math.max(0, count - 1));
            } else {
                //

                await getNotificationSubscription();

                const response = await EventSchedulerService.sendNotification({
                    eventId: id,
                });

                if (response.success && response?.notificationId) {
                    setCurrentNotificationId(response.notificationId);
                    setSubscriberTotal((count) => count + 1);
                    setSubscribers(
                        subscribers.concat({
                            userId: user.id,
                            notificationId: response.notificationId,
                        })
                    );
                } else {
                    throw "err";
                }
            }

            amplitude_logAnalyticsEvent(
                analyticsEventType + "_success",
                analyticsPayload
            );
        } catch (error) {
            //
            console.error("Subscribe error", error);
            showError(
                `Oops! Something went wrong while trying to ${
                    !isSubscribed ? "subscribe" : "unsubscribe"
                } to event notifications. Please try again later.`
            );

            amplitude_logAnalyticsEvent(
                eventType + "_failed",
                analyticsPayload
            );
        }
    });

    const isLoading = subscription.status === "pending";

    const handleSubscribe = useEventCallback(() => {
        // Signed out: ask them to sign in. No request starts, so nothing
        // shows as loading.
        if (!user?.id) {
            //
            toggleAuth();
            return;
        }

        subscription.run();
    }, []);

    const handleOpenSpace = useEventCallback(() => {
        const link = `${nodeEnv.PUBLIC_API}/${
            customLink ? customLink : "spaces/" + exhibitId
        }`;

        window.open(link);

        amplitude_logAnalyticsEvent("click_event_card", analyticsPayload);
    }, []);

    const isSubscribed = Boolean(currentNotificationId);

    const isTooLarge = eventType?.length > 5;

    const formattedStartDate = moment.unix(date);
    const formattedEndDate = moment.unix(endDate);

    let formattedString = `${formattedStartDate.format(
        "D MMM"
    )} - ${formattedStartDate.format("h:mma")}`;

    if (formattedEndDate.isValid()) {
        if (formattedEndDate.date() > formattedStartDate.date()) {
            formattedString = formattedString.concat(
                ` — ${formattedEndDate.format(
                    "D MMM"
                )} - ${formattedEndDate.format("h:mma")}`
            );
        } else {
            formattedString = formattedString.concat(
                ` - ${formattedEndDate.format("h:mma")}`
            );
        }
    }

    const isEventActive = moment().isBetween(
        formattedStartDate,
        formattedEndDate
    );

    return (
        <Container>
            <Label
                style={{
                    width: isTooLarge ? 95 : 60,
                }}
            >
                {eventType || ""}
            </Label>
            <div
                style={{
                    height: 180,
                }}
            >
                <Shape
                    id={id}
                    xlinkHref={thumbnail || "/images/sq_image_placeholder.png"}
                    size={isTooLarge ? "large" : "small"}
                />
            </div>

            {userId.toLowerCase() === user.id.toLowerCase() ? (
                <>
                    <DeleteWrapper
                        onClick={() => {
                            if (!deleteLoading) deletion.run();
                        }}
                    >
                        {deleteLoading ? (
                            <Spinner stroke="#000" width={12} />
                        ) : (
                            <IconImg size={12} name="trash" />
                        )}
                    </DeleteWrapper>
                    {deletion.status === "failed" && (
                        <DeleteFailure>
                            <InlineError
                                surface="light"
                                message="Couldn't delete the event."
                                onRetry={() => deletion.run(true)}
                            />
                        </DeleteFailure>
                    )}
                </>
            ) : null}

            <InfoWrapper>
                <HeaderWrapper>
                    <span className="date scrollbar-hidden">
                        {formattedString}
                    </span>

                    {/* <div className="dot" /> */}
                    <span className="title" onClick={handleOpenSpace}>
                        {eventLocation || ""}
                    </span>
                </HeaderWrapper>

                <h2 className="headline">{title || ""}</h2>

                <FooterWrapper>
                    {subscriberTotal > 0 ? (
                        <SubscribedUsers users={subscribers} count={subscriberTotal} />
                    ) : null}

                    {isEventActive ? (
                        <RoundButton
                            isLight={false}
                            className="visite-event-btn"
                            onClick={handleOpenSpace}
                        >
                            Ongoing
                        </RoundButton>
                    ) : (
                        <>
                            {!user?.id || (!subscribers?.length && !isSubscribed) ? (
                                <RoundButton
                                    isLight={false}
                                    className="subscribe-btn"
                                    onClick={handleSubscribe}
                                >
                                    {isLoading ? "Loading…" : "Subscribe Now"}
                                </RoundButton>
                            ) : isLoading ? (
                                <IconWrapper>
                                    <Spinner width={18} stroke="#5c5c5c" />
                                </IconWrapper>
                            ) : (
                                <IconButton
                                    name={
                                        isSubscribed
                                            ? isBellHover
                                                ? "bell-minus"
                                                : "bell-check"
                                            : "outline-bell"
                                    }
                                    mode="dark"
                                    size="small"
                                    className="bell"
                                    onClick={handleSubscribe}
                                    onMouseEnter={() => setBellHover(true)}
                                    onMouseLeave={() => setBellHover(false)}
                                />
                            )}
                        </>
                    )}
                </FooterWrapper>
            </InfoWrapper>
        </Container>
    );
}

const Container = styled.div`
    width: 305px;
    min-width: 305px;
    border-radius: 6px;
    position: relative;

    .label-container {
        position: absolute;
    }
`;

const Label = styled.div`
    position: absolute;
    top: 3px;
    display: flex;
    align-items: center;
    justify-content: center;

    color: #070707;
    text-align: center;
    font-family: Aeonik;
    font-size: 14px;
    font-style: normal;
    font-weight: 500;
    line-height: 100%;
`;

const InfoWrapper = styled.div`
    width: 100%;
    height: 140px;
    background: #f5f5f5;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;

    & > h2.headline {
        color: #070707;
        font-family: Aeonik;
        font-size: 16px;
        font-style: normal;
        font-weight: 500;
        line-height: 140%;
        margin: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        max-width: calc(100% - 20px);
    }

    & > .top-headline {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;

        & > div {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 6px;

            & > .dot {
                width: 4px;
                height: 4px;
                border-radius: 9999px;
                background: #c2c2c2;
            }
        }

        span {
            font-family: Aeonik;
            font-size: 12px;
            font-style: normal;
            font-weight: 400;
            line-height: normal;
            color: #5c5c5c;
            display: flex;
            align-items: center;
            gap: 8px;

            &.date {
                max-width: 160px;
                white-space: nowrap;
            }

            &.title {
                max-width: 100px;
                overflow: auto;
                white-space: nowrap;
                cursor: pointer;
            }
        }
    }
`;

const FooterWrapper = styled.div`
    display: flex;
    width: 100%;
    gap: 6px;
    margin-top: 0;
    align-items: center;
    justify-content: flex-start;

    & > .subscribe-btn,
    .visite-event-btn {
        height: 40px;
        padding: 12px 16px;
        border-radius: 900px;
        background: transparent;
        border: 1px solid #e0e0e0;

        font-family: Aeonik;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: 24px;
        color: #070707;
    }

    .visite-event-btn {
        &::before {
            content: "";
            background: #00e3bd;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        background: #fff;
        border: 1px solid #00e3bd;
    }

    & > .bell {
        background: transparent;
        border: 1px solid #e0e0e0;

        img {
            opacity: 0.8;

            &:hover {
                opacity: 1;
            }
        }
    }
`;

const IconWrapper = styled.div`
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
    display: flex;
    align-items: center;
    border-radius: 9999px;
    justify-content: center;
    background: transparent;
    border: 1px solid #e0e0e0;
`;

const HeaderWrapper = styled.div`
    // gap: 8px;
    width: 100%;
    // display: flex;
    // align-items: center;
    // justify-content: flex-start;

    & > .date {
        font-family: Aeonik;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: normal;
        color: #5c5c5c;

        // display: flex;
        // align-items: center;
        // gap: 8px;
        // max-width: 160px;
        white-space: nowrap;
        overflow: hidden;
        width: 100%;
        display: inline-block;
        text-overflow: ellipsis;
    }

    & > .location-wrapper {
        // gap: 6px;
        width: 100%;
        // display: flex;
        // align-items: center;
        // justify-content: flex-start;
        // margin-top: 6px;

        & > .dot {
            width: 4px;
            height: 4px;
            border-radius: 9999px;
            background: #c2c2c2;
        }
    }

    .title {
        font-family: Aeonik;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: normal;
        color: #5c5c5c;
        width: 100%;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: inline-block;
    }
`;

const DeleteWrapper = styled.div`
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    cursor: pointer;
    z-index: 100;
    background: #fff;
    border-radius: 50%;
    top: 10px;
    right: 6px;
    box-shadow: 0 0px 5px rgb(0 0 0 / 21%);
`;

// Lies over the picture, under the delete button it belongs to, so a failed
// delete does not move the card's contents.
const DeleteFailure = styled.div`
    position: absolute;
    z-index: 100;
    top: 48px;
    left: 6px;
    right: 6px;
    background: ${base.color.white};
    border-radius: ${base.radius.control}px;
    box-shadow: 0 0px 5px rgb(0 0 0 / 21%);
`;
