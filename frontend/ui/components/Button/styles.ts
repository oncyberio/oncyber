import styled from "styled-components";
import { ButtonProps } from "@ui/types";

export const StyledButton = styled.button<ButtonProps>`
    text-decoration: none;
    cursor: pointer;
    transition: all 0.4s ease-in-out;
    border-radius: 999999px;
    font-size: 15px;
    font-weight: 500;
    line-height: 36px;

    &:hover {
        transition: all 0.2s ease-in-out;
        opacity: 0.7;
    }

    ${({ uppercase }) =>
        uppercase &&
        `
		text-transform: uppercase;
	`}

    ${({ wide }) =>
        wide &&
        `
        width: 100%;
        text-align: center;
    `}

    ${({ icon }) =>
        icon &&
        `
        display: flex;
        align-items: center;
    `}

    ${({ iconPosition }) =>
        iconPosition === "right"
            ? `
        flex-direction: row-reverse;
        img, svg {
            margin-left: 20px;
        }
        `
            : `
        img, svg {
            margin-right: 20px;
        }
    `}
    ${({ size }) => {
        switch (size) {
            case "xlarge":
                return `padding: 1rem 2rem;`;
            case "large":
                return `padding: 10px 42px;`;
            case "medium":
                return `padding: 0.4rem 1.8rem; font-size: 10pt;`;
            case "small":
                return `padding: 0.3rem 1.6rem; font-size: 8pt;`;
            default:
                return null;
        }
    }}
    ${({
        variant,
        state,
        bg,
        borderColor,
        color,
        width,
        height,
        theme: { colors },
    }) => {
        switch (variant) {
            case "primary":
                return `
                    color: ${
                        state
                            ? colors.stateColors[state]
                            : color || colors.primary[900]
                    };
                    background: ${
                        state
                            ? colors.stateColors[state]
                            : bg || colors.primary[900]
                    };
                    border: 1px solid transparent;
                    &:hover {
                        background: ${
                            state
                                ? colors.stateColors[state]
                                : bg || colors.primary[700]
                        };
                    }
              `;
            case "secondary":
                return `
                color: ${
                    state
                        ? colors.stateColors[state]
                        : borderColor || colors.primary[900]
                };
                background: transparent;
                border: ${
                    state
                        ? colors.stateColors[state]
                        : borderColor || colors.primary[900]
                } 1px solid;

                svg {
                  stroke: ${colors.primary[900]};
                  transition: .3s all;
                }
              `;
            case "ghost":
                return `
                color: ${state ? colors.stateColors[state] : color};
                background: none;
                border: none;
              `;
            case "float":
                return `
                border: ${
                    state
                        ? colors.stateColors[state]
                        : borderColor || colors.primary[900]
                } 1px solid;
                width: ${width};
                height: ${height};
                border-radius: 999999px;
                display: flex;
                justify-content: center;
                padding: 0;
                background: transparent;

                img, svg {
                    margin-right: unset;
                }
                `;
            default:
                return `
                color: ${colors.white};
                background: ${
                    state
                        ? colors.stateColors[state]
                        : bg || colors.primary[900]
                };
                border: 1px solid transparent;
                &:hover {
                  background: ${
                      state
                          ? colors.stateColors[state]
                          : bg || colors.primary[700]
                  };
                }
              `;
        }
    }}
    &:disabled {
        background-color: ${({ theme }) => theme.colors.black[200]};
        color: ${({ theme }) => theme.colors.black[700]};
    }
`;
