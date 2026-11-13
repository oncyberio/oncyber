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
    /* Center 0.34em above the baseline: a little above the middle of the
       0.5em x-height, which reads as centered next to the label. */
    vertical-align: 0.04em;
    color: var(--create-icon-color, var(--oc-accent-create));
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
        transition: transform var(--oc-standard, 240ms) ease;
    }
    &::before {
        transform: rotate(0deg);
    }
    &::after {
        transform: rotate(90deg);
    }
    /* Each bar turns on its own into the ×. Diagonal bars read smaller than
       straight ones, hence the scale. */
    &[data-open="true"]::before {
        transform: rotate(45deg) scale(1.2);
    }
    &[data-open="true"]::after {
        transform: rotate(135deg) scale(1.2);
    }
`;
