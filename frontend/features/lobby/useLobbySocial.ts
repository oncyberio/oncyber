import {
    LobbyFlash,
    readLobbyFlash,
} from "../../../multiplayer/protocol/lobby-flash.js";
import type {
    LobbyGroupAction,
    LobbyGroupLocation,
} from "../../../multiplayer/protocol/lobby-groups";
import { useCallback, useEffect, useRef, useState } from "react";
import { randomLobbySpawn } from "./lobbySpawn";
import {
    initialLobbySnapshot,
    LobbyConnection,
    LobbyIdentity,
    LobbyPose,
    LobbyAvatar,
    LobbyAdminAction,
    NativeSocialSpace,
} from "./LobbyConnection";

export type {
    LobbyIdentity,
    LobbyMessage,
    LobbyPlayer,
    LobbyPose,
    LobbyAvatar,
    LobbyAdminAction,
    LobbyStage,
} from "./LobbyConnection";

// Per-page identity, matching the existing multiplayer guest lifecycle. Do
// not persist this in localStorage: duplicate IDs evict each other's tabs.
const EMPTY_PLAYERS = [];
let guestId: string;
function getGuestId() {
    if (!guestId)
        guestId = `Anon-${
            globalThis.crypto?.randomUUID?.() ||
            Math.random().toString(36).slice(2)
        }`;
    return guestId;
}

