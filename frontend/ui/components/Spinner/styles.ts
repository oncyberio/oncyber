import { Theme } from "@ui/types";
import styled, { css } from "styled-components";

type WrapperProps = {
    overrideTheme?: Theme;
    isLightTheme?: boolean;
    stroke?: string;
};

export const Wrapper = styled.svg<WrapperProps>`
    animation: rotate 2s linear infinite;

    circle {
        stroke: ${({ isLightTheme, overrideTheme }) =>
            (overrideTheme ? overrideTheme : isLightTheme) ? "#000" : "#fff"};

        ${({ stroke }) =>
            stroke &&
            css`
                stroke: ${stroke};
            `}

        stroke-linecap: round;
        animation: dash 1.5s ease-in-out infinite;
        stroke-linecap: round;
    }

    @keyframes rotate {
        100% {
            transform: rotate(360deg);
        }
    }

    @keyframes dash {
        0% {
            stroke-dasharray: 1, 150;
            stroke-dashoffset: 0;
        }
        50% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -35;
        }
        100% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -124;
        }
    }
`;
