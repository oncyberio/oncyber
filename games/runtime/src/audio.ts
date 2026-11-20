/**
 * Game sound. A game routes every sound through one node, `output`; the page
 * owns what happens after it: the visitor's volume and mute (one setting for
 * the page and every game), lowering the game while someone speaks in voice
 * chat, silence while the game is suspended. No DOM here: the browser side
 * is audio-browser.ts. See docs/games/sound.md.
 */

/** What the page sends: `<id>:audio`. Every field is optional. */
export interface AudioMessage {
    volume?: number;
    muted?: boolean;
    /** Someone in voice chat is talking: lower the game. */
    speaking?: boolean;
    /** A trusted gesture happened on the page: sound may start. */
    gesture?: boolean;
    /** Answer with `<id>:audio-state`. */
    probe?: boolean;
}

/** Facts for `inspect()`, asserted by the sound stage of `games:check`. */
export interface AudioFacts {
    /** "running" once a gesture let sound start; "none" without Web Audio. */
    audioState: string;
    /** Sound has reached the SDK's node. */
    audioRouted: boolean;
    /** Sounds that went around it: connections straight to a destination, media elements. */
    audioBypass: number;
    audioMuted: boolean;
    audioVolume: number;
    audioDucked: boolean;
    audioSuspended: boolean;
    /** The gain the SDK applies now, 0 to 1. */
    audioGain: number;
    /** Peak of what the game sends in, and of what leaves for the speakers. */
    audioInput: number;
    audioLevel: number;
}

/** How far the game drops while someone speaks. */
export const DUCK_GAIN = 0.3;

// The parts of Web Audio this file touches, so tests can fake them.
interface Param {
    value: number;
    setTargetAtTime(value: number, time: number, constant: number): unknown;
    cancelScheduledValues(time: number): unknown;
}
interface Node {
    connect(target: unknown): unknown;
    disconnect(): void;
}
interface Analyser extends Node {
    fftSize: number;
    getFloatTimeDomainData(samples: Float32Array): void;
}
export interface AudioContextLike {
    state: string;
    currentTime: number;
    destination: unknown;
    createGain(): Node & { gain: Param };
    createAnalyser?(): Analyser;
    resume(): Promise<void>;
    suspend(): Promise<void>;
    close(): Promise<void>;
}

export interface GameAudio<Context = AudioContextLike, Output = unknown> {
    /** Null where the browser has no Web Audio; every method still works. */
    readonly context: Context | null;
    /** Connect every sound here, never to `context.destination`. */
    readonly output: Output | null;
    readonly muted: boolean;
    readonly volume: number;
    /** True when sound can be heard: started, not muted, not suspended. */
    readonly audible: boolean;
    /** Apply what the page sent. Returns true when the page asked for the facts. */
    receive(message: unknown): boolean;
    /** Start sound. Only works inside, or after, a trusted gesture. */
    unlock(): Promise<boolean>;
    /**
     * Someone in voice chat is talking, as the game's own voice helper hears
     * it (voice.ts `connectVoice().onTalking`). The game is lowered while
     * this or the page's `speaking` is true.
     */
    setTalking(talking: boolean): void;
    /** Silence for `suspend()`, and bring back for `restore()`. */
    suspend(): void;
    restore(): void;
    /** Called with every change of mute, volume or state, to refresh a label. */
    onChange(listener: () => void): () => void;
    inspect(): AudioFacts;
    /** Counted in `audioBypass`; the browser side reports them. */
    reportBypass(): void;
    dispose(): void;
}

const unit = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : fallback;

