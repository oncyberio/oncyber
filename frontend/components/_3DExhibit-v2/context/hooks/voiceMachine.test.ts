import {
    initialVoiceState,
    voiceTransition as step,
    type VoiceEvent,
    type VoiceState,
} from "./voiceMachine";

const disabled: VoiceState = { type: "disabled" };
const pending: VoiceState = { type: "pending", reason: "mic" };
const expired: VoiceState = { type: "disabled", request: "expired" };
const withdrawn: VoiceState = { type: "disabled", request: "withdrawn" };
const left: VoiceState = { type: "disabled", leaveAsSpeaker: true };
const enabled = (state: Record<string, any> = {}): VoiceState => ({
    type: "enabled",
    state: { isMuted: true, isPlaying: false, ...state },
});
const stream = { hasAudio: true, hasVideo: true, placeholderId: "a" };
const sharing = enabled({ isPlaying: true, videoStreamState: stream });

const synced = (voice: VoiceState): VoiceEvent => ({ type: "synced", voice });
const requested = (reason: "mic" | "broadcast" = "mic"): VoiceEvent => ({
    type: "requested",
    reason,
});
const ended = (end: "expired" | "withdrawn"): VoiceEvent => ({
    type: "request-ended",
    end,
});
const rejected: VoiceEvent = { type: "rejected" };
const closed: VoiceEvent = { type: "closed" };
const muted = (voice: VoiceState): VoiceEvent => ({
    type: "mute-changed",
    voice,
});
const moved = (details: Record<string, any>): VoiceEvent => ({
    type: "stream-moved",
    details,
});

const STATES: VoiceState[] = [
    disabled,
    pending,
    expired,
    withdrawn,
    left,
    enabled(),
    sharing,
];

test("voice starts disabled", () => {
    expect(initialVoiceState).toEqual(disabled);
});

test.each<[string, VoiceState, VoiceEvent, VoiceState]>([
    ["a request is sent", disabled, requested(), pending],
    [
        "a request to share is sent",
        withdrawn,
        requested("broadcast"),
        { type: "pending", reason: "broadcast" },
    ],
    ["it expires", pending, ended("expired"), expired],
    ["it is withdrawn", pending, ended("withdrawn"), withdrawn],
    ["a moderator approves", pending, synced(enabled()), enabled()],
    ["a moderator says no", pending, rejected, disabled],
    ["no after an expiry forgets the expiry", expired, rejected, disabled],
    ["voice is left", sharing, closed, disabled],
    ["leaving forgets how a request ended", withdrawn, closed, disabled],
    [
        "the visitor stops speaking",
        enabled(),
        { type: "left-as-speaker", voice: disabled },
        left,
    ],
    [
        "the provider still reports voice on after stopping",
        enabled(),
        { type: "left-as-speaker", voice: enabled() },
        { ...enabled(), leaveAsSpeaker: true } as VoiceState,
    ],
    // The provider is the authority on whether voice is on.
    ["the provider reports voice off", sharing, synced(disabled), disabled],
    ["even while a request waits", pending, synced(disabled), disabled],
    [
        "unmuting keeps the shared stream",
        sharing,
        muted(enabled({ isMuted: false, isPlaying: true })),
        enabled({
            isMuted: false,
            isPlaying: true,
            videoStreamState: stream,
        }),
    ],
    [
        "muting after voice went off reports off",
        sharing,
        muted(disabled),
        disabled,
    ],
    [
        "muting from another state takes the provider's word",
        disabled,
        muted(enabled({ isMuted: false })),
        enabled({ isMuted: false }),
    ],
    [
        "the shared stream moves",
        sharing,
        moved({ placeholderId: "b", position: [1, 2, 3] }),
        enabled({
            isPlaying: true,
            videoStreamState: {
                hasAudio: true,
                hasVideo: true,
                placeholderId: "b",
                position: [1, 2, 3],
            },
        }),
    ],
])("%s", (_name, state, event, next) => {
    expect(step(state, event)).toEqual(next);
});

test.each<[string, VoiceState, VoiceEvent]>([
    ["a second request while one waits", pending, requested("broadcast")],
    ["an expiry with nothing waiting", disabled, ended("expired")],
    ["an expiry after an approval", enabled(), ended("expired")],
    ["a withdrawal after a rejection", disabled, ended("withdrawn")],
    ["no with voice already off", disabled, rejected],
    ["leaving with voice already off", disabled, closed],
    ["a stream moving with voice off", disabled, moved({ x: 1 })],
    ["a stream moving while a request waits", pending, moved({ x: 1 })],
    ["an unknown event", sharing, { type: "unknown" } as any],
])("%s returns the same state", (_name, state, event) => {
    expect(step(state, event)).toBe(state);
});

test("whatever the provider reports replaces any state", () => {
    for (const state of STATES) {
        expect(step(state, synced(sharing))).toBe(sharing);
        expect(step(state, synced(disabled))).toBe(disabled);
    }
});
