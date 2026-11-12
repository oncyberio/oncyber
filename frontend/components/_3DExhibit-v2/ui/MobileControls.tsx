import { IconButton } from "@ui/components/IconButton";
import { getUserSetting, saveUserSetting } from "@utils/userSettings";
import React, { useCallback, useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import { useMultiplayer } from "../context/MultiplayerProvider";
import { IS_MOBILE } from "../three/constants";
import {
    fullscreenelElement,
    onOrientationChange,
    openFullscreen,
    isLandscape,
} from "../three/utils/platform";
import { NButton } from "@ui/components/NButton";
import IconImg from "@ui/components/IconImg";
import { useCyberTranslation } from "@components/context/I18nContext";
import { useWorld } from "../hooks/useWorld";

type ViewState =
    | { type: "TUTORIAL_1" }
    | { type: "TUTORIAL_2" }
    | { type: "NO_TUTORIAL" };

interface MobileControlsProps {
    containerRef: React.MutableRefObject<HTMLElement>;
    hasBackPortal: boolean;
    isPlaying: boolean;
    isLandscape: boolean;
    viewState: ViewState;
    setViewState: (state: ViewState) => any;
    pause: () => void;
    openBackPortal: () => void;
    activateChat: () => void;
    isChatIconDisplayed: boolean;
    isInteractive: boolean;
    toggleChat: any;
    artwork: any;
    isModeMenuOpen: boolean;
    isCSSInteracting: boolean;
    exitInteractiveMode: () => void;
    joystickMovingRef: React.MutableRefObject<any>;
}

const MOBILE_HIDE_TUTORIAL = "MOBILE_HIDE_TUTORIAL";

const MobileControls: React.FC<MobileControlsProps> = ({
    containerRef,
    hasBackPortal,
    isPlaying,
    viewState,
    setViewState,
    pause,
    isChatIconDisplayed: isChatDisplayed,
    activateChat,
    openBackPortal,
    isInteractive,
    toggleChat,
    artwork,
    isModeMenuOpen,
    isCSSInteracting,
    exitInteractiveMode,
    joystickMovingRef,
}) => {
    const [isFullScreen, setFullScreen] = useState(false);
    const [supportsFullscreen, setFSSupport] = useState(false);
    const [hideTutorial, _setHideTutorial] = useState(true);

    const { t } = useCyberTranslation();

    const { chat, room, onConnect } = useMultiplayer();

    const { isTyping, setIsTyping, sendMessage } = chat;

    const closeChatButtonRef = useRef(null);

    const world = useWorld();

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

    //#region effects

    useEffect(() => {
        let disposeFullScreenEvent;
        const canFullscreen = function () {
            for (const key of [
                "exitFullscreen",
                "webkitExitFullscreen",
                "webkitCancelFullScreen",
                "mozCancelFullScreen",
                "msExitFullscreen",
            ]) {
                if (key in document) {
                    const handler = () => {
                        setFullScreen(!!document.fullscreenElement);
                    };
                    document.addEventListener("fullscreenchange", handler);
                    disposeFullScreenEvent = () =>
                        document.removeEventListener(
                            "fullscreenchange",
                            handler
                        );
                    return true;
                }
            }
            return false;
        };

        const FSSupported = canFullscreen();
        setFSSupport(FSSupported);

        const goFullScreen = () => {
            if (isLandscape() && fullscreenelElement() == null) {
                openFullscreen(containerRef.current);
            }
        };

        let disposegoFS = () => {};

        if (FSSupported) {
            // onOrientationChange(goFullScreen);
        }

        const noTutorial = getUserSetting(MOBILE_HIDE_TUTORIAL);

        setHideTutorial(noTutorial);

        if (noTutorial) {
            setViewState({ type: "NO_TUTORIAL" });
        }

        return () => {
            if (FSSupported) {
                disposeFullScreenEvent();
                disposegoFS();
            }
        };
    }, []);

    useEffect(() => {
        // When keyboard is showing we want to show the chat close icon
        function resizeHandler(e) {
            const isPortrait = window.innerHeight > window.innerWidth;

            const isKeyboardOpen =
                window.visualViewport.height < window.innerHeight;

            if (!closeChatButtonRef.current) return;

            if (isKeyboardOpen) {
                closeChatButtonRef.current.style.top = `${
                    window.innerHeight - window.visualViewport.height + 16
                }px`;
            } else {
                if (isPortrait) {
                    closeChatButtonRef.current.style.top = "24px";
                } else {
                    closeChatButtonRef.current.style.top = "16px";
                }
            }
        }

        window.visualViewport.addEventListener("resize", resizeHandler);

        return () => {
            window.visualViewport.removeEventListener("resize", resizeHandler);
        };
    }, [isTyping]);

    const onFullScreen = useCallback(() => {
        openFullscreen(containerRef.current);
    }, [containerRef.current]);

    const onPause = useCallback(() => {
        pause();
        if (fullscreenelElement() != null) {
            document.exitFullscreen();
        }
    }, [pause]);

    const setHideTutorial = useCallback(
        (val) => {
            _setHideTutorial(val);
            saveUserSetting(MOBILE_HIDE_TUTORIAL, val);
        },
        [_setHideTutorial]
    );

    const handleTutorialBtnClick = useCallback(() => {
        if (viewState.type === "TUTORIAL_1") {
            setViewState({ type: "NO_TUTORIAL" });
        }
        setHideTutorial(true);
    }, [viewState, setViewState]);

    const showTutorial = viewState.type !== "NO_TUTORIAL";

    let className = "";
    if (!IS_MOBILE || !isPlaying || isModeMenuOpen) {
        className = "hide";
    }

    let tutorialContent;

    const messages = [
        {
            title: t`MOVE`,
            text: t`MOVE_DESCRIPTION`,
            icon: `movehand`,
        },
        {
            title: t`LOOK_AROUND`,
            text: t`LOOK_AROUND_DESCRIPTION`,
            icon: `lookaroundhand`,
        },
        {
            title: t`SWITCH_VIEWING_MODE`,
            text: t`SWITCH_VIEWING_MODE_DESCRIPTION`,
            icon: `switchmode_dark`,
        },
        {
            title: t`LANDSCAPE_MODE`,
            text: t`LANDSCAPE_MODEDESCRIPTION`,
            icon: `switchlandscape`,
        },
    ];

    const shouldShowArtwork = assetType !== "Unknown" && assetType !== "Text";

    tutorialContent = messages.map((message, key) => (
        <TipContainer key={key}>
            <IconImg size={56} mode="light" name={message?.icon} />
            <div>
                <h5>{message?.title}</h5>
                <p>{message?.text}</p>
            </div>
        </TipContainer>
    ));

    if (showTutorial && isPlaying) {
        return (
            <TutorialContainer className="touch-target mobile-tutorial">
                <TutorialWrapper onClick={handleTutorialBtnClick}>
                    {/* <Tutorial first={true}>
                        <div className="tutorialContent scrollbar light">
                            <TutorialTitle>
                                {t`HOW_TO_USE`}{" "}
                                <span className="pixelated">oncyber</span>{" "}
                                {t`ON_MOBILE`}
                            </TutorialTitle>
                            <TipsContainer isLandscape={isLandscape}>
                                {tutorialContent}
                            </TipsContainer>
                            <div className="continue">
                                <h5>{t`TAP_TO_CONTINUE`}</h5>
                            </div>
                        </div>
                    </Tutorial> */}
                    <div className="joystick-tutorial">
                        <div />
                        <div />
                    </div>
                    <span>{t`SWIPE_LEFT_RIGHT_TO_EXPLORE`}</span>
                </TutorialWrapper>
            </TutorialContainer>
        );
    }

    return (
        <Container
            isFullScreenIconShowing={
                isLandscape && supportsFullscreen && !isFullScreen
            }
            className={className}
            showTutorial={showTutorial}
        >
            <FullscreenBtn
                id="fullscreen"
                className="cmd fullscreen"
                style={{
                    display:
                        isLandscape() && supportsFullscreen && !isFullScreen
                            ? "block"
                            : "none",
                }}
                onClick={onFullScreen}
            >
                <IconButton name="maximize-2" mode="light" />
            </FullscreenBtn>

            {IS_MOBILE &&
                isPlaying &&
                (!(
                    artwork &&
                    shouldShowArtwork &&
                    !isModeMenuOpen &&
                    !joystickMovingRef.current
                ) ||
                    isLandscape()) && (
                    <div
                        className="cmd pause"
                        id="pause"
                        onClick={pause}
                        style={{ display: !isChatDisplayed ? "block" : "none" }}
                    >
                        <IconButton name="arrow-left" mode="light" />
                    </div>
                )}

            {isCSSInteracting ? (
                <div className="exit" onClick={exitInteractiveMode}>
                    <NButton size="small" overrideTheme="dark">
                        Exit interactive
                    </NButton>
                </div>
            ) : null}

            <div
                className="pause"
                style={{ display: isChatDisplayed ? "block" : "none" }}
                onClick={() => {
                    toggleChat(false);
                    setIsTyping(false);
                    // sendMessage({
                    //     type: CHAT_TYPES.IS_CHATTING.label,
                    //     payload: false,
                    //     roomId: room.id,
                    // });
                }}
                ref={closeChatButtonRef}
            >
                <IconButton name="x" mode="light" />
            </div>

            {hasBackPortal && isPlaying && !artwork && (
                <NButton
                    overrideTheme="dark"
                    size="medium"
                    disabled={!hasBackPortal}
                    className="cmd"
                    id="reset"
                    onClick={openBackPortal}
                >
                    {t`BACK_TO_HUB`}
                </NButton>
            )}
        </Container>
    );
};

export default MobileControls;

const Container = styled.div<{
    showTutorial: boolean;
    isFullScreenIconShowing: boolean;
}>`
    position: absolute;
    bottom: 0;
    z-index: 9999;

    ${(props) =>
        props.showTutorial
            ? css`
                  width: 100%;
                  height: 100%;
              `
            : ""}

    #move {
        position: fixed;
        background: transparent;
        // background: rgb(21 44 222 / 50%); // use this to debug
    }

    .pause {
        position: fixed;
        left: 15.5px;
        top: 24px;
    }

    .exit {
        position: fixed;
        top: 24px;
        left: 62px;
    }

    ${({ isFullScreenIconShowing }) => {
        if (isFullScreenIconShowing) {
            return css`
                #artwork-info-toggle {
                    top: 24px;
                    right: 62px;
                }
            `;
        }
    }}

    #artwork-action {
        position: fixed;
        right: 5px;
        bottom: 75px;
        display: none;
        color: white;
    }

    /* The shared white action: its ink comes from NButton. */
    #reset {
        position: fixed;
        right: 15.5px;
        top: 24px;
    }

    #back-portal {
        position: fixed;
        top: 5px;
        right: 5px;
        display: none;
    }

    #jump {
        position: fixed;
        right: 95px;
        bottom: 7px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        font-size: 8pt;
        padding: 0;
        opacity: 0;
    }

    #reset,
    #artwork-action {
        height: 45px;
        width: auto;
        padding: 8px 22px;
        border-radius: 45px;
    }

    #chat {
        bottom: 16px;
        left: 15.5px;
        position: fixed;
        z-index: 100;
    }

    @media (orientation: landscape) {
        #move {
            width: 40vw;
            height: 45vh;
            left: 0;
            bottom: 0;
            z-index: 10;
        }

        .pause {
            position: fixed;
            left: 16px;
            top: 16px;
        }

        #artwork-info-toggle {
            top: 16px;
            right: 62px;
        }

        #fullscreen {
            top: 16px;
            right: 16px;
        }

        #reset {
            top: 10px;
            right: 65px;
        }
    }

    @media (orientation: portrait) {
        #move {
            display: none;
        }

        #fullscreen {
            display: none;
        }
    }
`;

