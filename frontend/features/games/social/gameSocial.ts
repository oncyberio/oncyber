/**
 * Chat and voice on a game page. The page owns both; a game never builds
 * its own. A visitor's lobby chat and microphone carry over when they travel
 * into a game, and run in the game's room, or in the party's room when a
 * party travelled together. The game gets two things only: it may send poses
 * for spatial voice (`voice`), and it hears who is talking (`talking`).
 * See docs/games/voice-chat.md.
 *
 * No imports and only erasable TypeScript, so `pnpm games:check` runs this
 * same file in a browser (scripts/games/social-check.mjs).
 */

export type SocialVoiceState = "off" | "connecting" | "live" | "muted";

export interface GameChatMessage {
    id: string;
    /** Room id of the sender; empty for messages carried from the lobby. */
    from: string;
    name: string;
    text: string;
    sentAt: number;
    self: boolean;
    /** Sent before the trip, shown again on the game page. */
    carried: boolean;
}

/** What the lobby hands the game page when a visitor travels. */
export interface SocialHandoff {
    messages: Array<{
        name: string;
        text: string;
        sentAt: number;
        self: boolean;
    }>;
    /** The visitor's voice in the lobby as they left. */
    voice: SocialVoiceState;
}

/** Between the game page and the lobby page around it (same origin). */
export const SOCIAL_REQUEST = "oncyber:game-social-request";
export const SOCIAL_HANDOFF = "oncyber:game-social";

export const CHAT_TEXT_MAX = 500;
export const CHAT_HISTORY_MAX = 60;
export const CHAT_CARRIED_MAX = 40;
/** The room allows one chat message a second per visitor. */
export const CHAT_INTERVAL_MS = 1000;
const NAME_MAX = 24;

const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";
const finite = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

/** The lobby's side of the handoff, from its own chat log and voice state. */
export function buildSocialHandoff(
    messages: ReadonlyArray<{
        sessionId?: unknown;
        name?: unknown;
        text?: unknown;
        sentAt?: unknown;
        recipientId?: unknown;
    }>,
    selfId: string,
    voice: unknown
): SocialHandoff {
    return {
        messages: messages
            // A direct message stays between its two people.
            .filter((message) => !message?.recipientId)
            .slice(-CHAT_CARRIED_MAX)
            .map((message) => ({
                name: text(message.name, NAME_MAX) || "Visitor",
                text: text(message.text, CHAT_TEXT_MAX),
                sentAt: finite(message.sentAt) ? message.sentAt : 0,
                self: !!selfId && message.sessionId === selfId,
            }))
            .filter((message) => message.text),
        voice: voice === "live" || voice === "muted" ? voice : "off",
    };
}

/** The game page's side: null unless the value is a well-formed handoff. */
export function readSocialHandoff(value: any): SocialHandoff | null {
    if (!value || !Array.isArray(value.messages)) return null;
    const messages: SocialHandoff["messages"] = [];
    for (const message of value.messages.slice(-CHAT_CARRIED_MAX)) {
        const body = text(message?.text, CHAT_TEXT_MAX);
        if (!body) continue;
        messages.push({
            name: text(message?.name, NAME_MAX) || "Visitor",
            text: body,
            sentAt: finite(message?.sentAt) ? message.sentAt : 0,
            self: message?.self === true,
        });
    }
    return {
        messages,
        voice:
            value.voice === "live" || value.voice === "muted"
                ? value.voice
                : "off",
    };
}

/** A chat message as native spaces and the lobby send it on the room. */
export function chatPacket(body: string, now: number) {
    return {
        type: "MESSAGE",
        text: body,
        acc_date: new Date(now).toISOString(),
    };
}

function decoded(data: unknown): any {
    let value = data;
    // The room's own check reads up to three JSON layers; read as many.
    for (let i = 0; typeof value === "string" && i < 3; i++) {
        try {
            value = JSON.parse(value);
        } catch {
            return null;
        }
    }
    return value;
}

