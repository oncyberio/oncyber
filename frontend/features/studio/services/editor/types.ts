//
import type Api from "@components/_3DExhibit-v2/three/api";
import type { EDITOR_ACTION } from "@components/_3DExhibit-v2/three/factory/editor/actions";
import type { ExhibitStore } from "../ExhibitStore";

export interface ExhibitCommandContext {
    world: Api;
    userId: string;
    isAnonymous: boolean;
    token: string;
    exhibitStore: ExhibitStore;
}

export interface ExhibitCommand {
    state: CommandState;
    get editorAction(): EDITOR_ACTION;
    run: () => Promise<void>;
}

export interface UserState {
    userId: string;
    token: string;
}

export type CommandState =
    | { type: "Idle" }
    | { type: "Submitting" }
    | { type: "Success"; data?: any }
    | { type: "Error"; error: string };

export type CommandSubmitStep = "3d" | "db" | "upload";
