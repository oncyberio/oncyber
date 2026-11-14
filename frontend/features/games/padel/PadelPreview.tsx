import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { UserContext } from "@components/context/UserContext";
import {
    resolveLobbyAvatar,
    DEFAULT_LOBBY_AVATAR_URL,
} from "@features/lobby/avatarSelection";
import { LOBBY_GUEST_PORTRAIT } from "@features/lobby/lobbyIdentity";
import {
    failLobbyDestination,
    isLobbyDestination,
    lobbyDestinationPrepared,
    registerLobbyDestinationEntry,
    requestLobbyDestinationBack,
    waitForLobbyDestinationEntry,
} from "@utils/lobbyDestinationBridge";
import {
    readVisitorIdentity as readPadelIdentity,
    type VisitorIdentity as PadelIdentity,
} from "../gameIdentity";

import {
    LOBBY_ATTEMPT_PARAM,
    readLobbyTravelView,
    type LobbyDestinationEntryOptions,
    type LobbyTravelView,
} from "@features/lobby/lobbyJourneyProtocol";
import PadelSocial from "./PadelSocial";
import {
    createPadelHostEnvelope,
    readPadelHostEnvelope,
    readPadelHostCommand,
    type PadelHostState,
    type PadelHostMessageType,
} from "./padelHostProtocol";
import type { VisitBridge as PadelVisitBridge } from "./visitBridge";

