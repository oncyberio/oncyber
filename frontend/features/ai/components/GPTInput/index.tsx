import styled, { css } from "styled-components";

import { Button } from "../shared";

import Spinner from "@ui/components/Spinner";

import Enter from "@ui/components/Icons/Enter";

import Stars from "@ui/components/Icons/Stars";

import Whisper from "../Whisper";

import { useEffect, useRef, useState } from "react";

import history from "../../utils/History";

import Suggestions from "./Suggestions";

import { useOnClickOutside } from "@components/hooks/useClickOutside";

import { motion } from "framer-motion";
import { AI_ACTIONS } from "@features/ai/context/types";
import { useMediaQuery } from "@components/hooks/useMediaQuery";
import EnterBg from "@ui/components/Icons/EnterBg";
import ControlL from "@ui/components/Icons/ControlL";
import AIStore from "../../utils/AIStore";
import IconImg from "@ui/components/IconImg";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import Events from "@3events";
import Emitter from "@3emitter";
import ComposerTuto from "@features/onboarding/Studio/Tuto/Composer";

export default function GPTInput({
    state,
    submitIntent,
    isFocused,
    setIsFocused,
    dispatch,
    inputRef,
    handleCallbackResponse,
    contextObj,
}) {
    const [selectedSuggestion, setSelectedSuggestion] = useState(-1);

    const suggestionsWrapperRef = useRef(null);

    const isSuggestionsDisplayed =
        state.state === "feedbacks" ||
        state.state === "suggestions" ||
        state.state === "idle" ||
        state.state === "error";

    const currentSuggestions =
        state.state === "feedbacks" ? state.feedbacks : state.suggestions;

    const [hasEnteredSuggestions, setHasEnteredSuggestions] = useState(false);

    const isMobile = useMediaQuery("(max-width: 480px)");

    const { clickRef } = useOnClickOutside({
        handler: () => {
            close();
        },
    });

    // const isFocused = true;

    // const setIsFocused = (t) => {};

    useEffect(() => {
        if (isFocused) {
            setTimeout(() => {
                inputRef.current.focus();
            }, 100);
        } else {
            inputRef.current.blur();
        }
    }, [isFocused]);

    function close() {
        setIsFocused(false);

        setSelectedSuggestion(-1);
    }

    function handleUp() {
        if (
            currentSuggestions.suggestions.length > 0 &&
            selectedSuggestion !== -1 &&
            isSuggestionsDisplayed
        ) {
            setSelectedSuggestion((state) => {
                const newState = state === -1 ? -1 : state - 1;

                if (newState === -1) {
                    inputRef.current.focus();

                    dispatch({
                        type: AI_ACTIONS.CHANGE_PROMPT_VALUE,
                        payload: {
                            value: "",
                        },
                    });

                    setHasEnteredSuggestions(false);

                    return -1;
                }

                const el = suggestionsWrapperRef.current.querySelector(
                    `[data-id="${newState}"]`
                );

                console.log("newState up", newState);

                if (el) el.focus();

                return newState;
            });

            return;
        }

        dispatch({
            type: AI_ACTIONS.CHANGE_PROMPT_VALUE,
            payload: {
                value: history.up(),
            },
        });
    }

    function handleDown() {
        if (
            currentSuggestions.suggestions.length > 0 &&
            isSuggestionsDisplayed &&
            history.currentIndex >= history.history.length - 1 &&
            (hasEnteredSuggestions || !state.prompt.value)
        ) {
            setHasEnteredSuggestions(true);

            setSelectedSuggestion((state) => {
                const newState =
                    state === currentSuggestions.suggestions.length - 1
                        ? 0
                        : state + 1;

                const el = suggestionsWrapperRef.current.querySelector(
                    `[data-id="${newState}"]`
                );

                if (el) {
                    el.focus();
                }

                console.log("newState down", newState);
                return newState;
            });

            return;
        }

        const downVal = history.down();

        dispatch({
            type: AI_ACTIONS.CHANGE_PROMPT_VALUE,
            payload: {
                value: downVal,
            },
        });

        setHasEnteredSuggestions(!downVal);
    }

    function handleKeyPress(e: React.KeyboardEvent) {
        if (
            e.key === "Escape" ||
            e.key === "ArrowDown" ||
            e.key === "ArrowUp"
        ) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (e.key === "Escape") {
            setTimeout(() => {
                inputRef.current?.blur();
            }, 100);

            close();

            return;
        }

        if (e.key === "ArrowDown") {
            handleDown();
            return;
        }

        if (e.key === "ArrowUp") {
            handleUp();
            return;
        }

        if (
            e.target === inputRef.current &&
            e.key === "Enter" &&
            state.prompt.value &&
            state.state !== "loading"
        ) {
            submitIntent().then(() => {
                setTimeout(() => {
                    inputRef.current?.focus();
                }, 500);
            });

            return;
        }

        //! is is not hiding gizmos & green effect on placeholder
        if (
            e.target === inputRef.current &&
            e.key === "Backspace" &&
            !state.prompt.value &&
            state.state !== "loading"
        ) {
            AIStore.callbacks?.["unselect"]?.();
            return;
        }
    }

    return (
        <>
            {contextObj?.label === "" && isFocused && <ViewBox></ViewBox>}
            <Container
                ref={clickRef}
                onKeyDown={handleKeyPress}
                // use translate instead of top
                animate={{
                    opacity: 1,
                    bottom: isFocused ? 236 + "px" : "8px",
                }}
                transition={{ duration: 0.2 }}
            >
                {/* <ComposerTuto /> */}

                <InputWrapper isFocused={isFocused}>
                    {!contextObj?.label && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Stars fill="#ffffff" name="stars" size={17} />
                        </div>
                    )}
                    {contextObj?.label && (
                        <ContextText>
                            <div>{contextObj?.label}</div>
                            <IconImg name="terminal-end" size={13} />
                        </ContextText>
                    )}
                    <Input
                        id="gpt-input"
                        autoComplete="off"
                        onFocus={() => {
                            setSelectedSuggestion(-1);
                            setHasEnteredSuggestions(false);
                            setIsFocused(true);
                        }}
                        // onBlur={}
                        disabled={state.state === "loading"}
                        value={state.prompt.value}
                        // onKeyDown={handleKeyPress}
                        onChange={(e) => {
                            if (state.state === "feedbacks")
                                dispatch({
                                    type: AI_ACTIONS.RESET,
                                });

                            history.reset();

                            dispatch({
                                type: AI_ACTIONS.CHANGE_PROMPT_VALUE,
                                payload: {
                                    value: e.target.value,
                                },
                            });
                        }}
                        placeholder={
                            contextObj?.placeholder ||
                            "Type for Magic Composer (beta)"
                        }
                        ref={inputRef}
                    />
                    {state.state === "loading" ? (
                        <Spinner width={24} />
                    ) : isFocused ? (
                        <>
                            <Button
                                disabled={state.state === "loading"}
                                // onClick={submitIntent}
                                onClick={() => submitIntent(state.prompt.value)}
                            >
                                {/* <Play fill="#1e1e1e" /> */}
                                <EnterBg
                                    size={20}
                                    background="#3D3D3D"
                                    foreground="#999999"
                                />
                            </Button>
                            {/* <Whisper
                            prompt={state.prompt}
                            submitIntent={submitIntent}
                            dispatch={dispatch}
                        /> */}
                        </>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                            }}
                            onClick={() => setIsFocused(true)}
                        >
                            <ControlL
                                background="#3D3D3D"
                                foreground="#999999"
                                size={60}
                            />
                        </div>
                    )}
                </InputWrapper>

                {isFocused ? (
                    <Suggestions
                        dispatch={dispatch}
                        inputRef={inputRef}
                        suggestionsWrapperRef={suggestionsWrapperRef}
                        selectedSuggestion={selectedSuggestion}
                        submitIntent={submitIntent}
                        state={state}
                        handleCallbackResponse={handleCallbackResponse}
                    />
                ) : null}
            </Container>
        </>
    );
}

