import { MovementState, NumberedInput } from "./movement";
export interface InputAcknowledgement {
    seq: number;
    state: MovementState;
    resetInputs: boolean;
    position: number[];
    animation: number;
    floor: boolean;
    serverTime: number;
    corrected: boolean;
}
export class InputAuthority {
    state: MovementState;
    sequence: number;
    yaw: number;
    simulated: number;
    missing: number;
    constructor(p: Partial<MovementState>, now: number);
    place(p: Partial<MovementState>, now: number): InputAcknowledgement;
    discard(inputs: NumberedInput[], now: number): InputAcknowledgement;
    diagnostics(): { queued: number; missing: number; simulated: number };
    receive(inputs: NumberedInput[]): void;
    advance(now: number): InputAcknowledgement | null;
}
