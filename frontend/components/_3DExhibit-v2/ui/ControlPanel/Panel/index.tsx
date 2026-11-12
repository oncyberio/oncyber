import NativeExperienceChrome from "@features/content-host/NativeExperienceChrome";
import { UserContext } from "@components/context/UserContext";
import {
    CANVAS,
    FLY_SPEED,
    IS_MOBILE,
} from "@components/_3DExhibit-v2/three/constants";

import { useContext, useEffect, useRef } from "react";

const Chat = dynamic(() => import("../../Chat"));

import ConnectWallet from "@ui/components/ConnectWallet";

import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";

const HelpModal = dynamic(() => import("@components/_3DExhibit-v2/ui/Help"));

import { Mode, usePanel } from "./../context/PanelProvider";

import dynamic from "next/dynamic";

import ModeMenu from "../../ModeMenu";

import Interactive from "./../Intractive";

import ArtworkInfoBulle from "./../ArtworkInfoBulle";

import {
    FUD_SPACE_SLUG,
    MINT_SPACE_SLUG,
} from "./../Raffle/raffles/rtfktRaffleConstants";

import Notification_Stack_3D from "./../Notification";
import SummonNotification from "./../Notification/SummonNotification";
import Toolbar from "./../Toolbar";
import { useEventCallback } from "@components/hooks/useEventCallback";
import styled, { css } from "styled-components";
import FlyMode from "./../FlyMode";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { useHotkey } from "@components/hooks/useHotkey";
import { EMOTES } from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/constants";
import AlgoliaProvider from "@utils/algolia/AlgoliaProvider";

const Profile = dynamic(() => import("./../Profile"));

const MultiPanel = dynamic(() => import("./../Modes/Multi"));

const SoloPanel = dynamic(() => import("./../Modes/Solo"));

const TourPanel = dynamic(() => import("./../Modes/Tour"));

