import { readVisitorIdentity, type VisitorIdentity } from "../gameIdentity";

/** Native Oncyber UI relay, separate from game lifecycle/admission messages. */
export const PADEL_HOST_PROTOCOL = "oncyber:padel-social-v1";
export type PadelHostMessageType =
    | "hello"
    | "connect"
    | "state"
    | "pose"
    | "chat"
    | "shortcut"
    | "command"
    | "focus"
    | "identity"
    | "back";
export interface PadelHostState {
    identity: VisitorIdentity | null;
    active: boolean;
    mode: "visit" | "match";
    setupOpen: boolean;
}
export interface PadelHostEnvelope {
    protocol: typeof PADEL_HOST_PROTOCOL;
    attempt: string;
    type: PadelHostMessageType;
    [key: string]: unknown;
}
export function createPadelHostEnvelope(
    attempt: string,
    type: PadelHostMessageType,
    payload: Record<string, unknown> = {}
): PadelHostEnvelope {
    return { ...payload, protocol: PADEL_HOST_PROTOCOL, attempt, type };
}
/** Callers must also check exact source window and origin. */
export function readPadelHostEnvelope(
    value: unknown,
    attempt: string
): PadelHostEnvelope | null {
    const message = value as PadelHostEnvelope;
    if (
        !attempt ||
        !/^[a-z0-9-]{20,80}$/i.test(attempt) ||
        !message ||
        message.protocol !== PADEL_HOST_PROTOCOL ||
        message.attempt !== attempt ||
        ![
            "hello",
            "connect",
            "state",
            "pose",
            "chat",
            "shortcut",
            "command",
            "focus",
            "identity",
            "back",
        ].includes(message.type)
    )
        return null;
    return message;
}
export function readPadelHostState(value: unknown): PadelHostState | null {
    const state = value as PadelHostState;
    if (
        !state ||
        typeof state.active !== "boolean" ||
        typeof state.setupOpen !== "boolean" ||
        !["visit", "match"].includes(state.mode)
    )
        return null;
    const identity = readVisitorIdentity(state.identity);
    if ((state.identity !== null && !identity) || (state.active && !identity))
        return null;
    return {
        identity,
        active: state.active,
        mode: state.mode,
        setupOpen: state.setupOpen,
    };
}
const text = (value: unknown, max = 128): value is string =>
    typeof value === "string" && value.length <= max;
const finite = (value: unknown, max: number): value is number =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= max;
const asset = (value: unknown) =>
    value === "" ||
    !!readVisitorIdentity({ avatarUrl: value, pfp: value, name: "Player" });

/** Copy only public presentation commands; navigation and travel stay host-owned. */
export function readPadelHostCommand(
    value: unknown
): Record<string, any> | null {
    const command = value as Record<string, any>;
    if (!command || typeof command.type !== "string") return null;
    if (["padel:play", "padel:settings"].includes(command.type))
        return { type: command.type };
    if (["padel:input", "padel:social-ready"].includes(command.type))
        return typeof command.enabled === "boolean"
            ? { type: command.type, enabled: command.enabled }
            : null;
    if (command.type === "padel:avatar") {
        if (
            !asset(command.avatarUrl) ||
            !command.avatarUrl ||
            !asset(command.pfp)
        )
            return null;
        return {
            type: command.type,
            avatarUrl: command.avatarUrl,
            pfp: command.pfp,
        };
    }
    if (command.type === "padel:emote") {
        if (
            !Number.isInteger(command.index) ||
            command.index < -1 ||
            command.index > 127 ||
            !(command.name === null || text(command.name, 120))
        )
            return null;
        return { type: command.type, index: command.index, name: command.name };
    }
    if (
        command.type !== "padel:peers" ||
        !text(command.sessionId) ||
        !Array.isArray(command.players) ||
        command.players.length > 64
    )
        return null;
    const players = [];
    for (const peer of command.players) {
        if (
            !peer ||
            !text(peer.id) ||
            !peer.id ||
            !text(peer.username, 120) ||
            !asset(peer.vrmUrl) ||
            !asset(peer.avatar) ||
            !finite(peer.x, 80) ||
            !finite(peer.z, 80) ||
            !finite(peer.y, 30) ||
            !finite(peer.rotation, 1e6) ||
            !finite(peer.speed, Math.SQRT2 * 15) ||
            typeof peer.grounded !== "boolean" ||
            !finite(peer.verticalVelocity, 20) ||
            !finite(peer.vx, 15) ||
            !finite(peer.vz, 15) ||
            !(peer.emote === null || text(peer.emote, 120))
        )
            return null;
        players.push({
            id: peer.id,
            username: peer.username,
            vrmUrl: peer.vrmUrl,
            avatar: peer.avatar,
            x: peer.x,
            y: peer.y,
            z: peer.z,
            rotation: peer.rotation,
            // The sampler bounds each horizontal component before taking hypot.
            speed: Math.max(0, Math.min(15, peer.speed)),
            grounded: peer.grounded,
            verticalVelocity: peer.verticalVelocity,
            vx: peer.vx,
            vz: peer.vz,
            emote: peer.emote,
        });
    }
    return { type: command.type, sessionId: command.sessionId, players };
}
