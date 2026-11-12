import { AI_ACTIONS } from "@features/ai/context/types";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import styled from "styled-components";

export default function Feedback({ state, dispatch, inputRef }) {
    return (
        <FeedbackWrapper>
            <p>Help us improve! Did it work?</p>
            <ThumbsWrapper>
                <div
                    onClick={() => {
                        amplitude_logAnalyticsEvent("prompt_feedback", {
                            id: state.prompt.id,
                            thumb: "up",
                            intent: state.prompt.intent,
                        });

                        dispatch({
                            type: AI_ACTIONS.RESET,
                        });

                        setTimeout(() => {
                            inputRef.current.focus();
                        }, 100);
                    }}
                >
                    👍🏻
                </div>
                <div
                    onClick={() => {
                        amplitude_logAnalyticsEvent("prompt_feedback", {
                            id: state.prompt.id,
                            thumb: "down",
                            intent: state.prompt.intent,
                        });

                        dispatch({ type: AI_ACTIONS.RESET });

                        setTimeout(() => {
                            inputRef.current.focus();
                        }, 100);
                    }}
                >
                    👎🏻
                </div>
            </ThumbsWrapper>
        </FeedbackWrapper>
    );
}

const FeedbackWrapper = styled.div`
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;

    p {
        margin: 0;
    }
`;

const ThumbsWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;

    div {
        cursor: pointer;
    }
`;
