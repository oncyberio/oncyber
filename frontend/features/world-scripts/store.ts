/**
 * What the page knows about the world scripts of the space on show, shared
 * by the layer that runs them, the chat (`/ai`) and the studio panel. A
 * tiny external store, so neither has to be inside the other's tree.
 */
import { useSyncExternalStore } from "react";
import type { HudCorner, WorldScriptRecord } from "./protocol";
import type { SwapMode, WorldScriptStatus } from "./host";

export const WORLD_SCRIPTS_ENABLED = ["1", "true", "on"].includes(
    String(process.env.NEXT_PUBLIC_WORLD_SCRIPTS || "").toLowerCase()
);

export interface GameLine {
    id: string;
    text: string;
    sentAt: number;
    tone?: "error";
}

export interface WorldScriptsState {
    experienceId: string | null;
    /** The saved script (one per space for now). */
    script: WorldScriptRecord | null;
    /** What runs now, which may be a live edit not saved yet. */
    source: string;
    status: WorldScriptStatus;
    canEdit: boolean;
    canAsk: boolean;
    askReason: string;
    remaining: number | null;
    busy: boolean;
    lines: GameLine[];
    logs: { level: "log" | "warn" | "error"; text: string; at: number }[];
    hud: Record<string, { text: string; corner: HudCorner }>;
    toasts: { id: number; text: string; until: number }[];
    banner: { text: string; until: number } | null;
}

const initial: WorldScriptsState = {
    experienceId: null,
    script: null,
    source: "",
    status: { state: "idle" },
    canEdit: false,
    canAsk: false,
    askReason: "",
    remaining: null,
    busy: false,
    lines: [],
    logs: [],
    hud: {},
    toasts: [],
    banner: null,
};

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

let lineCount = 0;
export function addGameLine(text: string, tone?: "error") {
    setWorldScripts((current) => ({
        lines: [
            ...current.lines,
            { id: `game-${++lineCount}`, text, sentAt: Date.now(), tone },
        ].slice(-30),
    }));
}

export function addLog(level: "log" | "warn" | "error", text: string) {
    setWorldScripts((current) => ({
        logs: [...current.logs, { level, text, at: Date.now() }].slice(-80),
    }));
}

/** Set by the running layer: the actions chat and studio call. */
export interface WorldScriptsController {
    ask(request: string): Promise<void>;
    run(source: string, mode?: SwapMode): Promise<boolean>;
    restart(): void;
    stop(): void;
    undo(): Promise<void>;
    save(script: Partial<WorldScriptRecord>): Promise<boolean>;
}

let controller: WorldScriptsController | null = null;
export function setWorldScriptsController(next: WorldScriptsController | null) {
    controller = next;
}
export function worldScriptsController() {
    return controller;
}

/** `/ai add more npcs` → "add more npcs"; anything else → null. */
export function readAiCommand(text: string): string | null {
    const match = /^\/ai(?:\s+([\s\S]*))?$/i.exec(text.trim());
    if (!match) return null;
    return (match[1] || "").trim();
}

/** Chat lines in their own order, with the game's lines fitted in by time. */
export function mergeGameLines<T extends { sentAt: number }>(
    chat: T[],
    lines: GameLine[]
): Array<
    | T
    | {
          id: string;
          sessionId: string;
          recipientId: undefined;
          name: string;
          avatar: string;
          text: string;
          sentAt: number;
      }
> {
    if (!lines.length) return chat;
    const game = lines.map((line) => ({
        id: line.id,
        sessionId: "world-script",
        recipientId: undefined,
        name: "Game",
        avatar: "",
        text: line.text,
        sentAt: line.sentAt,
    }));
    const out: Array<T | (typeof game)[number]> = [];
    let g = 0;
    for (const message of chat) {
        while (
            g < game.length &&
            message.sentAt &&
            game[g].sentAt < message.sentAt
        )
            out.push(game[g++]);
        out.push(message);
    }
    while (g < game.length) out.push(game[g++]);
    return out;
}
