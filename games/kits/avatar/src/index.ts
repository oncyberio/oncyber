/**
 * The Oncyber avatar kit: an optional library for three.js games. It shows
 * the visitor and the other players as their Oncyber avatars, plays the
 * lobby's animations and emotes, puts a name tag and a talking indicator
 * over each head, and stages the arrival pose. A game bundles it; the
 * lifecycle runtime never imports it. Rule and check: docs/games/avatar-kit.md.
 */
import * as THREE from "three";
import { createArrival, faces, type Arrival } from "./arrival.ts";
import type { AvatarFacts } from "./facts.js";
import { poseCode, readPoseCode, EMOTE_ORDER } from "./motion.ts";
import {
    PEER_DELAY,
    pushSample,
    readPeer,
    samplePose,
    type PeerSample,
} from "./peers.ts";
import {
    createAvatar,
    type Avatar,
    type ClipData,
    type VrmLike,
} from "./rig.ts";
import { createNameTag, type CanvasFactory, type NameTag } from "./tag.ts";
import { loadVRM } from "./vrm.ts";

export * from "./arrival.ts";
export * from "./facts.js";
export * from "./motion.ts";
export * from "./peers.ts";
export { drawProbe } from "./probe.js";
export {
    createAvatar,
    retargetClip,
    type Avatar,
    type VrmLike,
    type ClipData,
} from "./rig.ts";
export { createNameTag, type NameTag } from "./tag.ts";
export { loadVRM } from "./vrm.ts";

type Clips = Record<string, ClipData>;

export interface AvatarKitOptions {
    /** The game context's `services`: the visitor's avatar ref and `avatar()` bytes. */
    services: {
        identity: { avatar?: string };
        avatar?(ref: string, signal: AbortSignal): Promise<ArrayBuffer>;
    };
    /** The lobby's locomotion clips (the kit's motion/locomotion.json), fetched however the game loads files. */
    motion: () => Promise<Clips | null>;
    /** The lobby's emotes (motion/emotes.json or the game's own pick), fetched the first time one plays. */
    emotes?: () => Promise<Clips | null>;
    /** Bytes to an avatar. Defaults to `loadVRM`; a game with its own glTF reader passes that. */
    load?: (bytes: ArrayBuffer) => Promise<VrmLike>;
    /** Avatar height in the game's metres. */
    height?: number;
    /** Added to a peer pose's `h` so that 0 faces +z, for games whose forward is another way. */
    heading?: number;
    /** Give the visitor a stand-in body until their avatar loads. Off when the game has its own. */
    standIn?: boolean;
    /** Avatars loading at once. */
    maxLoads?: number;
    signal?: AbortSignal;
    canvas?: CanvasFactory;
    now?: () => number;
    onError?: (error: unknown, who: string) => void;
}

export interface OtherPlayer {
    id: string;
    name: string;
    vrm: string;
    talking: boolean;
    avatar: Avatar;
    tag: NameTag;
    samples: PeerSample[];
    drawn: boolean;
}

export interface AvatarKit {
    /** The visitor. Add `self.root` to the scene, place it, and set `self.motion`. */
    readonly self: Avatar;
    /** Everyone else, placed from their room poses. Add it to the scene once. */
    readonly group: THREE.Group;
    readonly others: ReadonlyMap<string, OtherPlayer>;
    readonly arrival: Arrival;
    /** Loads the visitor's avatar and the locomotion clips. Resolves false when the stand-in stays. */
    loadSelf(): Promise<boolean>;
    /** The page's `peers` list: `[{ id, name, vrm, x, y, z, h, a, talking }]`. */
    setPeers(list: unknown): void;
    /** Play a lobby emote on the visitor until `emote("")` or the game sets another motion. */
    emote(name: string): void;
    /** The visitor's pose for the page's `pose` message, with the motion encoded in `a`. */
    pose(
        position: { x: number; y: number; z: number },
        heading: number
    ): { x: number; y: number; z: number; h: number; a: number };
    /** Once a frame, before rendering. */
    update(seconds: number, camera: THREE.Camera): void;
    /** Spread into the game's `inspect()`. */
    inspect(): AvatarFacts;
    dispose(): void;
}

