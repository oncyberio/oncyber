import styled from "styled-components";

export const PanelTypeIcon = styled.span.attrs({
    className: "type-icon",
    "aria-hidden": "true",
})`
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    color: var(--studio-muted);
    filter: grayscale(1);
    opacity: 0.7;
    pointer-events: none;
    transform: translateY(2px);

    img,
    svg {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    .world-globe {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;

        > * {
            grid-area: 1 / 1;
        }
    }
`;
