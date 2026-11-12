import type { LobbyTravelPeer } from "@features/lobby/lobbyJourneyProtocol";
import type { LobbyAvatar } from "@features/lobby/webgpu/avatarAdapter";
import {
    TRAVEL_ANIMATION_DURATION_MS,
    TRAVEL_ANIMATION_PLAY_MS,
    TRAVEL_ANIMATION_SPEED,
} from "@features/lobby/travelAnimationPack";
import { NATIVE_TRAVEL_IDLE_BLEND_MS } from "./nativeTravelAnimation";

type Point = { x: number; y: number; z: number };
type AvatarFactory = (
    url: string,
    options: { signal: AbortSignal; scale?: number; profilePhoto?: string }
) => Promise<LobbyAvatar>;

/** Short-lived renderers only. Never inserts fake players into multiplayer or matches by name. */
export function createLobbyTravelPeers(
    scene: { add(object: any): void; remove(object: any): void },
    createAvatar: AvatarFactory
) {
    const peers = new Map<
        string,
        {
            snapshot: LobbyTravelPeer;
            avatar?: LobbyAvatar;
            controller: AbortController;
        }
    >();
    let disposed = false;
    let anchor: Point = { x: 0, y: 0, z: 0 };
    let reduced = false;
    let lift = 0;
    let firstTime: number | undefined;
    let standingAt: number | undefined;
    const update = (now: number, nextLift = lift) => {
        if (disposed) return;
        lift = nextLift;
        firstTime ??= now;
        for (const { snapshot, avatar } of peers.values()) {
            if (!avatar) continue;
            avatar.root.position.set(
                anchor.x + snapshot.offset.x,
                anchor.y + snapshot.offset.y + lift,
                anchor.z + snapshot.offset.z
            );
            avatar.root.rotation.y = snapshot.rotation;
            const standUpMs = TRAVEL_ANIMATION_PLAY_MS.TRAVEL_STAND_UP;
            const elapsed = Math.max(0, now - (standingAt ?? firstTime));
            avatar.sampleTravelPose(
                reduced
                    ? { name: "IDLE_CC0", time: (now - firstTime) / 1000 }
                    : standingAt === undefined
                    ? { name: "TRAVEL_CROUCH_IDLE", time: elapsed / 1000 }
                    : elapsed < standUpMs
                    ? {
                          name: "TRAVEL_STAND_UP",
                          time:
                              (elapsed *
                                  TRAVEL_ANIMATION_SPEED.TRAVEL_STAND_UP) /
                              1000,
                          previous: {
                              name: "TRAVEL_CROUCH_IDLE",
                              time: (standingAt - firstTime) / 1000,
                          },
                          blend: Math.min(1, elapsed / 100),
                      }
                    : {
                          name: "IDLE_CC0",
                          time: (elapsed - standUpMs) / 1000,
                          previous: {
                              name: "TRAVEL_STAND_UP",
                              time:
                                  TRAVEL_ANIMATION_DURATION_MS.TRAVEL_STAND_UP /
                                  1000,
                          },
                          blend: Math.min(
                              1,
                              (elapsed - standUpMs) /
                                  NATIVE_TRAVEL_IDLE_BLEND_MS
                          ),
                      }
            );
        }
    };
    const disposePeer = (peer: {
        avatar?: LobbyAvatar;
        controller: AbortController;
    }) => {
        peer.controller.abort();
        if (peer.avatar) {
            scene.remove(peer.avatar.root);
            peer.avatar.dispose();
            peer.avatar = undefined;
        }
    };
    return {
        get hasAvatars() {
            for (const peer of peers.values()) if (peer.avatar) return true;
            return false;
        },
        /** Starts cosmetic loads; main geometry and local-avatar readiness never wait. */
        prepare(
            snapshots: readonly LobbyTravelPeer[],
            origin: Point,
            reducedMotion: boolean
        ) {
            if (disposed) return;
            anchor = { ...origin };
            reduced = reducedMotion;
            const next = new Map(
                snapshots.slice(0, 7).map((peer) => [peer.id, peer])
            );
            for (const [id, peer] of peers)
                if (!next.has(id)) {
                    disposePeer(peer);
                    peers.delete(id);
                }
            for (const source of next.values()) {
                const snapshot = { ...source, offset: { ...source.offset } };
                const existing = peers.get(snapshot.id);
                if (
                    existing &&
                    existing.snapshot.vrmUrl === snapshot.vrmUrl &&
                    existing.snapshot.scale === snapshot.scale &&
                    existing.snapshot.avatar === snapshot.avatar
                ) {
                    existing.snapshot = snapshot;
                    continue;
                }
                if (existing) disposePeer(existing);
                const entry: {
                    snapshot: LobbyTravelPeer;
                    avatar?: LobbyAvatar;
                    controller: AbortController;
                } = { snapshot, controller: new AbortController() };
                peers.set(snapshot.id, entry);
                void Promise.resolve()
                    .then(() => {
                        if (disposed || peers.get(snapshot.id) !== entry)
                            return;
                        return createAvatar(snapshot.vrmUrl || undefined, {
                            signal: entry.controller.signal,
                            scale: snapshot.scale,
                            profilePhoto: snapshot.avatar,
                        });
                    })
                    .then(async (avatar) => {
                        if (!avatar) return;
                        try {
                            await avatar.prepareTravel();
                        } catch (error) {
                            avatar.dispose();
                            throw error;
                        }
                        if (disposed || peers.get(snapshot.id) !== entry) {
                            avatar.dispose();
                            return;
                        }
                        entry.avatar = avatar;
                        avatar.root.name = "lobby-travel-peer";
                        // Pose the model before attachment, even when it arrives midway.
                        update(performance.now());
                        scene.add(avatar.root);
                    })
                    .catch(() => {
                        // A missing cosmetic never blocks successful entry or its peers.
                        if (peers.get(snapshot.id) === entry) {
                            disposePeer(entry);
                            peers.delete(snapshot.id);
                        }
                    });
            }
            update(performance.now());
        },
        update,
        standUp(now: number) {
            standingAt ??= now;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const peer of peers.values()) disposePeer(peer);
            peers.clear();
        },
    };
}
