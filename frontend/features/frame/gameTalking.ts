/**
 * Who is talking, for the game's talking indicator. The page hears each
 * player's voice stream; the game only learns a yes or no per player, in
 * the `talking` field of the `peers` message. No audio crosses to the game.
 */

/** Loudness (0..1 RMS) above which a player counts as talking. */
export const TALKING_ON = 0.04;
/** Below this they stop, once the hold has run out. */
export const TALKING_OFF = 0.02;
/** A pause shorter than this, in milliseconds, doesn't flicker the indicator. */
export const TALKING_HOLD_MS = 350;

export interface TalkingState {
    talking: boolean;
    /** When a quiet player stops counting as talking. */
    until: number;
}

/** One reading of a player's level folded into their state. */
export function nextTalking(
    state: TalkingState,
    level: number,
    now: number
): TalkingState {
    if (level >= TALKING_ON)
        return { talking: true, until: now + TALKING_HOLD_MS };
    if (state.talking && (level >= TALKING_OFF || now < state.until))
        return state;
    return { talking: false, until: 0 };
}

/** RMS of a time-domain byte buffer (128 is silence). */
export function levelOf(samples: Uint8Array): number {
    if (!samples.length) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        const v = (samples[i] - 128) / 128;
        sum += v * v;
    }
    return Math.sqrt(sum / samples.length);
}

type Source = { read(): number; close(): void };

/**
 * Tracks who is talking from their voice streams. `open` turns a stream
 * into a level reader; the default uses a Web Audio analyser and returns
 * null where Web Audio is missing, so the indicator simply stays off.
 */
export class TalkingMeter {
    private sources = new Map<string, Source>();
    private states = new Map<string, TalkingState>();
    private open: (stream: MediaStream) => Source | null;
    private now: () => number;
    constructor(
        open: (stream: MediaStream) => Source | null = analyserSource,
        now: () => number = () => Date.now()
    ) {
        this.open = open;
        this.now = now;
    }
    watch(id: string, stream: MediaStream) {
        this.unwatch(id);
        const source = this.open(stream);
        if (source) this.sources.set(id, source);
    }
    unwatch(id: string) {
        this.sources.get(id)?.close();
        this.sources.delete(id);
        this.states.delete(id);
    }
    /** Read the player's level now. Call at the rate peers are sampled. */
    talking(id: string): boolean {
        const source = this.sources.get(id);
        if (!source) return false;
        const state = nextTalking(
            this.states.get(id) ?? { talking: false, until: 0 },
            source.read(),
            this.now()
        );
        this.states.set(id, state);
        return state.talking;
    }
    close() {
        Array.from(this.sources.keys()).forEach((id) => this.unwatch(id));
    }
}

let context: AudioContext | null = null;
function analyserSource(stream: MediaStream): Source | null {
    try {
        const Context =
            window.AudioContext || (window as any).webkitAudioContext;
        if (!Context) return null;
        context ??= new Context();
        const node = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        node.connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        return {
            read() {
                // Browsers start the context suspended until a gesture.
                if (context?.state === "suspended") void context.resume();
                analyser.getByteTimeDomainData(samples);
                return levelOf(samples);
            },
            close() {
                node.disconnect();
            },
        };
    } catch {
        return null;
    }
}
