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

import { useContext, useEffect, useRef, useState } from "react";

import styled from "styled-components";

import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";

import { personMore } from "./User";
import {
    DropdownItem,
    DropdownWrapper,
    focusFirstMenuItem,
    menuKeyDown,
} from "./UserDropdown";

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

    const trigger = useRef<HTMLButtonElement>(null);
    // Once open, the menu takes the keyboard.
    useEffect(() => {
        if (isDropdownShowing) focusFirstMenuItem(clickRef.current);
    }, [isDropdownShowing]);

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
        <Container>
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

                <button
                    type="button"
                    className="person-more"
                    aria-label={t`SPACE_GLOBAL`}
                    aria-expanded={isDropdownShowing}
                    onClick={() => setDropdownShowing((state) => !state)}
                    ref={(el) => {
                        trigger.current = el;
                        addTogglerRef("parent", el);
                    }}
                >
                    •••
                </button>

                {isDropdownShowing ? (
                    <DropdownWrapper
                        ref={(el) => {
                            clickRef.current = el;
                        }}
                        role="menu"
                        onKeyDown={menuKeyDown(() => {
                            setDropdownShowing(false);
                            trigger.current?.focus();
                        })}
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

/* The space's own row, in the same measure as the people below it. */
const Container = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    margin-top: 8px;
    padding: 4px 2px;
    box-sizing: border-box;

    .ds-avatar {
        width: 26px !important;
        height: 26px !important;
        min-width: 26px !important;
        min-height: 26px !important;
        background: ${base.color.line.faint};
    }

    .person-more {
        ${personMore}
    }
`;

const TitleWrapper = styled.div`
    min-width: 0;

    .title {
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: ${lobby.color.ink};
        font-size: 13px;
        font-weight: 500;
        line-height: 18px;
    }

    .title-label {
        margin: 0;
        color: ${lobby.color.secondary};
        font-size: 11px;
        line-height: 16px;
    }
`;

const LeftSection = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
`;

const RightSection = styled.div`
    display: flex;
    align-items: center;
`;
