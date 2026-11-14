/**
 * Leaving a game: the mirror of arrival. On the way in the page hands the
 * game the lobby's last third-person view (`arrival`); on the way out the
 * game hands the page its own last view in the same shape, the page waits
 * for it, and the lobby draws its first frame from it. No DOM or three.js
 * imports. See docs/games/departure.md.
 */

export interface Point {
    x: number;
    y: number;
    z: number;
}

/**
 * A third-person view of the avatar, relative to the avatar's feet, never in
 * world coordinates. The same shape as the `arrival` view.
 */
export interface TravelView {
    /** Camera position minus the feet. */
    cameraOffset: Point;
    /** The point the camera looks at, minus the feet. */
    cameraTargetOffset: Point;
    /** Yaw about +y in radians. At 0 the avatar faces -z, as in the lobby. */
    avatarRotation: number;
    /** Feet to the top of the head, in the same units as the offsets. */
    avatarHeight: number;
    /** Vertical field of view, degrees. */
    fov: number;
}

/** What the game has on screen, in its own world coordinates. */
export interface DepartureShot {
    camera: { position: Point; target: Point; fov: number };
    avatar: {
        /** Where the avatar stands (its feet). */
        feet: Point;
        /** Yaw about +y; at 0 the avatar faces -z. Or give `facing`. */
        yaw?: number;
        /** The direction the avatar faces; only x and z are read. */
        facing?: { x: number; z: number };
        height: number;
    };
}

const finite = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n);
const point = (p: any): p is Point =>
    !!p && [p.x, p.y, p.z].every((n) => finite(n) && Math.abs(n) <= 1000);
const copy = (p: Point): Point => ({ x: p.x, y: p.y, z: p.z });
const minus = (a: Point, b: Point): Point => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
});
const length = (p: Point) => Math.hypot(p.x, p.y, p.z);

/** A copy of a well-formed view, or null. The page and the lobby re-read it too. */
export function readTravelView(value: unknown): TravelView | null {
    const view = value as TravelView;
    if (
        !view ||
        !point(view.cameraOffset) ||
        !point(view.cameraTargetOffset) ||
        !finite(view.avatarRotation) ||
        Math.abs(view.avatarRotation) > 1e6 ||
        !finite(view.avatarHeight) ||
        view.avatarHeight < 0.2 ||
        view.avatarHeight > 10 ||
        !finite(view.fov) ||
        view.fov <= 5 ||
        view.fov >= 150
    )
        return null;
    return {
        cameraOffset: copy(view.cameraOffset),
        cameraTargetOffset: copy(view.cameraTargetOffset),
        avatarRotation: view.avatarRotation,
        avatarHeight: view.avatarHeight,
        fov: view.fov,
    };
}

/** The view of a shot: the camera and its target, relative to the feet. */
export function departureView(shot: DepartureShot): TravelView {
    const { camera, avatar } = shot;
    const facing = avatar.facing;
    const yaw =
        avatar.yaw ??
        (facing && Math.hypot(facing.x, facing.z) > 1e-6
            ? Math.atan2(-facing.x, -facing.z)
            : 0);
    const view = readTravelView({
        cameraOffset: minus(camera.position, avatar.feet),
        cameraTargetOffset: minus(camera.target, avatar.feet),
        avatarRotation: yaw,
        avatarHeight: avatar.height,
        fov: camera.fov,
    });
    if (!view) throw new Error("DEPARTURE_VIEW_INVALID");
    return view;
}

export interface ScreenBox {
    /** Centre of the avatar, 0 (left edge) to 1 (right edge). */
    x: number;
    /** Top of the head and the feet, 0 (top edge) to 1 (bottom edge). */
    top: number;
    bottom: number;
    /** bottom - top: the avatar's height as a share of the frame's height. */
    height: number;
}

/**
 * Where a view puts the avatar on screen: the box from its feet to the top
 * of its head. This is the frame the lobby draws first on the way back, so
 * the game's last frame must put the avatar in the same box. Null when the
 * avatar is behind or inside the camera.
 */
export function avatarOnScreen(
    view: TravelView,
    aspect: number
): ScreenBox | null {
    const eye = view.cameraOffset;
    const forward = minus(view.cameraTargetOffset, eye);
    const distance = length(forward);
    if (distance < 1e-6 || !(aspect > 0)) return null;
    const f = {
        x: forward.x / distance,
        y: forward.y / distance,
        z: forward.z / distance,
    };
    // right = forward x up, up = right x forward (a camera that never rolls).
    let right = { x: -f.z, y: 0, z: f.x };
    const flat = Math.hypot(right.x, right.z);
    right =
        flat > 1e-6
            ? { x: right.x / flat, y: 0, z: right.z / flat }
            : { x: 1, y: 0, z: 0 };
    const up = {
        x: right.y * f.z - right.z * f.y,
        y: right.z * f.x - right.x * f.z,
        z: right.x * f.y - right.y * f.x,
    };
    const tan = Math.tan((view.fov * Math.PI) / 360);
    const project = (p: Point) => {
        const d = minus(p, eye);
        const depth = d.x * f.x + d.y * f.y + d.z * f.z;
        if (depth < 0.05) return null;
        return {
            x:
                0.5 +
                (d.x * right.x + d.y * right.y + d.z * right.z) /
                    (depth * tan * aspect) /
                    2,
            y: 0.5 - (d.x * up.x + d.y * up.y + d.z * up.z) / (depth * tan) / 2,
        };
    };
    const feet = project({ x: 0, y: 0, z: 0 });
    const head = project({ x: 0, y: view.avatarHeight, z: 0 });
    if (!feet || !head) return null;
    return {
        x: (feet.x + head.x) / 2,
        top: head.y,
        bottom: feet.y,
        height: feet.y - head.y,
    };
}

