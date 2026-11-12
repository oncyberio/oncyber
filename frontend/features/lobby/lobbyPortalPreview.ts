/** The native room and lobby share a same-origin, per-navigation capability.
 * Rendering synchronously keeps their two canvases on the same camera frame;
 * the lobby's stencil reveals the actual room underneath without copying pixels. */
export interface LobbyPortalView {
    cameraPosition: { x: number; y: number; z: number };
    cameraTarget: { x: number; y: number; z: number };
    playerPosition: { x: number; y: number; z: number };
    avatarRotation: number;
    avatarHeight?: number;
    movement?: {
        keys: string[];
        speed: number;
        /** Metres per second in doorway coordinates, carried into native physics. */
        velocity?: { x: number; y: number; z: number };
    };
    fov: number;
    aspect: number;
}
export const LOBBY_PORTAL_PREVIEW_KEY = "__oncyberLobbyPortalPreview";
export interface LobbyPortalPreview {
    attempt: string;
    render(view: LobbyPortalView): boolean;
}
export function readLobbyPortalView(value: unknown): LobbyPortalView | null {
    const view = value as LobbyPortalView;
    const vector = (v: LobbyPortalView["cameraPosition"]) =>
        v &&
        [v.x, v.y, v.z].every(
            (n) =>
                typeof n === "number" &&
                Number.isFinite(n) &&
                Math.abs(n) <= 1000
        );
    if (
        !view ||
        (view.movement !== undefined &&
            (!view.movement ||
                !Array.isArray(view.movement.keys) ||
                view.movement.keys.length > 10 ||
                view.movement.keys.some(
                    (code) =>
                        typeof code !== "string" ||
                        !/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(
                            code
                        )
                ) ||
                !Number.isFinite(view.movement.speed) ||
                view.movement.speed < 0 ||
                view.movement.speed > 30 ||
                (view.movement.velocity !== undefined &&
                    (!vector(view.movement.velocity) ||
                        Math.hypot(
                            view.movement.velocity.x,
                            view.movement.velocity.y,
                            view.movement.velocity.z
                        ) > 30)))) ||
        !vector(view.cameraPosition) ||
        !vector(view.cameraTarget) ||
        !vector(view.playerPosition) ||
        !Number.isFinite(view.avatarRotation) ||
        Math.abs(view.avatarRotation) > 1e6 ||
        !Number.isFinite(view.fov) ||
        view.fov <= 0 ||
        view.fov >= 180 ||
        !Number.isFinite(view.aspect) ||
        view.aspect <= 0 ||
        view.aspect > 10 ||
        (view.avatarHeight !== undefined &&
            (!Number.isFinite(view.avatarHeight) ||
                view.avatarHeight < 0.2 ||
                view.avatarHeight > 10))
    )
        return null;
    return {
        ...view,
        ...(view.movement
            ? { movement: { ...view.movement, keys: [...view.movement.keys] } }
            : {}),
        cameraPosition: { ...view.cameraPosition },
        cameraTarget: { ...view.cameraTarget },
        playerPosition: { ...view.playerPosition },
    };
}
export function getLobbyPortalPreview(
    target: Window,
    attempt: string
): LobbyPortalPreview | null {
    if (!target || !attempt) return null;
    try {
        if (target.location.origin !== window.location.origin) return null;
        const preview = target[LOBBY_PORTAL_PREVIEW_KEY] as LobbyPortalPreview;
        return preview?.attempt === attempt &&
            typeof preview.render === "function"
            ? preview
            : null;
    } catch {
        return null;
    }
}