/** The text of a chat message on the room's channel, or null. */
export function readChatText(data: unknown): string | null {
    const value = decoded(data);
    if (value?.type !== "MESSAGE") return null;
    return text(value.text, CHAT_TEXT_MAX) || null;
}

/**
 * Chat messages and room commands belong to the page. A game's relay packet
 * that looks like one is refused, so a game can't speak in a visitor's name
 * or act as a moderator.
 */
export function isPagePacket(data: unknown): boolean {
    const value = decoded(data);
    return (
        !!value &&
        typeof value === "object" &&
        (value.type === "MESSAGE" || value.type === "RTM_COMMAND")
    );
}

// --- spatial voice -------------------------------------------------------

/** Full volume up close, silent past the range (metres). */
export const VOICE_FULL = 4;
export const VOICE_RANGE = 60;
export const VOICE_PLAYERS_MAX = 64;
const POSITION_MAX = 1e5;

export interface VoicePoint {
    x: number;
    y: number;
    z: number;
}
/** What a game may send as `<id>:voice`. */
export interface VoicePoses {
    /** Where the visitor hears from (usually the camera); `h` is its heading. */
    listener: VoicePoint & { h: number };
    /** Where each player's voice comes from, by room id. */
    players: Map<string, VoicePoint>;
}

function point(value: any): VoicePoint | null {
    const p = { x: value?.x, y: value?.y ?? 0, z: value?.z };
    return finite(p.x) &&
        finite(p.y) &&
        finite(p.z) &&
        Math.abs(p.x) <= POSITION_MAX &&
        Math.abs(p.y) <= POSITION_MAX &&
        Math.abs(p.z) <= POSITION_MAX
        ? p
        : null;
}

/** Null when the message is malformed; malformed players drop out. */
export function readVoicePoses(value: any): VoicePoses | null {
    const listener = point(value?.listener);
    if (!listener) return null;
    const players = new Map<string, VoicePoint>();
    const list = Array.isArray(value.players) ? value.players : [];
    for (const raw of list.slice(0, VOICE_PLAYERS_MAX)) {
        const id = typeof raw?.id === "string" ? raw.id.slice(0, 64) : "";
        const at = point(raw);
        if (id && at) players.set(id, at);
    }
    const h = value.listener.h;
    return { listener: { ...listener, h: finite(h) ? h : 0 }, players };
}

/** 1 within VOICE_FULL metres, falling in a line to 0 at VOICE_RANGE. */
export function voiceVolume(distance: number) {
    if (!(distance >= 0)) return 0;
    return Math.max(
        0,
        Math.min(1, 1 - (distance - VOICE_FULL) / (VOICE_RANGE - VOICE_FULL))
    );
}

/** A player the game placed is heard from there; null leaves the room's rule. */
export function voiceGain(poses: VoicePoses | null, id: string) {
    const at = poses?.players.get(id);
    if (!poses || !at) return null;
    return voiceVolume(
        Math.hypot(
            at.x - poses.listener.x,
            at.y - poses.listener.y,
            at.z - poses.listener.z
        )
    );
}

// --- who is talking ------------------------------------------------------

/** Levels are 0..1, 0.5 being -50 dB (utils/voiceChat/levels.ts). */
export const TALKING_LEVEL = 0.5;
/** A talker stays lit this long after their last loud sample. */
export const TALKING_HOLD_MS = 400;

/** Turns level samples into a steady set of talkers. */
export class TalkingTracker {
    private until = new Map<string, number>();
    private current: string[] = [];

    /** Returns the sorted talkers when the set changed, else null. */
    sample(
        levels: Iterable<[string, number]>,
        now: number,
        threshold = TALKING_LEVEL
    ): string[] | null {
        for (const [id, level] of levels)
            if (level >= threshold) this.until.set(id, now + TALKING_HOLD_MS);
        const next: string[] = [];
        this.until.forEach((until, id) => {
            if (until > now) next.push(id);
            else this.until.delete(id);
        });
        next.sort();
        if (next.join("\n") === this.current.join("\n")) return null;
        this.current = next;
        return next.slice();
    }

