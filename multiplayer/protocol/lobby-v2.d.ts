export const VERSION: 2;
export const MOVEMENT_BYTES: 24;
export const SNAPSHOT_HEADER_BYTES: 22;
export const POSE_BYTES: 26;
export const DEFAULT_DATAGRAM_BYTES: 1200;
export const DEFAULT_CONTROL_BYTES: 16384;
export interface Movement {
    sequence: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    animation: number;
    floor: boolean | 0 | 1;
}
export type Pose = [number, number, number, number, number, number, number, boolean | 0 | 1, number?, number?, number?];
export interface Snapshot {
    motion?: boolean;
    epoch: number;
    tick: number;
    serverTime: number;
    poses: Pose[];
}
export type Binary = ArrayBuffer | ArrayBufferView;
export interface Control {
    type: string;
    data: any;
}
export interface ControlOptions {
    maxFrameBytes?: number;
}
export function encodeMovement(move: Movement): Uint8Array;
export function decodeMovement(bytes: Binary): Movement | null;
export function encodeMotionPose(pose: Pose, target?: Uint8Array): Uint8Array;
export function encodePose(pose: Pose): Uint8Array;
export function encodeSnapshotParts(frame: Omit<Snapshot, "poses"> & { poses: Uint8Array[] }, maxBytes?: number): Uint8Array[];
export function encodeSnapshots(frame: Snapshot, maxBytes?: number): Uint8Array[];
export function decodeSnapshot(bytes: Binary): (Snapshot & { chunk: number }) | null;
export function encodeControl(type: string, data: any, options?: ControlOptions): Uint8Array;
export function createControlDecoder(onMessage: (message: Control) => void, options?: ControlOptions): { push(bytes: Binary): void; finish(): void };
