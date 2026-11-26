/**
 * The page side of game sound. The page owns one sound setting (volume and
 * mute) for the visitor: its own controls and every game read and write the
 * same value, saved in this browser. The game gets it as `<id>:audio`
 * messages, along with "someone is speaking" (to lower the game under voice
 * chat) and the first trusted gesture (so sound may start). The game side is
 * games/runtime/src/audio.ts. See docs/games/sound.md.
 */
export interface SoundSetting {
    volume: number;
    muted: boolean;
}
export const SOUND_STORAGE_KEY = "oncyber:sound";
const DEFAULT_SOUND: SoundSetting = { volume: 1, muted: false };

/** Anything in, a valid setting out. */
export function readSoundSetting(value: unknown): SoundSetting {
    let data: any = value;
    if (typeof value === "string") {
        try {
            data = JSON.parse(value);
        } catch {
            data = null;
        }
    }
    const volume = data?.volume;
    return {
        volume:
            typeof volume === "number" && Number.isFinite(volume)
                ? Math.max(0, Math.min(1, volume))
                : DEFAULT_SOUND.volume,
        muted: data?.muted === true,
    };
}

export interface SoundStore {
    get(): SoundSetting;
    set(change: Partial<SoundSetting>): SoundSetting;
    subscribe(listener: (setting: SoundSetting) => void): () => void;
}

/** The setting, saved on every change and kept in step across tabs. */
export function createSoundStore(
    storage:
        | Pick<Storage, "getItem" | "setItem">
        | undefined = globalThis.localStorage,
    events: Pick<Window, "addEventListener"> | undefined = globalThis.window
): SoundStore {
    const load = () => {
        try {
            return readSoundSetting(storage?.getItem(SOUND_STORAGE_KEY));
        } catch {
            return { ...DEFAULT_SOUND };
        }
    };
    let setting = load();
    const listeners = new Set<(setting: SoundSetting) => void>();
    const publish = () => listeners.forEach((listener) => listener(setting));
    events?.addEventListener("storage", (event: StorageEvent) => {
        if (event.key !== SOUND_STORAGE_KEY) return;
        setting = load();
        publish();
    });
    return {
        get: () => setting,
        set(change) {
            const next = readSoundSetting({ ...setting, ...change });
            if (next.volume === setting.volume && next.muted === setting.muted)
                return setting;
            setting = next;
            try {
                storage?.setItem(SOUND_STORAGE_KEY, JSON.stringify(setting));
            } catch {
                /* storage blocked: the setting lasts for this visit */
            }
            publish();
            return setting;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => void listeners.delete(listener);
        },
    };
}

let shared: SoundStore | undefined;
/** The one store every control on the page uses. */
export const soundStore = () => (shared ||= createSoundStore());

/**
 * All the voice side has to provide: whether anyone is talking right now.
 * `subscribe` calls the listener on every change and returns its undo.
 */
export interface SpeakingSource {
    subscribe(listener: (speaking: boolean) => void): () => void;
}

/** Keeps the game lowered this long after speech stops, so it doesn't pump. */
export const SPEAKING_HOLD_MS = 600;

type GestureTarget = Pick<Window, "addEventListener" | "removeEventListener">;
const GESTURES = ["pointerdown", "keydown", "touchend"];

/**
 * Connects one game frame to the page's sound. `post(kind, data)` sends
 * `<id>:<kind>` to the frame; pass what the game sends to `receive`.
 */
export function createGameAudioBridge(options: {
    post(kind: "audio", data: object): void;
    store?: SoundStore;
    speaking?: SpeakingSource;
    gestures?: GestureTarget;
}) {
    const store = options.store ?? soundStore();
    const gestures = options.gestures ?? globalThis.window;
    let speaking = false;
    let unlocked = false;
    let release: ReturnType<typeof setTimeout> | undefined;
    const sync = () =>
        options.post("audio", {
            ...store.get(),
            speaking,
            // Repeated with the state, for a game that loaded after the gesture.
            ...(unlocked ? { gesture: true } : {}),
        });
    const setSpeaking = (next: boolean) => {
        clearTimeout(release);
        if (next === speaking) return;
        if (next) {
            speaking = true;
            sync();
        } else
            release = setTimeout(() => {
                speaking = false;
                sync();
            }, SPEAKING_HOLD_MS);
    };
    const gesture = (event: Event) => {
        // Only a real gesture counts; the browser would refuse the rest.
        if (!event.isTrusted) return;
        unlocked = true;
        options.post("audio", { gesture: true });
    };
    for (const type of GESTURES)
        gestures?.addEventListener(type, gesture, { capture: true });
    const undo = [
        store.subscribe(sync),
        options.speaking?.subscribe(setSpeaking),
    ];
    return {
        /** Send the whole state: after the identity, or when the game asks. */
        sync,
        setSpeaking,
        /** A `<id>:audio` message from the game: its hello, or its own mute control. */
        receive(data: unknown) {
            const muted = (data as { muted?: unknown } | null)?.muted;
            // The game asked; the page decides, saves and answers everyone.
            if (typeof muted === "boolean") store.set({ muted });
            sync();
        },
        dispose() {
            clearTimeout(release);
            for (const type of GESTURES)
                gestures?.removeEventListener(type, gesture, { capture: true });
            undo.forEach((stop) => stop?.());
        },
    };
}