    get talking() {
        return this.current.slice();
    }

    /** Nobody is talking any more; true when somebody was. */
    clear() {
        const was = this.current.length > 0;
        this.until.clear();
        this.current = [];
        return was;
    }
}

// --- the page's social layer ---------------------------------------------

/** What the social layer needs from the room the page joined. */
export interface SocialRoom {
    /** This visitor's id in the room; empty until connected. */
    readonly sessionId: string;
    /** Send on the room's chat channel; false when it could not be sent. */
    sendChat(packet: object): boolean;
    /** A room member's display name, or empty. */
    peerName(id: string): string;
    voiceState(): SocialVoiceState;
    /** Turn the microphone on in this room. */
    goLive(): Promise<void> | void;
    /** Join voice to listen, without a microphone. */
    listen(): Promise<void> | void;
    /** Current level per room id, the visitor's own microphone included. */
    voiceLevels(): Iterable<[string, number]>;
    /** Volume per room id from the game's poses; null: the room's own rule. */
    setVoiceGain(gain: ((id: string) => number | null) | null): void;
}

export interface GameSocialState {
    messages: GameChatMessage[];
    /** Room ids of everyone talking, the visitor included. */
    talking: string[];
    /** The voice state the visitor arrived with, until it is restored. */
    carriedVoice: SocialVoiceState;
    connected: boolean;
}

export class GameSocial {
    state: GameSocialState = {
        messages: [],
        talking: [],
        carriedVoice: "off",
        connected: false,
    };
    private room: SocialRoom | null = null;
    private poses: VoicePoses | null = null;
    private tracker = new TalkingTracker();
    private listeners = new Set<(state: GameSocialState) => void>();
    private sentAt = -Infinity;
    private sequence = 0;
    private arrived = false;
    private restoring = false;
    /** The visitor's name on their own messages. */
    selfName: string;
    private toGame: (kind: string, data: object) => void;
    private now: () => number;

    constructor(options: {
        /** The visitor's name, for their own messages. */
        selfName: string;
        /** Posts `<id>:<kind>` to the game frame. */
        toGame(kind: string, data: object): void;
        now?: () => number;
    }) {
        this.selfName = text(options.selfName, NAME_MAX) || "You";
        this.toGame = options.toGame;
        this.now = options.now ?? Date.now;
    }

