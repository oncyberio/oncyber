import styled from "styled-components";

export type StyledProgressBarProps = {
    borderRadius?: string;
    background?: string;
    progress?: number;
    height?: string;
};

export const StyledProgressBar = styled.div<StyledProgressBarProps>`
    top: 0;
    left: 0;
    position: absolute;
    transition: 0.3s all ease;
    height: ${({ height }) => height};
    width: ${({ progress }) => progress}%;
    background: ${({ background }) => background};
    border-radius: ${({ borderRadius }) => borderRadius};
    opacity: ${({ progress }) => (progress <= 100 ? "1" : "0")};
`;

StyledProgressBar.defaultProps = {
    background: "#00ffd4",
    borderRadius: "0px",
    height: "8px",
    progress: 0,
};
