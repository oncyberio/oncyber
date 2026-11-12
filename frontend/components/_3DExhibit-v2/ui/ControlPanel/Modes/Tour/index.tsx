import ProfileBtn from "../shared/ProfileBtn";
import { usePanel } from "../../context/PanelProvider";
import {
    APP_STATES,
    CURRENT_STATE,
    IS_MOBILE,
} from "@components/_3DExhibit-v2/three/constants";
import { useEffect, useRef, useState } from "react";
import ScreenshotBtn from "../shared/ScreenshotBtn";
import { IconButton } from "@ui/components/IconButton";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { ControlPanelIcon, PanelContainer } from "../shared/styles";
import { useCyberTranslation } from "@components/context/I18nContext";
import ExtraBtn from "../shared/ExtraBtn";

const TRANSITION_INTERVAL = 5000;

export default function TourPanel() {
    const { currentTab, isModeMenuOpen, setCurrentTab } = usePanel();

    const [isPlaying, setIsPlaying] = useState(false);

    const { t } = useCyberTranslation();

    const intervalRef = useRef(null);

    const world = useWorld();

    // !TODO: Go from exposition state to space state
    // !TODO: How to handle artwork info and panel at the same time???

    useEffect(() => {
        handlePlay();

        function handleKeyDown(e) {
            if (e.code === "ArrowLeft") {
                handlePrev();
            } else if (e.code === "ArrowRight") {
                handleNext();
            }
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);

            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (isModeMenuOpen) {
            handlePause();
        }
    }, [isModeMenuOpen]);

    function handlePlay() {
        if (CURRENT_STATE !== APP_STATES.EXPOSITION) {
            world.current.setState("EXPOSITION", { next: true });
        }

        intervalRef.current = setInterval(() => {
            world.current.setState("EXPOSITION", { next: true });
        }, TRANSITION_INTERVAL);

        setIsPlaying(true);
    }

    function handlePause() {
        clearInterval(intervalRef.current);
        setIsPlaying(false);
    }

    function handleNext() {
        handlePause();
        world.current.setState("EXPOSITION", { next: true });
    }

    function handlePrev() {
        handlePause();
        world.current.setState("EXPOSITION", { previous: true });
    }

    return (
        <PanelContainer
            currentTab={currentTab}
            isHidden={currentTab === "profile" || currentTab === "settings"}
        >
            <ControlPanelIcon
                isMobile={IS_MOBILE}
                onMouseEnter={() => {
                    setCurrentTab("");
                }}
            >
                {/* <span>{t`PREV`}</span> */}
                <IconButton
                    onClick={handlePrev}
                    style={{
                        border: "none",
                        marginRight: 16,
                        background: "rgba(7, 7, 7, 0.6)",
                        // backdropFilter: "blur(20px)",
                    }}
                    mode="light"
                    outline
                    name="chevron-left"
                    variants="studio"
                    size="medium-plus"
                />
            </ControlPanelIcon>

            <ControlPanelIcon isMobile={IS_MOBILE}>
                {/* <span>{t`PAUSE_PLAY`}</span> */}
                {isPlaying ? (
                    <IconButton
                        onClick={handlePause}
                        style={{
                            border: "none",
                            marginRight: 16,
                            background: "rgba(7, 7, 7, 0.6)",
                            // backdropFilter: "blur(20px)",
                        }}
                        mode="light"
                        outline
                        name="pause"
                        variants="studio"
                        size="medium-plus"
                        onMouseEnter={() => {
                            setCurrentTab("");
                        }}
                    />
                ) : (
                    <IconButton
                        onClick={handlePlay}
                        style={{
                            border: "none",
                            marginRight: 16,
                            background: "rgba(7, 7, 7, 0.6)",
                            // backdropFilter: "blur(20px)",
                        }}
                        mode="light"
                        outline
                        name="play"
                        variants="studio"
                        size="medium-plus"
                        onMouseEnter={() => {
                            setCurrentTab("");
                        }}
                    />
                )}
            </ControlPanelIcon>
            <ControlPanelIcon isMobile={IS_MOBILE}>
                {/* <span>{t`NEXT`}</span> */}
                <IconButton
                    onClick={handleNext}
                    style={{
                        border: "none",
                        marginRight: 16,
                        background: "rgba(7, 7, 7, 0.6)",
                        // backdropFilter: "blur(20px)",
                    }}
                    mode="light"
                    outline
                    name="chevron-right"
                    variants="studio"
                    size="medium-plus"
                    onMouseEnter={() => {
                        setCurrentTab("");
                    }}
                />
            </ControlPanelIcon>

            <ScreenshotBtn />

            <ExtraBtn />

            <ProfileBtn />
        </PanelContainer>
    );
}
