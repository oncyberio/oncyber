import React, {
    useContext,
    useEffect,
    useReducer,
    useRef,
    useState,
} from "react";

import AIApi from "@api/ai/_api";

import shortid from "shortid";

import { useWorldState } from "@components/_3DExhibit-v2/hooks/useWorldState";

import { UserContext } from "../../../components/context/UserContext";

import AIStore from "../utils/AIStore";

import { amplitude_logAnalyticsEvent } from "@utils/analytics";

import history from "../utils/History";

import dynamic from "next/dynamic";

// The prompt bar (framer-motion and about 30 files) shows only for
// whitelisted studio users inside a space, so it loads only then.
const GPTInput = dynamic(() => import("../components/GPTInput"), {
    ssr: false,
});

import {
    defaultSuggestions,
    placeholderSuggestions,
    selectedAssetSuggestions,
} from "../suggestions";

import { AIContextActions, AIContextState, AI_ACTIONS, Intent } from "./types";

import { reducer } from "./reducer";

import { useRouter } from "next/router";

// Three-free modules: `three/constants` would pull the engine into this
// provider, which every page renders.
import { APP_STATES } from "@components/_3DExhibit-v2/three/shellconstants";
import { IS_MAC } from "@components/_3DExhibit-v2/three/device";

export const AIContext = React.createContext<{
    state: any;
    dispatch: React.Dispatch<AIContextActions>;
    isFocused: boolean;
    isShowing: boolean;
    isWhitelisted: boolean;
    toggle: () => void;
}>(null);

const nonGPTCommands = ["undo", "redo"];

const initialState: AIContextState = {
    prompt: {
        id: "",
        value: "",
        intent: null,
    },
    suggestions: defaultSuggestions,
    feedbacks: { title: "", suggestions: [] },
    state: "idle",
    error: "",
    progress: "",
};