const TutorialContainer = styled.div`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    color: white;

    @media (orientation: landscape) {
        padding: 0;
        border-radius: 0;
    }
`;

const TutorialWrapper = styled.div`
    position: relative;
    width: 100%;
    height: var(--100-vh);
    display: flex;
    align-items: center;
    flex-direction: column;
    backdrop-filter: blur(5px);
    justify-content: center;
    background: rgba(0, 0, 0, 0.4) !important;

    & > .joystick-tutorial {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-around;

        & > div {
            width: 132px;
            height: 40px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 999px;
        }
    }

    & > span {
        max-width: 143px;
        font-style: normal;
        font-weight: 600;
        font-size: 14px;
        line-height: 20px;
        text-align: center;
        text-transform: uppercase;
        color: #ffffff;
        margin-top: 16px;
    }
`;

const Tutorial = styled.div<{ first: boolean }>`
    width: 100%;
    height: var(--100-vh);
    padding: 1em 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    .continue {
        margin-top: 32px;
        font-size: 14px;
        text-align: center;

        font-weight: 500;
        font-size: 16px;
    }

    p.bottom {
        font-size: 16px;
        flex-basis: 0%;
        text-align: center;
        position: absolute;
        opacity: 0.8;
        bottom: 56px;
        width: 100%;
    }

    p.bottom > img {
        height: 35px;
        width: 35px;
    }

    @media (orientation: landscape) {
        border-radius: 0;
        border: none;
        margin: 0;
        padding: 0;

        .continue {
            margin: 2%;
        }

        p.bottom {
            position: absolute;
            left: 1rem;
            bottom: 1rem;
            width: 35vw;
        }
    }
`;

const TutorialTitle = styled.div`
    text-align: center;
    font-weight: 500;
    margin: 16px 0px 32px 0;
    font-size: 20px;
    color: #ffffff;

    .pixelated {
        font-family: "PPNeueBit", "Aeonik", "sans-serif";
        font-size: 1.45em;
        font-weight: 400;
    }
`;

const FullscreenBtn = styled.div`
    position: fixed;
    right: 24px;
    top: 24px;

    @media (orientation: landscape) {
        right: 70px !important;
        top: 16px !important;
    }
`;

const TipContainer = styled.div`
    img {
        max-width: 64px;
        max-height: 64px;
        padding: 4px;
    }

    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    width: 100%;
    margin: 12px 0;

    h5 {
        font-weight: 500;
        margin: 4px 0px;
        font-size: 14px;
    }

    p {
        margin: 0;
        font-size: 13px;
        max-width: 200px;
        opacity: 0.8;
    }

    @media (orientation: landscape) {
    }
`;
