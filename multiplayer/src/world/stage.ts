/**
 * Lobby voice moderation for the shared world, kept on the main thread so
 * every gateway worker sees one answer. Nobody speaks until an admin puts
 * them on voice; speakers are still heard only by the people near them.
 */

export type StageRole = "owner" | "admin";
export const STAGE_ACTIONS = ["stage-add", "stage-remove", "mute", "unmute", "kick", "decline-request", "grant-admin", "revoke-admin"] as const;
export type StageAction = (typeof STAGE_ACTIONS)[number];
export const STAGE_KICK_BAN_MS = 15 * 60 * 1000;
/**
 * Matches voice in spaces on oncyber.io: 8 open mics, heard by everyone
 * within 2x the default voice range of 60 (120 m), kept until 2.5x (150 m).
 */
export const STAGE_SPEAKER_LIMIT = 8;
export const STAGE_VOICE_RADIUS = 120;
export const STAGE_VOICE_EXIT_RADIUS = 150;
const REQUEST_LIMIT = 64;

interface Seat {
    /** Stable per traveller: verified party identity, else the seat's own key. */
    key: string;
    verified: boolean;
    role?: StageRole;
    muted: boolean;
}
export interface StageSnapshot {
    revision: number;
    limit: number;
    /** Actor ids in the order an admin added them. */
    speakers: number[];
    /** Actor ids in the order they asked. */
    requests: number[];
    muted: number[];
    roles: Array<[number, StageRole]>;
}
export interface StageOutcome {
    ok: boolean;
    error?: string;
    /** An actor the caller must disconnect. */
    kick?: number;
}

export class StageAuthority {
    private seats = new Map<number, Seat>();
    private speakers: number[] = [];
    private requests: number[] = [];
    // Moderation outlives a session.
    private grants = new Map<string, StageRole>();
    private mutes = new Set<string>();
    private bans = new Map<string, number>();
    revision = 0;
    constructor(readonly limit = STAGE_SPEAKER_LIMIT) {}

    banned(key: string | undefined, now = Date.now()) {
        return !!key && (this.bans.get(key) || 0) > now;
    }
    /** The role a seat starts with: its signed claim, else an owner's grant. */
    roleFor(key: string, verified: boolean, claim?: StageRole): StageRole | undefined {
        return claim || (verified ? this.grants.get(key) : undefined);
    }
    join(id: number, key: string, verified: boolean, claim?: StageRole) {
        this.seats.set(id, { key, verified, role: this.roleFor(key, verified, claim), muted: this.mutes.has(key) });
        this.revision++;
    }
    leave(id: number) {
        if (!this.seats.delete(id)) return;
        this.drop(this.speakers, id);
        this.drop(this.requests, id);
        this.revision++;
    }
    role(id: number) {
        return this.seats.get(id)?.role;
    }
    request(id: number, cancel: boolean) {
        const seat = this.seats.get(id);
        if (!seat) return;
        if (cancel) {
            if (this.drop(this.requests, id)) this.revision++;
            return;
        }
        if (seat.muted || this.speakers.includes(id) || this.requests.includes(id) || this.requests.length >= REQUEST_LIMIT) return;
        this.requests.push(id);
        this.revision++;
    }
    leaveStage(id: number) {
        if (this.drop(this.speakers, id)) this.revision++;
    }
    admin(actorId: number, action: string, targetId: number, now = Date.now()): StageOutcome {
        const actor = this.seats.get(actorId),
            target = this.seats.get(targetId);
        if (!actor?.role || !(STAGE_ACTIONS as readonly string[]).includes(action)) return { ok: false, error: "You’re not an admin here." };
        if (!target) return { ok: false, error: "That person has left the lobby." };
        const self = actorId === targetId,
            owner = actor.role === "owner";
        // Admins cannot act on the owner or on other admins; only the owner manages admins.
        if (!self && target.role && (target.role === "owner" || !owner)) return { ok: false, error: "Only the main admin can moderate admins." };
        let kick: number | undefined;
        if (action === "stage-add") {
            if (target.muted) return { ok: false, error: "Unmute them first." };
            if (!this.speakers.includes(targetId)) {
                if (this.speakers.length >= this.limit) return { ok: false, error: `Voice is full (${this.limit} speakers).` };
                this.speakers.push(targetId);
            }
            this.drop(this.requests, targetId);
        } else if (action === "stage-remove") this.drop(this.speakers, targetId);
        else if (action === "decline-request") this.drop(this.requests, targetId);
        else if (action === "mute" || action === "unmute") {
            if (self) return { ok: false, error: "You can’t mute yourself here." };
            target.muted = action === "mute";
            if (target.muted) {
                this.mutes.add(target.key);
                this.drop(this.speakers, targetId);
                this.drop(this.requests, targetId);
            } else this.mutes.delete(target.key);
        } else if (action === "kick") {
            if (self) return { ok: false, error: "You can’t remove yourself." };
            this.bans.set(target.key, now + STAGE_KICK_BAN_MS);
            kick = targetId;
        } else {
            if (!owner) return { ok: false, error: "Only the main admin can change admins." };
            if (self) return { ok: false, error: "You’re already the main admin." };
            if (!target.verified) return { ok: false, error: "They need to sign in before they can be an admin." };
            if (action === "grant-admin") {
                this.grants.set(target.key, "admin");
                target.role = "admin";
            } else {
                this.grants.delete(target.key);
                target.role = undefined;
            }
        }
        this.revision++;
        return kick ? { ok: true, kick } : { ok: true };
    }
    snapshot(): StageSnapshot {
        const muted: number[] = [],
            roles: Array<[number, StageRole]> = [];
        for (const [id, seat] of this.seats) {
            if (seat.muted && muted.length < 256) muted.push(id);
            if (seat.role) roles.push([id, seat.role]);
        }
        return { revision: this.revision, limit: this.limit, speakers: this.speakers.slice(), requests: this.requests.slice(), muted, roles };
    }
    private drop(list: number[], id: number) {
        const at = list.indexOf(id);
        if (at < 0) return false;
        list.splice(at, 1);
        return true;
    }
}
