/**
 * How loud counts as speaking, on the 0..1 scale of the level readings
 * (0.5 is -50dB below full scale).
 *
 * This is the one number to change after tuning it with real microphones.
 * Open a space with `?voiceDebug` to read every person's level, or with
 * `?voiceDebug=0.42` (or `?voiceDebug=-58`, in decibels) to try another value
 * for that visit. See VoiceLevelDebug.tsx.
 */
export const AUDIO_LOW_BAR = 0.5;

/** The decibels below full scale of a 0..1 level: 0.5 is -50dB. */
export function levelToDecibels(level: number) {
    return level * 100 - 100;
}

/** The 0..1 level of decibels below full scale; -100dB and quieter is 0. */
export function decibelsToLevel(decibels: number) {
    return Math.max(decibels + 100, 0) / 100;
}

/** The URL parameter that shows the level readout. */
export const VOICE_DEBUG_PARAM = "voiceDebug";

export interface VoiceDebugRequest {
    /** The threshold to try for this visit, on the 0..1 scale. */
    threshold?: number;
}

/**
 * What a URL query asks of the level readout: null without `voiceDebug`.
 *
 * A value from 0 to 1 is a threshold to try, on the level scale. A negative
 * value down to -100 is a threshold in decibels. Any other value, or none,
 * shows the readout with the threshold already in force.
 */
export function readVoiceDebug(search: string): VoiceDebugRequest | null {
    const params = new URLSearchParams(search);

    if (!params.has(VOICE_DEBUG_PARAM)) return null;

    const raw = params.get(VOICE_DEBUG_PARAM).trim();
    const value = raw === "" ? NaN : Number(raw);

    if (value >= 0 && value <= 1) return { threshold: value };

    if (value < 0 && value >= -100) {
        return { threshold: decibelsToLevel(value) };
    }

    return {};
}
