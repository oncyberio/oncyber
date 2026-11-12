import { AI_ACTIONS } from "@features/ai/context/types";
import IconImg from "@ui/components/IconImg";
import ArrowRightCircle from "@ui/components/Icons/ArrowRightCircle";
import CtrlZ from "@ui/components/Icons/CtrlZ";
import EnterBg from "@ui/components/Icons/EnterBg";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import styled, { css } from "styled-components";

export default function SuggestionDisplay({
    selectedSuggestion,
    submitIntent,
    suggestionsWrapperRef,
    suggestions: _suggestions,
    state,
    dispatch,
    handleCallbackResponse,
}) {
    const { title, suggestions } = _suggestions;

    async function handleSelect(suggestion) {
        if (suggestion.onselect) {
            try {
                dispatch({ type: AI_ACTIONS.PROMPT_CALLBACK_LOADING });

                amplitude_logAnalyticsEvent("prompt_suggestion", {
                    id: state.prompt.id,
                    intent: state.prompt.intent,
                });

                const result = await suggestion.onselect({
                    prompt: state.prompt,
                    dispatch,
                    submitIntent,
                });

                if (title !== "QUICK ACTIONS") {
                    handleCallbackResponse({
                        response: result,
                        prompt: state.prompt,
                    });
                }
            } catch (err) {
                console.log(err);
            }
        }
    }

    function handleFocused(suggestions) {
        if (suggestions.onfocus) {
            suggestions.onfocus({
                prompt: state.prompt,
                dispatch,
                submitIntent,
            });
        }
    }

    function handleBlur(suggestions) {
        if (suggestions.onblur) {
            suggestions.onblur({
                prompt: state.prompt,
                dispatch,
                submitIntent,
            });
        }
    }

    return (
        <SuggestionsWrapper hasError={state.error} ref={suggestionsWrapperRef}>
            {title ? (
                <Title>
                    <div
                        style={
                            state.state === "feedbacks"
                                ? {
                                      color: "#fff",
                                      fontSize: 13,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                  }
                                : {}
                        }
                    >
                        {state.state === "feedbacks" ? (
                            <IconImg
                                size={16}
                                mode="light"
                                name="check-circle"
                            />
                        ) : null}
                        {title}
                    </div>
                    {state.state === "feedbacks" &&
                    !state.feedbacks.undoable ? (
                        <CTRLZWrapper>
                            <p>Press</p>
                            {/* <CtrlWrapper> */}
                            <CtrlZ
                                background="#3D3D3D"
                                foreground="#999999"
                                size={60}
                            />
                            {/* </CtrlWrapper> */}
                            <p>to UNDO</p>
                        </CTRLZWrapper>
                    ) : null}
                </Title>
            ) : null}

            {suggestions.map((suggestion, index) => {
                const { Component } = suggestion;

                const isSelected = index === selectedSuggestion;

                return (
                    <SuggestionWrapper
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleSelect(suggestion);
                            }
                        }}
                        onClick={() => handleSelect(suggestion)}
                        isSelected={isSelected}
                        key={index}
                        data-id={index}
                        onFocus={() => handleFocused(suggestion)}
                        onBlur={() => handleBlur(suggestion)}
                    >
                        {suggestion.text ? (
                            <TextWrapper>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                    }}
                                >
                                    <ArrowRightCircle
                                        size={18}
                                        fill={isSelected ? "#fff" : "#999999"}
                                        style={{ marginTop: 2 }}
                                    />
                                    <p>{suggestion.text}</p>
                                </div>
                                {isSelected ? (
                                    <EnterBg
                                        size={18}
                                        foreground="#292929"
                                        background="#fff"
                                    />
                                ) : null}
                            </TextWrapper>
                        ) : null}
                        {Component ? (
                            <Component isSelected={isSelected} />
                        ) : null}
                    </SuggestionWrapper>
                );
            })}
        </SuggestionsWrapper>
    );
}

const SuggestionsWrapper = styled.div<{
    hasError: boolean;
}>`
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    max-height: 180px;
    overflow-y: auto;

    ${({ hasError }) =>
        hasError &&
        css`
            max-height: calc(176px - 40px);
        `};

    &::-webkit-scrollbar-thumb {
        width: 8px;
        background: #00000085;
        border-radius: 8px;
    }

    &::-webkit-scrollbar {
        width: 8px;
        background: transparent;
    }
`;

const SuggestionWrapper = styled.button<{
    isSelected: boolean;
}>`
    padding: 12px;
    cursor: pointer;
    width: 100%;
    border: none;
    background: none;
    outline: none;
    color: #999999;

    &:focused {
        background: #303030;
    }

    transition: 0.2s all ease;

    &:hover {
        background: #303030;
    }

    p {
        margin: 0;
        text-align: left;
    }

    ${({ isSelected }) =>
        isSelected &&
        css`
            background: #3d3d3d;

            color: #ffffff;
        `};
`;

const Title = styled.div`
    color: #999999;
    padding: 0 12px;
    padding-top: 14px;
    padding-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;

    p {
        margin: 0;
    }
`;

const TextWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const CTRLZWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    svg {
        margin-top: 2px;
    }
`;

const CtrlWrapper = styled.div`
    position: relative;
    width: 60px;
    height: 20px;

    svg {
        position: absolute;
        top: 0;
        left: 0;
    }
`;
