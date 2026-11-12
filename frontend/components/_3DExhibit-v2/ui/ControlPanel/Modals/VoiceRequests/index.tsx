import {
    UtilityStack,
    UtilityButton,
} from "@features/content-host/NativeVisitorPanel";
import { UserContext } from "@components/context/UserContext";
import Avatar from "@ui/components/Avatar";
import IconImg from "@ui/components/IconImg";
import { useContext, useEffect } from "react";
import styled from "styled-components";
import { usePanel } from "../../context/PanelProvider";
import Anon from "../Anon";
import Spinner from "@ui/components/Spinner";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { CHAT_TYPES } from "@components/_3DExhibit-v2/context/hooks/useChat";
import NoVoiceRequest from "./NotFound";

export default function Profile() {
    const { user: _user } = useContext(UserContext);

    const { voice, chat } = useMultiplayer();

    const {
        voiceRequests,
        hasNewVoiceRequests,
        markAllVoiceReqsAsRead,
        admin_acceptUserVoicePermissionRequest,
        admin_rejectUserVoicePermissionRequest,
    } = voice;

    const { pushMessage } = chat;

    const { selectedUser, toggleAuth } = usePanel();

    useEffect(() => {
        if (voiceRequests.some((req) => !req.wasRead)) {
            markAllVoiceReqsAsRead();
        }
    }, [voiceRequests]);

    function handleDecline(user) {
        admin_rejectUserVoicePermissionRequest(user.sessionId);
    }

    async function handleAccept(user) {
        const result = await admin_acceptUserVoicePermissionRequest(
            user.sessionId
        );

        if (result.success === false) {
            pushMessage(result.error, CHAT_TYPES.ALERT.label);
        }
    }

    if (
        (!_user.id && !selectedUser.userId) ||
        // anon
        (selectedUser?.userData &&
            selectedUser?.userData?.username ===
                selectedUser?.userData?.walletId)
    )
        return <Anon onConnect={toggleAuth} />;

    if (!voiceRequests?.length) return <NoVoiceRequest />;

    return (
        <Container>
            {/* {hasNewVoiceRequests ? (
                <NotificationRound
                    style={{
                        marginLeft: 8,
                    }}
                />
            ) : null} */}

            {voiceRequests.map((req, index) => {
                const { user, status } = req;

                const { userData } = user;

                const { avatar, username, walletId } = userData;

                const displayWalletId =
                    walletId.slice(0, 4) +
                    "..." +
                    walletId.slice(walletId.length - 4, walletId.length);

                return (
                    <RequestWrapper key={index}>
                        <div>
                            <Avatar
                                size="small"
                                style={{ border: "none" }}
                                src={avatar}
                            />

                            <p
                                style={{
                                    margin: 0,
                                    marginLeft: 8,
                                    maxWidth: "10em",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {username || displayWalletId}
                            </p>
                        </div>

                        {status === "submitting" ? (
                            <Spinner
                                style={{ width: "20px", height: "20px" }}
                            />
                        ) : (
                            <div>
                                <UtilityButton
                                    type="button"
                                    aria-label={`Accept voice request from ${
                                        username || displayWalletId
                                    }`}
                                    onClick={() => handleAccept(user)}
                                >
                                    <IconImg
                                        name="check"
                                        mode="light"
                                        size={20}
                                    />
                                </UtilityButton>
                                <UtilityButton
                                    type="button"
                                    aria-label={`Decline voice request from ${
                                        username || displayWalletId
                                    }`}
                                    onClick={() => handleDecline(user)}
                                >
                                    <IconImg
                                        name="x"
                                        mode="light"
                                        size={20}
                                        style={{ cursor: "pointer" }}
                                    />
                                </UtilityButton>
                            </div>
                        )}
                    </RequestWrapper>
                );
            })}
        </Container>
    );
}

const Container = styled(UtilityStack)`
    padding: 0;

    p {
        margin: 0;
    }

    .auth-toggle {
        font-weight: 500;
        text-decoration: underline;
        cursor: pointer;
    }
`;

const RequestWrapper = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 8px 0;

    &:last-child {
        margin-bottom: 0px;
    }

    & > div {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }
    button {
        flex-shrink: 0;
        padding: 8px;
        min-width: 40px;
    }
`;
