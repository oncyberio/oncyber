import {
    SOUND_STORAGE_KEY,
    SPEAKING_HOLD_MS,
    createGameAudioBridge,
    createSoundStore,
    readSoundSetting,
    type SpeakingSource,
} from "./gameAudio";

function memory(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    return {
        values,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, value),
    };
}
function target() {
    const listeners = new Map<string, (event: any) => void>();
    return {
        listeners,
        addEventListener: (type: string, listener: any) =>
            void listeners.set(type, listener),
        removeEventListener: (type: string) => void listeners.delete(type),
    } as any;
}
/** Stands in for voice chat: it only says whether someone is talking. */
function fakeVoice() {
    let listener: (speaking: boolean) => void = () => {};
    const source: SpeakingSource = {
        subscribe(next) {
            listener = next;
            return () => (listener = () => {});
        },
    };
    return { source, say: (speaking: boolean) => listener(speaking) };
}
function bridge(saved?: string) {
    const storage = memory(saved ? { [SOUND_STORAGE_KEY]: saved } : {});
    const store = createSoundStore(storage, target());
    const sent: any[] = [];
    const gestures = target();
    const voice = fakeVoice();
    const audio = createGameAudioBridge({
        post: (_kind, data) => sent.push(data),
        store,
        speaking: voice.source,
        gestures,
    });
    return { storage, store, sent, gestures, voice, audio };
}

test("reads any saved value as a valid setting", () => {
    expect(readSoundSetting(null)).toEqual({ volume: 1, muted: false });
    expect(readSoundSetting("{bad")).toEqual({ volume: 1, muted: false });
    expect(readSoundSetting('{"volume":4,"muted":true}')).toEqual({
        volume: 1,
        muted: true,
    });
    expect(readSoundSetting({ volume: 0.25, muted: "yes" })).toEqual({
        volume: 0.25,
        muted: false,
    });
});

test("one saved setting: the page's control and the game's see each other", () => {
    const { storage, store, sent, audio } = bridge(
        '{"volume":0.5,"muted":false}'
    );
    audio.sync();
    expect(sent.pop()).toEqual({ volume: 0.5, muted: false, speaking: false });
    // The page's own control.
    store.set({ muted: true });
    expect(sent.pop()).toMatchObject({ muted: true });
    // The game's M key asks; the page saves and answers.
    audio.receive({ muted: false });
    expect(store.get().muted).toBe(false);
    expect(sent.pop()).toMatchObject({ muted: false, volume: 0.5 });
    expect(JSON.parse(storage.values.get(SOUND_STORAGE_KEY)!)).toEqual({
        volume: 0.5,
        muted: false,
    });
    // A game can't set anything else.
    audio.receive({ volume: 0, muted: "no" });
    expect(store.get()).toEqual({ volume: 0.5, muted: false });
});

test("another tab's change arrives through the storage event", () => {
    const storage = memory();
    const events = target();
    const store = createSoundStore(storage, events);
    const seen: boolean[] = [];
    store.subscribe((setting) => seen.push(setting.muted));
    storage.setItem(SOUND_STORAGE_KEY, '{"volume":1,"muted":true}');
    events.listeners.get("storage")!({ key: SOUND_STORAGE_KEY });
    expect(seen).toEqual([true]);
});

test("only a trusted gesture is forwarded, and repeated to a late game", () => {
    const { sent, gestures, audio } = bridge();
    gestures.listeners.get("pointerdown")!({ isTrusted: false });
    expect(sent).toEqual([]);
    gestures.listeners.get("keydown")!({ isTrusted: true });
    expect(sent.pop()).toEqual({ gesture: true });
    audio.receive({ hello: true });
    expect(sent.pop()).toMatchObject({ gesture: true, muted: false });
    audio.dispose();
    expect(gestures.listeners.size).toBe(0);
});

test("speech lowers the game at once and lets go after a hold", () => {
    jest.useFakeTimers();
    const { sent, voice } = bridge();
    voice.say(true);
    expect(sent.pop()).toMatchObject({ speaking: true });
    voice.say(false);
    voice.say(true); // a pause between words
    jest.advanceTimersByTime(SPEAKING_HOLD_MS);
    expect(sent).toEqual([]);
    voice.say(false);
    jest.advanceTimersByTime(SPEAKING_HOLD_MS);
    expect(sent.pop()).toMatchObject({ speaking: false });
    jest.useRealTimers();
});
