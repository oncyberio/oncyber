/**
 * What the page knows about the world scripts of the space on show, shared
 * by the layer that runs them, the dock's AI button and the AI sidebar. A
 * tiny external store, so none of them has to be inside another's tree.
 */
import { useSyncExternalStore } from "react";
import type { HudCorner, WorldScriptRecord } from "./protocol";
import type { SwapMode, WorldScriptStatus } from "./host";
import { cleanStyle, type WorldStyle } from "./style";

export const WORLD_SCRIPTS_ENABLED = ["1", "true", "on"].includes(
    String(process.env.NEXT_PUBLIC_WORLD_SCRIPTS || "").toLowerCase()
);

/** One line of the sidebar's conversation. */
export interface TranscriptEntry {
    id: number;
    kind: "you" | "step" | "say" | "error";
    text: string;
    /** A step still under way shows a spinner. */
    state?: "running" | "done" | "failed";
    at: number;
}

export interface WorldScriptsState {
    experienceId: string | null;
    /** The saved script (one per space for now). */
    script: WorldScriptRecord | null;
    /** What runs now, which may be a live edit not saved yet. */
    source: string;
    /** The world's creative direction, once it has one. */
    style: WorldStyle | null;
    status: WorldScriptStatus;
    canEdit: boolean;
    canAsk: boolean;
    /** On the early-access list: the AI sidebar is offered to these only. */
    earlyAccess: boolean;
    askReason: string;
    remaining: number | null;
    busy: boolean;
    panelOpen: boolean;
    transcript: TranscriptEntry[];
    logs: { level: "log" | "warn" | "error"; text: string; at: number }[];
    hud: Record<string, { text: string; corner: HudCorner }>;
    toasts: { id: number; text: string; until: number }[];
    banner: { text: string; until: number } | null;
}

const initial: WorldScriptsState = {
    experienceId: null,
    script: null,
    source: "",
    style: null,
    status: { state: "idle" },
    canEdit: false,
    canAsk: false,
    earlyAccess: false,
    askReason: "",
    remaining: null,
    busy: false,
    panelOpen: false,
    transcript: [],
    logs: [],
    hud: {},
    toasts: [],
    banner: null,
};

/** The script a space starts with, and its style. */
export function savedScript(space: {
    worldScripts?: WorldScriptRecord[];
    worldStyle?: unknown;
}) {
    return {
        script: space.worldScripts?.[0] || null,
        source:
            (space.worldScripts || []).find((script) => script.enabled)
                ?.source || "",
        style: cleanStyle(space.worldStyle),
    };
}

/**
 * Whether this visitor is offered the AI sidebar: an editor of the space
 * who is on the early-access list. The server checks both again on every
 * request.
 */
export function offersAiSidebar(state: {
    canEdit: boolean;
    earlyAccess: boolean;
}) {
    return state.canEdit && state.earlyAccess;
}

let state = initial;
const listeners = new Set<() => void>();

export function getWorldScripts() {
    return state;
}

export function setWorldScripts(
    patch:
        | Partial<WorldScriptsState>
        | ((current: WorldScriptsState) => Partial<WorldScriptsState>)
) {
    const next = typeof patch === "function" ? patch(state) : patch;
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
}

export function resetWorldScripts() {
    state = initial;
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useWorldScripts() {
    return useSyncExternalStore(subscribe, getWorldScripts, () => initial);
}

let entryCount = 0;

/** Adds a line to the conversation and returns its id (to update a step). */
export function say(
    kind: TranscriptEntry["kind"],
    text: string,
    stepState?: TranscriptEntry["state"]
) {
    const id = ++entryCount;
    setWorldScripts((current) => ({
        transcript: [
            ...current.transcript,
            { id, kind, text, state: stepState, at: Date.now() },
        ].slice(-200),
    }));
    return id;
}

export function updateEntry(
    id: number,
    patch: Partial<Pick<TranscriptEntry, "text" | "state">>
) {
    setWorldScripts((current) => ({
        transcript: current.transcript.map((entry) =>
            entry.id === id ? { ...entry, ...patch } : entry
        ),
    }));
}

export function addLog(level: "log" | "warn" | "error", text: string) {
    setWorldScripts((current) => ({
        logs: [...current.logs, { level, text, at: Date.now() }].slice(-80),
    }));
}

/** Set by the running layer: the actions the sidebar calls. */
export interface WorldScriptsController {
    ask(request: string): Promise<void>;
    run(source: string, mode?: SwapMode): Promise<boolean>;
    restart(): void;
    stop(): void;
    undo(): Promise<void>;
    save(script: Partial<WorldScriptRecord>): Promise<boolean>;
    setStyle(style: WorldStyle): Promise<void>;
}

let controller: WorldScriptsController | null = null;
export function setWorldScriptsController(next: WorldScriptsController | null) {
    controller = next;
}
export function worldScriptsController() {
    return controller;
}
