import NativeExperienceChrome from "@features/content-host/NativeExperienceChrome";
import Jump from "./Jump";
import React, { useContext, useEffect, useRef } from "react";
import styled, { css } from "styled-components";
import { Mode, usePanel } from "../../context/PanelProvider";
import ArtworkInfoBulle from "../../ArtworkInfoBulle";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import Chat from "@components/_3DExhibit-v2/ui/Chat";
import Modals from "./Modals";
import ConnectWallet from "@ui/components/ConnectWallet";
import SeeArtwork from "./SeeArtwork";
import { deviceOrientation } from "@components/_3DExhibit-v2/three/utils/platform";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { UserContext } from "@components/context/UserContext";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import Helper from "@components/_3DExhibit-v2/ui/ControlPanel/Modes/shared/Helper";
import TooltipNotification from "../../Notification/Tooltip";
import SummonNotification from "../../Notification/SummonNotification";
import { AnimatePresence } from "framer-motion";

export default function MobileControlPanel({
    isChatActive,
    exhibit,
    isPlaying,
    showArtworkInfo,
    isArtInfoTransition,
    toggleArtworkInfo,
    artwork,
    setMobileEmote,
    mobileEmote,
    isExtaMenuVisible,
    toggleExtraMenu,
    toggleIntercation,
    isInteractionVisible,
    joystickMovingRef,
}) {
    const lastReadMessageIndex = useRef(0);

    const { user } = useContext(UserContext);

    const {
        settings,
        toggleAuth,
        currentTab,
        isModeMenuOpen,
        selectedMode,
        isAuthShowing,
        handleSettings,
        isMobileArtworkInfoOpened,
    } = usePanel();

    const animationCounterRef = useRef(0);

    const world = useWorld();

    const { room, chat, onConnect } = useMultiplayer();

    const hasRequestMic = useRef(false);

    const { isChatDisplayed, messageIndex } = chat;
    const chatVisible = isChatActive && isChatDisplayed && chat?.active;

    useEffect(() => {
        if (isChatDisplayed && isChatActive) {
            //
            lastReadMessageIndex.current = messageIndex;
        }
    }, [isChatDisplayed, isChatActive, messageIndex]);

    function sendAnalytics(animation) {
        const amplitudePayload = {
            exhibitId: exhibit?.id,
            user_id: user?.id,
            ownerId: exhibit?.owner,
            exhibitName: exhibit?.info?.headline,
            collab: exhibit?.editors?.length > 1,
            number_of_artworks: Object.keys(exhibit?.artworks || {}).length,
            destination: exhibit?.info?.room,
            screen_mode: deviceOrientation(),
            serverName: room.id,
            ...world.current.getPlayerData({
                isFirstPerson: true,
            }),
            animation,
        };

        if (animationCounterRef.current === 1) {
            console.log("CALLED sent_first_emote");
            amplitude_logAnalyticsEvent("sent_first_emote", amplitudePayload);
        }

        // Log this event every ten messages
        if (
            animationCounterRef.current > 0 &&
            animationCounterRef.current % 10 === 0
        ) {
            console.log("CALLED sent_10_emote");

            amplitude_logAnalyticsEvent("sent_10_emote", amplitudePayload);
        }
    }

    const handlePlayEmote = useEventCallback(
        async (key: number, name?: string) => {
            //

            animationCounterRef.current += 1;

            if (settings.camera !== "third_person") {
                await handleSettings("camera", "third_person");
            }

            world.current.playEmote(key);

            //
            sendAnalytics(name);

            toggleIntercation(false);
        },
        []
    );

    const assetType =
        artwork?.source?.api === "oncyber" &&
        artwork?.source?.blockchain === "none"
            ? "Upload"
            : artwork?.contract_address && artwork.token_id
            ? "Nft"
            : artwork?.mime_type === "embed/youtube"
            ? "Youtube"
            : artwork?.mime_type?.includes("embed/html")
            ? "Website"
            : artwork?.mime_type === "cyber/text"
            ? "Text"
            : "Unknown";

    const shouldShowArtwork = assetType !== "Unknown" && assetType !== "Text";

    return (
        <>
            {isAuthShowing && (
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
            )}

            {isPlaying && (
                <MobileNotifyWrapper>
                    <TooltipNotification
                        hasRequestMic={hasRequestMic?.current}
                    />
                    <Helper />
                </MobileNotifyWrapper>
            )}

            {isPlaying && selectedMode === Mode.MULTIPLAYER && (
                <SummonNotification />
            )}

            <AnimatePresence>
                {isPlaying &&
                    artwork &&
                    shouldShowArtwork &&
                    !isModeMenuOpen &&
                    !joystickMovingRef.current && (
                        <SeeArtwork artwork={artwork} assetType={assetType} />
                    )}
            </AnimatePresence>

            {currentTab !== "" && <Modals />}

            {artwork && !isModeMenuOpen && isMobileArtworkInfoOpened && (
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

            {isPlaying && !showArtworkInfo && (
                <Container isInteractionVisible={isInteractionVisible}>
                    <NativeExperienceChrome exhibit={exhibit} mobile onEmote={handlePlayEmote} />
                    {chatVisible && (
                        <Chat exhibit={exhibit} isMobile={true} />
                    )}
                    <MobileJump $chatVisible={chatVisible}>
                        <Jump className="jump-btn no-select" />
                    </MobileJump>
                </Container>
            )}
        </>
    );
}

const Container = styled.div<{ isInteractionVisible: boolean }>`
    ${(props) =>
        props.isInteractionVisible &&
        css`
            @media (orientation: landscape) {
                .jump-btn {
                    opacity: 0.2;
                }
            }

            @media (orientation: portrait) {
                .extra-btn,
                .mic-enabled-btn,
                .jump-btn {
                    opacity: 0.2;
                }
            }
        `}
`;

const MobileNotifyWrapper = styled.div`
    position: fixed;
    top: 85px;
    left: 50%;
    transform: translateX(-50%);
    max-width: 70%;
    display: flex;
    justify-content: center;
`;

const MobileJump = styled.div<{ $chatVisible: boolean }>`
    position: absolute;
    right: 24px;
    bottom: max(90px, calc(env(safe-area-inset-bottom) + 78px));
    @media (max-width: 680px) {
        ${({ $chatVisible }) =>
            $chatVisible &&
            css`
                bottom: max(140px, calc(env(safe-area-inset-bottom) + 128px));
            `}
    }
    z-index: 10001;
    pointer-events: auto;
`;
