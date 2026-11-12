import { useCyberTranslation } from "@components/context/I18nContext";
import { UserContext } from "@components/context/UserContext";

import { useOnClickOutside } from "@components/hooks/useClickOutside";

import { CHAT_TYPES } from "@components/_3DExhibit-v2/context/hooks/useChat";
import {
    SUMMON_COMMAND,
    useMultiplayer,
} from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { DEFAULT_SUMMON_RADIUS } from "@components/_3DExhibit-v2/three/factory/multiplayer/constants";

import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";

import Avatar from "@ui/components/Avatar";

import { IconButton } from "@ui/components/IconButton";

import { useContext, useState } from "react";

import styled from "styled-components";

import { DropdownItem, DropdownWrapper } from "./UserDropdown";

export default function SpaceControl({ setCurrentTab }) {
    //
    const [isDropdownShowing, setDropdownShowing] = useState(false);

    const { t } = useCyberTranslation();

    const { room, chat, MultiplayerService } = useMultiplayer();

    const { user, userData } = useContext(UserContext);

    const { clickRef, addTogglerRef } = useOnClickOutside({
        handler: () => {
            setDropdownShowing(false);
        },
    });

    function handleSummonAllToMe() {
        if (!room.isMod) return;

        MultiplayerService.current.sendCommand(SUMMON_COMMAND, {
            sessionId: room.sessionId,
            username: userData?.username,
            radius: DEFAULT_SUMMON_RADIUS,
        });

        chat.pushMessage(t`TELEPORT_ALL_SENT`, CHAT_TYPES.INFO.label);

        setDropdownShowing(false);
    }

    return (
        <Container style={{ marginTop: 16, marginBottom: 12 }}>
            <LeftSection>
                <Avatar
                    size="small"
                    style={{ border: "none" }}
                    src={
                        room.currentExhibit?.info?.cHeroImg ||
                        room.currentExhibit?.info?.heroImg
                    }
                />

                <TitleWrapper>
                    <p className="title">
                        {room.currentExhibit?.info?.headline ||
                            room.currentExhibit?.id}
                    </p>
                    <p className="title-label">{t`SPACE_GLOBAL`}</p>
                </TitleWrapper>
            </LeftSection>

            <RightSection style={{ position: "relative" }}>
                {/* <div style={{ width: 90, marginRight: 16 }}>
                    <Slider
                        size="small"
                        onChange={() => {}}
                        min={0}
                        max={100}
                        hideInput
                        mode="dark"
                    />
                </div> */}

                <div
                    onClick={() => setDropdownShowing((state) => !state)}
                    ref={(el) => addTogglerRef("parent", el)}
                >
                    <IconButton
                        size="xsmall"
                        style={{ border: "1px solid #f5f5f54d" }}
                        mode="light"
                        outline
                        name="more-horizontal"
                    />
                </div>

                {isDropdownShowing ? (
                    <DropdownWrapper
                        ref={(el) => {
                            clickRef.current = el;
                        }}
                    >
                        {room.isMod ? (
                            <DropdownItem
                                icon="users"
                                label={t`TELEPORT_ALL_TO_ME`}
                                onClick={handleSummonAllToMe}
                            />
                        ) : null}
                        <DropdownItem
                            icon="message-square"
                            label={t`GIVE_US_FEEDBACK`}
                            onClick={() => setCurrentTab("feedback")}
                        />
                    </DropdownWrapper>
                ) : null}
            </RightSection>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const TitleWrapper = styled.div`
    margin-left: 8px;

    .title {
        font-weight: 500;
        font-size: 14px;
        letter-spacing: -0.01em;
        color: #ffffff;
        margin: 0;
        white-space: nowrap;
        margin-bottom: 4px;
        max-width: 12em;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .title-label {
        font-weight: 500;
        font-size: 12px;
        line-height: 100%;

        color: #ffffff;
        margin: 0;

        opacity: 0.5;
    }
`;

const LeftSection = styled.div`
    display: flex;
    align-items: center;
`;

const RightSection = styled.div`
    display: flex;
    align-items: center;
`;