export default function DesktopControlPanel({
    isChatActive,
    mobileViewState,
    exhibit,
    isPlaying,
    showArtworkInfo,
    isArtInfoTransition,
    toggleArtworkInfo,
    artwork,
    isInteractive,
    sceneContainer,
    pause,
    isFlyMode,
    worldMode,
    switchMode,
    onFlyMode,
    isFlyModeChatDisplayed,
    setIsFlyModeChatDisplayed,
}) {
    const { chat, onConnect, mode, changeMode, room, refreshVoiceRights } =
        useMultiplayer();

    const world = useWorld();

    const { isChatDisplayed, setIsChatDisplayed, isTyping, setIsTyping } = chat;

    const { dispatch, userData, user } = useContext(UserContext);

    const emoteCounterRef = useRef(0);

    const { toggleTip, isMobileArtworkInfoOpened, setMobileViewState } =
        usePanel();

    const enteredFirstTime = useRef(false);

    const {
        toggleAuth,
        isAuthShowing,
        currentTab,
        isModeMenuOpen,
        selectedMode,
        isPanelHidden,
        toggleModeMenu,
        setCurrentTab,
        setIsFirstTimeOpenModeMenu,
        isFirstTimeOpenModeMenu,
    } = usePanel();

    useEffect(() => {
        if (isPlaying && !enteredFirstTime.current) {
            toggleTip({
                type: "mode",
                timeout: 4000,
                opts: {
                    mode: selectedMode,
                },
            });

            if (
                IS_MOBILE &&
                exhibit?.info?.room !== MINT_SPACE_SLUG &&
                exhibit?.info?.room !== FUD_SPACE_SLUG &&
                Object.keys(exhibit.artworks || {}).length
            ) {
                setMobileViewState({
                    type: "TUTORIAL_1",
                });
            }

            enteredFirstTime.current = true;
        }
    }, [isPlaying]);

    useHotkey(async (e) => {
        //
        if (!isPlaying) return;

        if (e?.code?.includes("Digit")) {
            const code = parseInt(e.code.replace("Digit", ""));
            const emote = EMOTES[code - 1];

            if (!emote) return;

            emoteCounterRef.current += 1;

            const amplitudePayload = {
                exhibitId: exhibit?.id,
                user_id: user?.id,
                ownerId: exhibit?.owner,
                exhibitName: exhibit?.info?.headline,
                collab: exhibit?.editors?.length > 1,
                number_of_artworks: Object.keys(exhibit?.artworks || {}).length,
                destination: exhibit?.info?.room,
                serverName: room.id,
                ...world.current.getPlayerData({
                    isFirstPerson: true,
                }),
                animation: emote?.name,
            };

            if (emoteCounterRef.current === 1) {
                console.log("CALLED sent_first_emote");
                amplitude_logAnalyticsEvent(
                    "sent_first_emote",
                    amplitudePayload
                );
            }

            // Log this event every ten messages
            if (
                emoteCounterRef.current > 0 &&
                emoteCounterRef.current % 10 === 0
            ) {
                console.log("CALLED sent_10_emote");

                amplitude_logAnalyticsEvent("sent_10_emote", amplitudePayload);
            }
        }
    });

    useEffect(() => {
        refreshVoiceRights(exhibit);
    }, [exhibit.params?.voiceAllowed]);

    const fireFlyModeAmplEvent = (event) => {
        amplitude_logAnalyticsEvent(event, {
            exhibitId: exhibit.id,
            ownerId: user.id,
            destination: exhibit?.info?.room,
        });
    };

    const handleToggleFlyMode = async () => {
        await onFlyMode();

        if (currentTab !== "") {
            setCurrentTab("");
        }
    };

    const onMouseLeave = useEventCallback(() => {
        if (currentTab === "profile-menu" || currentTab === "dashboard") {
            setCurrentTab("");
        }
    }, []);

    const handleChatClose = () => {
        chat.setIsChatDisplayed(false);
        setIsTyping(false);
    };

    if (mobileViewState.type !== "NO_TUTORIAL") return null;

    return (
        <Container
            isArtworkInfoShowing={!!artwork}
            isTyping={isTyping}
            isOpened={isMobileArtworkInfoOpened}
            isMobile={IS_MOBILE}
            isChatDisplayed={isChatDisplayed}
            isSoloMode={selectedMode !== Mode.MULTIPLAYER}
            isModeMenuOpen={isModeMenuOpen}
            currentTab={currentTab}
            className="panel"
            selectedMode={selectedMode}
            isFirstTimeOpenModeMenu={isFirstTimeOpenModeMenu}
        >
            {isPlaying && isModeMenuOpen ? (
                <ModeMenu exhibit={exhibit} />
            ) : null}

            {isInteractive && !isModeMenuOpen ? (
                <Interactive
                    sharedChrome={worldMode !== "edit" && selectedMode !== Mode.VIRTUAL_TOUR && !isFlyMode.current}
                    pause={pause}
                    close={handleChatClose}
                    isChatActive={isChatActive}
                    isChatDisplayed={isChatDisplayed}
                />
            ) : null}

            {isAuthShowing ? (
                <ConnectWallet
                    toggle={toggleAuth}
                    onlyEthereum={false}
                    open={isAuthShowing}
                    style={{ zIndex: 10000000 }}
                    callbackAfterAuth={async (
                        token,
                        account,
                        connection,
                        { userData }
                    ) => {
                        onConnect(userData, account, token);
                    }}
                    skipRedirectToAccount={false}
                />
            ) : null}

            {isPlaying && isFlyMode?.current && (
                <FlyMode
                    isFlyModeRef={isFlyMode}
                    fireFlyModeAmplEvent={fireFlyModeAmplEvent}
                    isArtworkShowing={artwork && showArtworkInfo}
                    isFlyModeChatDisplayed={isFlyModeChatDisplayed}
                    setIsFlyModeChatDisplayed={setIsFlyModeChatDisplayed}
                />
            )}

            {!showArtworkInfo &&
            isChatActive &&
            isChatDisplayed &&
            isPlaying &&
            !isModeMenuOpen &&
            chat.active ? (
                <Chat
                    exhibit={exhibit}
                    isFlyMode={isFlyMode}
                    isFlyModeChatDisplayed={isFlyModeChatDisplayed}
                />
            ) : null}

            {artwork && currentTab === "" && !isModeMenuOpen && (
                <ArtworkInfoBulle
                    artwork={artwork}
                    exhibit={exhibit}
                    isPlaying={isPlaying}
                    showArtworkInfo={showArtworkInfo}
                    isArtInfoTransition={isArtInfoTransition}
                    toggleArtworkInfo={toggleArtworkInfo}
                    selectedMode={selectedMode}
                />
            )}

            {isPlaying && <Profile isShowing={currentTab === "profile"} />}

            <HelpModal
                isShowing={currentTab === "help" && isPlaying && !isPanelHidden}
                toggle={() => setCurrentTab("")}
            />

            {isPlaying && selectedMode === Mode.MULTIPLAYER && (
                <>
                    <Notification_Stack_3D />
                    <SummonNotification />
                </>
            )}

            {!showArtworkInfo &&
                isPlaying &&
                !isPanelHidden &&
                !isFlyMode.current && (
                    worldMode !== "edit" && selectedMode !== Mode.VIRTUAL_TOUR ? (
                        <NativeExperienceChrome exhibit={exhibit}>
                            <Toolbar
                                embedded
                                worldMode={worldMode}
                                switchMode={switchMode}
                                sceneContainer={sceneContainer}
                                onFlyMode={handleToggleFlyMode}
                            />
                        </NativeExperienceChrome>
                    ) : <div
                        className="panel-container"
                        onMouseLeave={onMouseLeave}
                    >
                        <Toolbar
                            worldMode={worldMode}
                            switchMode={switchMode}
                            sceneContainer={sceneContainer}
                            onFlyMode={handleToggleFlyMode}
                        />
                        {selectedMode === Mode.MULTIPLAYER ? (
                            <MultiPanel />
                        ) : selectedMode === Mode.SOLO ? (
                            <SoloPanel />
                        ) : selectedMode === Mode.VIRTUAL_TOUR ? (
                            <TourPanel />
                        ) : null}
                    </div>
                )}
        </Container>
    );
}

