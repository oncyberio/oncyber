import IconImg from "@ui/components/IconImg";
import styled from "styled-components";

export function FloatBtn({
    onClick,
    icon,
    badge = null,
    className = "",
    style = {},
}) {
    //
    return (
        <Container
            onClick={onClick}
            className={className}
            style={style}
            aria-label={icon === "layers" ? "World contents" : icon}
        >
            <IconImg name={icon} size={22} style={{ filter: "invert(0.9)" }} />
            {badge != null && <span className="badge">{badge}</span>}
        </Container>
    );
}

const Container = styled.button.attrs({ type: "button" })`
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--studio-surface);
    border: 1px solid var(--studio-line);
    width: 54px;
    height: 54px;
    border-radius: 14px;
    box-shadow: var(--studio-edge);
    cursor: pointer;

    pointer-events: all;
    padding: 0 0 5px;
    &:hover {
        background: var(--studio-hover);
    }
    &:focus-visible {
        outline: 2px solid var(--studio-ink);
        outline-offset: 3px;
    }

    .added-components {
        top: 0px;
        right: 70px;
        width: 336px;

        @media (max-width: 600px) {
            width: 280px;
        }

        .arrow-indicator {
            &.right {
                top: 15px !important;
            }
        }
    }

    & > .badge {
        position: absolute;
        bottom: 4px;
        right: 4px;
        padding: 0 3px;
        border-radius: 2px;
        background: var(--studio-surface, #1c1c1f);
        display: flex;
        align-items: center;
        justify-content: center;

        color: var(--studio-muted, #a1a1a8);
        font: 10px/12px var(--studio-mono, monospace);
    }
`;
