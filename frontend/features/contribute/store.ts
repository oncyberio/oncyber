import { useEffect, useState } from "react";

/**
 * Contributor mode settings. They live only in this browser: the GitHub
 * token and the AI key are the visitor's own, are sent straight from the
 * browser to GitHub and to the AI provider, and never reach Oncyber's
 * servers.
 */
export type ContributeSettings = {
    githubToken?: string;
    githubLogin?: string;
    aiProvider?: "openai";
    aiKey?: string;
    aiModel?: string;
    enabled?: boolean;
};

const KEY = "oncyber.contribute.v1";
const EVENT = "oncyber:contribute-settings";

let cache: ContributeSettings | null = null;

export function readContributeSettings(): ContributeSettings {
    if (cache) return cache;
    try {
        cache = JSON.parse(window.localStorage.getItem(KEY) || "{}") || {};
    } catch {
        cache = {};
    }
    return cache;
}

export function writeContributeSettings(
    patch: Partial<ContributeSettings>
): ContributeSettings {
    const next = { ...readContributeSettings(), ...patch };
    for (const key of Object.keys(next)) {
        if (next[key] === undefined || next[key] === "") delete next[key];
    }
    // Contributor mode needs both accounts.
    if (!next.githubToken || !next.aiKey) delete next.enabled;
    cache = next;
    try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // Private mode: the settings last for this page only.
    }
    window.dispatchEvent(new Event(EVENT));
    return next;
}

export function clearContributeSettings() {
    cache = {};
    try {
        window.localStorage.removeItem(KEY);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
}

export function useContributeSettings(): ContributeSettings {
    const [settings, setSettings] = useState<ContributeSettings>({});
    useEffect(() => {
        const update = () => setSettings(readContributeSettings());
        const storage = (event: StorageEvent) => {
            if (event.key !== KEY) return;
            cache = null;
            update();
        };
        update();
        window.addEventListener(EVENT, update);
        window.addEventListener("storage", storage);
        return () => {
            window.removeEventListener(EVENT, update);
            window.removeEventListener("storage", storage);
        };
    }, []);
    return settings;
}

/** For tests. */
export function resetContributeCache() {
    cache = null;
}
