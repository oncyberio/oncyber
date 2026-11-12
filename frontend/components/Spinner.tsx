import styled, { keyframes } from "styled-components";

type SpinnerProps = {
    className?: string;
};

function Spinner({ className }: SpinnerProps) {
    return (
        <div className={className}>
            <div />
            <div />
            <div />
            <div />
        </div>
    );
}

const animation = keyframes`
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
`;

export default styled(Spinner)<{
    width?: number;
    height?: number;
    borderWidth?: number;
}>`
    display: inline-block;
    position: relative;
    width: ${({ width }) => `${width || 80}px`};
    height: ${({ height }) => `${height || 80}px`};

    div {
        box-sizing: border-box;
        display: block;
        position: absolute;
        width: 34px;
        height: 34px;
        margin: 8px;
        border-radius: 50%;
        border-color: #eee;
        border-style: solid;
        border-color: #eee transparent transparent transparent;
        border-width: ${({ borderWidth }) => `${borderWidth || 8}px`};
        animation: ${animation} 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    }
    div:nth-child(1) {
        animation-delay: -0.45s;
    }
    div:nth-child(2) {
        animation-delay: -0.3s;
    }
    div:nth-child(3) {
        animation-delay: -0.15s;
    }
`;
