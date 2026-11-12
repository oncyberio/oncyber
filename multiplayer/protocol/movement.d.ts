export interface MovementInput {
    strafe: number;
    forward: number;
    yaw: number;
    running: boolean;
    jump: boolean;
    animation: number;
}
export interface NumberedInput extends MovementInput {
    sequence: number;
}
export interface MovementState {
    x: number;
    y: number;
    z: number;
    rotation: number;
    vx: number;
    vz: number;
    vy: number;
    jumpHeld: boolean;
    jumpCount?: number;
    animation: number;
    floor: boolean;
}
export const STEP: number;
export const ACCELERATION: number;
export function advanceVelocity(s: { vx: number; vz: number }, strafe: number, forward: number, running: boolean, dt: number): void;
export function input(value: MovementInput): MovementInput;
export function state(p?: Partial<MovementState>): MovementState;
export function step(s: MovementState, i: MovementInput, dt?: number): MovementState;
export function validState(s: unknown): s is MovementState;
export function encodeInputs(inputs: NumberedInput[]): Uint8Array;
export function decodeInputs(bytes: Uint8Array): NumberedInput[] | null;