export function createGameAudio<Context extends AudioContextLike>(
    context: Context | null
): GameAudio<Context, ReturnType<Context["createGain"]>> {
    let volume = 1,
        muted = false,
        speaking = false,
        talking = false,
        suspended = false,
        wanted = false,
        routed = false,
        bypass = 0,
        disposed = false;
    const listeners = new Set<() => void>();
    // output (the game's side, always 1) -> control (the page's side) -> speakers.
    const output = context?.createGain() ?? null;
    const control = context?.createGain() ?? null;
    const tapIn = context?.createAnalyser?.() ?? null;
    const tapOut = context?.createAnalyser?.() ?? null;
    if (context && output && control) {
        output.connect(control);
        control.connect(context.destination);
        if (tapIn && tapOut) {
            tapIn.fftSize = tapOut.fftSize = 2048;
            output.connect(tapIn);
            control.connect(tapOut);
        }
    }
    const samples = new Float32Array(2048);
    const peak = (tap: Analyser | null) => {
        if (!tap || context?.state !== "running") return 0;
        tap.getFloatTimeDomainData(samples);
        let max = 0;
        for (let i = 0; i < samples.length; i++)
            max = Math.max(max, Math.abs(samples[i]));
        return Math.round(max * 10000) / 10000;
    };
    const target = () =>
        muted || suspended ? 0 : volume * (speaking || talking ? DUCK_GAIN : 1);
    const changed = () => listeners.forEach((listener) => listener());
    /** Fast to silence, quick to duck, slow to come back up after speech. */
    const apply = (constant: number) => {
        if (!context || !control) return;
        control.gain.cancelScheduledValues(context.currentTime);
        // A stopped clock runs no ramps: set the value outright.
        if (context.state !== "running" || constant === 0)
            control.gain.value = target();
        else
            control.gain.setTargetAtTime(
                target(),
                context.currentTime,
                constant
            );
    };
    apply(0);
    const settle = (promise: Promise<void> | undefined) =>
        (promise ?? Promise.resolve())
            .then(
                () => true,
                () => false
            )
            .then((ok) => {
                changed();
                return ok;
            });
    return {
        context,
        output: output as ReturnType<Context["createGain"]> | null,
        get muted() {
            return muted;
        },
        get volume() {
            return volume;
        },
        get audible() {
            return context?.state === "running" && target() > 0;
        },
        receive(message) {
            if (!message || typeof message !== "object" || disposed)
                return false;
            const m = message as AudioMessage;
            const before = `${volume}|${muted}|${speaking}`;
            const wasSpeaking = speaking || talking;
            volume = unit(m.volume, volume);
            if (typeof m.muted === "boolean") muted = m.muted;
            if (typeof m.speaking === "boolean") speaking = m.speaking;
            if (before !== `${volume}|${muted}|${speaking}`) {
                const ducked = speaking || talking;
                apply(
                    wasSpeaking && !ducked
                        ? 0.35
                        : ducked && !wasSpeaking
                        ? 0.06
                        : 0.02
                );
                changed();
            }
            if (m.gesture === true) void this.unlock();
            return m.probe === true;
        },
        async unlock() {
            if (!context || disposed) return false;
            wanted = true;
            if (suspended) return false;
            if (context.state === "running") return true;
            let resumed: Promise<void> | undefined;
            try {
                resumed = context.resume();
            } catch {
                return false;
            }
            const ok = await settle(resumed);
            apply(0);
            return ok && context.state === "running";
        },
        setTalking(next) {
            if (disposed || talking === (next === true)) return;
            const was = speaking || talking;
            talking = next === true;
            const ducked = speaking || talking;
            if (was !== ducked) apply(ducked ? 0.06 : 0.35);
            changed();
        },
        suspend() {
            if (suspended || disposed) return;
            suspended = true;
            apply(0);
            // Stops the game's scheduled notes too, not only their loudness.
            if (context?.state === "running")
                try {
                    void settle(context.suspend());
                } catch {
                    /* closed */
                }
            changed();
        },
        restore() {
            if (!suspended || disposed) return;
            suspended = false;
            apply(0);
            if (wanted && context)
                try {
                    void settle(context.resume());
                } catch {
                    /* closed */
                }
            changed();
        },
        onChange(listener) {
            listeners.add(listener);
            return () => void listeners.delete(listener);
        },
        inspect() {
            const audioInput = peak(tapIn);
            if (audioInput > 0) routed = true;
            return {
                audioState: context?.state ?? "none",
                audioRouted: routed,
                audioBypass: bypass,
                audioMuted: muted,
                audioVolume: volume,
                audioDucked: (speaking || talking) && !muted,
                audioSuspended: suspended,
                audioGain: control
                    ? Math.round(control.gain.value * 1000) / 1000
                    : 0,
                audioInput,
                audioLevel: peak(tapOut),
            };
        },
        reportBypass() {
            bypass++;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            listeners.clear();
            for (const node of [output, control, tapIn, tapOut])
                try {
                    node?.disconnect();
                } catch {
                    /* closed */
                }
            if (context && context.state !== "closed")
                void context.close().catch(() => {});
        },
    };
}
