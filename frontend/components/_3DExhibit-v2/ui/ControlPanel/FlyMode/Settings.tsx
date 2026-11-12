import React, { useState } from "react";
import styled from "styled-components";
import Switch from "@ui/components/Switch";
import { Toggle } from "@features/studio/components/Toggle";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import Controls from "./Controls";
import { useCyberTranslation } from "@components/context/I18nContext";
import { usePanel } from "../context/PanelProvider";
import { FLY_SPEED } from "@components/_3DExhibit-v2/three/constants";

export default function FlyModeSettings({
    speed,
    setSpeed,
    clickRef,
    showUsername,
    stabilization,
    setShowUsername,
    setStabilization,
    isFlyModeChatDisplayed,
    setIsFlyModeChatDisplayed,
}) {
    const world = useWorld();

    const { handleSettings } = usePanel();

    const [showControl, toggleControl] = useState(false);

    const { t } = useCyberTranslation();

    const onStabilization = async (opts) => {
        await world.current.setStabilization(opts);

        setStabilization(opts);

        handleSettings("fly_mode_stabilization", opts);
    };

    const onSpeed = async (opts) => {
        const val = FLY_SPEED[opts];

        await world.current.setFlyModeSpeed(val);

        setSpeed(opts);

        handleSettings("fly_mode_speed", opts);
    };

    const onShowUsername = async (opts) => {
        await world.current.setShowUsername(opts);

        setShowUsername(!showUsername);

        handleSettings("fly_mode_show_username", opts);
    };

    const onChatToggle = async () => {
        setIsFlyModeChatDisplayed(!isFlyModeChatDisplayed);

        handleSettings("fly_mode_show_chat", !isFlyModeChatDisplayed);
    };

    return (
        <Container ref={clickRef}>
            <div className="stabilization">
                <span className="label">{t`STABILIZATION`}</span>
                <Switch
                    height="42px"
                    fontSize="12px"
                    borderRadius="900px"
                    innerBorderRadius={"900px"}
                    background="rgba(29,29,29,0.8)"
                    items={[
                        {
                            key: "OFF",
                            title: t`OFF`,
                        },
                        {
                            key: "MEDIUM",
                            title: t`MEDIUM`,
                        },
                        {
                            key: "HIGH",
                            title: t`HIGH`,
                        },
                    ]}
                    defaultSelected={stabilization}
                    onSelect={onStabilization}
                />
            </div>
            <div className="speed">
                <span className="label">{t`SPEED`}</span>
                <Switch
                    height="42px"
                    fontSize="12px"
                    borderRadius="900px"
                    innerBorderRadius={"900px"}
                    background="rgba(29,29,29,0.8)"
                    items={[
                        {
                            key: "SLOWEST",
                            title: t`SLOWEST`,
                        },
                        {
                            key: "SLOW",
                            title: t`SLOW`,
                        },
                        {
                            key: "NORMAL",
                            title: t`NORMAL`,
                        },
                        {
                            key: "FAST",
                            title: t`FAST`,
                        },
                    ]}
                    defaultSelected={speed}
                    onSelect={onSpeed}
                />
            </div>
            <div className="toggled">
                <span className="label">{t`SHOW_CHAT`}</span>
                <Toggle
                    value={isFlyModeChatDisplayed}
                    onChange={onChatToggle}
                />
            </div>

            <div className="toggled">
                <span className="label">{t`SHOW_USERNAMES`}</span>
                <Toggle value={showUsername} onChange={onShowUsername} />
            </div>

            <Controls showControl={showControl} toggleControl={toggleControl} />
        </Container>
    );
}

const Container = styled.div`
    width: 296px;
    position: absolute;
    background: rgba(7, 7, 7, 0.8);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    padding: 10px 17px 10px 24px;
    left: 50%;
    top: 55px;
    transform: translate(-50%, 0);

    & > div.stabilization,
    div.speed {
        display: flex;
        flex-direction: column;
        margin-top: 16px;

        .input {
            border: none !important;
        }

        & > span.label {
            font-weight: 500;
            font-size: 14px;
            line-height: 100%;
            color: #ffffff;
            letter-spacing: 0.4px;
            margin-bottom: 8px;
        }
    }

    & > div.toggled {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 22px;

        & > span.label {
            font-weight: 500;
            font-size: 14px;
            line-height: 100%;
            color: #ffffff;
            letter-spacing: 0.4px;
        }
    }
`;