const Container = styled.div<{
    isArtworkInfoShowing?: boolean;
    isTyping?: boolean;
    isOpened?: boolean;
    isMobile?: boolean;
    isChatDisplayed?: boolean;
    isSoloMode?: boolean;
    isModeMenuOpen?: boolean;
    currentTab?: string;
    isFirstTimeOpenModeMenu?: boolean;
    selectedMode: Mode;
}>`
    .panel-container {
        left: 50%;
        bottom: 8px;
        width: 390px;
        display: flex;
        z-index: 10000;
        position: fixed;
        align-items: center;
        flex-direction: column;
        justify-content: center;
        transform: translateX(-50%);

        ${({ isFirstTimeOpenModeMenu }) => {
            return (
                isFirstTimeOpenModeMenu &&
                css`
                    display: none;
                `
            );
        }}

        @media (max-width: 1100px) {
            right: 24px;
            transform: none;
            left: auto;

            ${({ isChatDisplayed, isSoloMode }) => {
                return (
                    (!isChatDisplayed || isSoloMode) &&
                    css`
                        transform: translateX(-50%);
                        left: 50%;
                        right: auto;
                    `
                );
            }}
        }

        @media (max-width: 760px) and (orientation: landscape) {
            ${({ isChatDisplayed }) => {
                return !isChatDisplayed
                    ? css`
                          transform: translateX(-50%);
                          left: 50%;
                          right: auto;
                      `
                    : css`
                          display: none;
                      `;
            }}
        }

        @media (max-width: 760px) and (orientation: portrait) {
            width: 100%;
            bottom: 0px;
            max-width: 100%;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            transform: translateX(-50%);
            right: auto;
            left: 50%;

            ${({ isChatDisplayed }) => {
                return !isChatDisplayed
                    ? css`
                          transform: translateX(-50%);
                          left: 50%;
                          right: auto;
                      `
                    : css`
                          display: none;
                      `;
            }}
        }

        @media (max-height: 450px) {
            ${({ isModeMenuOpen }) => {
                return (
                    isModeMenuOpen &&
                    css`
                        display: none;
                    `
                );
            }}
        }

        @media (max-width: 550px) and (orientation: landscape) {
            ${({ isArtworkInfoShowing }) => {
                return (
                    isArtworkInfoShowing &&
                    css`
                        // display: none;
                        border-top-left-radius: 0;
                        border-top-right-radius: 0;
                    `
                );
            }}

            ${(props) => {
                return (
                    props.currentTab !== "" &&
                    css`
                        border-radius: 0;
                    `
                );
            }}

            ${({ isChatDisplayed }) => {
                return (
                    isChatDisplayed &&
                    css`
                        display: none;
                    `
                );
            }}

            ${({ isModeMenuOpen }) => {
                return (
                    isModeMenuOpen &&
                    css`
                        display: none;
                    `
                );
            }}
        }

        @media (max-width: 550px) and (orientation: portrait) {
            width: 100%;
            left: 0;
            bottom: 0;
            transform: none;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            display: flex;
            align-items: center;
            justify-content: space-around;

            ${({ isArtworkInfoShowing }) => {
                return (
                    isArtworkInfoShowing &&
                    css`
                        // display: none;
                        border-top-left-radius: 0;
                        border-top-right-radius: 0;
                    `
                );
            }}

            ${(props) => {
                return (
                    props.currentTab !== "" &&
                    css`
                        border-radius: 0;
                    `
                );
            }}

            ${({ isChatDisplayed }) => {
                return (
                    isChatDisplayed &&
                    css`
                        display: none;
                    `
                );
            }}

            ${({ isModeMenuOpen }) => {
                return (
                    isModeMenuOpen &&
                    css`
                        display: none;
                    `
                );
            }}
        }
    }

    .artwork-info-bulle-container {
        &.mobile {
            position: fixed;
            bottom: 56px;
            left: 0;
            width: 100%;

            z-index: 1000000;

            ${({ isOpened }) =>
                isOpened &&
                css`
                    bottom: 0;
                `}
        }

        &.helper {
            position: fixed;
            left: 50%;
            transform: translateX(-50%);
            bottom: calc(12px + 62px);

            @media (max-width: 1100px) {
                right: 24px;
                bottom: calc(12px + 62px);
                left: auto;
                transform: none;

                ${({ isChatDisplayed, isSoloMode }) => {
                    return (
                        (!isChatDisplayed || isSoloMode) &&
                        css`
                            transform: translateX(-50%);
                            // bottom: calc(100% + 8px);
                            left: 50%;
                            right: auto;
                        `
                    );
                }}
            }

            @media (max-width: 760px) {
                transform: translateX(-50%);
                right: auto;
                left: 50%;
                bottom: calc(62px + 12px);

                ${({ isChatDisplayed }) => {
                    return !isChatDisplayed
                        ? css`
                              transform: translateX(-50%);
                              left: 50%;
                              right: auto;
                          `
                        : css`
                              display: none;
                          `;
                }}
            }
        }

        &.basic {
            position: fixed;
            bottom: 8px;
            right: 24px;

            /* the basic one shows only when width >= 1100 */
            /* ${({ isMobile }) => {
                return (
                    isMobile &&
                    css`
                        right: auto;
                        left: 50%;
                        transform: translateX(-50%);
                    `
                );
            }} */

            @keyframes slidein {
                from {
                    transform: translateY(100%);
                }

                to {
                    transform: translateY(0);
                }
            }
        }
    }

    .helper-container {
        ${({ selectedMode }) => {
            return (
                selectedMode === Mode.VIRTUAL_TOUR &&
                css`
                    display: none;
                `
            );
        }}

        @media (max-width: 1100px) {
            ${({ isArtworkInfoShowing }) => {
                return (
                    isArtworkInfoShowing &&
                    css`
                        display: none;
                    `
                );
            }}
        }
    }
`;