/** A development destination: the game owns its waiting area and NPC match. */
export default function PadelPreview() {
    const { userData } = useContext(UserContext);
    const router = useRouter();
    const routerRef = useRef(router);
    routerRef.current = router;
    const profile = useRef(userData);
    profile.current = userData;
    const frame = useRef<HTMLIFrameElement>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [approvedIdentity, setApprovedIdentity] =
        useState<PadelIdentity | null>(null);
    const [setupOpen, setSetupOpen] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [alive, setAlive] = useState(false);
    const [frameKey, setFrameKey] = useState(0);
    const effectRuns = useRef(0);
    const [mode, setMode] = useState<"visit" | "match">("visit");

    const [hostOwned, setHostOwned] = useState(false);
    const host = useRef<{ attempt: string; connected: boolean } | null>(null);
    const hostState = useRef<PadelHostState>(null);
    hostState.current = {
        identity: approvedIdentity,
        active: ready && revealed && alive && !error,
        mode,
        setupOpen,
    };
    const publishHost = useCallback(
        (type: PadelHostMessageType, payload: Record<string, unknown> = {}) => {
            const session = host.current;
            if (!session || (!session.connected && type !== "hello")) return;
            window.parent.postMessage(
                createPadelHostEnvelope(session.attempt, type, payload),
                window.location.origin
            );
        },
        []
    );
    useEffect(() => {
        publishHost("state", { state: hostState.current });
    }, [
        publishHost,
        approvedIdentity,
        ready,
        revealed,
        alive,
        error,
        mode,
        setupOpen,
    ]);

    const visit = useRef<PadelVisitBridge | null>(null);
    const interactionAllowed = useRef(false);
    const sendGame = useCallback((message: object) => {
        const input = message as { type?: string; enabled?: boolean };
        if (
            input.type === "padel:input" &&
            input.enabled === true &&
            !interactionAllowed.current
        )
            return;
        frame.current?.contentWindow?.postMessage(
            message,
            window.location.origin
        );
    }, []);
    const focusGame = useCallback(() => {
        if (!interactionAllowed.current) return;
        frame.current?.focus();
        sendGame({ type: "padel:input", enabled: true });
    }, [sendGame]);

    useEffect(() => {
        // Fast Refresh / StrictMode may replay effects while preserving refs and
        // DOM. A disposed game cannot be revived: give it a fresh iframe and
        // repeat admission instead of retaining an inert canvas and stale UI.
        if (effectRuns.current++ > 0) {
            setFrameKey((value) => value + 1);
            setReady(false);
            setRevealed(false);
            setError("");
            setMode("visit");
            setApprovedIdentity(null);
            setSetupOpen(false);
        }
        interactionAllowed.current = false;
        let disposed = false;
        let greeted = false;
        let sentIdentity = false;
        let prepared = false;
        let failed = false;
        let identity: PadelIdentity | null = null;
        const inJourney = isLobbyDestination();
        setHostOwned(inJourney);
        const hostAttempt = inJourney
            ? new URLSearchParams(window.location.search).get(
                  LOBBY_ATTEMPT_PARAM
              )
            : null;
        host.current = hostAttempt
            ? { attempt: hostAttempt, connected: false }
            : null;
        let revealed = !inJourney;
        let arrivalComplete = !inJourney;
        let travelState:
            | "idle"
            | "entered"
            | "staged"
            | "revealed"
            | "departing" = "idle";
        let requestSequence = 0;
        const requestSession = `${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2)}`;
        type TravelPhase = "enter" | "stage" | "reveal" | "depart";
        type PendingTravel = {
            phase: TravelPhase;
            target: Window;
            timer: ReturnType<typeof setTimeout>;
            resolve: (view?: LobbyTravelView) => void;
            reject: (error: Error) => void;
        };
        const pendingTravel = new Map<string, PendingTravel>();
        let announcedEntry = false;
        let visitActive = true;
        let inputReleased = false;
        let dialogOpen = false;
        let focusFrame = 0;
        const entryLifetime = new AbortController();
        const send = (message: object) =>
            frame.current?.contentWindow?.postMessage(
                message,
                window.location.origin
            );
        const cancelled = () => {
            const error = new Error("Padel travel was cancelled.");
            error.name = "AbortError";
            return error;
        };
        const sendTravelCancellation = (target: Window, requestId: string) => {
            try {
                target.postMessage(
                    { type: "padel:travel-cancel", requestId },
                    window.location.origin
                );
            } catch {
                // An iframe can disappear during teardown. Its pending promise
                // must still settle so the native travel bridge can recover.
            }
        };
        const cancelTravel = (error = cancelled()) => {
            for (const [requestId, pending] of pendingTravel) {
                clearTimeout(pending.timer);
                sendTravelCancellation(pending.target, requestId);
                pending.reject(error);
            }
            pendingTravel.clear();
        };
        const requestTravel = (
            phase: TravelPhase,
            options: LobbyDestinationEntryOptions
        ): Promise<LobbyTravelView | undefined> => {
            const target = frame.current?.contentWindow;
            if (disposed || failed || !prepared || !target)
                return Promise.reject(cancelled());
            const view = readLobbyTravelView(options?.travelView);
            if (options?.travelView !== undefined && !view)
                return Promise.reject(
                    new Error("The padel travel view is invalid.")
                );
            // Lifecycle commands are serialized by the destination bridge. A
            // replacement renderer must not leave an older command running.
            cancelTravel();
            const requestId = `${requestSession}-${++requestSequence}`;
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    if (!pendingTravel.has(requestId)) return;
                    pendingTravel.delete(requestId);
                    sendTravelCancellation(target, requestId);
                    failed = true;
                    interactionAllowed.current = false;
                    inputReleased = false;
                    setAlive(false);
                    const message =
                        "Padel couldn’t finish the transition. Return to the lobby and try again.";
                    setError(message);
                    reject(new Error(message));
                }, 20000);
                pendingTravel.set(requestId, {
                    phase,
                    target,
                    timer,
                    resolve,
                    reject,
                });
                try {
                    target.postMessage(
                        {
                            type: "padel:travel",
                            phase,
                            requestId,
                            options: {
                                reducedMotion: options?.reducedMotion === true,
                                ...(view ? { travelView: view } : {}),
                            },
                        },
                        window.location.origin
                    );
                } catch {
                    clearTimeout(timer);
                    pendingTravel.delete(requestId);
                    reject(new Error("Padel could not start its transition."));
                }
            });
        };
        const deliverIdentity = () => {
            if (!disposed && greeted && identity && !sentIdentity) {
                sentIdentity = true;
                setApprovedIdentity(identity);
                send({ type: "padel:identity", ...identity });
            }
        };
        const announceEntry = () => {
            if (
                disposed ||
                failed ||
                !prepared ||
                !revealed ||
                !arrivalComplete ||
                announcedEntry
            )
                return;
            announcedEntry = true;
            // Let the parent's revealed message release its iframe before focus.
            focusFrame = requestAnimationFrame(() => {
                focusFrame = 0;
                if (disposed || failed || entryLifetime.signal.aborted) return;
                inputReleased = true;
                interactionAllowed.current = true;
                setRevealed(true);
                setAlive(true);
                frame.current?.focus();
                send({ type: "padel:entered" });
            });
        };
        const disposeGame = () => {
            if (disposed) return;
            publishHost("state", {
                state: { ...hostState.current, active: false },
            });
            disposed = true;
            host.current = null;
            interactionAllowed.current = false;
            cancelTravel();
            inputReleased = false;
            setAlive(false);
            entryLifetime.abort();
            cancelAnimationFrame(focusFrame);
            send({ type: "padel:dispose" });
        };
        const leave = () => {
            document.exitPointerLock?.();
            if (!requestLobbyDestinationBack())
                void routerRef.current.push("/?lobby=1");
        };
        // Native admission stages the matching avatar/camera while the parent
        // keeps its transition visible. Only the renderer's final reveal ack
        // permits the bridge to release input and social UI.
        const unregister = registerLobbyDestinationEntry(
            async (options) => {
                interactionAllowed.current = false;
                inputReleased = false;
                await requestTravel("enter", options);
                travelState = "entered";
            },
            disposeGame,
            {
                prepareReveal: async (options) => {
                    if (travelState !== "entered")
                        throw new Error("Padel is not ready to stage arrival.");
                    await requestTravel("stage", options);
                    travelState = "staged";
                },
                reveal: async (options) => {
                    if (travelState !== "staged")
                        throw new Error("Padel has not staged its arrival.");
                    await requestTravel("reveal", options);
                    if (disposed || failed) throw cancelled();
                    travelState = "revealed";
                    arrivalComplete = true;
                    announceEntry();
                },
                depart: async (options) => {
                    if (!inputReleased || disposed || failed) throw cancelled();
                    interactionAllowed.current = false;
                    inputReleased = false;
                    setAlive(false);
                    travelState = "departing";
                    return requestTravel("depart", options);
                },
            }
        );
        if (inJourney) {
            void waitForLobbyDestinationEntry(entryLifetime.signal)
                .then(() => {
                    revealed = true;
                    announceEntry();
                })
                .catch(() => {});
        }
        const receive = (event: MessageEvent) => {
            if (disposed || event.origin !== window.location.origin) return;
            if (inJourney && event.source === window.parent && host.current) {
                const envelope = readPadelHostEnvelope(
                    event.data,
                    host.current.attempt
                );
                if (envelope) {
                    if (envelope.type === "connect") {
                        host.current.connected = true;
                        send({ type: "padel:social-ready", enabled: true });
                        publishHost("state", { state: hostState.current });
                    } else if (
                        host.current.connected &&
                        envelope.type === "back"
                    ) {
                        leave();
                    } else if (
                        host.current.connected &&
                        envelope.type === "command"
                    ) {
                        const command = readPadelHostCommand(envelope.message);
                        // A stale overlay must never regain control during travel or after failure.
                        if (
                            command &&
                            prepared &&
                            inputReleased &&
                            !failed &&
                            visitActive
                        ) {
                            const passive = [
                                "padel:peers",
                                "padel:social-ready",
                            ].includes(command.type);
                            if (
                                !dialogOpen ||
                                passive ||
                                (command.type === "padel:input" &&
                                    !command.enabled)
                            )
                                sendGame(command);
                        }
                    } else if (
                        host.current.connected &&
                        envelope.type === "focus"
                    ) {
                        if (
                            prepared &&
                            inputReleased &&
                            !failed &&
                            visitActive &&
                            !dialogOpen
                        )
                            focusGame();
                    } else if (
                        host.current.connected &&
                        envelope.type === "identity"
                    ) {
                        const next = readPadelIdentity(envelope.identity);
                        if (
                            next &&
                            prepared &&
                            inputReleased &&
                            !failed &&
                            visitActive &&
                            !dialogOpen
                        ) {
                            identity = next;
                            setApprovedIdentity(next);
                        }
                    }
                    return;
                }
            }
            if (
                inJourney &&
                event.source === window.parent &&
                event.data?.type === "padel:lobby-identity"
            ) {
                const approved = readPadelIdentity(event.data);
                if (approved && !sentIdentity) {
                    identity = approved;
                    deliverIdentity();
                }
                return;
            }
            if (event.source !== frame.current?.contentWindow) return;
            if (event.data?.type === "padel:travel-result") {
                const result = event.data;
                if (typeof result.requestId !== "string") return;
                const pending = pendingTravel.get(result.requestId);
                if (
                    !pending ||
                    pending.target !== event.source ||
                    pending.phase !== result.phase ||
                    typeof result.ok !== "boolean"
                )
                    return;
                clearTimeout(pending.timer);
                pendingTravel.delete(result.requestId);
                if (!result.ok) {
                    sendTravelCancellation(pending.target, result.requestId);
                    pending.reject(
                        new Error("Padel could not finish its transition.")
                    );
                } else {
                    const view = readLobbyTravelView(result.travelView);
                    if (result.travelView !== undefined && !view) {
                        pending.reject(
                            new Error("Padel returned an invalid travel view.")
                        );
                    } else pending.resolve(view ?? undefined);
                }
            } else if (event.data?.type === "padel:hello") {
                greeted = true;
                deliverIdentity();
            } else if (
                event.data?.type === "padel:ready" &&
                sentIdentity &&
                !prepared &&
                !failed
            ) {
                prepared = true;
                clearTimeout(watchdog);
                setReady(true);
                if (host.current?.connected)
                    send({ type: "padel:social-ready", enabled: true });
                lobbyDestinationPrepared();
                announceEntry();
            } else if (
                prepared &&
                event.data?.type === "padel:mode" &&
                ["visit", "match"].includes(event.data.mode)
            ) {
                visitActive = event.data.mode === "visit";
                dialogOpen = false;
                setSetupOpen(false);
                setMode(event.data.mode);
            } else if (
                prepared &&
                inputReleased &&
                !failed &&
                visitActive &&
                event.data?.type === "padel:setup" &&
                typeof event.data.open === "boolean"
            ) {
                dialogOpen = event.data.open;
                setSetupOpen(dialogOpen);
            } else if (
                prepared &&
                inputReleased &&
                !failed &&
                visitActive &&
                event.data?.type === "padel:pose"
            ) {
                if (inJourney) publishHost("pose", { pose: event.data.pose });
                else visit.current?.receivePose(event.data.pose);
            } else if (
                prepared &&
                inputReleased &&
                !failed &&
                visitActive &&
                !dialogOpen &&
                event.data?.type === "padel:shortcut"
            ) {
                if (inJourney)
                    publishHost("shortcut", { slot: event.data.slot });
                else visit.current?.receiveShortcut(event.data.slot);
            } else if (
                prepared &&
                inputReleased &&
                !failed &&
                visitActive &&
                !dialogOpen &&
                event.data?.type === "padel:chat"
            ) {
                if (inJourney) publishHost("chat");
                else visit.current?.focusChat();
            } else if (event.data?.type === "padel:exit" && greeted) {
                leave();
            } else if (event.data?.type === "padel:error" && greeted) {
                failed = true;
                interactionAllowed.current = false;
                inputReleased = false;
                cancelTravel(new Error("Padel could not load."));
                clearTimeout(watchdog);
                const message =
                    "Padel couldn’t load. Return to the lobby and try again.";
                setError(message);
                failLobbyDestination(message, "padel-load-failed");
            }
        };
        window.addEventListener("message", receive);
        publishHost("hello");
        // A parent may finish mounting after the first greeting.
        const hostGreeting = setInterval(() => {
            if (!host.current?.connected) publishHost("hello");
        }, 500);
        // The lobby may have a newer, unsaved carousel selection than the account.
        if (inJourney)
            window.parent.postMessage(
                { type: "padel:identity-request" },
                window.location.origin
            );
        const fallback = setTimeout(
            async () => {
                if (disposed || sentIdentity || identity) return;
                const user = profile.current;
                const avatar = await resolveLobbyAvatar(user).catch(() => ({
                    url: DEFAULT_LOBBY_AVATAR_URL,
                }));
                if (disposed || identity) return;
                identity = readPadelIdentity({
                    avatarUrl: avatar.url,
                    name:
                        typeof user?.username === "string" &&
                        user.username.trim()
                            ? user.username.slice(0, 120)
                            : "You",
                    pfp:
                        typeof user?.avatar === "string" && user.avatar
                            ? user.avatar
                            : LOBBY_GUEST_PORTRAIT,
                }) || {
                    avatarUrl: DEFAULT_LOBBY_AVATAR_URL,
                    name: "You",
                    pfp: LOBBY_GUEST_PORTRAIT,
                };
                deliverIdentity();
            },
            inJourney ? 250 : 0
        );
        const watchdog = setTimeout(() => {
            if (disposed || prepared) return;
            failed = true;
            const message =
                "Padel is taking too long to load. Return to the lobby and try again.";
            setError(message);
            failLobbyDestination(message, "padel-load-timeout");
        }, 60000);
        return () => {
            disposeGame();
            clearInterval(hostGreeting);
            clearTimeout(fallback);
            clearTimeout(watchdog);
            window.removeEventListener("message", receive);
            unregister();
        };
    }, []);

    return (
        <main
            data-mode={mode}
            data-revealed={revealed && alive}
            style={{
                position: "fixed",
                inset: 0,
                background: "#070b14",
                color: "#fff",
            }}
        >
            <iframe
                key={frameKey}
                ref={frame}
                src="/games/padel/index.html"
                title="Padel · social club and doubles NPC practice"
                allow="fullscreen; gamepad"
                style={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    display: "block",
                }}
            />
            {!hostOwned &&
                ready &&
                revealed &&
                alive &&
                !error &&
                mode === "visit" &&
                approvedIdentity && (
                    <PadelSocial
                        identity={approvedIdentity}
                        bridge={visit}
                        send={sendGame}
                        focusGame={focusGame}
                        onIdentityChange={setApprovedIdentity}
                        hidden={setupOpen}
                    />
                )}
            {(!ready || error) && (
                <div
                    role="status"
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeContent: "center",
                        gap: 18,
                        textAlign: "center",
                        background: "#070b14",
                        fontFamily: '"Oncyber Sans", Arial, sans-serif',
                    }}
                >
                    <p>{error || "Opening padel…"}</p>
                    {error && (
                        <a
                            href="/?lobby=1"
                            style={{ color: "#fff" }}
                            onClick={(event) => {
                                if (requestLobbyDestinationBack())
                                    event.preventDefault();
                            }}
                        >
                            Back to lobby
                        </a>
                    )}
                </div>
            )}
        </main>
    );
}