const ContextText = styled(motion.div)<{}>`
    width: min-content;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    white-space: pre;
    margin-right: -6px;
    font-weight: 500;
    background: #3d3d3d;
    border-radius: 4px;
    padding: 4px 8px;
    user-select: none;

    & > * {
        margin-bottom: 4px;
    }
`;

const ViewBox = styled.div`
    position: fixed;
    width: calc(100% - 60px);
    height: calc(100% - 60px);
    left: 0;
    top: 0;
    z-index: 1;
    margin: 30px;
    border-radius: 17px;
    border: 5px dashed #1e1e1e;
    opacity: 0.3;
    pointer-events: none;
`;

const Container = styled(motion.div)<{}>`
    position: fixed;
    left: 50%;
    // background: #1e1e1e;
    box-shadow: 0px 2px 15px rgb(0 0 0 / 50%);
    border-radius: 6px;
    gap: 6px;
    color: #ffffff;
    transform: translateX(-50%);
    font-size: 14px;
    width: 450px;
    z-index: 1000;
    opacity: 0;
    // top: 100%;
    bottom: 0;

    @media (max-width: 600px) {
        display: none;
    }

    @media (max-width: 480px) {
        width: 95%;
    }
`;

const InputWrapper = styled.div<{
    isFocused: boolean;
}>`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    border-radius: 6px;
    padding: 8px 12px;

    background-color: var(--world-builder-bg);
    -webkit-backdrop-filter: blur(5px);
    backdrop-filter: blur(5px);

    ${({ isFocused }) =>
        isFocused &&
        css`
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
        `}
`;

const Input = styled.input`
    border: none;
    padding: 7px 8px;
    border-radius: 6px;
    color: #ffffff;
    outline: none;
    background: transparent;
    width: 100%;
`;

const ChoicesWrapper = styled.div`
    font-size: 14px;
`;
