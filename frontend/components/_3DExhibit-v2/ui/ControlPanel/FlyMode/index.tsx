import React, { useEffect, useState } from "react";
import styled, { css } from "styled-components";
import { IconButton } from "@ui/components/IconButton";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import Settings from "./Settings";
import { AnimatePresence, motion } from "framer-motion";
import { useOnClickOutside } from "@components/hooks/useClickOutside";
import { useCyberTranslation } from "@components/context/I18nContext";
import { usePanel } from "../context/PanelProvider";

export default function FlyMode({
    isFlyModeRef,
    isArtworkShowing,
    fireFlyModeAmplEvent,
    isFlyModeChatDisplayed,
    setIsFlyModeChatDisplayed,
}) {
    const [isSettings, toggle] = useState(false);

    const { t } = useCyberTranslation();

    const { settings } = usePanel();

    const [stabilization, setStabilization] = useState(
        settings?.fly_mode_stabilization || "MEDIUM"
    );

    const [showUsername, setShowUsername] = useState(
        settings?.fly_mode_show_username ?? true
    );

    const [speed, setSpeed] = useState(settings?.fly_mode_speed || "NORMAL");

    const world = useWorld();

    const { addTogglerRef, clickRef } = useOnClickOutside({
        handler: () => {
            toggle(false);
        },
    });

    useEffect(() => {
        //
        fireFlyModeAmplEvent("start_fly_mode");

        return () => fireFlyModeAmplEvent("leave_fly_mode");
    }, []);

    const onExitFlyMode = async () => {
        await world.current.setShowUsername(true);
        await world.current.setFlyMode({ enabled: false });
        isFlyModeRef.current = false;
    };

    return (
        <Container isArtworkShowing={isArtworkShowing}>
            <div className="exit-dropdown">
                <SettingsIconWrapper
                    isActive={isSettings}
                    onClick={() => toggle((prevState) => !prevState)}
                    ref={(el) => {
                        addTogglerRef("fly-mode-settings", el);
                    }}
                >
                    <IconButton
                        immersed={true}
                        size="medium"
                        name="settings"
                        mode="light"
                    />
                </SettingsIconWrapper>
                <AnimatePresence>
                    {isSettings && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.08 }}
                        >
                            <Settings
                                speed={speed}
                                setSpeed={setSpeed}
                                clickRef={clickRef}
                                showUsername={showUsername}
                                stabilization={stabilization}
                                setIsFlyModeChatDisplayed={
                                    setIsFlyModeChatDisplayed
                                }
                                setShowUsername={setShowUsername}
                                setStabilization={setStabilization}
                                isFlyModeChatDisplayed={isFlyModeChatDisplayed}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <ExitFlyMode onClick={onExitFlyMode}>
                <span>{t`EXIT_FLY_MODE`}</span>
            </ExitFlyMode>
        </Container>
    );
}

const Container = styled.div<{ isArtworkShowing: boolean }>`
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    position: absolute;
    top: 25px;
    right: 25px;

    ${(props) =>
        props.isArtworkShowing &&
        css`
            display: none;
        `}

    & > .exit-dropdown {
        position: relative;
    }
`;

const ExitFlyMode = styled.div`
    display: flex;
    height: 50px;
    padding: 20px;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
        201.23deg,
        rgba(7, 7, 7, 0.3) 4.03%,
        rgba(23, 24, 26, 0.24) 94%
    );
    cursor: pointer;
    border-radius: 900px;
    //box-shadow: 0px 27px 30px rgb(0 0 0 / 25%), 0px 4px 4px rgb(0 0 0 / 11%);

    & > span {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        text-align: center;
        color: #ffffff;
    }
`;

const SettingsIconWrapper = styled.div<{ isActive: boolean }>`
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    border-radius: 40px;
    outline: none;
    border: 0;

    color: white;

    cursor: pointer;

    img {
        width: 100%;
    }

    ${(props) =>
        props.isActive
            ? css`
                  button {
                      background: rgba(7, 7, 7, 0.8) !important;
                  }
              `
            : css`
                  button {
                      background: linear-gradient(
                          201.23deg,
                          rgba(7, 7, 7, 0.3) 4.03%,
                          rgba(23, 24, 26, 0.24) 94%
                      ) !important;
                  }
              `}

    box-shadow: 0px 27px 30px rgb(0 0 0 / 25%), 0px 4px 4px rgb(0 0 0 / 11%);
`;
