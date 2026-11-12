import { useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import Navigation from "./Navigation";
import useModal from "@components/modals/useModal";
import useAnalytics from "../shared/useAnalytics";
import { AnimatePresence, motion } from "framer-motion";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { useRouter } from "next/router";
import Gating from "./Gating";
import { useWorldState } from "@components/_3DExhibit-v2/hooks/useWorldState";
import nipplejs from "nipplejs";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useGatingError } from "@components/context/GatingErrorContext";

function eventFire(el, etype) {
    if (el.fireEvent) {
        el.fireEvent("on" + etype);
    } else {
        var evObj = document.createEvent("Events");
        evObj.initEvent(etype, true, false);
        el.dispatchEvent(evObj);
    }
}

export default function D_Menu({
    exhibit,
    destination,
    controlsType,
    enterVR,
    play,
    hasBackPortal,
    isPlaying,
    isMobile,
    parentPage = null,
    settings,
    joystickContainerRef,
    isInteractionVisible,
    isExtaMenuVisible,
    isDisablePlay,
    isChatDisplayed,
    joystickMovingRef,
}) {
    //
    const router = useRouter();

    const fireAnalytics = useRef(false);

    const nipple = useRef(null);

    const mobileMoveRef = useRef(null);

    const [toggleDetails, setToggleDetails] = useState(false);

    const { toggle } = useModal();

    const worldState = useWorldState();

    const { mode } = useMultiplayer();

    const world = useWorld();

    const { gatingError } = useGatingError();

    const { handleStartExhibitAnalytics, handleEndExhibitAnalytics } =
        useAnalytics({
            exhibit,
            hasBackPortal,
            settings,
            destination,
        });

    useEffect(() => {
        if (mobileMoveRef.current && !nipple.current) {
            nipple.current = nipplejs.create({
                zone: mobileMoveRef.current,
                color: "#070707",
                mode: "static",
                dynamicPage: true,
                restOpacity: 0.8,
                threshold: 0.7,
                size: 80,
                shape: "circle",
                position: {
                    bottom: "50%",
                    left: "50%",
                },
            });

            nipple.current.on(
                // @ts-ignore
                "start end move",
                (event, data) => {
                    if (event.type === "move") {
                        //
                        if (data.force > 0.6) {
                            playSpace();
                        }

                        if (data.force < 0.6) return;

                        joystickMovingRef.current = true;

                        const direction = Math.round(data.angle.degree / 45);

                        world.current.mobileMove({
                            event: event.type,
                            direction: direction > 7 ? 0 : direction,
                            angle: data.angle.degree,
                        });

                        return;
                    }

                    if (event.type === "end") {
                        joystickMovingRef.current = false;
                    }

                    world.current.mobileMove(event);
                }
            );
        }

        return () => {
            if (nipple.current) {
                nipple.current.destroy();
                nipple.current = null;
                joystickMovingRef.current = false;
            }
        };
    }, [mobileMoveRef.current]);

    const playSpace = useEventCallback(
        (isEnterVR = false, force = false, shouldPlay = true) => {
            if (shouldPlay) {
                if (isEnterVR) {
                    enterVR();
                } else {
                    if (!fireAnalytics?.current) {
                        handleStartExhibitAnalytics(mode);

                        handleEndExhibitAnalytics(force, mode);

                        fireAnalytics.current = true;
                    }

                    if (!gatingError) {
                        play();
                    }
                }
            }

            try {
                const sound = document.querySelector("#app svg");

                if (sound) {
                    eventFire(sound, "click");
                } else {
                    console.log("PLAYING");
                }
            } catch (e) {
                console.error(e);
            }
        },
        [isPlaying, gatingError]
    );

    const isPreviewEmbed = router.query.embedp != null;

    return (
        <>
            <AnimatePresence>
                {!isPlaying && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Container>
                            <Info
                                isMobile={isMobile}
                                isPlaying={isPlaying}
                                id="m-menu"
                            >
                                {!isPreviewEmbed && (
                                    <Navigation
                                        isHidden={parentPage === "mint"}
                                    />
                                )}
                            </Info>
                        </Container>
                    </motion.div>
                )}
            </AnimatePresence>
            {worldState?.hasSpace && (
                <Gating
                    settings={settings}
                    exhibit={exhibit}
                    isPlaying={isPlaying}
                    handlePlay={playSpace}
                    ref={joystickContainerRef}
                    isDisablePlay={isDisablePlay}
                    isExtaMenuVisible={isExtaMenuVisible}
                    isChatDisplayed={isChatDisplayed}
                    mobileMoveRef={mobileMoveRef}
                    toggleDetails={toggleDetails}
                    isInteractionVisible={isInteractionVisible}
                />
            )}
        </>
    );
}

const Container = styled.div``;

const Info = styled.div<{
    isPlaying: boolean;
    isMobile: boolean;
}>`
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: absolute;
    height: var(--100-vh);

    display: flex;
    flex-direction: column;

    background: linear-gradient(
        0,
        rgba(0, 0, 0, 0.74) 0%,
        rgba(0, 0, 0, 0.45) 60%,
        rgba(0, 0, 0, 0) 100%
    );

    top: 0;

    ${({ isPlaying }) =>
        isPlaying &&
        css`
            display: none;
        `}

    ${({ isMobile }) =>
        isMobile &&
        css`
            height: -moz-available; /* WebKit-based browsers will ignore this. */
            height: -webkit-fill-available; /* Mozilla-based browsers will ignore this. */
            height: fill-available;
        `}
`;
