import React, { useState } from "react";
import { usePanel } from "../../context/PanelProvider";
import { ControlPanelIcon } from "./styles";
import { IconButton } from "@ui/components/IconButton";
import ExperienceControlIcon from "@ui/components/ExperienceControlIcon";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import styled from "styled-components";

export default function ExtraBtn() {
    const { voice } = useMultiplayer();

    const [showTip, setShowTip] = useState(true);

    const { hasNewVoiceRequests } = voice;

    const { currentTab, setCurrentTab, addTogglerRef } = usePanel();

    return (
        <ControlPanelIcon
            isMobile={IS_MOBILE}
            ref={(el) => addTogglerRef("dashboard", el)}
            onClick={() => {
                if (IS_MOBILE) {
                    setCurrentTab((state) =>
                        state === "dashboard" ? "" : "dashboard"
                    );
                }
            }}
            onMouseEnter={() => {
                if (!IS_MOBILE) {
                    setCurrentTab((prevState) => {
                        if (prevState === "report") {
                            return "report";
                        }

                        setShowTip(prevState !== "dashboard");
                        return "dashboard";
                    });
                }
            }}
            className="control-panel_icon"
        >
            <IconButton
                active={currentTab === "dashboard"}
                mode="light"
                aria-label="More"
                aria-expanded={currentTab === "dashboard"}
                style={{
                    color: currentTab === "dashboard" ? "#17191e" : "#e8e9ec",
                }}
                variants="studio"
                size="medium-plus"
                className="icon-btn-panel"
            >
                <ExperienceControlIcon name="more" />
            </IconButton>
            {hasNewVoiceRequests && <NotificationRound />}
        </ControlPanelIcon>
    );
}

const NotificationRound = styled.div`
    width: 7px;
    height: 7px;
    background: #00e3bd;
    border-radius: 50%;
    position: absolute;
    bottom: 9px;
    right: 9px;
`;
