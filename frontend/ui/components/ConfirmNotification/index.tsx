import React, { CSSProperties } from "react";
import { DEFAULT_PLAYER_AVATAR_PICTURE } from "@components/_3DExhibit-v2/three/constants";
import Avatar from "../Avatar";
import IconImg from "../IconImg";
import {
    Action,
    Button,
    Wrapper,
    IconWrapper,
    Description,
    AvatarWrapper,
} from "./styles";

import { AudioType } from "@components/_3DExhibit-v2/context/hooks/useVoice";
import { useCyberTranslation } from "@components/context/I18nContext";

type NotificationPayload = {
    id: string;
    avatar: string;
    username: string;
    sessionId: string;
    type: AudioType;
};

type ConfirmNotificationProps = React.HTMLAttributes<HTMLDivElement> & {
    style?: CSSProperties;
    notifiaction: NotificationPayload;
    handleDecline: (id: string) => void;
    handleApprove: (id: string) => void;
};

export default function ConfirmNotification({
    notifiaction,
    handleDecline,
    handleApprove,
}: ConfirmNotificationProps) {
    const { t } = useCyberTranslation();

    const { avatar, sessionId, type, username } = notifiaction;

    return (
        <Wrapper>
            <Description>
                <IconWrapper>
                    <IconImg
                        size={19}
                        mode={"light"}
                        name={type === "mic" ? "mic-plus" : "broadcasting"}
                    />
                    <AvatarWrapper>
                        <Avatar
                            size={"tiny"}
                            src={avatar || DEFAULT_PLAYER_AVATAR_PICTURE}
                        />
                    </AvatarWrapper>
                </IconWrapper>
                <p>
                    @{username || "anon"}{" "}
                    <b style={{ fontWeight: "500" }}>
                        {type === "mic"
                            ? t`REQUESTED_VOICE_ACCESS`
                            : t`REQUESTED_SCREEN_SHARING`}
                    </b>
                    .
                </p>
            </Description>
            <Action>
                <Button onClick={() => handleApprove(sessionId)}>
                    {t`APPROVE`}
                </Button>
                <Button
                    onClick={() => handleDecline(sessionId)}
                >{t`DENY`}</Button>
            </Action>
        </Wrapper>
    );
}
