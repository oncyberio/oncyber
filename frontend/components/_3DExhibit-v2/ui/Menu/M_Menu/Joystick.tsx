import React from "react";
import styled, { css } from "styled-components";
import { useCyberTranslation } from "@components/context/I18nContext";

export default function Joystick({
    isPlaying,
    isChatDisplayed,
    isExtaMenuVisible,
    isInteractionVisible,
    mobileMoveRef,
    toggleDetails,
    settings,
    gatingError,
}) {
    const { t } = useCyberTranslation();

    return (
        <Container
            className="mobile-joystick"
            gatingError={gatingError}
            isToggleDetails={toggleDetails}
            isPositionLeft={settings?.joystick == "left"}
        >
            <JoyStickContainer
                ref={mobileMoveRef}
                className="no-select"
                position={settings?.joystick}
                isChatDisplayed={isChatDisplayed}
                isExtaMenuVisible={isExtaMenuVisible}
                isInteractionVisible={isInteractionVisible}
            />
            {!isPlaying && <span>{t`MOVE_JOYSTICK_TO_START`}</span>}
        </Container>
    );
}

const Container = styled.div<{
    isToggleDetails: boolean;
    isPositionLeft: boolean;
    gatingError: boolean;
}>`
    ${(props) =>
        (props.isToggleDetails || props.gatingError) &&
        css`
            display: none;
        `}

    & > span {
        width: 9em;
        max-width: 9em;
        font-weight: 500;
        font-size: 12px;
        line-height: 20px;
        text-align: center;
        text-transform: uppercase;
        color: #ffffff;
        position: absolute;
        bottom: -7px;

        ${(props) =>
            props.isPositionLeft
                ? css`
                      left: 5px;
                  `
                : css`
                      right: 5px;
                  `}

        @media (orientation: landscape) {
            display: none;
        }
    }
`;

const JoyStickContainer = styled.div<{
    position: string;
    isChatDisplayed: boolean;
    isExtaMenuVisible: boolean;
    isInteractionVisible: boolean;
}>`
    position: absolute;
    height: 100px;
    width: 120px;
    bottom: 30px;

    ${(props) =>
        props.position === "left"
            ? css`
                  left: 0;
              `
            : css`
                  right: 0;
              `}

    @media (orientation: portrait) {
        ${(props) =>
            (props.isExtaMenuVisible || props.isInteractionVisible) &&
            css`
                visibility: hidden;
            `}
    }

    -moz-user-select: none;
    -khtml-user-select: none;
    -webkit-user-select: none;

    -ms-user-select: none;
    user-select: none;

    @media (orientation: landscape) {
        height: 80px;
        width: 110px;
        bottom: 10px;
        left: 0;
    }

    /* The composer is always available now; leave movement controls above it. */
    ${({ isChatDisplayed }) =>
        isChatDisplayed &&
        css`
            bottom: max(80px, calc(env(safe-area-inset-bottom) + 68px));
            @media (max-width: 680px) {
                bottom: max(140px, calc(env(safe-area-inset-bottom) + 128px));
            }
        `}

    .nipple {
        // opacity: initial !important;

        .back {
            // backdrop-filter: blur(20px) !important;
            background: rgba(7, 7, 7, 0.88) !important;
        }

        .front {
            background: #ffffff !important;
            opacity: initial !important;
        }
    }
`;
