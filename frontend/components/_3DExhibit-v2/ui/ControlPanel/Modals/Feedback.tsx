import {
    UtilityStack,
    UtilityActions,
    UtilityButton,
    UtilityTextarea,
} from "@features/content-host/NativeVisitorPanel";
import { useCyberTranslation } from "@components/context/I18nContext";
import { CHAT_TYPES } from "@components/_3DExhibit-v2/context/hooks/useChat";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";

import Spinner from "@ui/components/Spinner";

import { useState } from "react";

import styled from "styled-components";
import { usePanel } from "../context/PanelProvider";
import Submitted from "./shared/Submitted";

export default function Feedback({}) {
    const [loading, setLoading] = useState(false);

    const { room, chat, MultiplayerService } = useMultiplayer();

    const { t } = useCyberTranslation();

    const { pushMessage } = chat;

    const [message, setMessage] = useState("");

    const [submitted, setSubmitted] = useState(false);

    const [error, setError] = useState("");

    const { setCurrentTab } = usePanel();

    function handleSendFeedback() {
        if (!message) return setError(t`EMPTY_MESSAGE`);

        setLoading(true);

        setError("");

        let _message = message;

        MultiplayerService.current.roomService
            .storage("feedback", _message, room.label)
            .then(({ success }) => {
                if (success) {
                    pushMessage(t`FEEDBACK_MSG_SENT`, CHAT_TYPES.INFO.label);

                    setMessage("");

                    setSubmitted(true);
                } else {
                    setError(t`FAILED_SEND_FEEDBACK`);

                    pushMessage(
                        t`FAILED_SEND_FEEDBACK`,
                        CHAT_TYPES.ALERT.label
                    );
                }
            })
            .catch((err) => {
                console.log(err);

                setError(t`FAILED_SEND_FEEDBACK`);

                pushMessage(t`FAILED_SEND_FEEDBACK`, CHAT_TYPES.ALERT.label);
            })
            .finally(() => {
                setLoading(false);
            });
    }

    if (submitted) {
        return (
            <Submitted
                title={t`FEEDBACK_SUBMITTED`}
                subtitle={t`WE_WILL_BE_IN_TOUCH_SOON`}
                setCurrentTab={setCurrentTab}
            />
        );
    }

    return (
        <Container>
            <p>{t`FEEDBACK_DESCRIPTION`}</p>

            <TextareaContainer>
                <p>{t`FEEDBACK_TITLE`}</p>

                <div>
                    <UtilityTextarea
                        style={error ? { border: "1px solid #FF292B" } : {}}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={t`WRITE_HERE`}
                        aria-label={t`FEEDBACK_TITLE`}
                        aria-invalid={!!error}
                        disabled={loading}
                    />
                    {error ? (
                        <p
                            role="alert"
                            style={{
                                fontSize: 14,
                                marginTop: 8,
                                color: "#FF292B",
                            }}
                        >
                            {error}
                        </p>
                    ) : null}
                </div>

                <ButtonsWrapper>
                    <UtilityButton onClick={() => setCurrentTab("")}>
                        {t`CANCEL`}
                    </UtilityButton>

                    <UtilityButton
                        $primary
                        disabled={loading}
                        onClick={handleSendFeedback}
                    >
                        {loading ? (
                            <SpinnerWrapper>
                                <Spinner width={22} />
                                <span>{t`SUBMITTING`}…</span>
                            </SpinnerWrapper>
                        ) : (
                            t`SUBMIT_FEEDBACK`
                        )}
                    </UtilityButton>
                </ButtonsWrapper>
            </TextareaContainer>
        </Container>
    );
}

const Container = styled(UtilityStack)`
    padding: 0;
`;

const TextareaContainer = styled.div`
    font-style: normal;
    font-size: 12px;
    color: #ffffff;

    & > p {
        margin-bottom: 8px;
    }
`;

const ButtonsWrapper = styled(UtilityActions)`
    margin-top: 16px;
`;

const SpinnerWrapper = styled.div`
    display: flex;
    align-items: center;
`;
