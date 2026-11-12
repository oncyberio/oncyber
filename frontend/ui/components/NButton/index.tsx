import { Theme } from "@ui/types";
import { forwardRef } from "react";
import styled from "styled-components";
import { actionSpec, blueAction, pillAction } from "@styles/brand";
import { actionTokens as action } from "@styles/tokens/action";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    size?: "large" | "medium" | "small";
    outline?: boolean;
    overrideTheme?: Theme;
    variant?: string;
    ref?: any;
    gradient?: boolean;
}

export const NButton = forwardRef((props: ButtonProps, ref) => {
    return <StyledButton {...props} ref={ref} />;
});

NButton.defaultProps = {
    size: "medium",
    outline: false,
    variant: "primary",
};

/** The line box that makes the spec's padding and border add up to 40 px. */
const legacyLineHeight =
    action.size.minHeight -
    2 * (action.size.paddingY + action.size.borderWidth);

/**
 * Legacy pill button, on the shared action spec: the type, border width,
 * height and padding of `actionSpec`. `size` is kept for existing call
 * sites; every size is the same 40 px button.
 *
 * The colours follow the surface, read from `overrideTheme` or the
 * styled-components theme (light when neither says). On a dark surface a
 * solid button is the shared white action and `outline` is the shared
 * outline. On a light page they stay black and light. A button over a dark
 * surface that sits in a light-themed page must pass `overrideTheme="dark"`,
 * or it is black on dark.
 *
 * `variant="blue"` is the blue action, for sign in and publish only.
 */
export const StyledButton = styled.button<ButtonProps>`
    background: none;
    margin: 0;
    white-space: nowrap;
    display: flex;
    align-items: center;

    ${actionSpec}
    ${pillAction}
    /* Call sites set their own, smaller heights and paddings. A minimum
       height would override them, so the 40 px comes from the line box. */
    min-height: auto;
    line-height: ${legacyLineHeight}px;

    cursor: pointer;

    transition: all 0.3s ease;

    *:first-child {
        margin-right: 8px;
    }

    &:focus-visible {
        outline: ${action.state.focusWidth}px solid ${action.state.focusRing};
        outline-offset: ${action.state.focusOffset}px;
    }

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }

    ${({ gradient, theme, overrideTheme, outline, variant }) => {
        //console.log(theme, size, outline);

        let styles = ``;

        // Blue looks the same on every surface; see the end of this block.
        if (variant === "blue") return styles;

        const surface = overrideTheme || theme?.type || "light";

        if (outline) {
            if (gradient) {
                styles += `

                    background: #fff;

                    color: #070707;

                    border: 2px solid transparent;

                    border-image: url(/images/gradient.png) 1;
                `;
            } else {
                if (surface === "dark") {
                    // The shared outline (see outlineAction).
                    styles += `
                        background: transparent;

                        border-color: ${action.outline.border};

                        color: ${action.outline.ink};

                        &:hover {
                            background: ${action.outline.hoverFill};

                            border-color: ${action.outline.hoverBorder};
                        }

                        &:active {
                            background: ${action.outline.pressedFill};
                        }

                        &:disabled {
                            background: transparent;

                            border-color: ${action.outline.border};

                            opacity: ${action.state.disabledOpacity};

                            cursor: not-allowed;
                        }

                    `;
                } else if (surface === "light") {
                    styles += `
                        background: #fff;

                        border: 1px solid #E0E0E0;

                        color: #070707;

                        &:hover {
                            background: #f7f7f7;

                            border: 1px solid #F5F5F5;
                        }


                        &:disabled {
                            background: none;

                            border: 1px solid #C2C2C2;

                            color: #C2C2C2;
                        }

                    `;
                }
            }
        } else {
            if (surface === "dark") {
                // The shared solid white (see whiteAction).
                styles += `
                background: ${action.white.fill};

                border-color: ${action.white.fill};

                color: ${action.white.ink};

                &:hover {
                    background: ${action.white.hover};

                    border-color: ${action.white.hover};
                }

                &:active {
                    background: ${action.white.pressed};

                    border-color: ${action.white.pressed};
                }

                &:disabled {
                    background: ${action.white.fill};

                    border-color: ${action.white.fill};

                    opacity: ${action.state.disabledOpacity};

                    cursor: not-allowed;
                }
                `;
            } else if (surface === "light") {
                styles += `

                background: #070707;

                color: #ffffff;

                &:hover {
                    background: #292929;
                }


                &:disabled {

                    border: 1px solid #E0E0E0;

                    background: #E0E0E0;

                    color: #FFFFFF;
                }
                `;
            }
        }

        return styles;
    }}

    ${({ variant }) => variant === "blue" && blueAction}
`;
