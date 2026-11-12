/**
 * The visitor's own voice in a world, as a pure state machine.
 *
 * `useVoice` holds the value and applies `voiceTransition`. It keeps
 * everything that touches the voice provider, the room and the clock,
 * including the timer that withdraws an unanswered request to speak. Whether
 * voice is on is the provider's to say: "synced" carries what it reports
 * (`getVoiceState()` in the hook), and replaces what was stored.
 *
 *   any ─ synced(voice) ─▶ voice          (disabled or enabled)
 *   any but pending ─ requested(reason) ─▶ pending
 *   pending ─ request-ended(end) ─▶ disabled, remembering how it ended
 *   any ─ rejected | closed ─▶ disabled
 *   any ─ left-as-speaker(voice) ─▶ voice, marked as left
 *   enabled ─ mute-changed(voice) | stream-moved(details) ─▶ enabled
 *
 * A request that ends unanswered (it expired, or the visitor withdrew it)
 * is remembered on "disabled" so nobody is told it was denied. "rejected" is
 * a moderator's no. "closed" is voice being left altogether.
 */

export type EnabledVoiceState = {
    isMuted?: boolean;
    isPlaying?: boolean;
    videoStreamState?: {
        hasAudio?: boolean;
        hasVideo?: boolean;
        placeholderId?: string;
        [key: string]: any;
    };
};

export type AudioType = "mic" | "broadcast";

/**
 * How a request to speak ended without a moderator's answer: it ran out of
 * time, or the visitor withdrew it (by cancelling, or by leaving voice).
 */
export type VoiceRequestEnd = "expired" | "withdrawn";

export type VoiceState =
    | {
          type: "disabled";
          leaveAsSpeaker?: boolean;
          /** Set when a request to speak ended unanswered. */
          request?: VoiceRequestEnd;
      }
    | { type: "pending"; reason: AudioType }
    | { type: "enabled"; state: EnabledVoiceState };

export type VoiceEvent =
    /** What the voice provider reports now, replacing what was stored. */
    | { type: "synced"; voice: VoiceState }
    /** A request to speak was sent to the moderators. */
    | { type: "requested"; reason: AudioType }
    /** The request ended unanswered. */
    | { type: "request-ended"; end: VoiceRequestEnd }
    /** A moderator said no. */
    | { type: "rejected" }
    /** Voice was left altogether. */
    | { type: "closed" }
    /** The visitor stopped speaking; `voice` is what the provider reports. */
    | { type: "left-as-speaker"; voice: VoiceState }
    /**
     * The microphone was muted or unmuted; `voice` is what the provider
     * reports. What it does not report, such as a shared stream, is kept.
     */
    | { type: "mute-changed"; voice: VoiceState }
    /** The shared stream moved, or was placed on another frame. */
    | { type: "stream-moved"; details: Record<string, any> };

export const initialVoiceState: VoiceState = { type: "disabled" };

const isBareDisabled = (state: VoiceState) =>
    state.type === "disabled" &&
    state.leaveAsSpeaker == null &&
    state.request == null;

export function voiceTransition(
    state: VoiceState,
    event: VoiceEvent
): VoiceState {
    switch (event.type) {
        case "synced":
            return event.voice;
        case "requested":
            return state.type === "pending"
                ? state
                : { type: "pending", reason: event.reason };
        case "request-ended":
            return state.type === "pending"
                ? { type: "disabled", request: event.end }
                : state;
        case "rejected":
        case "closed":
            return isBareDisabled(state) ? state : { type: "disabled" };
        case "left-as-speaker":
            return { ...event.voice, leaveAsSpeaker: true } as VoiceState;
        case "mute-changed": {
            const voice = event.voice;
            if (voice.type !== "enabled" || state.type !== "enabled") {
                return voice;
            }
            return {
                ...voice,
                state: { ...state.state, ...voice.state },
            };
        }
        case "stream-moved": {
            if (state.type !== "enabled") return state;
            // Only a stream that is shared moves: it has details already.
            const stream = state.state.videoStreamState;
            return {
                ...state,
                state: {
                    ...state.state,
                    videoStreamState: {
                        hasAudio: stream.hasAudio,
                        hasVideo: stream.hasVideo,
                        ...event.details,
                    },
                },
            };
        }
        default:
            return state;
    }
}
