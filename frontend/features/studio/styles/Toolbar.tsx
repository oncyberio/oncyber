import styled, { css } from "styled-components";

export const Toolbar = styled.div`
    display: flex;
    flex-direction: row;
    gap: 12px;
    justify-content: flex-start;
    align-items: center;
`;

export const Tool = styled.button<{
    state?: "toggled" | "selected";
    blink?: boolean;
}>`
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur-sm);
    -webkit-backdrop-filter: var(--glass-blur-sm);
    border: var(--glass-border-subtle);
    border-radius: var(--radius-pill);
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    transition: all 0.3s ease-out;

    &:hover {
        background: var(--glass-bg-hover);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    & > .tool-icon {
        filter: invert(1);
    }

    ${(props) => {
        //
        if (props.state === "toggled") {
            //
            return css`
                background: rgba(255, 255, 255, 0.35);
                border: var(--glass-border);
            `;
        }

        if (props.state === "selected") {
            //
            return css`
                filter: invert(1);
            `;
        }
    }}

    ${(props) => {
        //
        if (props.blink) {
            //
            return css`
                &:active {
                    filter: invert(1);
                }
            `;
        }
    }}
`;
