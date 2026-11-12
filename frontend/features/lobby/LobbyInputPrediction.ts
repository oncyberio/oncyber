import {
    STEP,
    input,
    state,
    step,
    validState,
    MovementInput,
    MovementState,
    NumberedInput,
} from "../../../multiplayer/protocol/movement";
/** Fixed-step input history. Corrections replay only unacknowledged inputs. */
export class LobbyInputPrediction {
    state = state();
    private sequence = 0;
    private acknowledged = 0;
    private accumulator = 0;
    private history: NumberedInput[] = [];
    replayed = 0;
    corrections = 0;
    correctionDistance = 0;
    reset(p: Partial<MovementState>) {
        this.state = state(p);
        this.sequence = this.acknowledged = 0;
        this.accumulator = 0;
        this.history = [];
    }
    advance(dt: number, controls: MovementInput) {
        this.accumulator = Math.min(
            0.1,
            this.accumulator + Math.max(0, Number.isFinite(dt) ? dt : 0)
        );
        const normalized = input(controls);
        while (this.accumulator + 1e-9 >= STEP) {
            this.accumulator -= STEP;
            const command = { ...normalized, sequence: ++this.sequence };
            step(this.state, command);
            this.history.push(command);
        }
        // Three seconds; an older acknowledgement requires a fresh input timeline.
        if (this.history.length > 180)
            this.history.splice(0, this.history.length - 180);
        return {
            ...step({ ...this.state }, normalized, this.accumulator),
            movementInput: normalized,
        };
    }
    packet() {
        return this.history.slice(-12);
    }
    acknowledge(message: any) {
        if (
            !Number.isSafeInteger(message?.seq) ||
            message.seq < 0 ||
            message.seq > this.sequence ||
            (!message.resetInputs && message.seq <= this.acknowledged) ||
            !validState(message.state)
        )
            return false;
        if (
            !message.resetInputs &&
            this.history.length &&
            message.seq < this.history[0].sequence - 1
        )
            return false;
        const before = this.state;
        this.state = { ...message.state };
        if (message.resetInputs) {
            this.sequence = message.seq;
            this.history = [];
            this.accumulator = 0;
        } else {
            this.history = this.history.filter((i) => i.sequence > message.seq);
            for (const i of this.history) {
                step(this.state, i);
                this.replayed++;
            }
        }
        this.acknowledged = message.seq;
        const error = Math.hypot(
            before.x - this.state.x,
            before.y - this.state.y,
            before.z - this.state.z
        );
        if (error > 0.002) {
            this.corrections++;
            this.correctionDistance = Math.max(this.correctionDistance, error);
        }
        return true;
    }
    get pending() {
        return this.history.length;
    }
}
