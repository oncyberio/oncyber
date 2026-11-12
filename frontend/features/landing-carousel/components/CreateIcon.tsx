import styled from "styled-components";

/**
 * The "+" next to Create, turning into "×" while creating.
 *
 * Drawn with two bars instead of typed as a "+" / "×" glyph: glyph heights
 * differ from font to font, and in Space Grotesk the glyph sat above the
 * label. Sitting inline after the label (not as a separate flex item), the
 * bars are centered on the lowercase letters, which Aeonik and Space Grotesk
 * both draw about 0.5em tall.
 */
export function CreateIcon({ open }: { open?: boolean }) {
    return <Bars aria-hidden="true" data-open={open ? "true" : undefined} />;
}

const Bars = styled.span`
    position: relative;
    display: inline-block;
    width: 0.6em;
    height: 0.6em;
    margin-left: var(--create-icon-gap, 0.85em);
    /* Center 0.22em above the baseline: the middle of a 0.5em x-height, less
       about half a pixel the bars read high by. */
    vertical-align: -0.08em;
    color: var(--create-icon-color, var(--oc-accent-create));
    transition: transform var(--oc-fast);
    &::before,
    &::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 1.2px;
        margin-top: -0.6px;
        border-radius: 1px;
        background: currentColor;
    }
    &::after {
        transform: rotate(90deg);
    }
    &[data-open="true"] {
        /* Diagonal bars read smaller than straight ones. */
        transform: rotate(45deg) scale(1.2);
    }
`;