/** Why a view can't be handed to the lobby, or null when it can. */
export function departureProblem(
    view: TravelView | null,
    aspect = 16 / 9
): string | null {
    if (!view) return "DEPARTURE_VIEW_INVALID";
    if (length(view.cameraOffset) < 0.6)
        return "DEPARTURE_CAMERA_INSIDE_AVATAR";
    const box = avatarOnScreen(view, aspect);
    if (!box) return "DEPARTURE_AVATAR_BEHIND_CAMERA";
    if (box.height < 0.08) return "DEPARTURE_AVATAR_TOO_SMALL";
    if (box.top < -0.02 || box.bottom > 1.02 || box.x < 0.05 || box.x > 0.95)
        return "DEPARTURE_AVATAR_OFF_SCREEN";
    return null;
}

export type DepartureReason = "self" | "party";

export interface DepartureOptions {
    /** Sends `<game id>:<kind>` to the page. */
    post(kind: string, data?: Record<string, unknown>): void;
    /**
     * Put the game in its last frame and say what is on screen. The game:
     * goes to its walkable arrival state (from any menu, match or result),
     * stands the avatar still in third person, hides its interface, fades
     * the world to black around the lit avatar, and returns the shot. It
     * may take a moment (return a promise); the page waits 1.5 s at most.
     */
    stage(
        reason: DepartureReason
    ): DepartureShot | TravelView | Promise<DepartureShot | TravelView>;
    /** Resolves once the next frame is drawn. Defaults to requestAnimationFrame. */
    frame?(): Promise<unknown>;
    /** Frames drawn in the final view before the page is told. Default 2. */
    settleFrames?: number;
}

const nextFrame = () =>
    new Promise<unknown>((resolve) => {
        const g = globalThis as any;
        if (typeof g.requestAnimationFrame === "function")
            g.requestAnimationFrame(resolve);
        else setTimeout(resolve, 16);
    });

/**
 * The game's side of leaving.
 *
 *     const departure = createDeparture({ post: host.post, stage });
 *     host.on("departure", (data) => departure.receive("departure", data));
 *     lobbyButton.onclick = () => departure.leave();
 *
 * `leave()` asks the page to start the trip back (`exit`). However the trip
 * starts (the game's button, the page's, or a party member leaving), the
 * page then sends `departure`; the game says `departure-staging` at once,
 * stages its last frame and answers `departure-ready` with the view. The page waits for that answer, then
 * returns the visitor to the lobby where they left.
 */
export function createDeparture(options: DepartureOptions) {
    const frame = options.frame ?? nextFrame;
    let phase: "playing" | "asked" | "staging" | "staged" = "playing";
    let view: TravelView | null = null;
    const run = async (reason: DepartureReason) => {
        phase = "staging";
        // At once, so the page knows to wait: a game that doesn't know
        // `departure` says nothing and is left without the wait.
        options.post("departure-staging");
        let problem: string | null = null;
        try {
            const staged = await options.stage(reason);
            view =
                "camera" in staged
                    ? departureView(staged)
                    : readTravelView(staged);
            problem = departureProblem(view);
            for (let i = 0; i < (options.settleFrames ?? 2); i++) await frame();
        } catch (error) {
            view = null;
            problem = String((error as Error)?.message ?? error).slice(0, 120);
        }
        phase = "staged";
        // A view the lobby can't use is not sent: the page then returns
        // without a matched frame instead of with a wrong one.
        options.post(
            "departure-ready",
            problem ? { view: null, problem } : { view }
        );
    };
    return {
        get phase() {
            return phase;
        },
        /** The staged view, once `departure-ready` was sent. */
        get view() {
            return view;
        },
        /** The visitor chose to go back to the lobby. Safe to call twice. */
        leave() {
            if (phase !== "playing") return;
            phase = "asked";
            options.post("exit");
        },
        /** Feed page messages here. True when the message was a departure message. */
        receive(kind: string, data?: { reason?: unknown }) {
            if (kind !== "departure") return false;
            // Asked again (a retry): answer again from the same staged frame.
            if (phase === "staged") options.post("departure-ready", { view });
            else if (phase !== "staging")
                void run(data?.reason === "party" ? "party" : "self");
            return true;
        },
    };
}
