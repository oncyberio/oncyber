import Enter from "@ui/components/Icons/Enter";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import { useState } from "react";

import styled, { css } from "styled-components";

import Spinner from "@ui/components/Spinner";

import SuggestionDisplay from "./SuggestionDisplay";

import { motion } from "framer-motion";

import { AI_ACTIONS } from "@features/ai/context/types";

import SArrowUp from "@ui/components/Icons/SArrowUp";

import SArrowDown from "@ui/components/Icons/SArrowDown";

import Escape from "@ui/components/Icons/Escape";

import EnterBg from "@ui/components/Icons/EnterBg";

import Feedback from "./Feedback";

const tip = "💡 Tip: if you don't like the result, press CTRL+Z to undo.";

export default function Suggestions({
    dispatch,
    inputRef,
    suggestionsWrapperRef,
    selectedSuggestion,
    submitIntent,
    state,
    handleCallbackResponse,
}) {
    return (
        <Container animate={{ opacity: 1, top: "100%" }}>
            <Divider />
            <Body>
                <>
                    {state.progress ? (
                        <ProgressWrapper>
                            <Spinner stroke="#a5a5a5" width={16} />
                            <p>{state.progress}</p>
                        </ProgressWrapper>
                    ) : null}

                    {state.error ? (
                        state?.type === "notfound" ? (
                            <TipWrapper
                                error={state.error}
                            >
                                {state.error ? "❔ " + state.error : null}
                            </TipWrapper>
                        ): (
                            <TipWrapper
                                // style={{ textAlign: "center" }}
                                error={state.error}
                            >
                                {state.error ? "⚠️ " + state.error : null}
                            </TipWrapper>
                        )
                    ) : null}

                    {state.state === "suggestions" ||
                    state.state === "idle" ||
                    state.state === "error" ? (
                        <SuggestionDisplay
                            selectedSuggestion={selectedSuggestion}
                            submitIntent={submitIntent}
                            suggestionsWrapperRef={suggestionsWrapperRef}
                            suggestions={state.suggestions}
                            dispatch={dispatch}
                            state={state}
                            handleCallbackResponse={handleCallbackResponse}
                        />
                    ) : null}

                    {state.state === "feedbacks" ? (
                        <SuggestionDisplay
                            selectedSuggestion={selectedSuggestion}
                            submitIntent={submitIntent}
                            suggestionsWrapperRef={suggestionsWrapperRef}
                            suggestions={state.feedbacks}
                            dispatch={dispatch}
                            state={state}
                            handleCallbackResponse={handleCallbackResponse}
                        />
                    ) : null}
                </>
            </Body>

            <Footer>
                <TipsWrapper>
                    {state.state !== "success" &&
                    state.state !== "feedbacks" ? (
                        <>
                            <STipWrapper>
                                <p>Enter</p>
                                <EnterBg
                                    size={18}
                                    background="#3D3D3D"
                                    foreground="#999999"
                                />
                                <p>to select</p>
                            </STipWrapper>

                            <STipWrapper>
                                <p>Arrows</p>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                    }}
                                >
                                    <SArrowUp
                                        size={17}
                                        background="#3D3D3D"
                                        foreground="#999999"
                                    />
                                    <SArrowDown
                                        size={17}
                                        background="#3D3D3D"
                                        foreground="#999999"
                                    />
                                </div>
                                <p>for prompts</p>
                            </STipWrapper>
                        </>
                    ) : (
                        <Feedback
                            state={state}
                            dispatch={dispatch}
                            inputRef={inputRef}
                        />
                    )}

                    <STipWrapper>
                        <p>Escape</p>
                        <Escape
                            style={{ marginRight: 2 }}
                            size={24}
                            background="#3D3D3D"
                            foreground="#999999"
                        />
                        <p>to close</p>
                    </STipWrapper>
                </TipsWrapper>
            </Footer>
        </Container>
    );
}

const Container = styled(motion.div)`
    position: absolute;
    top: 50%;
    width: 100%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999;
    opacity: 0;
    background-color: #1e1e1e;
    -webkit-backdrop-filter: blur(5px);
    backdrop-filter: blur(5px);
    overflow: hidden;
    border-bottom-left-radius: 6px;
    border-bottom-right-radius: 6px;
    // width: 390px;
    // max-height: 116px;
`;

// const ScrollWrapper = styled.div`
//     position: relative;
//     height: 100%;

// `;

const ProgressWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 13px;
    color: #a5a5a5;

    p {
        margin: 8px 0;
    }
`;

const TipWrapper = styled.p<{ error: string, color?: string }>`
    font-size: 13px;
    margin: 0;
    color: #d6d1d1;
    padding: 12px;

    ${({ error }) =>
        error &&
        css`
            color: #ff380b;
        `};
    
    ${({ color }) =>
        color === "orange" &&
        css`
            color: #FFD200;
        `};

`;

const Body = styled.div``;

const Footer = styled.div`
    background: rgba(0, 0, 0, 0.2);
    -webkit-backdrop-filter: blur(5px);
    backdrop-filter: blur(5px);

    border-bottom-left-radius: 8.4375px;
    border-bottom-right-radius: 8.4375px;

    color: #b4b4b4;
    font-size: 12px;

    // position: sticky;
    // bottom: 0;

    p {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
    }
`;

const TipsWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
    padding: 12px;
`;

const Divider = styled.div`
    width: 95%;
    height: 1px;
    background: #292929;
    margin: 0 auto;
`;

const STipWrapper = styled.div`
    display: flex;
    gap: 3px;
    align-items: center;

    p {
        font-size: 11px;
        font-weight: 500;
        color: #7a7a7a;
    }
`;
