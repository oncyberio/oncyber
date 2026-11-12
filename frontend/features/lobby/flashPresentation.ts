import { takeFlashPreview } from "./flashPreview";
import type * as Three from "three";
import type { LobbyAvatar } from "./webgpu/avatarAdapter";
import type { LobbyFlash } from "../../../multiplayer/protocol/lobby-flash";
import { createFlashFrame, flashFrameLayout } from "./flashFrame";
import { lobbyErrorMessage } from "./lobbyErrors";

type Actor = {
    id: string;
    flash: LobbyFlash;
    /** Shown in the viewer's artwork info bubble. */
    name?: string;
    avatar: LobbyAvatar;
    parent: Three.Group;
    local?: boolean;
    reducedMotion?: boolean;
};
type TextureResult = { texture: Three.Texture; aspect: number };
type Frame = ReturnType<typeof createFlashFrame>;
type Entry = {
    actor: Actor;
    frame: Frame;
    texture?: Three.Texture;
    controller: AbortController;
    ready: boolean;
    progress: number;
    ending: boolean;
    /** Ended by its own timeout: finish the authored take, don't cut it. */
    graceful: boolean;
    /** Seconds since the gesture started. */
    clock: number;
    baseY: number;
    unit: number;
    seen: boolean;
};

/** Each Flash shows for this long, then lowers its arms and pops away. */
export const FLASH_SHOW_MS = 5000;
// The frame pops in as the hands come up, and settles in ~0.6 s.
const POP_DELAY = 0.3;
const POP_IN = 0.6;
const POP_OUT = 0.45;
const BOB_PERIOD = 3.6;

export type FlashFocus = { id: string; flash: LobbyFlash; name?: string };

/** Decode only when selected; stale image completions never attach to a new Flash. */
export function loadFlashTexture(
    THREE: typeof Three,
    url: string,
    signal: AbortSignal
): Promise<TextureResult> {
    const preview = !signal.aborted && takeFlashPreview(url);
    if (preview) {
        const texture = new THREE.CanvasTexture(preview.canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        return Promise.resolve({ texture, aspect: preview.aspect });
    }
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        let settled = false;
        const timeout = window.setTimeout(
            () => fail(new Error("This NFT’s image took too long to load.")),
            15000
        );
        const cleanup = () => {
            window.clearTimeout(timeout);
            image.onload = null;
            image.onerror = null;
            signal.removeEventListener("abort", abort);
        };
        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            image.removeAttribute("src");
            reject(error);
        };
        const abort = () => fail(new Error("Flash cancelled"));
        signal.addEventListener("abort", abort, { once: true });
        image.onerror = () =>
            fail(new Error("This NFT’s image couldn’t load."));
        image.onload = () => {
            if (settled) return;
            if (signal.aborted) return abort();
            try {
                const width = image.naturalWidth;
                const height = image.naturalHeight;
                if (!width || !height)
                    throw new Error("This NFT has no image.");
                // Bound upload and retained GPU memory, including very large originals.
                const size = Math.min(1, 1024 / Math.max(width, height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(width * size));
                canvas.height = Math.max(1, Math.round(height * size));
                const context = canvas.getContext("2d");
                if (!context)
                    throw new Error("This NFT’s image couldn’t open.");
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.anisotropy = 4;
                settled = true;
                cleanup();
                image.removeAttribute("src");
                resolve({ texture, aspect: width / height });
            } catch (error) {
                fail(error);
            }
        };
        if (signal.aborted) abort();
        else image.src = url;
    });
}