const point = new THREE.Vector3();
const TAG_COLORS = [0xff5f7e, 0x2f7bff, 0xffc23d, 0x3fbf5a, 0xa07bff, 0xff8a4a];
const colorFor = (id: string) => {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return TAG_COLORS[h % TAG_COLORS.length];
};

export function createAvatarKit(options: AvatarKitOptions): AvatarKit {
    const height = options.height ?? 1.75;
    const now = options.now ?? (() => performance.now() / 1000);
    const load = options.load ?? ((bytes: ArrayBuffer) => loadVRM(bytes));
    const lifetime = new AbortController();
    options.signal?.addEventListener("abort", () => lifetime.abort(), {
        once: true,
    });
    const report =
        options.onError ??
        ((error, who) => console.warn(`[avatar kit] ${who}`, error));
    const self = createAvatar({ height, standIn: options.standIn });
    const group = new THREE.Group();
    group.name = "other-players";
    const others = new Map<string, OtherPlayer>();
    const arrival = createArrival();
    let camera: THREE.Camera | null = null,
        selfDrawn = false,
        disposed = false;

    let motion: Promise<Clips | null> | null = null,
        emotes: Promise<Clips | null> | null = null;
    const once = (
        source: (() => Promise<Clips | null>) | undefined,
        what: string
    ) =>
        source
            ? source().catch((error) => {
                  report(error, what);
                  return null;
              })
            : Promise.resolve(null);
    const locomotion = () => (motion ??= once(options.motion, "motion"));
    const emoteClips = () => (emotes ??= once(options.emotes, "emotes"));
    const giveEmotes = (avatar: Avatar, name: string) => {
        if (
            !options.emotes ||
            avatar.hasClip(name) ||
            !EMOTE_ORDER.includes(name as any)
        )
            return;
        void emoteClips().then((clips) => {
            if (!disposed) avatar.addClips(clips);
        });
    };

    const fetchAvatar = async (avatar: Avatar, ref: string) => {
        if (!options.services.avatar) throw new Error("AVATAR_SERVICE_MISSING");
        const [bytes, clips] = await Promise.all([
            options.services.avatar(ref, lifetime.signal),
            locomotion(),
        ]);
        const vrm = await load(bytes);
        if (disposed) {
            vrm.dispose?.();
            throw new Error("KIT_DISPOSED");
        }
        avatar.attach(vrm);
        avatar.addClips(clips);
    };

    // Other players' avatars load a few at a time.
    let loading = 0;
    const queue: Array<() => void> = [];
    const loadOther = (player: OtherPlayer, ref: string) => {
        const run = () => {
            if (
                disposed ||
                others.get(player.id) !== player ||
                player.vrm !== ref ||
                player.avatar.kind === "vrm"
            )
                return next();
            loading++;
            fetchAvatar(player.avatar, ref)
                .catch((error) => report(error, `player ${player.id}`))
                .finally(() => {
                    loading--;
                    next();
                });
        };
        const next = () => {
            if (loading < (options.maxLoads ?? 2)) queue.shift()?.();
        };
        queue.push(run);
        next();
    };

    const addOther = (id: string): OtherPlayer => {
        const avatar = createAvatar({ height, color: colorFor(id) });
        const tag = createNameTag("…", { canvas: options.canvas });
        tag.object.position.y = height + 0.22;
        avatar.root.add(tag.object);
        avatar.root.visible = false; // until its first pose is placed
        group.add(avatar.root);
        const player: OtherPlayer = {
            id,
            name: "",
            vrm: "",
            talking: false,
            avatar,
            tag,
            samples: [],
            drawn: false,
        };
        others.set(id, player);
        return player;
    };

    return {
        self,
        group,
        others,
        arrival,
        async loadSelf() {
            const ref = options.services.identity.avatar;
            try {
                if (!ref) {
                    self.addClips(await locomotion());
                    return false;
                }
                await fetchAvatar(self, ref);
                return true;
            } catch (error) {
                if (!disposed) report(error, "visitor");
                return false;
            }
        },
        setPeers(list) {
            if (disposed) return;
            const t = now();
            const alive = new Set<string>();
            for (const raw of Array.isArray(list) ? list.slice(0, 32) : []) {
                const peer = readPeer(raw);
                if (!peer || alive.has(peer.id)) continue;
                alive.add(peer.id);
                const player = others.get(peer.id) ?? addOther(peer.id);
                if (peer.name !== player.name) {
                    player.name = peer.name;
                    player.tag.setName(peer.name);
                }
                if (peer.talking !== player.talking) {
                    player.talking = peer.talking;
                    player.tag.setTalking(peer.talking);
                }
                if (peer.vrm && peer.vrm !== player.vrm) {
                    player.vrm = peer.vrm;
                    loadOther(player, peer.vrm);
                }
                pushSample(player.samples, peer.pose, t, peer.fresh);
            }
            for (const player of [...others.values()]) {
                if (alive.has(player.id)) continue;
                player.tag.dispose();
                player.avatar.dispose();
                others.delete(player.id);
            }
        },
        emote(name) {
            self.motion = name ? { emote: name } : {};
            if (name) giveEmotes(self, name);
        },
        pose(position, heading) {
            return {
                x: position.x,
                y: position.y,
                z: position.z,
                h: heading,
                a: poseCode(self.motion),
            };
        },
        update(seconds, view) {
            if (disposed) return;
            camera = view;
            arrival.update(seconds);
            selfDrawn = self.takeDrawn();
            self.drive(seconds, arrival.crouch);
            const t = now() - PEER_DELAY;
            for (const player of others.values()) {
                player.drawn = player.avatar.takeDrawn();
                const pose = samplePose(player.samples, t);
                if (!pose) continue;
                const root = player.avatar.root;
                root.visible = true;
                root.position.set(pose.x, pose.y, pose.z);
                root.rotation.y = pose.h + (options.heading ?? 0);
                player.avatar.motion = readPoseCode(pose.a, pose.speed);
                if (player.avatar.motion.emote)
                    giveEmotes(player.avatar, player.avatar.motion.emote);
                player.avatar.drive(seconds);
                player.tag.update(seconds);
            }
        },
        inspect() {
            let inFrame = false,
                facing = false;
            if (camera) {
                self.root.updateWorldMatrix(true, false);
                camera.updateMatrixWorld();
                const feet = self.root.getWorldPosition(new THREE.Vector3());
                // Drawn by the renderer last frame, with the body's middle inside the view.
                point
                    .copy(feet)
                    .setY(feet.y + height * 0.5 * (1 - arrival.crouch * 0.4))
                    .project(camera);
                inFrame =
                    selfDrawn &&
                    Math.abs(point.x) <= 1 &&
                    Math.abs(point.y) <= 1 &&
                    point.z > -1 &&
                    point.z < 1;
                const eye = camera.getWorldPosition(new THREE.Vector3());
                const forward = self.root.getWorldDirection(
                    new THREE.Vector3()
                );
                facing = faces(feet, Math.atan2(forward.x, forward.z), eye);
            }
            const shown = [...others.values()].filter((p) => p.drawn);
            return {
                avatarSelf: self.kind,
                avatarSelfInFrame: inFrame,
                avatarOthers: others.size,
                avatarOthersDrawn: shown.length,
                avatarOthersVrm: shown.filter((p) => p.avatar.kind === "vrm")
                    .length,
                avatarArrival: arrival.phase,
                avatarFacingCamera: facing,
                avatarHandsEmpty: arrival.handsEmpty,
                avatarTalking: [...others.values()].filter((p) => p.talking)
                    .length,
                avatarEmote: self.motion.emote ?? "",
            };
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            lifetime.abort();
            queue.length = 0;
            for (const player of others.values()) {
                player.tag.dispose();
                player.avatar.dispose();
            }
            others.clear();
            group.parent?.remove(group);
            self.dispose();
        },
    };
}
