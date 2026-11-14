import { EMOTES } from "@components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/constants";
import type { LobbyPlayer, LobbyPose } from "@features/lobby/LobbyConnection";

export interface VisitBridge {
    receivePose: (value: unknown) => void;
    focusChat: () => void;
    receiveShortcut: (slot: unknown) => void;
}

/** Only bounded presentation/motion data can enter the native room. */
export function readGymPose(value: unknown): LobbyPose | null {
    const pose = value as Record<string, unknown>;
    if (
        !pose ||
        !["x", "y", "z", "rotation"].every(
            (key) => typeof pose[key] === "number" && Number.isFinite(pose[key])
        )
    )
        return null;
    if (
        Math.abs(pose.x as number) > 80 ||
        Math.abs(pose.z as number) > 80 ||
        (pose.y as number) < -5 ||
        (pose.y as number) > 30
    )
        return null;
    const finite = (input: unknown, limit: number) =>
        typeof input === "number" && Number.isFinite(input)
            ? Math.max(-limit, Math.min(limit, input))
            : 0;
    const emote =
        typeof pose.emote === "string"
            ? EMOTES.findIndex((item) => item.name === pose.emote)
            : pose.emote;
    return {
        x: pose.x as number,
        y: pose.y as number,
        z: pose.z as number,
        rotation: Math.atan2(
            Math.sin(pose.rotation as number),
            Math.cos(pose.rotation as number)
        ),
        animation:
            Number.isInteger(emote) &&
            (emote as number) >= -1 &&
            (emote as number) <= 127
                ? (emote as number)
                : -1,
        floor: pose.grounded !== false,
        speed: Math.max(0, finite(pose.speed, 15)),
        vy: finite(pose.verticalVelocity, 20),
        vx: finite(pose.vx, 15),
        vz: finite(pose.vz, 15),
        moving: finite(pose.speed, 15) > 0.05,
    };
}

/** Never forward tokens, account IDs, room internals or main-lobby party state. */
export function gymPeers(players: LobbyPlayer[], sessionId: string) {
    return players
        .filter((player) => !player.isLocal && player.id !== sessionId)
        .slice(0, 64)
        .map((player) => ({
            id: player.id,
            username: player.name,
            vrmUrl: player.vrmUrl,
            avatar: player.avatar,
            x: player.x,
            y: player.y,
            z: player.z,
            rotation: player.rotation,
            speed: Number.isFinite(player.speed)
                ? player.speed
                : Math.hypot(player.vx || 0, player.vz || 0),
            grounded: player.floor !== false,
            verticalVelocity: player.vy || 0,
            vx: player.vx || 0,
            vz: player.vz || 0,
            emote: EMOTES[player.animation]?.name || null,
        }));
}

/** Native CyberRoom packets omit velocity. Derive it from the smoothed roster,
 * keeping the same coordinate/heading convention and rejecting teleport spikes. */
export function createGymPeerSampler() {
    const previous = new Map<
        string,
        { x: number; y: number; z: number; time: number }
    >();
    return (
        players: LobbyPlayer[],
        sessionId: string,
        now = performance.now()
    ) => {
        const alive = new Set(players.map((player) => player.id));
        for (const id of previous.keys())
            if (!alive.has(id)) previous.delete(id);
        const moving = players.map((player) => {
            const old = previous.get(player.id);
            const dt = old ? (now - old.time) / 1000 : 0;
            const continuous =
                dt > 0 &&
                dt < 0.5 &&
                Math.hypot(
                    player.x - old.x,
                    player.y - old.y,
                    player.z - old.z
                ) < 6;
            const bounded = (value: number, limit: number) =>
                Math.max(-limit, Math.min(limit, value));
            const vx = continuous ? bounded((player.x - old.x) / dt, 15) : 0;
            const vz = continuous ? bounded((player.z - old.z) / dt, 15) : 0;
            const vy = continuous ? bounded((player.y - old.y) / dt, 20) : 0;
            previous.set(player.id, {
                x: player.x,
                y: player.y,
                z: player.z,
                time: now,
            });
            return { ...player, vx, vz, vy };
        });
        return gymPeers(moving, sessionId);
    };
}