export default function AIProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    const cleanErrorCallbackRef = useRef(null);

    const worldState = useWorldState();

    const [isShowing, setIsShowing] = useState(false);

    const [isFocused, setIsFocused] = useState(false);

    const { user } = useContext(UserContext);

    const inputRef = useRef<HTMLInputElement>(null);

    const router = useRouter();

    const [contextObj, setContextObj] = useState<{
        label?: string;
        placeholder?: string;
    }>({});

    useEffect(() => {
        AIStore.setContextCallback((context) => {
            if (context?.label == "Asset") {
                dispatch({
                    type: AI_ACTIONS.SET_SUGGESTIONS,
                    payload: {
                        suggestions: selectedAssetSuggestions,
                    },
                });
            } else if (context?.label == "Placeholder") {
                dispatch({
                    type: AI_ACTIONS.SET_SUGGESTIONS,
                    payload: {
                        suggestions: placeholderSuggestions,
                    },
                });
            } else {
                dispatch({
                    type: AI_ACTIONS.SET_SUGGESTIONS,
                    payload: {
                        suggestions: defaultSuggestions,
                    },
                });
            }
            setContextObj(context);
        });
    }, []);

    const [isWhitelisted, setIsWhitelisted] = useState(false);

    useEffect(() => {
        if (user.id && router.pathname.startsWith("/studio")) {
            AIApi.isWhitelisted({
                walletId: user.id,
            }).then((res) => {
                setIsWhitelisted(res.success);
                setIsShowing(res.success);
            });
            // setIsShowing(true);
        }
    }, [user.id, router.pathname]);

    useEffect(() => {
        function handleKeyDown(e) {
            const key = IS_MAC ? e.metaKey : e.ctrlKey;

            if (
                key &&
                (e.key === "i" || e.key === "I")
                // && whitelist[user.id]
            ) {
                e.preventDefault();

                setIsFocused((state) => !state);
            }
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            AIStore.clear();

            // if (cleanErrorCallbackRef.current) {
            //     clearTimeout(cleanErrorCallbackRef.current);
            // }

            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    function handleCallbackResponse({ response, prompt }) {
        if (!response?.success) {
            amplitude_logAnalyticsEvent("prompt_error", {
                ...(prompt.value && { prompt: prompt.value }),
                id: prompt.id,
                intent: prompt.intent,
            });
            console.log("[ AI EXECUSION ERROR ]", response);
            dispatch({
                type: AI_ACTIONS.SET_ERROR,
                payload: {
                    error: response?.message || "Failed to execute action",
                    type: response?.type || "error",
                },
            });

            return;
        }

        if (response.suggestions) {
            dispatch({
                type: AI_ACTIONS.SET_SUGGESTIONS,
                payload: {
                    suggestions: response.suggestions,
                },
            });
        } else if (response.feedbacks) {
            dispatch({
                type: AI_ACTIONS.SET_FEEDBACKS,
                payload: {
                    feedbacks: response.feedbacks,
                },
            });
        } else {
            dispatch({ type: AI_ACTIONS.RESET });
        }

        amplitude_logAnalyticsEvent("prompt_success", {
            ...(prompt.value && { prompt: prompt.value }),
            intent: prompt.intent,
            id: prompt,
        });
    }

    async function handleRunIntent({ prompt, intentDataList, id }) {
        //* need to skip await if list is length 1
        for (const intentData of intentDataList) {
            const { intent } = intentData;
            if (AIStore.callbacks[intent.toLowerCase()]) {
                dispatch({ type: AI_ACTIONS.PROMPT_CALLBACK_LOADING });

                const actionResponse = await AIStore.callbacks[intent]({
                    ...intentData,
                    dispatch,
                    // executeAsync: intentDataList.length == 1,
                    executeAsync: false,
                });
                handleCallbackResponse({
                    response: actionResponse,
                    prompt: {
                        id,
                        intent: intentData,
                        value: prompt,
                    },
                });
            } else {
                amplitude_logAnalyticsEvent("prompt_error", {
                    prompt: prompt,
                    intent: intentData,
                    message: "Action not supported for the moment",
                    id,
                });

                dispatch({
                    type: AI_ACTIONS.SET_ERROR,
                    payload: {
                        error: "Action not supported for the moment",
                    },
                });
                return;
            }
        }
    }

    async function submitIntent(_prompt: string = "") {
        const sPrompt = _prompt.trim() || state.prompt.value;

        if (!sPrompt) {
            dispatch({
                type: AI_ACTIONS.SET_ERROR,
                payload: {
                    error: "Field cannot be empty",
                },
            });

            return;
        }

        if (sPrompt) {
            try {
                const id = shortid.generate();

                dispatch({
                    type: AI_ACTIONS.SUBMIT_PROMPT_LOADING,
                    payload: {
                        id,
                        prompt: {
                            value: sPrompt,
                        },
                    },
                });

                history.push(sPrompt);

                amplitude_logAnalyticsEvent("prompt_submit", {
                    prompt: sPrompt,
                    id,
                });

                if (nonGPTCommands.includes(sPrompt.trim().toLowerCase())) {
                    await handleRunIntent({
                        prompt: sPrompt,
                        id,
                        intentDataList: {
                            intent: sPrompt,
                        },
                    });

                    return;
                }

                let response;

                try {
                    response = {
                        success: true,
                        data: [JSON.parse(sPrompt)],
                    };
                } catch (err) {
                    console.log("[AI CONTEXT ERROR]", err);

                    response = await AIApi.opts({
                        timeout: 15000,
                    }).getIntent({
                        text: sPrompt,
                        prompt: (window.prompt as any as string) || "",
                    });
                }

                console.log("[AI CONTEXT RESPONSE]", response);

                dispatch({
                    type: AI_ACTIONS.SUBMIT_PROMPT_SUCCESS,
                    payload: {
                        prompt: {
                            intent: response.data,
                        },
                    },
                });
                if (response.success) {
                    await handleRunIntent({
                        prompt: sPrompt,
                        intentDataList: response.data,
                        id,
                    });
                } else {
                    amplitude_logAnalyticsEvent("prompt_error", {
                        prompt: sPrompt,
                        message: response.message || "Failed to fetch intent",
                        id,
                    });

                    dispatch({
                        type: AI_ACTIONS.SET_ERROR,
                        payload: {
                            error: "Failed to detect action.",
                        },
                    });
                }

                // setIsExecutingCommand(false);
            } catch (err) {
                console.log(err);

                dispatch({
                    type: AI_ACTIONS.SET_ERROR,
                    payload: {
                        error: "Failed to execute prompt",
                    },
                });
            } finally {
                setTimeout(() => {
                    inputRef.current?.focus();
                }, 100);
            }
        }
    }

    function toggle() {
        //
        if (!isWhitelisted) return;

        setIsShowing((state) => !state);
    }

    const hasSpace =
        worldState.hasSpace && worldState.state === APP_STATES.SPACE;

    const value = {
        state,
        dispatch,
        isFocused,
        isShowing,
        isWhitelisted,
        toggle,
    };

    const props = {
        state,
        submitIntent,
        isShowing,
        setIsShowing,
        isWhitelisted,
        isFocused,
        setIsFocused,
        inputRef,
        dispatch,
        handleCallbackResponse,
    };

    return (
        <AIContext.Provider value={value}>
            {isShowing && hasSpace ? (
                <GPTInput {...props} contextObj={contextObj} />
            ) : null}
            {children}
        </AIContext.Provider>
    );
}

export function useAI(opts: {
    [callbackName: string]: (
        opts: Intent & { dispatch: React.Dispatch<AIContextActions> }
    ) => Promise<any>;
}) {
    const context = useContext(AIContext);

    useEffect(() => {
        AIStore.addCallbacks(opts);

        return () => {
            AIStore.removeCallbacks(opts);
        };
    }, [opts]);

    if (context === undefined) {
        throw new Error("useAIContext must be used within FeedProvider");
    }

    return context;
}