export default function useLobbySocial({
    enabled,
    present = true,
    location,
    identity = {},
    endpointConfig,
    nativeSpace,
}: {
    enabled: boolean;
    /** Keep the control socket while suppressing lobby presence inside a destination. */
    present?: boolean;
    location?: LobbyGroupLocation;
    identity?: LobbyIdentity;
    /** Deployment-owned configuration; never pass arbitrary user-entered URLs. */
    endpointConfig?: string;
    /** Explicit native destination scope; does not join the main lobby transport. */
    nativeSpace?: NativeSocialSpace;
}) {
    const [snapshot, setSnapshot] = useState(initialLobbySnapshot);
    const [attempt, setAttempt] = useState(0);
    const connection = useRef<LobbyConnection>(null);
    const spawn = useRef<LobbyPose>(null);
    spawn.current ||= randomLobbySpawn();
    const pose = useRef<LobbyPose>(spawn.current);
    const { userId, username, avatar, token, vrmUrl, scale } = identity;
    const locationRef = useRef(location);
    locationRef.current = location;
    const locationKey = JSON.stringify(location);
    const presentRef = useRef(present);
    presentRef.current = present;
    const flashRef = useRef<LobbyFlash | null>(null);
    const avatarRef = useRef<LobbyAvatar>({ vrmUrl: vrmUrl || "", scale });

    useEffect(() => {
        if (!enabled) {
            flashRef.current = null;
            return;
        }
        let active = true;
        const id = userId || getGuestId();
        const client = new LobbyConnection(
            {
                userId: id,
                username: username || `Guest ${id.slice(-4).toUpperCase()}`,
                avatar,
                token,
                ...avatarRef.current,
            },
            (next) => {
                if (active) setSnapshot(next);
            },
            { endpointConfig, nativeSpace }
        );
        connection.current = client;
        if (locationRef.current)
            client.setLobbyPresence?.(presentRef.current, locationRef.current);
        else client.setLobbyPresence?.(presentRef.current);
        client.updatePosition(pose.current);
        client.setFlash?.(
            presentRef.current &&
                (!locationRef.current || locationRef.current.state === "lobby")
                ? flashRef.current
                : null
        );
        setSnapshot(initialLobbySnapshot());
        void client.connect();
        return () => {
            active = false;
            if (connection.current === client) connection.current = null;
            void client.close();
        };
    }, [
        enabled,
        userId,
        username,
        avatar,
        token,
        attempt,
        endpointConfig,
        nativeSpace,
    ]);

    useEffect(() => {
        if (
            !present ||
            (locationRef.current && locationRef.current.state !== "lobby")
        )
            flashRef.current = null;
        if (locationRef.current)
            connection.current?.setLobbyPresence?.(
                present,
                locationRef.current
            );
        else connection.current?.setLobbyPresence?.(present);
    }, [present, locationKey]);
    const groupAction = useCallback(
        (command: Omit<LobbyGroupAction, "requestId">) => {
            const client = connection.current;
            return client
                ? client.groupAction(command)
                : Promise.reject(new Error("Reconnect to use parties."));
        },
        []
    );
    const setFlash = useCallback((value: LobbyFlash | null) => {
        const next = value === null ? null : readLobbyFlash(value);
        if (value !== null && (!next || !presentRef.current)) return false;
        flashRef.current = next;
        return connection.current?.setFlash(next) || false;
    }, []);
    const setLobbyPresence = useCallback((value: boolean) => {
        presentRef.current = value;
        if (!value) flashRef.current = null;
        connection.current?.setLobbyPresence?.(value);
    }, []);
    const updateAvatar = useCallback((next: LobbyAvatar) => {
        avatarRef.current = next;
        connection.current?.updateAvatar(next);
    }, []);
    useEffect(() => {
        updateAvatar({ vrmUrl: vrmUrl || "", scale });
    }, [vrmUrl, scale, updateAvatar]);

    const advanceMovement = useCallback((dt, input) => {
        if (input.forward || input.strafe || input.jump)
            flashRef.current = null;
        return connection.current?.advanceMovement(dt, input) || null;
    }, []);
    const updatePosition = useCallback((next: LobbyPose) => {
        if (
            next.moving ||
            next.floor === false ||
            Math.hypot(
                next.x - pose.current.x,
                next.y - pose.current.y,
                next.z - pose.current.z
            ) > 0.01
        )
            flashRef.current = null;
        pose.current = next;
        connection.current?.updatePosition(next);
    }, []);
    const sendMessage = useCallback(
        (text: string, recipientId?: string) =>
            connection.current?.sendMessage(text, recipientId) || false,
        []
    );
    const toggleVoice = useCallback(async () => {
        await connection.current?.toggleVoice();
    }, []);
    const listen = useCallback(async () => {
        await connection.current?.listen();
    }, []);
    const adminAction = useCallback(
        (action: LobbyAdminAction, sessionId: string) =>
            connection.current?.adminAction(action, sessionId) ||
            Promise.resolve("You’re offline."),
        []
    );
    const requestVoice = useCallback(
        (cancel?: boolean) => connection.current?.requestVoice(cancel),
        []
    );
    const leaveStage = useCallback(() => connection.current?.leaveStage(), []);
    const leave = useCallback(async () => {
        flashRef.current = null;
        const client = connection.current;
        connection.current = null;
        await client?.close();
    }, []);
    const sampleParticipants = useCallback(
        (now?: number) =>
            connection.current?.sampleParticipants(now) || EMPTY_PLAYERS,
        []
    );
    const consumeCorrection = useCallback(() => {
        const correction = connection.current?.consumeCorrection() || null;
        if (correction) pose.current = connection.current.getPredictedPose();
        return correction;
    }, []);
    // A renderer may mount after the welcome/ack already changed prediction.
    // Take the reconciled pose and drain that delta atomically to avoid applying
    // it a second time against the new scene's origin.
    const initializePose = useCallback(() => {
        const client = connection.current;
        if (client) {
            client.consumeCorrection();
            pose.current = client.getPredictedPose();
        }
        return { ...pose.current };
    }, []);
    const getPredictedPose = useCallback(
        () => connection.current?.getPredictedPose() || pose.current,
        []
    );
    const getNetworkDiagnostics = useCallback(
        () => connection.current?.getNetworkDiagnostics() || null,
        []
    );
    const retry = useCallback(() => setAttempt((value) => value + 1), []);

    return {
        ...snapshot,
        sampleParticipants,
        consumeCorrection,
        getPredictedPose,
        initializePose,
        advanceMovement,
        getNetworkDiagnostics,
        updatePosition,
        updateAvatar,
        sendMessage,
        groupAction,
        setLobbyPresence,
        setFlash,
        toggleVoice,
        listen,
        adminAction,
        requestVoice,
        leaveStage,
        leave,
        retry,
    };
}
