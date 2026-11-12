import { asConst } from "@utils/js";

export type IntentAssetTypes =
    | "all"
    | "website"
    | "image"
    | "video"
    | "youtube"
    | "audio"
    | "text"
    | "model"
    | "glb"
    | "artwork"
    | "portal";

export type IntentScope =
    | "all"
    | "closest"
    | "in_front"
    | "closest_in_front"
    | "prev_context"
    | "random"
    | "walls"
    | "selected";

export type TIntentFilter = {
    name?: string;
    creator?: string;
    type?: IntentAssetTypes;
    creator_name?: string;
    blockchain?: string;
};

export type TSuggestions = {
    title: string;
    suggestions: Array<{
        id: string;
        text: string;
        Component?: React.FC;
        onfocus?: (props: any) => void;
        onselect?: (props: any) => void;
        onblur?: (props: any) => void;
    }>;
};

export interface TPrompt {
    id: string;
    value: string;
    intent: Intent;
}

export interface Intent {
    intent: string;
    scope?: IntentScope;
    type?: IntentAssetTypes;
    text?: string; // "hang_text"
    exhibitId?: string; // "hang_portal"
    filter?: TIntentFilter;
    frameColor?: "none" | "transparent" | string; // hang_frame
    size?: number; // change_size
    count?: number;
}

export interface AIContextState {
    prompt: TPrompt;
    suggestions: TSuggestions;
    feedbacks: TSuggestions & { undoable?: boolean };
    state:
        | "success"
        | "error"
        | "loading"
        | "idle"
        | "feedbacks"
        | "suggestions";
    error: string;
    type?: string;
    progress: string;
}

export const AI_ACTIONS = {
    SET_SUGGESTIONS: asConst("SET_SUGGESTIONS"),
    SET_FEEDBACKS: asConst("SET_FEEDBACKS"),
    SET_ERROR: asConst("SET_ERROR"),
    SUBMIT_PROMPT_LOADING: asConst("SUBMIT_PROMPT_LOADING"),
    SUBMIT_PROMPT_SUCCESS: asConst("SUBMIT_PROMPT_SUCCESS"),
    PROMPT_PROGRESS: asConst("PROMPT_PROGRESS"),
    CHANGE_PROMPT_VALUE: asConst("CHANGE_PROMPT_VALUE"),
    PROMPT_CALLBACK_LOADING: asConst("PROMPT_CALLBACK_LOADING"),
    RESET: asConst("RESET"),
    SUBMIT_WHISPER_LOADING: asConst("SUBMIT_WHISPER_LOADING"),
    SUBMIT_WHISPER_SUCCESS: asConst("SUBMIT_WHISPER_SUCCESS"),
};

export type AIContextActions =
    | {
          type: typeof AI_ACTIONS.SET_SUGGESTIONS;
          payload: { suggestions?: AIContextState["suggestions"] };
      }
    | {
          type: typeof AI_ACTIONS.SET_FEEDBACKS;
          payload: { feedbacks?: AIContextState["feedbacks"] };
      }
    | { type: typeof AI_ACTIONS.SET_ERROR; payload: { error: string, type?:string } }
    | {
          type: typeof AI_ACTIONS.SUBMIT_PROMPT_LOADING;
          payload: { prompt: Partial<TPrompt>; id: string };
      }
    | {
          type: typeof AI_ACTIONS.PROMPT_PROGRESS;
          payload: { progress: string };
      }
    | {
          type: typeof AI_ACTIONS.CHANGE_PROMPT_VALUE;
          payload: { value: string };
      }
    | {
          type: typeof AI_ACTIONS.PROMPT_CALLBACK_LOADING;
      }
    | {
          type: typeof AI_ACTIONS.RESET;
      }
    | {
          type: typeof AI_ACTIONS.SUBMIT_PROMPT_SUCCESS;
          payload: { prompt: { intent: Intent } };
      }
    | {
          type: typeof AI_ACTIONS.SUBMIT_WHISPER_LOADING;
      }
    | {
          type: typeof AI_ACTIONS.SUBMIT_WHISPER_SUCCESS;
          payload: { prompt: { value: string } };
      };
