import { forwardRef, ReactNode } from "react";
import styled, { css, CSSProperties } from "styled-components";

import React from "react";

import IconImg from "../IconImg";

interface IconButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    name?: string;

    active?: boolean;

    outline?: boolean;

    size?:
        | "xsmall"
        | "small"
        | "tiny"
        | "small-plus"
        | "medium"
        | "medium-plus"
        | "large"
        | "large-plus";

    mode?: "dark" | "light";

    style?: CSSProperties;

    className?: string;

    disabled?: boolean;

    children?: ReactNode;

    isHalo?: boolean;

    isSubtract?: boolean;

    immersed?: boolean;

    variants?: "studio";

    subtractSize?: "small" | "large";
}

export const IconButton = forwardRef(
    (props: IconButtonProps, ref: React.ForwardedRef<HTMLButtonElement>) => {
        let iconSize = 18;
        let buttonSize = 40;

        if (props.size !== "small") {
            iconSize = 24;
        }

        // if (props.variants === "studio") {
        //     buttonSize = 24;
        //     iconSize = 24;
        // }

        if (props.size === "xsmall") {
            buttonSize = 24;

            iconSize = 16;
        } else if (props.size === "medium") {
            buttonSize = 50;
        } else if (props.size === "large") {
            buttonSize = 56;
        } else if (props.size === "medium-plus") {
            iconSize = 20;
            buttonSize = 50;
        } else if (props.size === "small-plus") {
            iconSize = 24;
            buttonSize = 28;
        } else if (props.size === "tiny") {
            iconSize = 13;
            buttonSize = 36;
        } else if (props.size === "large-plus") {
            iconSize = 26.25;
            buttonSize = 72;
        }

        if (props.isHalo) {
            iconSize += 14;
            buttonSize += 2;
        }

        if (props.isSubtract) {
            iconSize = 20;
        }

        return (
            <Container ref={ref} {...props} buttonSize={buttonSize}>
                {props.children ? (
                    props.children
                ) : (
                    <IconImg
                        size={iconSize}
                        mode={props.mode}
                        name={props.name}
                        className="no-select icon-btn-img"
                    />
                )}
            </Container>
        );
    }
);

export const HaloButton = forwardRef(
    (props: IconButtonProps, ref: React.ForwardedRef<HTMLButtonElement>) => {
        return (
            <HaloContainer>
                <IconButton {...props} isHalo />
            </HaloContainer>
        );
    }
);

export const SubtractButton = forwardRef(
    (props: IconButtonProps, ref: React.ForwardedRef<HTMLButtonElement>) => {
        return (
            <SubtractContainer
                subtractSize={props?.subtractSize}
                isActive={props?.active}
            >
                <IconButton {...props} isSubtract />
            </SubtractContainer>
        );
    }
);

SubtractButton.defaultProps = {
    subtractSize: "small",
};

IconButton.defaultProps = {
    name: "activity",

    size: "small",

    disabled: false,
};

const HaloContainer = styled.div`
    background: url("/images/btnHalo-2.png");
    background-size: cover;
    padding: 2px;
    border-radius: 50%;
`;

const SubtractContainer = styled.div<{
    subtractSize: "small" | "large";
    isActive?: boolean;
}>`
    background-size: cover;
    padding: 2px;
    border-radius: 50%;
    // backdrop-filter: blur(20px);
    background-repeat: no-repeat;
    background-position: center;

    ${({ subtractSize, isActive }) => {
        return subtractSize === "small"
            ? isActive
                ? css`
                      background: url("/icons/subtract-white.svg");
                  `
                : css`
                      background: url("/icons/subtract.svg");
                  `
            : isActive
            ? css`
                  background: url("/icons/subtract2-white.svg");
              `
            : css`
                  background: url("/icons/subtract2.svg");
              `;
    }}
`;

const Container = styled.button<IconButtonProps>`
    border-radius: 50%;
    cursor: pointer;
    width: ${(props) => props.buttonSize}px;
    height: ${(props) => props.buttonSize}px;
    min-width: ${(props) => props.buttonSize}px;
    min-height: ${(props) => props.buttonSize}px;

    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.5s ease;
    outline: none;
    -webkit-tap-highlight-color: transparent;

    -webkit-user-select: none; /* Safari */
    -ms-user-select: none; /* IE 10 and IE 11 */
    user-select: none; /* Standard syntax */

    ${(props) => {
        if (props.outline && props.active) {
            return css`
                background: #2e2e2c;
                border: none;
            `;
        }

        if (props.variants === "studio") {
            return css`
                border: none;
                //margin-right: 8px;
                // backdrop-filter: blur(20px);
                background: rgba(7, 7, 7, 0.6);

                ${() => {
                    return (
                        props.outline &&
                        css`
                            border: 1px solid #f5f5f5;

                            &:hover {
                                border: 1px solid #e0e0e0;
                            }
                        `
                    );
                }}

                ${() => {
                    return props?.active
                        ? css`
                              background: #ffffff;
                              svg,
                              img {
                                  filter: ${() =>
                                      props?.mode == "light"
                                          ? "invert(0)"
                                          : "invert(1)"} !important;
                                  -webkit-filter: ${() =>
                                      props?.mode == "light"
                                          ? "invert(0)"
                                          : "invert(1)"} !important;
                              }
                          `
                        : css`
                              &:hover {
                                  background: rgba(7, 7, 7, 0.8) !important;
                              }
                          `;
                }}
            `;
        } else if (props.outline) {
            return css`
                background: none;

                border: 1px solid #f5f5f5;

                &:hover {
                    background: #e0e0e0 !important;

                    border: 1px solid #e0e0e0;
                }
            `;
        } else if (props.immersed) {
            return css`
                background: rgba(7, 7, 7, 0.6);
                // backdrop-filter: blur(40px);

                border: 0px;

                &:hover {
                    background: #2e2e2c;
                }
            `;
        } else if (props?.isSubtract) {
            return css`
                background: transparent;
                border: none;
                outline: none;

                ${() => {
                    return props?.active
                        ? css`
                              svg,
                              img {
                                  filter: ${() =>
                                      props?.mode == "light"
                                          ? "invert(0)"
                                          : "invert(1)"} !important;
                                  -webkit-filter: ${() =>
                                      props?.mode == "light"
                                          ? "invert(0)"
                                          : "invert(1)"} !important;
                              }
                          `
                        : css``;
                }}

                svg,
                img {
                    margin-top: 0px !important;
                    margin-right: 1px !important;
                }

                // transition: .1s;
                // &:hover {
                //     filter: brightness(0.5);
                //     // background: rgba(0, 0, 0, 0.8);
                // }
            `;
        } else {
            return css`
                background: ${props?.isHalo
                    ? "rgba(0, 0, 0, 0.8)"
                    : "rgba(7, 7, 7, 0.6)"};

                border: ${props?.isHalo ? "0px" : "1px solid #474542"};

                &:hover {
                    background: #2e2e2c;
                }
            `;
        }
    }}

    &:disabled {
        border: 1px solid #f2f2f224;
        background: #f2f2f224;
    }

    &:focus {
        outline: none;
    }
`;
