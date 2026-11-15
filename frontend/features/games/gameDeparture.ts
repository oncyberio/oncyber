/**
 * The page's side of leaving a game: the mirror of `stageArrival` in
 * GamePage. On the way in the page hands the game the lobby's last
 * third-person view; on the way out it asks the game for its own
 * (`departure`), waits for the answer (`departure-ready`, 1.5 s at most; a
 * game that doesn't acknowledge within 0.6 s is not waited for) and
 * gives that view to the lobby, which draws its first frame from it. See
 * docs/games/departure.md.
 */
import {
    readLobbyTravelView,
    type LobbyTravelView,
} from "@features/lobby/lobbyJourneyProtocol";

/** As long as the page waits on arrival. */
export const DEPARTURE_WAIT_MS = 1500;
/**
 * A game that knows `departure` says `departure-staging` at once. One that
 * says nothing this long doesn't know it, and leaves as it always did.
 */
export const DEPARTURE_ACK_MS = 600;
export type DepartureReason = "self" | "party";

/**
 * The game's view as the lobby's return view. A game stands the avatar
 * planted, idle and in third person before it answers, so the lobby keeps
 * that pose through its own reveal.
 */
export function lobbyReturnView(view: unknown): LobbyTravelView | undefined {
    const game = view as Partial<LobbyTravelView> | null;
    if (!game || typeof game !== "object") return undefined;
    return (
        readLobbyTravelView({
            cameraOffset: game.cameraOffset,
            cameraTargetOffset: game.cameraTargetOffset,
            avatarRotation: game.avatarRotation,
            avatarLift: 0,
            avatarHeight: game.avatarHeight,
            avatarTravelPose: "idle",
            cameraMode: "third-person",
            fov: game.fov,
        }) ?? undefined
    );
}

export function createGameDeparture(options: {
    /** Sends `<game id>:<kind>` to the game's frame. */
    post(kind: string, data?: object): void;
    /** False until the game has drawn a frame: nothing to wait for. */
    ready(): boolean;
    waitMs?: number;
    ackMs?: number;
}) {
    let staging: Promise<LobbyTravelView | undefined> | null = null;
    let settle: ((view?: LobbyTravelView) => void) | null = null;
    let acknowledged = false;
    return {
        get started() {
            return !!staging;
        },
        /**
         * Ask the game for its last frame. Resolves with the view the lobby
         * should open on, or undefined when the game has none (it doesn't
         * know the message, failed, or shows no avatar). Never rejects, and
         * a second call joins the first.
         */
        stage(reason: DepartureReason = "self") {
            if (staging) return staging;
            if (!options.ready()) return Promise.resolve(undefined);
            staging = new Promise((resolve) => {
                const timer = setTimeout(
                    () => settle?.(),
                    options.waitMs ?? DEPARTURE_WAIT_MS
                );
                const ack = setTimeout(
                    () => acknowledged || settle?.(),
                    options.ackMs ?? DEPARTURE_ACK_MS
                );
                settle = (view) => {
                    clearTimeout(timer);
                    clearTimeout(ack);
                    settle = null;
                    resolve(view);
                };
                options.post("departure", { reason });
            });
            return staging;
        },
        /** Feed the game's messages here. True when it was the answer. */
        receive(
            kind: string,
            data: { view?: unknown; problem?: unknown } | undefined
        ) {
            if (kind === "departure-staging") return (acknowledged = true);
            if (kind !== "departure-ready") return false;
            settle?.(lobbyReturnView(data?.view));
            return true;
        },
        /** The page is going away: stop waiting. */
        cancel() {
            settle?.();
        },
    };
}
