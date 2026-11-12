import { defaultSuggestions } from "../suggestions";

import { AIContextActions, AIContextState, AI_ACTIONS } from "./types";

export function reducer(
    state: AIContextState,
    action: AIContextActions
): AIContextState {
    switch (action.type) {
        case AI_ACTIONS.CHANGE_PROMPT_VALUE:
            return {
                ...state,
                error: "",
                prompt: {
                    id: "",
                    intent: null,
                    value: action.payload.value,
                },
            };
        case AI_ACTIONS.SUBMIT_PROMPT_LOADING:
            return {
                ...state,
                progress: "Executing command…",
                error: "",
                state: "loading",
                prompt: {
                    ...state.prompt,
                    id: action.payload.id,
                    value: action.payload.prompt.value || state.prompt.value,
                },
            };
        case AI_ACTIONS.SUBMIT_PROMPT_SUCCESS:
            return {
                ...state,
                prompt: {
                    ...state.prompt,
                    intent: action.payload.prompt.intent,
                },
            };
        case AI_ACTIONS.PROMPT_CALLBACK_LOADING:
            return {
                ...state,
                error: "",
                progress: "Executing command…",
                state: "loading",
            };
        case AI_ACTIONS.SET_SUGGESTIONS:
            return {
                ...state,
                error: "",
                suggestions: action.payload.suggestions || defaultSuggestions,
                state: "suggestions",
                progress: "",
                prompt: {
                    ...state.prompt,
                    value: "",
                },
            };
        case AI_ACTIONS.SET_FEEDBACKS:
            return {
                ...state,
                error: "",
                feedbacks: action.payload.feedbacks || {
                    title: "",
                    suggestions: [],
                },
                state: "feedbacks",
                progress: "",
                prompt: {
                    ...state.prompt,
                    value: "",
                },
            };
        case AI_ACTIONS.SUBMIT_WHISPER_LOADING:
            return {
                ...state,
                error: "",
                progress: "Processing your command…",
            };
        case AI_ACTIONS.SUBMIT_WHISPER_SUCCESS:
            return {
                ...state,
                error: "",
                progress: "Command proccessed successfully!",
                prompt: {
                    ...state.prompt,
                    value: action.payload.prompt.value,
                },
            };
        case AI_ACTIONS.SET_ERROR:
            return {
                ...state,
                progress: "",
                suggestions: defaultSuggestions,
                feedbacks: { title: "", suggestions: [] },
                error: action.payload.error,
                type: action.payload?.type || "error",
                state: "error",
            };
        case AI_ACTIONS.RESET:
            return {
                ...state,
                suggestions: defaultSuggestions,
                feedbacks: { title: "", suggestions: [] },
                progress: "",
                error: "",
                state: "idle",
                prompt: {
                    id: "",
                    intent: null,
                    value: "",
                },
            };
        default:
            return state;
    }
}
