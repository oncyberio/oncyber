import styled from "styled-components";

export function ToggleTab({ value1, value2, selected, onChange }) {
    //
    const flipped = selected === value2;

    return (
        <StyledToggler flipped={flipped}>
            <div
                className={
                    flipped ? "tm-child tm-static" : "tm-child tm-toggle"
                }
                onClick={() => onChange(value1)}
            >
                {value1}
            </div>
            <div
                className={
                    flipped ? "tm-child tm-toggle" : "tm-child tm-static"
                }
                onClick={() => onChange(value2)}
            >
                {value2}
            </div>
        </StyledToggler>
    );
}

export const StyledToggler = styled.div<{ flipped: boolean }>`
    display: flex;
    flex-direction: row;
    width: 100%;

    padding: 2px;
    background: var(--studio-surface, #1c1c1f);
    border-radius: 8px;

    .tm-child {
        flex: 1;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }

    .tm-static {
        font-size: 11px;
        font-weight: 400;
        color: #a7a7a7;
        cursor: pointer;
    }

    .tm-toggle {
        border-radius: 8px;
        background: var(--studio-surface, #1c1c1f);
        font-size: 11px;
        font-weight: 500;
        color: #fff;
        cursor: pointer;
    }
`;
