/**
 * What the page knows about the world scripts of the space on show, shared
 * by the layer that runs them, the dock's AI button and the AI sidebar. A
 * tiny external store, so none of them has to be inside another's tree.
 *
 * What a script shows on screen (HUD lines, toasts, a banner) is a second
 * store beside it: it can change every frame, and only the layer that
 * draws it should hear of that.
 */
import { useSyncExternalStore } from "react";
import type { HudCorner, WorldScriptRecord } from "./protocol";
import type { SwapMode, WorldScriptStatus } from "./host";
import { firstLine, flagOn } from "./basics";
import { cleanStyle, type WorldStyle } from "./style";

export const WORLD_SCRIPTS_ENABLED = flagOn(
    process.env.NEXT_PUBLIC_WORLD_SCRIPTS
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
}

/** What the running script shows on screen. */
export interface WorldScriptScreen {
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
};

const blankScreen: WorldScriptScreen = { hud: {}, toasts: [], banner: null };

/**
 * What this page last saved for a space. The space it was given at load is
 * older than that after an edit, and is what the layer is handed again when
 * the visitor comes back from another space without a reload.
 */
const lastSaved = new Map<
    string,
    { scripts: WorldScriptRecord[]; style?: WorldStyle }
>();

const newest = (scripts: WorldScriptRecord[] = []) =>
    Math.max(0, ...scripts.map((script) => Number(script.updatedAt) || 0));

export function rememberSaved(
    spaceId: string,
    scripts: WorldScriptRecord[] | null | undefined,
    style?: WorldStyle | null
) {
    const known = lastSaved.get(spaceId);
    lastSaved.set(spaceId, {
        scripts: scripts || known?.scripts || [],
        style: style || known?.style,
    });
}

/** The script a space starts with, and its style. */
export function savedScript(space: {
    id?: string;
    worldScripts?: WorldScriptRecord[];
    worldStyle?: unknown;
}) {
    const saved = space.id ? lastSaved.get(space.id) : undefined;
    const given = space.worldScripts || [];
    // Whichever is newer: a space fetched again after the save wins.
    const scripts =
        saved && newest(saved.scripts) >= newest(given) ? saved.scripts : given;
    return {
        script: scripts[0] || null,
        source: scripts.find((script) => script.enabled)?.source || "",
        style: saved?.style || cleanStyle(space.worldStyle),
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
    told.clear();
    listeners.forEach((listener) => listener());
    resetWorldScriptScreen();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function useWorldScripts() {
    return useSyncExternalStore(subscribe, getWorldScripts, () => initial);
}

let screen = blankScreen;
const screenListeners = new Set<() => void>();

export function getWorldScriptScreen() {
    return screen;
}

export function setWorldScriptScreen(
    patch:
        | Partial<WorldScriptScreen>
        | ((current: WorldScriptScreen) => Partial<WorldScriptScreen>)
) {
    const next = typeof patch === "function" ? patch(screen) : patch;
    screen = { ...screen, ...next };
    screenListeners.forEach((listener) => listener());
}

export function resetWorldScriptScreen() {
    if (screen === blankScreen) return;
    screen = blankScreen;
    screenListeners.forEach((listener) => listener());
}

function subscribeScreen(listener: () => void) {
    screenListeners.add(listener);
    return () => screenListeners.delete(listener);
}

/** For the layer that draws what the script shows, and nobody else. */
export function useWorldScriptScreen() {
    return useSyncExternalStore(
        subscribeScreen,
        getWorldScriptScreen,
        () => blankScreen
    );
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

/** Warnings and errors already in the conversation, so each is said once. */
const told = new Set<string>();
const MAX_TOLD = 12;

/**
 * What the running script or its host has to say: a warning (a limit it
 * ran into) or an error goes into the conversation, once each and only a
 * few, so a script failing every frame does not fill it.
 */
export function addLog(level: "log" | "warn" | "error", text: string) {
    const line = firstLine(text);
    if (level === "log" || !line) return;
    if (told.has(line) || told.size >= MAX_TOLD) return;
    told.add(line);
    say(level === "error" ? "error" : "say", line);
}

/** A new request: what was said about the last script may be said again. */
export function forgetLogs() {
    told.clear();
}

/** What a runtime tells the page that drives it. */
export function pageEvents() {
    return {
        onStatus: (status: WorldScriptStatus) => setWorldScripts({ status }),
        onLog: addLog,
        onReady(failed?: string) {
            if (failed)
                say(
                    "error",
                    `The world's script didn't start: ${firstLine(failed)}`
                );
        },
    };
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
    /** The space is no longer on show: what is under way changes nothing. */
    dispose(): void;
}

let controller: WorldScriptsController | null = null;
export function setWorldScriptsController(next: WorldScriptsController | null) {
    controller = next;
}
export function worldScriptsController() {
    return controller;
}
