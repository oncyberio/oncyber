import React, { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Header } from "../shared/styles";
import { usePanel } from "../context/PanelProvider";
import IconImg from "@ui/components/IconImg";
import styled, { css } from "styled-components";

import { motion, AnimatePresence } from "framer-motion";

import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { useCyberTranslation } from "@components/context/I18nContext";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import useFeed from "@components/hooks/useFeed";

const Settings = dynamic(() => import("../Settings"));

const Explore = dynamic(() => import("../Modals/Explore"));

const Report = dynamic(() => import("../Modals/Report"));

const UsersList = dynamic(() => import("../Modals/Users"));

const Feedback = dynamic(() => import("../Modals/Feedback"));

const Extra = dynamic(() => import("../Modals/Extra"));

const ProfileExplore = dynamic(() => import("../Profile/Explore"));

const AudioSharing = dynamic(() => import("../Modals/AudioSharing"));

const SelectMediaPlaceholder = dynamic(
    () => import("../Modals/SelectMediaPlaceholder")
);

const VoiceRequests = dynamic(() => import("../Modals/VoiceRequests"));

export default function Toolbar({
    sceneContainer,
    onFlyMode,
    worldMode,
    switchMode,
    embedded = false,
}) {
    let { currentTab, setCurrentTab, addTogglerRef } = usePanel();

    // currentTab = "select-media-placeholder";

    const feed = useFeed({
        initialize: false,
    });

    const { chat } = useMultiplayer();

    const { t } = useCyberTranslation();

    const { isChatDisplayed } = chat;

    let content = null;

    const tabs = useMemo(() => {
        return {
            users: {
                title: "USERS_LIST",
            },
            camera: {
                title: "PHOTO_MODE",
            },

            profile: {
                title: "USER_PROFILE",
            },

            feedback: {
                title: "FEEDBACK",
            },

            report: {
                title: "REPORT_USER",
            },

            requests: {
                title: "REQUESTS",
            },

            settings: {
                title: "YOUR_SETTINGS",
            },

            audioSharing: {
                title: "SCREEN_AUDIO_SHARING",
            },

            "select-media-placeholder": {
                style: {
                    width: 271,
                    // height: 267,
                },
            },

            screenShot: {
                title: "SCREENSHOT",
            },

            voiceRequests: {
                title: "PARTICIPATION_REQUESTS",
            },
        };
    }, []);

    if (
        currentTab !== "screenShot" &&
        currentTab !== "profile-menu" &&
        currentTab !== "dashboard" &&
        currentTab !== "requests" &&
        currentTab !== "settings" &&
        currentTab !== "help" &&
        currentTab !== "explore" &&
        currentTab !== "profile" &&
        currentTab !== "profile-explore" &&
        currentTab !== "select-media-placeholder"
    ) {
        content = <p>{t(tabs[currentTab]?.title)}</p>;
    }

    let style = tabs[currentTab]?.style ?? {};

    const panelContent =
        currentTab === "settings" ? (
            <Settings />
        ) : currentTab === "explore" ? (
            <Explore feed={feed} />
        ) : currentTab === "audioSharing" ? (
            <AudioSharing />
        ) : currentTab === "select-media-placeholder" ? (
            <SelectMediaPlaceholder embedded={embedded} />
        ) : currentTab === "feedback" ? (
            <Feedback />
        ) : currentTab === "report" ? (
            <Report />
        ) : currentTab === "dashboard" ? (
            <Extra
                embedded={embedded}
                onFlyMode={onFlyMode}
                worldMode={worldMode}
                switchMode={switchMode}
            />
        ) : currentTab === "users" ? (
            <UsersList
                sceneContainer={sceneContainer}
                addModalTogglerRef={addTogglerRef}
            />
        ) : currentTab === "voiceRequests" ? (
            <VoiceRequests />
        ) : currentTab === "profile-explore" ? (
            <ProfileExplore />
        ) : null;
    if (embedded) return panelContent;

    return (
        <AnimatePresence>
            {currentTab !== "" && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    style={{ width: "100%" }}
                >
                    <Container
                        isMobile={IS_MOBILE}
                        tab={currentTab}
                        isChatDisplayed={isChatDisplayed}
                        className="scrollbar scrollbar-hidden"
                        style={style}
                    >
                        {content && (
                            <Header tab={currentTab}>
                                {content}
                                <div onClick={() => setCurrentTab("")}>
                                    <IconImg
                                        style={{
                                            cursor: "pointer",
                                        }}
                                        size={16}
                                        mode="light"
                                        name="x"
                                    />
                                </div>
                            </Header>
                        )}

                        {panelContent}
                    </Container>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

const Container = styled.div<{
    isChatDisplayed: boolean;
    tab: string;
    isMobile: boolean;
}>`
    border: none;
    padding: 0px;
    width: 100%;
    overflow: scroll;
    position: relative;
    border-radius: 8px;
    color: #f0f2fd;
    z-index: 100000;
    margin-bottom: 10px;
    // backdrop-filter: blur(20px);
    background: rgba(7, 7, 7, 0.8);
    max-height: calc(var(--100-vh) - 50vh);

    ${(props) =>
        props.tab === "explore" && props.isMobile
            ? css`
                  backdrop-filter: blur(21px);
                  -webkit-backdrop-filter: blur(21px);
                  height: calc(var(--100-vh) - 30vh);
                  max-height: calc(var(--100-vh) - 30vh);
              `
            : css``};

    @media (max-width: 1100px) {
        right: 0;
        transform: none;
        left: auto;

        ${({ isChatDisplayed }) => {
            return (
                !isChatDisplayed &&
                css`
                    transform: translateX(-50%);
                    bottom: calc(100% + 8px);
                    left: 50%;
                `
            );
        }}
    }

    @media (max-width: 760px) {
        transform: translateX(-50%);
        bottom: calc(100% + 8px);
        left: 50%;
    }

    @media (max-width: 550px) {
        width: 100%;
        bottom: 100%;
        border: none;
        max-width: 95%;
        border-radius: 8px;
    }
`;
