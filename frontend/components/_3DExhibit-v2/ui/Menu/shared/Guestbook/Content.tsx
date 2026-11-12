import Textarea from "@ui/components/Textarea";
import { addComment, removeComment } from "@utils/saveToDb";
import { useContext, useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import Avatar from "@ui/components/Avatar";
import { UserContext } from "@components/context/UserContext";
import useSWR from "swr";
import IconImg from "@ui/components/IconImg";
import { NButton } from "@ui/components/NButton";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { useCyberTranslation } from "@components/context/I18nContext";
import { fetcher } from "@utils/fetcher";
import InlineError from "@ui/components/InlineError";

// For a locale that does not carry FAILED_TO_REMOVE_MESSAGE yet.
const FAILED_TO_REMOVE_MESSAGE = "Couldn't remove the message.";

export default function GuestBookContent({
    isShowing,
    toggle,
    exhibit,
    owner,
    isMobile,
}) {
    const [message, setMessage] = useState("");

    const { t, i18n } = useCyberTranslation();

    const [loadingRemoveComment, setLoadingRemoveComment] = useState(false);

    const {
        data,
        error: reqError,
        mutate,
    } = useSWR(
        `/api/guestbook?${
            exhibit.id
                ? `id=${exhibit.id}`
                : `destinationId=${exhibit.info.room}`
        }`,
        fetcher
    );

    // What failed, above the message field, with Retry when sending or
    // removing again can help (docs/feedback.md).
    const [error, setError] = useState<{
        message: string;
        retry?: () => void;
    }>(null);

    const messagesRef = useRef(null);

    const [loading, setLoading] = useState(false);

    const { user } = useContext(UserContext);

    const hasOpened = useRef(null);

    function scrolldown() {
        if (isShowing) {
            if (messagesRef.current) {
                messagesRef.current.scrollTop =
                    messagesRef.current.scrollHeight -
                    messagesRef.current.clientHeight;
            }
        }
    }

    useEffect(() => {
        if (!hasOpened.current && isShowing) {
            hasOpened.current = true;
            amplitude_logAnalyticsEvent("open_guestbook", {
                exhibitId: exhibit?.id,
                user_id: user?.id,
                ownerId: exhibit?.owner,
                exhibitName: exhibit?.info?.headline,
                number_of_artworks: Object.keys(exhibit?.artworks || {}).length,
                destination: exhibit?.info?.room,
                totalComments: data?.messages?.length || 0,
            });
        }
    }, [isShowing]);

    useEffect(() => {
        scrolldown();
    }, [messagesRef.current, isShowing]);

    function handleAddComment() {
        setError(null);
        setLoading(false);

        if (!message) {
            return setError({ message: t`MESSAGE_CANT_BE_EMPTY` });
        }

        setLoading(true);

        addComment(
            { id: exhibit.id, destinationId: exhibit.info.room },
            {
                message,
            }
        )
            .then(async ({ success, message, error }) => {
                if (success) {
                    setMessage("");

                    await mutate();

                    scrolldown();

                    amplitude_logAnalyticsEvent("comment_on_guestbook", {
                        exhibitId: exhibit?.id,
                        user_id: user?.id,
                        ownerId: exhibit?.owner,
                        exhibitName: exhibit?.info?.headline,
                        number_of_artworks: Object.keys(exhibit?.artworks || {})
                            .length,
                        destination: exhibit?.info?.room,
                        totalComments: data?.messages?.length || 0,
                    });

                    return;
                }

                setError({
                    message: error || t`FAILED_TO_ADD_MESSAGE`,
                    retry: handleAddComment,
                });
            })
            .catch((err) => {
                console.log("error", err);
                setError({
                    message: t`FAILED_TO_ADD_MESSAGE`,
                    retry: handleAddComment,
                });
            })
            .finally(() => {
                setLoading(false);
            });
    }

    function handleRemoveComment(commentId) {
        setError(null);
        setLoadingRemoveComment(true);
        const retry = () => handleRemoveComment(commentId);
        removeComment(
            { id: exhibit.id, destinationId: exhibit.info.room },
            commentId
        )
            .then(async ({ success, message, error }) => {
                if (success) {
                    setMessage("");

                    await mutate();

                    scrolldown();

                    return;
                }

                setError({
                    message:
                        error ||
                        t`FAILED_TO_REMOVE_MESSAGE` ||
                        FAILED_TO_REMOVE_MESSAGE,
                    retry,
                });
            })
            .catch((err) => {
                console.log("error", err);
                setError({
                    message:
                        t`FAILED_TO_REMOVE_MESSAGE` || FAILED_TO_REMOVE_MESSAGE,
                    retry,
                });
            })
            .finally(() => {
                setLoadingRemoveComment(false);
            });
    }

    const _owner =
        owner?.user?.username || owner?.username || t`THE_SPACE_CREATOR`;

    return (
        <>
            <Body
                isMobile={isMobile}
                ref={messagesRef}
                className="scrollbar-hidden"
            >
                {!reqError && data?.success ? (
                    data.messages?.length ? (
                        data.messages
                            .sort((a, b) => {
                                return (
                                    new Date(a.date).getTime() -
                                    new Date(b.date).getTime()
                                );
                            })
                            .map(
                                (
                                    {
                                        avatar,
                                        username,
                                        walletId,
                                        message,
                                        date,
                                        hidden,
                                        id,
                                    },
                                    index
                                ) => {
                                    const text = "";

                                    if (hidden) return;

                                    return (
                                        <MessageWrapper key={index}>
                                            <div style={{ height: "100%" }}>
                                                <Avatar
                                                    src={
                                                        avatar ||
                                                        "/images/avatar.png"
                                                    }
                                                />
                                            </div>
                                            <Message isMobile={isMobile}>
                                                <div className="username">
                                                    <span className="username_text">
                                                        {username || walletId}
                                                    </span>
                                                    {/* <span className="username_date">
                                                        {text}
                                                    </span> */}
                                                </div>

                                                <span className="message scrollbar-hidden">
                                                    {message}
                                                </span>
                                            </Message>
                                            {(exhibit.owner == user?.id ||
                                                walletId == user?.id) && (
                                                <div
                                                    onClick={() =>
                                                        handleRemoveComment(id)
                                                    }
                                                    style={{
                                                        cursor: "pointer",
                                                        transform: "scale(0.8)",
                                                        margin: "auto 0",
                                                    }}
                                                >
                                                    <IconImg
                                                        size={18}
                                                        name="trash-2"
                                                        mode={
                                                            isMobile
                                                                ? "dark"
                                                                : "light"
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </MessageWrapper>
                                    );
                                }
                            )
                    ) : (
                        <EmptyBodyWrapper isMobile={isMobile}>
                            <h3>{t`NO_COMMENT_YET`}...</h3>
                            <p>{t`BE_THE_FIRST_ONE_TO_WRITE_SOMETHING`}</p>
                        </EmptyBodyWrapper>
                    )
                ) : (
                    <EmptyBodyWrapper isMobile={isMobile}>
                        <h3>{t`FAILED_TO_FETCH_COMMENTS`}</h3>
                        <p>{t`PLEASE_REFRESH_THE_PAGE`}</p>
                    </EmptyBodyWrapper>
                )}
            </Body>

            <Footer isMobile={isMobile}>
                <InlineError
                    message={!loading && error?.message}
                    onRetry={error?.retry}
                    surface={isMobile ? "light" : "dark"}
                    style={{ marginBottom: 8, fontSize: 13 }}
                />

                <span className="label">
                    {i18n != "ja"
                        ? t`LEAVE_A_WORD_FOR` + " " + _owner
                        : _owner + " " + t`LEAVE_A_WORD_FOR`}
                </span>

                <Textarea
                    className="textarea"
                    value={message}
                    overrideTheme={"light"}
                    onChange={(e) => {
                        setMessage(e.target.value);
                    }}
                    placeholder={
                        isMobile
                            ? i18n != "ja"
                                ? t`LEAVE_A_WORD_FOR` + " " + _owner
                                : _owner + " " + t`LEAVE_A_WORD_FOR`
                            : ""
                    }
                    style={{ color: isMobile ? "#000" : "#fff" }}
                />

                <FooterButtons isMobile={isMobile}>
                    <NButton
                        onClick={toggle}
                        size="small"
                        outline
                        className="cancel"
                        overrideTheme={"light"}
                    >
                        {isMobile ? t`CLOSE_GUESTBOOK` : t`CANCEL`}
                    </NButton>
                    <NButton
                        disabled={loading}
                        onClick={handleAddComment}
                        size="small"
                        className="submit"
                        overrideTheme={"light"}
                    >
                        {loading ? `${t`SAVING`}…` : t`COMMENT`}
                    </NButton>
                </FooterButtons>
            </Footer>
        </>
    );
}

const Body = styled.div<{ isMobile: boolean }>`
    display: flex;
    overflow: auto;

    ${(props) =>
        props.isMobile
            ? css`
                  padding: 24px;
                  width: 100%;
                  bottom: 0;
                  flex-direction: column;
                  height: 100%;

                  @media (orientation: landscape) {
                      height: 100%;
                  }
              `
            : css`
                  height: 100%;
                  max-height: 100%;
                  flex-direction: column-reverse;
              `}
`;

const EmptyBodyWrapper = styled.div<{ isMobile: boolean }>`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    & > h3 {
        margin: 0;
        font-weight: 500;
        line-height: 120%;
        color: ${(props) => (props.isMobile ? "#000" : "#fff")};
    }

    & > p {
        color: #99999f;
    }
`;

const MessageWrapper = styled.div`
    display: flex;
    gap: 12px;
    align-items: center;

    margin-bottom: 20px;

    .ds-avatar {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        min-height: 32px !important;
    }
`;

const Message = styled.div<{ isMobile: boolean }>`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .message {
        max-width: 95%;
        word-wrap: break-word;
        color: ${(props) => (props.isMobile ? "#000" : "#fff")};
        font-size: 14px;
        font-style: normal;
        font-weight: 400;
        line-height: 120%;
        max-height: 60px;
        overflow: auto;
    }

    .username {
        display: flex;
        align-items: flex-end;
        color: #fff;

        .username_text {
            display: inline-block;
            max-width: 12em;
            text-overflow: ellipsis;
            overflow: hidden;
            color: ${(props) => (props.isMobile ? "#000" : "#fff")};
            font-size: 12px;
            font-style: normal;
            font-weight: 700;
            line-height: 140% !important;
            height: 16px;
        }

        .username_date {
            font-weight: 400;
            display: inline-block;
            color: #999999;
            font-weight: 400;
            font-size: 10px;
            margin-left: 6px;
        }
    }
`;

const Footer = styled.div<{ isMobile: boolean }>`
    ${(props) =>
        props.isMobile
            ? css`
                  padding: 24px;
                  border-top: 1px solid #dfdfe4;
                  padding-top: 12px;

                  & > .label {
                      display: none;
                  }
              `
            : css`
                  display: flex;
                  flex-direction: column;

                  & > span.label {
                      font-size: 14px;
                      font-weight: 400;
                      line-height: 33px;
                      color: rgba(255, 255, 255, 0.5);
                  }

                  .textarea {
                      padding: 7px 12px;
                      border-radius: 10px;
                      background: rgba(0, 0, 0, 0.15);
                      box-shadow: 0px 8px 60px 0px rgba(0, 0, 0, 0.3) inset;
                      border: none;
                  }
              `}
`;

const FooterButtons = styled.div<{ isMobile: boolean }>`
    display: flex;
    gap: 12px;
    margin-top: 16px;
    justify-content: space-between;
    width: 100%;

    button {
        text-transform: uppercase;
    }

    ${(props) =>
        props.isMobile
            ? css``
            : css`
                  button {
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      border-radius: 900px;
                      text-align: center;
                      font-size: 14px;
                      font-weight: 500;
                      border: none;
                      height: 43px;

                      &.cancel {
                          background: rgba(255, 255, 255, 0.15);
                          color: #fff;
                      }

                      &.submit {
                          color: #070707;
                          background: #fff;
                      }
                  }
              `}
`;
