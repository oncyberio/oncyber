import { createGameAudio, type GameAudio } from "./audio.ts";
import { GAME_MESSAGE_PREFIX } from "./contract.ts";

/** The visitor's sound setting when a game runs on its own (no page). */
const STANDALONE_KEY = "oncyber:sound";

export interface BrowserGameAudio extends GameAudio<AudioContext, GainNode> {
    /**
     * Ask for mute on or off (the game's own M key or sound button). The page
     * owns the setting: it saves it and sends it back to every listener.
     */
    requestMuted(muted: boolean): void;
}

/**
 * The game's sound output in a browser frame. Call it once, before `hello`.
 * A game on the one contract passes nothing (its messages are
 * `oncyber:game:audio`); a build from before the contract passes its id
 * (`<id>:audio`). It:
 * - takes volume, mute and "someone is speaking" from the page (`audio`);
 * - starts sound on the first trusted gesture, here or forwarded by the page;
 * - counts sound that goes around `output` (see `audioBypass`).
 * It does not watch the tab: the session silences it on `suspend()` and
 * brings it back on `restore()`, and only the one pause (pausing.ts)
 * suspends a session, so a match against another person keeps its sound.
 */
export function connectGameAudio(id?: string): BrowserGameAudio {
    const prefix = id ? `${id}:` : GAME_MESSAGE_PREFIX;
    const Context: typeof AudioContext | undefined =
        (window as any).AudioContext || (window as any).webkitAudioContext;
    let context: AudioContext | null = null;
    try {
        context = Context ? new Context() : null;
    } catch {
        /* no audio device */
    }
    const audio = createGameAudio(context);
    const embedded = window.parent !== window;
    const post = (kind: string, data: object) => {
        if (embedded)
            window.parent.postMessage(
                { type: `${prefix}${kind}`, ...data },
                "*"
            );
    };

    // Sound that goes around the output: any other node wired to a
    // destination, and media elements that play without a source node.
    const undo: Array<() => void> = [];
    const patch = <T extends object, K extends keyof T>(
        owner: T | undefined,
        key: K,
        wrap: (original: any) => any
    ) => {
        if (!owner || typeof owner[key] !== "function") return;
        const original = owner[key];
        owner[key] = wrap(original);
        undo.push(() => {
            owner[key] = original;
        });
    };
    let warned = false;
    const bypass = (what: string) => {
        audio.reportBypass();
        if (!warned)
            console.warn(
                `[oncyber] ${what} bypasses the game's sound output; connect it to audio.output`
            );
        warned = true;
    };
    // The SDK's own connection to the speakers was made above, before this.
    const wired = new WeakSet<object>();
    patch(
        (window as any).AudioNode?.prototype,
        "connect",
        (original) =>
            function (this: AudioNode, ...args: any[]) {
                const Destination = (window as any).AudioDestinationNode;
                if (Destination && args[0] instanceof Destination)
                    bypass("A node connected to a destination");
                return original.apply(this, args);
            }
    );
    patch(
        (window as any).AudioContext?.prototype,
        "createMediaElementSource",
        (original) =>
            function (this: AudioContext, element: any) {
                wired.add(element);
                return original.call(this, element);
            }
    );
    patch(
        (window as any).HTMLMediaElement?.prototype,
        "play",
        (original) =>
            function (this: HTMLMediaElement) {
                if (!wired.has(this) && !this.muted && this.volume > 0)
                    bypass("A media element");
                return original.call(this);
            }
    );

    const report = () => post("audio-state", { state: audio.inspect() });
    const receive = (event: MessageEvent) => {
        if (
            event.source !== window.parent ||
            event.data?.type !== `${prefix}audio`
        )
            return;
        if (audio.receive(event.data)) report();
    };
    const gesture = (event: Event) => {
        if (event.isTrusted) void audio.unlock();
    };
    const GESTURES = ["pointerdown", "pointerup", "keydown", "touchend"];
    if (embedded) window.addEventListener("message", receive);
    for (const type of GESTURES)
        window.addEventListener(type, gesture, {
            capture: true,
            passive: true,
        });
    // On its own (a dev server), the game keeps the setting itself.
    if (!embedded)
        try {
            audio.receive(
                JSON.parse(localStorage.getItem(STANDALONE_KEY) || "{}")
            );
        } catch {
            /* blocked or malformed */
        }
    // Ask the page for the visitor's setting; it answers with `<id>:audio`.
    post("audio", { hello: true });

    const close = audio.dispose;
    return Object.assign(audio, {
        requestMuted(muted: boolean) {
            audio.receive({ muted });
            post("audio", { muted });
            if (!embedded)
                try {
                    localStorage.setItem(
                        STANDALONE_KEY,
                        JSON.stringify({ volume: audio.volume, muted })
                    );
                } catch {
                    /* blocked */
                }
        },
        dispose() {
            window.removeEventListener("message", receive);
            for (const type of GESTURES)
                window.removeEventListener(type, gesture, { capture: true });
            for (const restore of undo.splice(0)) restore();
            close();
        },
    }) as BrowserGameAudio;
}
