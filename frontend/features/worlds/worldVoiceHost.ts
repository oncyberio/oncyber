/**
 * The page's side of relayed voice (./relayedVoice): the microphone and
 * every voice heard are the page's, in the room it holds for the world.
 * The world's rules decide whether its visitor may speak, how loud each
 * voice is and whom this visitor's voice reaches; the page does as they
 * say. A microphone goes on only from the page's own button, because a
 * click inside the frame is not one the page can see.
 */
import { AUDIO_LOW_BAR } from "@utils/voiceChat/levels";
import type { VoiceState } from "@features/frame/roomVoice";

/** The parts of the page's voice in a room (features/frame/roomVoice) used here. */
export interface PageVoiceEngine {
    state: VoiceState;
    toggle(): Promise<void> | void;
    listen(): Promise<void>;
    updateVolumes(): void;
    published(): string[];
    setGated(id: string, gated: boolean): void;
    levels: { levels(): Iterable<[string, number]> };
    close(): void;
}

export interface PageVoiceEngineOptions {
    volume(id: string): number;
    onChange(state: VoiceState, error: string): void;
    onPublished(id: string, published: boolean): void;
}

/** What the page's microphone button shows. */
export interface WorldVoiceView {
    state: VoiceState;
    error: string;
    /** The world's rules let this visitor speak. */
    allowed: boolean;
}

const LEVELS_EVERY_MS = 200;
const text = (value: unknown) =>
    typeof value === "string" && value.length <= 64 ? value : "";

export function hostWorldVoice({
    create,
    post,
    onChange,
    now = () => Date.now(),
}: {
    /** The page's voice in the room it holds now. */
    create(options: PageVoiceEngineOptions): PageVoiceEngine;
    /** To the world in the frame. */
    post(kind: string, data?: object): void;
    onChange(view: WorldVoiceView): void;
    now?(): number;
}) {
    // What the world says: who may speak, and how loud each voice is. No
    // voice is heard until the world gives it a volume.
    let allowed = false;
    const volumes = new Map<string, number>();
    const spoke = new Map<string, number>();
    let error = "";
    let live = false;

    const voice = create({
        volume: (id) => volumes.get(id) ?? 0,
        onChange(state, message) {
            error = message;
            said(state);
        },
        onPublished(id, published) {
            if (!published) {
                volumes.delete(id);
                spoke.delete(id);
            }
            post("voice-published", { uid: id, published });
        },
    });
    function said(state = voice.state) {
        if ((state === "live") !== live) {
            live = state === "live";
            post("voice-state", { live });
        }
        onChange({ state, error, allowed });
    }
    const mute = () => {
        if (voice.state === "live") void voice.toggle();
    };

    // Who is talking, for the world to show: the level of each voice and
    // how long since it was last above the bar.
    const levels = setInterval(() => {
        const at = now();
        const stats: Record<
            string,
            { level: number; isActive: boolean; inactiveTime: number }
        > = {};
        for (const [id, level] of voice.levels.levels()) {
            const isActive = level > AUDIO_LOW_BAR;
            if (isActive) spoke.set(id, at);
            stats[id] = {
                level,
                isActive,
                inactiveTime: spoke.has(id) ? at - spoke.get(id) : Infinity,
            };
        }
        if (Object.keys(stats).length) post("voice-levels", { volumes: stats });
    }, LEVELS_EVERY_MS);

    void voice.listen().catch(() => {});
    said();

    return {
        /** A `voice-*` message from the world. */
        receive(kind: string, data: any) {
            const uid = text(data?.uid);
            if (kind === "voice-join") {
                post("voice-joined");
                post("voice-state", { live });
                for (const id of voice.published())
                    post("voice-published", { uid: id, published: true });
            } else if (kind === "voice-allow") {
                allowed = data?.allowed === true;
                if (!allowed) mute();
                said();
            } else if (kind === "voice-mute" || kind === "voice-leave") {
                if (kind === "voice-leave") allowed = false;
                mute();
                said();
            } else if (kind === "voice-volume" && uid) {
                volumes.set(
                    uid,
                    Math.min(1, Math.max(0, Number(data.volume) || 0))
                );
                voice.updateVolumes();
            } else if (kind === "voice-gate" && uid)
                voice.setGated(uid, data.gated === true);
        },
        /**
         * The page's microphone button was pressed. False when the world's
         * rules do not let this visitor speak yet: the press is then the
         * world's to answer (asking a moderator, say).
         */
        press() {
            if (!allowed) return false;
            void voice.toggle();
            return true;
        },
        dispose() {
            clearInterval(levels);
            voice.close();
        },
    };
}
