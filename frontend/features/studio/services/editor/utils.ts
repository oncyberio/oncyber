import type { Experience, Script } from "@uitypes/experience";

// Existing script records stay untouched when artwork is removed, duplicated,
// or restored. They are inert and are cleaned only by the reviewed operator tool.
export function getScripts(_exhibit: Experience, _artworkId: string): Record<string, Script> {
    return {};
}

export function removeScripts(_exhibit: Experience, _artworkId: string): Record<string, Script> {
    return {};
}

export function restoreScripts(_exhibit: Experience, _artworkId: string, _scripts: Record<string, Script>) {}

export function duplicateScripts(_exhibit: Experience, _sourceId: string, _targetId: string): Record<string, Script> {
    return {};
}
