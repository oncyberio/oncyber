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

export default function Report() {
    const [loading, setLoading] = useState(false);

    const { room, chat, MultiplayerService } = useMultiplayer();

    const [submitted, setSubmitted] = useState(false);

    const [error, setError] = useState("");

    const { pushMessage } = chat;

    const [message, setMessage] = useState("");

    const { setCurrentTab, selectedUser } = usePanel();

    const { t } = useCyberTranslation();

    function handleSendReport() {
        if (!message) return setError(t`EMPTY_MESSAGE`);

        setLoading(true);

        setError("");

        const _userId =
            selectedUser?.userData?.walletId || selectedUser?.userId;

        MultiplayerService.current.roomService
            .storage(
                "report",
                {
                    reason: message,
                    user: _userId,
                },
                room.label
            )
            .then(({ success }) => {
                if (success) {
                    pushMessage(
                        t`USER_SUCCESSFULLY_REPORTED`,
                        CHAT_TYPES.INFO.label
                    );

                    setMessage("");

                    setSubmitted(true);
                } else {
                    setError(t`FAILED_SEND_FEEDBACK`);

                    pushMessage(
                        t`FAILED_TO_REPORT_USER`,
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
            <p>
                {t`HELP_US_UNDERSTAND_THE_PROBLEM`}{" "}
                <strong>
                    {selectedUser?.userData?.username || selectedUser?.userId}
                </strong>{" "}
                {t`ARE_YOU_REPORTING`}
            </p>

            <TextareaWrapper>
                {/* <p>Additional Resons/Comments</p> */}

                <div>
                    <UtilityTextarea
                        style={error ? { border: "1px solid #FF292B" } : {}}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={t`WRITE_HERE`}
                        aria-label={t`SUBMIT_REPORT`}
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
                        onClick={handleSendReport}
                    >
                        {loading ? (
                            <SpinnerWrapper>
                                <Spinner width={22} />
                                <span>{t`SUBMITTING`}…</span>
                            </SpinnerWrapper>
                        ) : (
                            t`SUBMIT_REPORT`
                        )}
                    </UtilityButton>
                </ButtonsWrapper>
            </TextareaWrapper>
        </Container>
    );
}

const Container = styled(UtilityStack)`
    padding: 0;
`;

const TextareaWrapper = styled.div`
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