    subscribe(listener: (state: GameSocialState) => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    private update(next: Partial<GameSocialState>) {
        this.state = { ...this.state, ...next };
        this.listeners.forEach((listener) => listener(this.state));
    }

    /**
     * The lobby's chat and voice as the visitor left. Messages already
     * carried are not added twice (the page asks again at the reveal).
     */
    carry(handoff: SocialHandoff | null) {
        if (!handoff) return;
        const known = new Set(
            this.state.messages
                .filter((message) => message.carried)
                .map((m) => `${m.sentAt}\n${m.name}\n${m.text}`)
        );
        const carried: GameChatMessage[] = [];
        for (const message of handoff.messages) {
            const key = `${message.sentAt}\n${message.name}\n${message.text}`;
            if (known.has(key)) continue;
            known.add(key);
            carried.push({
                id: `carried-${this.sequence++}`,
                from: "",
                name: message.name,
                text: message.text,
                sentAt: message.sentAt,
                self: message.self,
                carried: true,
            });
        }
        const live = this.state.messages.filter((m) => !m.carried);
        const before = this.state.messages.filter((m) => m.carried);
        this.update({
            // Carried messages were all sent before anything said here.
            messages: [...before, ...carried, ...live].slice(-CHAT_HISTORY_MAX),
            carriedVoice: handoff.voice,
        });
        void this.restoreVoice();
    }

    /** The room the page joined for this game or party; null when it left. */
    attach(room: SocialRoom | null) {
        this.room?.setVoiceGain(null);
        this.room = room;
        room?.setVoiceGain(this.poses ? (id) => this.gain(id) : null);
        this.update({ connected: !!room?.sessionId });
        if (!room && this.tracker.clear()) {
            this.update({ talking: [] });
            this.toGame("talking", { ids: [], self: false });
        }
        void this.restoreVoice();
    }

    /** The visitor can see and hear the game now. */
    arrive() {
        this.arrived = true;
        void this.restoreVoice();
    }

    /**
     * Voice survives the trip: a visitor who was talking in the lobby is
     * talking here, one who was listening keeps listening. Waits for the
     * reveal, so a microphone is never live in two places.
     */
    private async restoreVoice() {
        const room = this.room;
        const wanted = this.state.carriedVoice;
        if (
            !room?.sessionId ||
            !this.arrived ||
            this.restoring ||
            wanted === "off" ||
            wanted === "connecting"
        )
            return;
        this.restoring = true;
        try {
            if (wanted === "live" && room.voiceState() !== "live")
                await room.goLive();
            else if (wanted === "muted" && room.voiceState() === "off")
                await room.listen();
            // Restored once; from here the visitor's own choice stands.
            if (this.room === room) this.update({ carriedVoice: "off" });
        } catch {
            // The microphone button still works; nothing to restore twice.
            this.update({ carriedVoice: "off" });
        } finally {
            this.restoring = false;
        }
    }

    /**
     * Every message on the room's channel passes through here. True when
     * the page consumed it: the game never sees chat or room commands.
     */
    receive(from: string, data: unknown, sentAt?: number): boolean {
        if (!isPagePacket(data)) return false;
        const body = readChatText(data);
        if (!body || typeof from !== "string" || !from) return true;
        const self = !!this.room && from === this.room.sessionId;
        const at = finite(sentAt) ? sentAt : this.now();
        this.update({
            messages: [
                ...this.state.messages,
                {
                    id: `${from}-${at}-${this.sequence++}`,
                    from,
                    name: self
                        ? this.selfName
                        : text(this.room?.peerName(from), NAME_MAX) ||
                          "Visitor",
                    text: body,
                    sentAt: at,
                    self,
                    carried: false,
                },
            ].slice(-CHAT_HISTORY_MAX),
        });
        return true;
    }

    /** Send a chat message to the room. The room echoes it back to `receive`. */
    send(value: string): boolean {
        const body = text(value, CHAT_TEXT_MAX);
        const now = this.now();
        if (
            !body ||
            !this.room?.sessionId ||
            now - this.sentAt < CHAT_INTERVAL_MS
        )
            return false;
        if (!this.room.sendChat(chatPacket(body, now))) return false;
        this.sentAt = now;
        return true;
    }

    /** True when the game's packet may go on the room's relay. */
    allowsRelay(data: unknown) {
        return !isPagePacket(data);
    }

    /** `<id>:voice` from the game: where the listener and the players are. */
    setVoicePoses(value: unknown) {
        const poses = readVoicePoses(value);
        if (!poses) return false;
        const first = !this.poses;
        this.poses = poses;
        if (first) this.room?.setVoiceGain((id) => this.gain(id));
        return true;
    }
    private gain(id: string) {
        return voiceGain(this.poses, id);
    }

    /** Call a few times a second: updates who is talking and tells the game. */
    tick() {
        const room = this.room;
        const connected = !!room?.sessionId;
        if (connected !== this.state.connected) {
            this.update({ connected });
            void this.restoreVoice();
        }
        const talking = this.tracker.sample(
            room ? room.voiceLevels() : [],
            this.now()
        );
        if (!talking) return;
        this.update({ talking });
        this.toGame("talking", {
            ids: talking,
            self: !!room?.sessionId && talking.includes(room.sessionId),
        });
    }
}
