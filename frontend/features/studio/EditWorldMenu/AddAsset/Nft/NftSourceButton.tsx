import styled from "styled-components";

export function NftSourceButton({ label, value, toggled = false }) {
    return (
        <Container
            type="button"
            aria-label={`${label}: ${value}`}
            aria-expanded={toggled}
        >
            <span className="source-value">{value}</span>
            <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
            >
                <path d={toggled ? "m4 10 4-4 4 4" : "m4 6 4 4 4-4"} />
            </svg>
        </Container>
    );
}

const Container = styled.button`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 12px;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border-radius: var(--studio-radius-control);
    margin: 0;
    min-height: 36px;
    border: 1px solid var(--studio-line);
    background: var(--studio-surface);
    color: var(--nft-ink);
    text-align: left;
    cursor: pointer;
    .source-value {
        overflow: hidden;
        font: 12px/20px var(--studio-font, sans-serif);
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    &:hover,
    &[aria-expanded="true"] {
        background: var(--studio-hover);
    }
    &:focus-visible {
        outline: 1px solid var(--nft-ink);
        outline-offset: 2px;
    }
    @media (max-width: 600px) {
        min-height: 44px;
    }
`;