/** One bounded presentation per admitted actor, sharing the existing renderer. */
export function createFlashPresentation(
    THREE: typeof Three,
    options: {
        loadTexture?: typeof loadFlashTexture;
        onReady?: (flash: LobbyFlash) => void;
        onError?: (flash: LobbyFlash, message: string) => void;
        /** The local Flash reached FLASH_SHOW_MS and is ending on its own. */
        onTimeout?: (flash: LobbyFlash) => void;
    } = {}
) {
    const entries = new Map<string, Entry>();
    // A broken or finished remote poster stays in its profile until its next
    // selection. Do not recreate its frame and replay it on every render.
    const failures = new Map<
        string,
        { nonce: string; avatar: LobbyAvatar; seen: boolean }
    >();
    const loadTexture = options.loadTexture ?? loadFlashTexture;
    const world = new THREE.Vector3();
    const view = new THREE.Vector3();
    let disposed = false;
    const release = (entry: Entry) => {
        entry.controller.abort();
        // A graceful ending lets the avatar finish lowering its arms itself.
        if (!entry.graceful) entry.actor.avatar.stopFlash?.();
        entry.frame.group.removeFromParent();
        entry.frame.dispose();
        entry.texture?.dispose();
        entry.texture = undefined;
    };
    const end = (entry: Entry, graceful = entry.ready) => {
        if (entry.ending) return;
        entry.ending = true;
        entry.controller.abort();
        entry.graceful = graceful && !!entry.actor.avatar.endFlash;
        if (entry.graceful) entry.actor.avatar.endFlash();
        else entry.actor.avatar.stopFlash?.();
    };
    const settle = (id: string, entry: Entry) =>
        failures.set(id, {
            nonce: entry.actor.flash.nonce,
            avatar: entry.actor.avatar,
            seen: entry.seen,
        });
    return {
        beginFrame() {
            for (const entry of entries.values()) entry.seen = false;
            for (const failure of failures.values()) failure.seen = false;
        },
        sync(actor: Actor) {
            if (disposed) return;
            const failure = failures.get(actor.id);
            if (failure) {
                if (
                    failure.nonce === actor.flash.nonce &&
                    failure.avatar === actor.avatar
                ) {
                    failure.seen = true;
                    const finishing = entries.get(actor.id);
                    if (finishing) finishing.seen = true;
                    return;
                }
                failures.delete(actor.id);
            }
            let entry = entries.get(actor.id);
            if (
                entry &&
                (entry.actor.flash.nonce !== actor.flash.nonce ||
                    entry.actor.avatar !== actor.avatar ||
                    entry.ending)
            ) {
                if (entry.actor.avatar !== actor.avatar) entry.graceful = false;
                release(entry);
                entries.delete(actor.id);
                entry = undefined;
            }
            if (entry) {
                entry.seen = true;
                entry.actor = actor;
                return;
            }
            const frame = createFlashFrame(THREE, { maxSize: 0.88 });
            frame.group.name = `lobby-flash-${actor.id}`;
            // The native lobby rig faces local -Z. Raise the artwork toward
            // the shoulders and place it slightly behind the avatar (+Z).
            const height = actor.avatar.height || 1.8;
            const unit = height / 1.8;
            // Negative local X is screen-right when facing the avatar.
            frame.group.position.set(-height * 0.18, height * 0.82, height * 0.16);
            frame.group.rotation.y = Math.PI;
            frame.group.scale.setScalar(unit * 1.1 * 1.2);
            frame.setPresentation(0);
            actor.parent.add(frame.group);
            entry = {
                actor,
                frame,
                controller: new AbortController(),
                ready: false,
                progress: 0,
                ending: false,
                graceful: false,
                clock: 0,
                baseY: height * 0.82,
                unit,
                seen: true,
            };
            entries.set(actor.id, entry);
            const active = entry;
            const live = () =>
                !disposed &&
                !active.controller.signal.aborted &&
                entries.get(actor.id) === active;
            // Own the image immediately: an animation failure must not leak its texture.
            const image = loadTexture(
                THREE,
                actor.flash.imageUrl,
                active.controller.signal
            ).then((result) => {
                if (!live()) {
                    result.texture.dispose();
                    return;
                }
                active.texture = result.texture;
                frame.setArtwork(result.texture, result.aspect);
                // Grow toward screen top-right, keeping the previous bottom-left fixed.
                const layout = flashFrameLayout(result.aspect, 0.88);
                const offset = unit * 1.1 * 0.1;
                frame.group.position.x = -height * 0.18 - layout.width * offset;
                active.baseY = height * 0.82 + layout.height * offset;
                frame.group.position.y = active.baseY;
            });
            void Promise.all([
                image,
                Promise.resolve().then(() => actor.avatar.prepareFlash?.()),
            ])
                .then(async () => {
                    if (!live()) return;
                    await actor.avatar.playFlash?.({
                        reducedMotion: actor.reducedMotion,
                    });
                    if (!live()) return;
                    active.ready = true;
                    active.clock = 0;
                    if (actor.local) options.onReady?.(actor.flash);
                })
                .catch((error) => {
                    if (!live()) return;
                    settle(actor.id, active);
                    end(active, false);
                    if (actor.local)
                        options.onError?.(
                            actor.flash,
                            lobbyErrorMessage(
                                error,
                                "This NFT couldn’t be flashed."
                            )
                        );
                });
        },
        finishFrame(delta: number, reducedMotion = false) {
            for (const [id, failure] of failures) {
                if (!failure.seen) failures.delete(id);
            }
            for (const [id, entry] of entries) {
                if (!entry.seen) end(entry);
                if (entry.ready) entry.clock += delta;
                if (
                    entry.ready &&
                    !entry.ending &&
                    entry.clock * 1000 >= FLASH_SHOW_MS
                ) {
                    // Remember the nonce, so its profile can't replay it.
                    settle(id, entry);
                    end(entry, true);
                    if (entry.actor.local)
                        options.onTimeout?.(entry.actor.flash);
                }
                const showing =
                    entry.ready &&
                    !entry.ending &&
                    (reducedMotion || entry.clock >= POP_DELAY);
                entry.progress = reducedMotion
                    ? Number(showing)
                    : Math.max(
                          0,
                          Math.min(
                              1,
                              entry.progress +
                                  (showing ? delta / POP_IN : -delta / POP_OUT)
                          )
                      );
                const p = entry.progress;
                entry.frame.setPresentation(p);
                // The artwork floats with the avatar's breath.
                entry.frame.group.position.y =
                    entry.baseY +
                    (reducedMotion
                        ? 0
                        : Math.sin((entry.clock / BOB_PERIOD) * Math.PI * 2) *
                          0.012 *
                          entry.unit);
                if (entry.ending && p === 0) {
                    release(entry);
                    entries.delete(id);
                }
            }
        },
        /** The settled Flash nearest the middle of this camera's view. */
        focus(camera: Three.Camera, maxDistance = 10): FlashFocus | null {
            let best: FlashFocus | null = null;
            let bestScore = Infinity;
            for (const [id, entry] of entries) {
                if (entry.ending || entry.progress < 0.6) continue;
                entry.frame.group.getWorldPosition(world);
                if (camera.position.distanceTo(world) > maxDistance) continue;
                view.copy(world).project(camera);
                if (
                    view.z < -1 ||
                    view.z > 1 ||
                    Math.abs(view.x) > 0.45 ||
                    Math.abs(view.y) > 0.65
                )
                    continue;
                const score = view.x * view.x + view.y * view.y;
                if (score < bestScore) {
                    bestScore = score;
                    best = {
                        id,
                        flash: entry.actor.flash,
                        name: entry.actor.name,
                    };
                }
            }
            return best;
        },
        /** Still on screen, including its outro after its Flash was cleared. */
        has(id: string) {
            return entries.has(id);
        },
        clear() {
            for (const entry of entries.values()) {
                entry.graceful = false;
                release(entry);
            }
            entries.clear();
            failures.clear();
        },
        dispose() {
            disposed = true;
            this.clear();
        },
        get count() {
            return entries.size;
        },
    };
}
