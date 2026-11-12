import type { LobbyPose } from "./LobbyConnection";
export type LobbyCorrection = {
    sequence: number;
    x: number;
    y: number;
    z: number;
    rotation: number;
    hardSnap: boolean;
};
const angle = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));
const valid = (position: unknown): position is number[] =>
    Array.isArray(position) &&
    position.length === 4 &&
    position.every(Number.isFinite);
/** Client pose prediction with authoritative delta replay for the open lobby.
 * This deliberately does not claim collision-aware deterministic input replay. */
export class LobbyPrediction {
    pose: LobbyPose = {
        x: 0,
        y: 0,
        z: 4,
        rotation: 0,
        animation: -1,
        floor: true,
    };
    private sequence = 0;
    private acknowledged = 0;
    private sent = new Map<number, LobbyPose>();
    private pending: LobbyCorrection | null = null;
    corrections = 0;
    resetSession() {
        this.sequence = this.acknowledged = 0;
        this.sent.clear();
    }
    packet() {
        const sequence = ++this.sequence;
        this.sent.set(sequence, { ...this.pose });
        while (this.sent.size > 128)
            this.sent.delete(this.sent.keys().next().value);
        return [
            sequence,
            this.pose.x,
            this.pose.y,
            this.pose.z,
            this.pose.rotation,
            this.pose.animation ?? -1,
            this.pose.floor !== false,
        ];
    }
    welcome(position: unknown) {
        if (!valid(position)) return false;
        this.resetSession();
        this.apply(position, this.pose, 0, true);
        return true;
    }
    acknowledge(message: any) {
        if (
            !Number.isSafeInteger(message?.seq) ||
            message.seq <= this.acknowledged ||
            !valid(message.position)
        )
            return false;
        const sent = this.sent.get(message.seq);
        if (!sent) return false;
        this.acknowledged = message.seq;
        this.apply(message.position, sent, message.seq, false);
        for (const sequence of this.sent.keys())
            if (sequence <= message.seq) this.sent.delete(sequence);
        return true;
    }
    reconcileState(
        state: { x: number; y: number; z: number; rotation: number },
        sequence: number
    ) {
        this.apply(
            [state.x, state.y, state.z, state.rotation],
            this.pose,
            sequence,
            false
        );
    }
    private apply(
        position: number[],
        sent: LobbyPose,
        sequence: number,
        hardSnap: boolean
    ) {
        const correction = {
            sequence,
            x: position[0] - sent.x,
            y: position[1] - sent.y,
            z: position[2] - sent.z,
            rotation: angle(position[3] - sent.rotation),
            hardSnap,
        };
        if (
            ![
                correction.x,
                correction.y,
                correction.z,
                correction.rotation,
            ].some((value) => Math.abs(value) > 0.0001)
        )
            return;
        for (const pose of [this.pose, ...this.sent.values()]) {
            pose.x += correction.x;
            pose.y += correction.y;
            pose.z += correction.z;
            pose.rotation += correction.rotation;
        }
        if (this.pending) {
            correction.x += this.pending.x;
            correction.y += this.pending.y;
            correction.z += this.pending.z;
            correction.rotation += this.pending.rotation;
            correction.hardSnap ||= this.pending.hardSnap;
        }
        this.pending = correction;
        this.corrections++;
    }
    consume = () => {
        const correction = this.pending;
        this.pending = null;
        return correction;
    };
    get pendingPackets() {
        return this.sent.size;
    }
}
