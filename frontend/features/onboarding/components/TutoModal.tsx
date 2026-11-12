import React, { useState } from "react";
import styled from "styled-components";
import { motion } from "framer-motion";
import { classes, noop } from "@utils/js";
import { TutoModalProps } from "../types";
import IconImg from "@ui/components/IconImg";
import { useHotkey } from "@components/hooks/useHotkey";
import { RoundButton } from "@components/DesignSystem/buttons";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useOnboarding } from "../context/OnboardingContext";

export default function TutoModal({
    items = [],
    onNext = noop,
    className = "",
    arrowPosition = "left",
    ...rest
}: TutoModalProps) {
    //

    const { nextStudioTuto } = useOnboarding();

    const [currentItemIndex, setCurrentItemIndex] = useState(0);

    useHotkey(async (e: KeyboardEvent) => {
        //
        if (e.key === "Enter") {
            handleNext();
        }
    });

    function handleNext() {
        if (!isPagination || currentItemIndex + 1 === items?.length) {
            return onNext?.();
        } else {
            setCurrentItemIndex(currentItemIndex + 1);
        }
    }

    const nextItem = useEventCallback((event) => {
        event.stopPropagation();

        handleNext();
    }, []);

    const onMore = (e) => {
        e.stopPropagation();
        window.open(currentItem.href);
    };

    const isPagination = Array.isArray(items);

    const currentItem = isPagination ? items[currentItemIndex] : items;

    return (
        <Container>
            <motion.div
                className={classes({
                    "motion-wrapper": true,
                    [className]: className !== undefined,
                })}
                {...rest}
            >
                <div className={`arrow-indicator ${arrowPosition}`} />

                {currentItem?.img && (
                    <img src={currentItem?.img} className="cover" />
                )}

                <div>
                    <h3>{currentItem?.title ?? "Untitled"}</h3>
                    <span className="description">
                        {currentItem?.description ?? "No description"}
                    </span>
                </div>
                <div className="actions">
                    {isPagination && (
                        <span>
                            <strong>{currentItemIndex + 1}</strong>/
                            {items.length}
                        </span>
                    )}

                    <div
                        className={classes({
                            "full-width": !isPagination || !currentItem?.href,
                        })}
                    >
                        {currentItem?.href && (
                            <RoundButton
                                isLight={true}
                                className="more"
                                onClick={onMore}
                                style={{
                                    width: !isPagination ? "100%" : "auto",
                                }}
                            >
                                Learn More
                            </RoundButton>
                        )}

                        <RoundButton
                            isLight={true}
                            className="next"
                            onClick={nextItem}
                        >
                            Next
                            <div className="icon-wrapper">
                                <IconImg
                                    name="chevrons-left-line"
                                    size={8}
                                    mode="dark"
                                />
                            </div>
                        </RoundButton>
                    </div>
                </div>
            </motion.div>
        </Container>
    );
}

const Container = styled.div`
    //
    & > .motion-wrapper {
        position: absolute;
        border-radius: 8px;
        background: #1d1d1d;
        box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15);
        display: flex;
        padding: 0 0 5px 0;
        flex-direction: column;
        justify-content: space-between;

        .arrow-indicator {
            &.left {
                border-top: 10px solid transparent;
                border-right: 12px solid #1d1d1d;
                border-bottom: 10px solid transparent;
                position: absolute;
                left: -12px;
                top: 50px;
                padding: 0px;
            }

            &.bottom {
                position: absolute;
                bottom: -10px;
                padding: 0px;
                left: 50%;
                transform: translateX(-50%);
                border-left: 10px solid transparent;
                border-right: 10px solid transparent;
                border-top: 12px solid #1d1d1d;
            }

            &.top {
                position: absolute;
                top: -12px;
                padding: 0px;
                right: 50%;
                transform: translateX(-50%);
                border-left: 10px solid transparent;
                border-right: 10px solid transparent;
                border-bottom: 12px solid #1d1d1d;
            }

            &.right {
                border-top: 10px solid transparent;
                border-left: 12px solid #1d1d1d;
                border-bottom: 10px solid transparent;
                position: absolute;
                top: 45%;
                right: -12px;
                padding: 0px;
            }
        }

        max-height: 320px;

        & > .cover {
            width: 100%;
            height: 161px;
            object-fit: cover;
            border-top-right-radius: 8px;
            border-top-left-radius: 8px;
        }

        & > div:not(.arrow-indicator) {
            padding: 12px 24px;

            & > h3 {
                font-weight: 500;
                font-size: 14px;
                line-height: 28px;
                display: flex;
                align-items: center;
                /* Base/White */
                color: #ffffff;
                margin: 0;
            }

            & > span {
                font-weight: 400;
                font-size: 14px;
                line-height: 18px;
                color: #777980;
            }
        }

        & > .actions {
            display: flex;
            align-items: center;
            justify-content: space-between;

            & > span {
                font-weight: 400;
                font-size: 12px;
                line-height: 20px;
                color: #777980;

                & > strong {
                    color: #ffffff;
                    margin-right: 2px;
                }
            }

            & > div {
                display: flex;
                gap: 8px;
                align-items: center;
                justify-content: space-between;

                &.full-width {
                    width: 100%;
                    justify-content: flex-end;
                }

                & > button {
                    height: 34px;
                    display: flex;
                    align-items: center;
                    border-radius: 200px;
                    justify-content: center;

                    font-weight: 500;
                    font-size: 14px;
                    line-height: 24px;
                }

                & > .next {
                    width: 92px;

                    color: #070707;
                    background: #ffffff;
                    position: relative;
                    padding: 6px 3px 6px 24px;

                    & > .icon-wrapper {
                        width: 24px;
                        height: 24px;
                        border-radius: 999px;
                        margin-left: 10px;
                        background: #e0e0e0;
                        display: flex;
                        flex-direction: row;
                        align-items: center;
                        justify-content: center;
                    }
                }

                & > .more {
                    background: transparent;
                    border: 1px solid #3d3d3d;
                }
            }
        }
    }
`;
