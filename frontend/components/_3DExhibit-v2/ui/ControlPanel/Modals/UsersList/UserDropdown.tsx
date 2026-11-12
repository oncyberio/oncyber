import { UserContext } from "@components/context/UserContext";
import { CHAT_TYPES } from "@components/_3DExhibit-v2/context/hooks/useChat";
import {
    KICK_COMMAND,
    SUMMON_COMMAND,
    useMultiplayer,
} from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import {
    DEFAULT_SUMMON_RADIUS,
    TELEPORT_TO_USER,
} from "@components/_3DExhibit-v2/three/factory/multiplayer/constants";
import { useContext, useEffect, useState } from "react";
import styled, { css } from "styled-components";
import { usePanel } from "../../context/PanelProvider";
import ReactDOM from "react-dom";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import { useCyberTranslation } from "@components/context/I18nContext";
import IconImg from "@ui/components/IconImg";

export default function UserDropdown({
    clickRef,
    dropTargetRef = null,
    addModalTogglerRef,
    sceneContainer,
    user,
}) {
    const {
        userId: currentUserId,
        chat,
        voice,
        room,
        MultiplayerService,
    } = useMultiplayer();

    const { token } = useContext(UserContext);

    const { t } = useCyberTranslation();

    const { setCurrentTab, setSelectedUser } = usePanel();

    const world = useWorld();

    const [position, setPosition] = useState([]);

    const { user: _user } = useContext(UserContext);

    const { pushMessage } = chat;

    useEffect(() => {
        if (dropTargetRef?.current) {
            const t = dropTargetRef.current.getBoundingClientRect();

            setPosition([t.x, t.y]);
        } else {
            setPosition([user.offset.x, user.offset.y]);
        }
    }, []);

    const { isMod, currentExhibit, label, id: roomId } = room;

    // Our own row (shown in "active mods"): the only action that makes sense
    // is summoning everyone to us — teleport/kick/report to self are no-ops.
    const isSelf = user.sessionId === room.sessionId;

    const isAnon = user?.userData?.username === user?.userData?.walletId;

    function handleTeleport() {
        const response = world.current.handleCommand({
            type: TELEPORT_TO_USER,
            payload: {
                username: user?.userData?.username,

                sessionId: user.sessionId,
            },
        });

        if (!response.success) {
            pushMessage(response.message, CHAT_TYPES.ALERT.label);
        } else {
            setCurrentTab("");

            if (response.summon) {
                pushMessage(
                    t`SUCCESSFULLY_TELEPORTED_TO_SPACE`,
                    CHAT_TYPES.INFO.label
                );
            } else {
                pushMessage(t`SUCCESSFULLY_TELEPORTED`, CHAT_TYPES.INFO.label);
            }
        }
    }

    function handleSummonAll() {
        if (!isMod) return;

        MultiplayerService.current.sendCommand(SUMMON_COMMAND, {
            sessionId: user.sessionId,
            username: user?.userData?.username,
            radius: DEFAULT_SUMMON_RADIUS,
        });

        pushMessage(t`TELEPORT_ALL_SENT`, CHAT_TYPES.INFO.label);

        setCurrentTab("");
    }

    function handleKick() {
        if (isMod) {
            MultiplayerService.current.sendCommand(KICK_COMMAND, {
                userId: user.userId,
            });
        }
    }
    function handleReport() {
        if (IS_MOBILE) {
            chat.setIsChatDisplayed(false);
        }

        setSelectedUser(user);

        setCurrentTab("report");
    }

    function handleOpenProfile() {
        if (IS_MOBILE) {
            chat.setIsChatDisplayed(false);
        }

        setSelectedUser(user);

        setCurrentTab("profile-explore");
    }

    return (
        typeof window !== "undefined" &&
        ReactDOM.createPortal(
            <DropdownWrapper
                ref={(el) => {
                    clickRef.current = el;
                    addModalTogglerRef("menu-dropdown", el);
                }}
                position={position}
            >
                {isSelf ? (
                    isMod ? (
                        <DropdownItem
                            icon="users"
                            label={t`TELEPORT_ALL_HERE`}
                            onClick={handleSummonAll}
                        />
                    ) : null
                ) : (
                    <>
                        {!isAnon ? (
                            <DropdownItem
                                icon="user"
                                label={t`PROFILE`}
                                onClick={handleOpenProfile}
                            />
                        ) : null}

                        <DropdownItem
                            icon="navigation-2"
                            label={t`TELEPORT`}
                            onClick={handleTeleport}
                        />

                        {isMod ? (
                            <DropdownItem
                                icon="users"
                                label={t`TELEPORT_ALL_HERE`}
                                onClick={handleSummonAll}
                            />
                        ) : null}

                        {isMod ? (
                            <DropdownItem
                                icon="user-x"
                                label={t`KICK`}
                                onClick={handleKick}
                                danger
                            />
                        ) : null}

                        {_user.id ? (
                            <DropdownItem
                                icon="flag"
                                label={t`REPORT`}
                                onClick={handleReport}
                            />
                        ) : null}
                    </>
                )}
            </DropdownWrapper>,
            sceneContainer?.current || document.body
        )
    );
}

export function DropdownItem({
    icon,
    label,
    onClick,
    danger = false,
}: {
    icon?: string;
    label: string;
    onClick: () => void;
    danger?: boolean;
}) {
    return (
        <li className={danger ? "danger" : ""} onClick={onClick}>
            {icon ? (
                <IconImg
                    size={15}
                    name={icon}
                    mode="light"
                    className="item-icon"
                />
            ) : null}
            <span>{label}</span>
        </li>
    );
}

export const DropdownWrapper = styled.ul<{
    position?: Array<number>;
}>`
    position: absolute;
    right: 0;
    top: 12px;
    z-index: 10000000000;

    min-width: 184px;
    margin: 0;
    padding: 6px;
    list-style: none;

    background: rgba(18, 18, 20, 0.82);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.35);
    color: #fff;

    ${(props) => {
        if (props.position) {
            return css`
                top: calc(${props.position[1]}px + 14px);
                left: calc(${props.position[0]}px - 26px);
                right: auto;
            `;
        }
    }}

    & > li {
        display: flex;
        align-items: center;
        gap: 10px;

        padding: 8px 10px;
        border-radius: 8px;

        font-size: 13px;
        font-weight: 500;
        line-height: 1;
        cursor: pointer;
        white-space: nowrap;
        text-transform: capitalize;
        transition: background 0.12s ease;

        & > span {
            flex: 1;
        }

        & .item-icon {
            opacity: 0.7;
            transition: opacity 0.12s ease;
        }

        &:hover {
            background: rgba(255, 255, 255, 0.09);

            & .item-icon {
                opacity: 1;
            }
        }

        &.danger {
            color: #ff6b6b;

            &:hover {
                background: rgba(255, 90, 90, 0.14);
            }
        }
    }
`;
