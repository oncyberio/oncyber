import { TOO_MANY_PASSWORD_ATTEMPTS } from "@components/_3DExhibit-v2/utils/gating";
import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import styled from "styled-components";
import { useRouter } from "next/router";
import { UserContext } from "@components/context/UserContext";
import type { Experience } from "@uitypes/experience";
import { finishSpaceEntrance } from "@utils/spaceEntrance";
import {
    failLobbyDestination,
    isLobbyDestinationPreparing,
    lobbyDestinationPrepared,
    registerLobbyDestinationEntry,
} from "@utils/lobbyDestinationBridge";
import ExperienceShell, { ExperiencePanel } from "./ExperienceShell";
import {
    CONTENT_SANDBOX,
    CONTENT_PERMISSIONS,
    ConnectPermissionStore,
    isTrustedContentHostWindow,
    allowsLocalContentPreviewWallet,
} from "./security";
import {
    ContentMessageGate,
    contentRequestError,
    createContentInit,
    createContentSession,
    type ContentRequest,
} from "./protocol";
import {
    CONTENT_PROTOCOL,
    createContentEvent,
    createContentReply,
} from "./contentBridgeMessages";
import { resolveEmbeddedRuntime, type EmbeddedRuntime } from "./runtime";

interface Props {
    experience?: Experience;
    runtime?: EmbeddedRuntime;
    title?: string;
    onExit?: () => void;
}
type Pending = {
    request: ContentRequest;
    generation: number;
    accountId: string;
    port: MessagePort;
};

export default function EmbeddedExperience(props: Props) {
    // A new descriptor is a new document and permission lifecycle, including
    // when Next reuses the page during client-side navigation.
    const key = `${props.experience?.id || "url"}:${JSON.stringify(
        props.runtime || props.experience?.runtime
    )}`;
    return <ContentDocument key={key} {...props} />;
}

function ContentDocument({
    experience,
    runtime: suppliedRuntime,
    title: suppliedTitle,
    onExit,
}: Props) {
    const router = useRouter();
    const { user, walletConnection, authenticated, isAnonymous } =
        useContext(UserContext);
    const frame = useRef<HTMLIFrameElement>(null);
    const generation = useRef(0);
    const gate = useRef<ContentMessageGate>(null);
    const session = useRef("");
    const pendingRef = useRef<Pending>(null);
    const stage = useRef<HTMLDivElement>(null);
    const dialog = useRef<HTMLDivElement>(null);
    const [runtime, setRuntime] = useState<EmbeddedRuntime>(null);
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [gateError, setGateError] = useState("");
    const [password, setPassword] = useState("");
    const [submittedPassword, setSubmittedPassword] = useState("");
    const [permissionsOpen, setPermissionsOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [pending, setPending] = useState<Pending>(null);
    const [remember, setRemember] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [forgotten, setForgotten] = useState(false);
    const title =
        suppliedTitle || experience?.info?.headline || "Web experience";
    const accountId = authenticated && !isAnonymous ? user?.id || "" : "";
    const account = useRef({ accountId, walletConnection });
    account.current = { accountId, walletConnection };
    const permissionStore = useMemo(() => {
        try {
            return new ConnectPermissionStore(window.sessionStorage);
        } catch {
            return new ConnectPermissionStore();
        }
    }, []);
    const identity = useMemo(
        () => ({
            experienceId: experience?.id || "external-url",
            url: runtime?.url || "",
            accountId,
        }),
        [experience?.id, runtime?.url, accountId]
    );
    const identityRef = useRef(identity);
    identityRef.current = identity;
    const revokeDocument = useCallback(() => {
        generation.current++;
        gate.current = null;
        session.current = "";
        pendingRef.current?.port.close();
        pendingRef.current = null;
        setPending(null);
    }, []);
    const leave = useCallback(() => {
        revokeDocument();
        setRuntime(null);
        document.exitPointerLock?.();
        if (onExit) onExit();
        else void router.push("/?lobby=1");
    }, [onExit, router, revokeDocument]);
    const failDocument = useCallback((message: string, code: string) => {
        revokeDocument();
        setRuntime(null);
        setLoaded(false);
        setReady(false);
        setError(message);
        document.exitPointerLock?.();
        finishSpaceEntrance();
        failLobbyDestination(message, code);
    }, [revokeDocument]);

    useEffect(() => {
        const controller = new AbortController();
        pendingRef.current?.port.close();
        pendingRef.current = null;
        setPending(null);
        setRuntime(null);
        setLoaded(false);
        setReady(false);
        setError("");
        setGateError("");
        const resolve = async () => {
            try {
                let descriptor = suppliedRuntime;
                if (experience) {
                    const response = await fetch("/api/content/session", {
                        method: "POST",
                        signal: controller.signal,
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            experienceId: experience.id,
                            password: submittedPassword || undefined,
                        }),
                    });
                    const result = await response.json();
                    if (controller.signal.aborted) return;
                    if (!response.ok) {
                        if (result.gating) setGateError(result.gating);
                        throw new Error(
                            result.gating === "password-error"
                                ? "This world needs a password."
                                : result.gating === "too-many-attempts-error"
                                ? TOO_MANY_PASSWORD_ATTEMPTS
                                : result.gating
                                ? "Your account does not have access to this world."
                                : "This world could not load. Please try again."
                        );
                    }
                    descriptor = result.runtime;
                }
                const next = resolveEmbeddedRuntime(
                    descriptor,
                    window.location.origin,
                    process.env.NODE_ENV === "development"
                );
                // Only a server-admitted space may request an address in production.
                // A supplied descriptor or URL query is not proof of admission.
                if (
                    !experience &&
                    !allowsLocalContentPreviewWallet(window.location.origin)
                )
                    next.capabilities = [];
                if (!controller.signal.aborted) setRuntime(next);
            } catch (reason) {
                if (!controller.signal.aborted) {
                    setError(
                        reason.message || "This world could not load."
                    );
                    finishSpaceEntrance();
                    failLobbyDestination(
                        "This world could not prepare. Open it to review access.",
                        "content-load"
                    );
                }
            }
        };
        void resolve();
        return () => {
            controller.abort();
            generation.current++;
            gate.current = null;
            pendingRef.current?.port.close();
            pendingRef.current = null;
        };
    }, [
        experience?.id,
        suppliedRuntime,
        submittedPassword,
        attempt,
        accountId,
    ]);

    const reply = useCallback(
        (request: ContentRequest, payload: unknown, code?: string) => {
            if (request.session !== session.current) return;
            // Opaque frames require '*'; only a verified WindowProxy receives this
            // response and it contains neither auth credentials nor a wallet provider.
            frame.current?.contentWindow?.postMessage(
                createContentReply(request, payload, code),
                "*"
            );
        },
        []
    );
    const finishRequest = useCallback(
        (allow: boolean) => {
            const request = pendingRef.current;
            pendingRef.current = null;
            setPending(null);
            if (!request) return;
            if (
                request.generation !== generation.current ||
                request.accountId !== account.current.accountId
            ) {
                request.port.close();
                return;
            }
            const answer = (payload: unknown, error?: string) => {
                try {
                    request.port.postMessage(
                        createContentReply(
                            {
                                ...request.request,
                                method: CONTENT_PROTOCOL.methods.walletConnect,
                            },
                            payload,
                            error
                        )
                    );
                } finally {
                    request.port.close();
                }
            };
            const connection = account.current.walletConnection;
            const walletAvailable =
                account.current.accountId &&
                connection?.walletId &&
                ["ethereum", "solana", "tezos", "counterparty"].includes(
                    connection.type
                );
            if (!allow || !walletAvailable) {
                answer(null, "USER_REJECTED");
                return;
            }
            if (remember) permissionStore.grant(identityRef.current);
            // This narrow bridge only discloses the selected PUBLIC address. It has
            // no provider.request, signature, approval, transfer or transaction path.
            answer({ address: connection.walletId, chain: connection.type });
        },
        [reply, remember, permissionStore]
    );

    useEffect(() => {
        if (!runtime) return;
        const receive = (event: MessageEvent) => {
            if (event.source !== frame.current?.contentWindow) return;
            const request = gate.current?.read(
                event,
                frame.current?.contentWindow
            );
            if (!request) {
                event.ports?.forEach((port) => port.close());
                return;
            }
            const invalid = contentRequestError(request);
            if (invalid) {
                event.ports?.forEach((port) => port.close());
                reply(request, null, invalid);
                return;
            }
            if (request.method === CONTENT_PROTOCOL.methods.ready) {
                event.ports?.forEach((port) => port.close());
                setReady(true);
                setLoaded(true);
                setError("");
                finishSpaceEntrance();
                lobbyDestinationPrepared();
                reply(request, {});
                return;
            }
            if (request.method === CONTENT_PROTOCOL.methods.menu) {
                event.ports?.forEach((port) => port.close());
                document.exitPointerLock?.();
                setMenuOpen(true);
                reply(request, {});
                return;
            }
            const reject = (code: string) => {
                event.ports?.forEach((port) => port.close());
                reply(request, null, code);
            };
            if (
                !runtime.capabilities?.includes(
                    CONTENT_PROTOCOL.methods.walletConnect
                )
            ) {
                reject("CAPABILITY_DISABLED");
                return;
            }
            if (!isTrustedContentHostWindow()) {
                reject("UNTRUSTED_HOST_CONTEXT");
                return;
            }
            // A transferred port stays bound to the requesting document across
            // redirects; a WindowProxy does not. Addresses never use postMessage("*").
            if (event.ports?.length !== 1) {
                reject("RESPONSE_PORT_REQUIRED");
                return;
            }
            if (isLobbyDestinationPreparing()) {
                reject("NOT_ENTERED");
                return;
            }
            if (pendingRef.current) {
                reject("REQUEST_PENDING");
                return;
            }
            document.exitPointerLock?.();
            const next = {
                request,
                generation: generation.current,
                accountId: account.current.accountId,
                port: event.ports[0],
            };
            pendingRef.current = next;
            setRemember(false);
            setDismissed(permissionStore.has(identityRef.current));
            setPending(next);
        };
        window.addEventListener("message", receive);
        return () => window.removeEventListener("message", receive);
    }, [runtime, reply, permissionStore]);

    const resume = useCallback(() => {
        setMenuOpen(false);
        // The world's SDK hands this to its onResume listeners.
        frame.current?.contentWindow?.postMessage(
            createContentEvent(session.current, CONTENT_PROTOCOL.events.resume),
            "*"
        );
        frame.current?.focus();
    }, []);
    const onLoad = useCallback(() => {
        generation.current++;
        pendingRef.current?.port.close();
        pendingRef.current = null;
        setPending(null);
        setMenuOpen(false);
        setReady(false);
        session.current = createContentSession();
        gate.current = new ContentMessageGate(session.current);
        setLoaded(true);
        frame.current?.contentWindow?.postMessage(
            createContentInit(session.current, runtime?.capabilities),
            "*"
        );
        finishSpaceEntrance();
        // Generic sites need no SDK. 'Loaded' describes only the browser load
        // event, not a guarantee that a cross-origin game has rendered.
        lobbyDestinationPrepared();
    }, [runtime]);
    // Opaque content has no renderer-owned reveal callback. The bridge therefore
    // advertises immediate entry; iframe loading must never imply a 3D capability.
    useEffect(
        () =>
            registerLobbyDestinationEntry(
                async () => {
                    if (!frame.current || !loaded || error)
                        throw new Error("The world is not ready.");
                    frame.current.focus();
                },
                () => {
                    generation.current++;
                    gate.current = null;
                    pendingRef.current?.port.close();
                    pendingRef.current = null;
                    setPending(null);
                    setRuntime(null);
                }
            ),
        [loaded, error]
    );
    useEffect(() => {
        if (!runtime || loaded) return;
        const timer = window.setTimeout(() => {
            failDocument(
                "This site is taking too long to load. It may not allow embedding.",
                "timeout"
            );
        }, 30000);
        return () => window.clearTimeout(timer);
    }, [runtime, loaded, failDocument]);
    useEffect(() => {
        // Changing account, reloading or navigating revokes pending consent.
        const previous = pendingRef.current;
        if (previous && previous.accountId !== accountId) {
            previous.port.close();
            pendingRef.current = null;
            setPending(null);
        }
    }, [accountId, reply]);
    useEffect(() => {
        if (!pending) return;
        stage.current?.setAttribute("inert", "");
        const previous = document.activeElement as HTMLElement;
        dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
        const timer = window.setTimeout(() => finishRequest(false), 60000);
        return () => {
            stage.current?.removeAttribute("inert");
            window.clearTimeout(timer);
            previous?.focus?.();
        };
    }, [pending, finishRequest]);
    const connectionReady = !!(
        accountId &&
        walletConnection?.walletId &&
        ["ethereum", "solana", "tezos", "counterparty"].includes(
            walletConnection.type
        )
    );

    return (
        <Root>
            <Stage ref={stage} aria-hidden={pending ? true : undefined}>
                {runtime && (
                    <iframe
                        key={`${runtime.url}:${attempt}`}
                        ref={frame}
                        src={runtime.url}
                        title={title}
                        sandbox={CONTENT_SANDBOX}
                        allow={CONTENT_PERMISSIONS}
                        referrerPolicy="no-referrer"
                        onLoad={onLoad}
                        onError={() =>
                            failDocument("This site could not load in Oncyber.", "content-load")
                        }
                        {...({ credentialless: "" } as any)}
                    />
                )}
            </Stage>
            <ExperienceShell
                title={title}
                onExit={leave}
                status={
                    error
                        ? "Could not load"
                        : !loaded
                        ? "Loading world…"
                        : experience
                        ? "External content"
                        : "Unregistered preview"
                }
                actions={[
                    {
                        id: "permissions",
                        label: "Content permissions",
                        icon: "lock",
                        active: permissionsOpen,
                        onClick: () => {
                            document.exitPointerLock?.();
                            setPermissionsOpen(!permissionsOpen);
                        },
                    },
                    {
                        id: "reload",
                        label: "Reload world",
                        icon: "refresh-cw",
                        onClick: () => setAttempt((value) => value + 1),
                    },
                ]}
            >
                {menuOpen && !permissionsOpen && (
                    <ExperiencePanel role="region" aria-label="World menu">
                        <h2>{title}</h2>
                        <button onClick={resume}>Resume</button>
                        <button
                            onClick={() => {
                                setPermissionsOpen(true);
                            }}
                        >
                            Content permissions
                        </button>
                        <button onClick={leave}>Back to exploring</button>
                    </ExperiencePanel>
                )}
                {permissionsOpen && (
                    <ExperiencePanel
                        role="region"
                        aria-label="Content permissions"
                    >
                        <h2>Content permissions</h2>
                        <p>
                            {runtime
                                ? new URL(runtime.url).hostname
                                : "External content"}
                        </p>
                        <p>
                            This world runs separately from your Oncyber
                            account. It cannot use Oncyber’s wallet to sign or
                            send transactions.
                        </p>
                        <p>
                            Wallet address requests:{" "}
                            {runtime?.capabilities?.includes("wallet.connect")
                                ? "Ask each time"
                                : "Blocked"}
                            . Camera, microphone, popups, downloads and
                            fullscreen: blocked.
                        </p>
                        <button
                            onClick={() => {
                                permissionStore.revoke(identity);
                                setForgotten(true);
                            }}
                        >
                            Reset remembered permission
                        </button>
                        {forgotten && (
                            <p role="status">
                                The permission explanation will appear again.
                            </p>
                        )}
                        <button onClick={() => setPermissionsOpen(false)}>
                            Close
                        </button>
                    </ExperiencePanel>
                )}
            </ExperienceShell>
            {error && (
                <Notice role="alert">
                    <h2>Unable to open this world</h2>
                    <p>{error}</p>
                    {(gateError === "password-error" ||
                        gateError === "too-many-attempts-error") && (
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                setSubmittedPassword(password);
                                setAttempt((value) => value + 1);
                            }}
                        >
                            <label>
                                World password
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                />
                            </label>
                            <button>Unlock world</button>
                        </form>
                    )}
                    <button onClick={() => setAttempt((value) => value + 1)}>
                        Try again
                    </button>
                    <button onClick={leave}>Back to exploring</button>
                </Notice>
            )}
            {pending && (
                <Backdrop>
                    <Consent
                        ref={dialog}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="wallet-consent-title"
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                event.preventDefault();
                                finishRequest(false);
                            }
                            if (event.key === "Tab") {
                                const controls = Array.from(
                                    dialog.current?.querySelectorAll<HTMLElement>(
                                        "button:not(:disabled),input"
                                    ) || []
                                );
                                const first = controls[0],
                                    last = controls[controls.length - 1];
                                if (
                                    event.shiftKey &&
                                    document.activeElement === first
                                ) {
                                    event.preventDefault();
                                    last?.focus();
                                } else if (
                                    !event.shiftKey &&
                                    document.activeElement === last
                                ) {
                                    event.preventDefault();
                                    first?.focus();
                                }
                            }
                        }}
                    >
                        <small>ONCYBER · CONTENT PERMISSION</small>
                        <h2 id="wallet-consent-title">
                            Share your wallet address?
                        </h2>
                        <p>
                            <strong>{title}</strong> is requesting your public
                            wallet address.
                        </p>
                        <p className="origin">
                            Configured source:{" "}
                            {runtime && new URL(runtime.url).origin}
                        </p>
                        {!dismissed && (
                            <p>
                                This allows the content to identify your wallet.
                                It does not allow signatures, token approvals,
                                purchases, or transfers.
                            </p>
                        )}
                        {connectionReady ? (
                            <code>{walletConnection.walletId}</code>
                        ) : (
                            <p>
                                Connect a wallet using the Oncyber account menu
                                first, then request again.
                            </p>
                        )}
                        {!dismissed && (
                            <label>
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={(event) =>
                                        setRemember(event.target.checked)
                                    }
                                />
                                Do not show this again
                            </label>
                        )}
                        <small>
                            Remembers this explanation for this content and
                            account during this session. Sharing still requires
                            confirmation every time.
                        </small>
                        <div className="buttons">
                            <button onClick={() => finishRequest(false)}>
                                Cancel
                            </button>
                            <button
                                disabled={!connectionReady}
                                onClick={() => finishRequest(true)}
                            >
                                Share address
                            </button>
                        </div>
                    </Consent>
                </Backdrop>
            )}
        </Root>
    );
}

const Root = styled.div`
    position: fixed;
    inset: 0;
    background: #101010;
    color: #f3f3f1;
    overflow: hidden;
    font-family: "Oncyber Sans", Aeonik, system-ui, sans-serif;
`;
const Stage = styled.div`
    position: absolute;
    inset: 0;
    iframe {
        display: block;
        border: 0;
        width: 100%;
        height: 100%;
        background: #101010;
    }
`;
const Notice = styled.div`
    position: absolute;
    z-index: 20;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(440px, calc(100% - 40px));
    padding: 24px;
    border: 1px solid #ffffff24;
    border-radius: 24px;
    background: #191919;
    p {
        line-height: 1.5;
    }
    button,
    input {
        font: inherit;
        border-radius: 12px;
        padding: 12px;
        margin: 4px;
        background: #242424;
        color: inherit;
        border: 1px solid #ffffff24;
    }
    label {
        display: grid;
    }
`;
const Backdrop = styled.div`
    position: fixed;
    inset: 0;
    z-index: 20000;
    background: #000a;
    display: grid;
    place-items: center;
    padding: 20px;
`;
const Consent = styled.div`
    width: min(440px, 100%);
    max-height: calc(100dvh - 40px);
    overflow: auto;
    background: #191919;
    border: 1px solid #ffffff24;
    border-radius: 24px;
    padding: 28px;
    box-shadow: 0 12px 32px #0006;
    display: flex;
    flex-direction: column;
    gap: 16px;
    h2,
    p {
        margin: 0;
    }
    p {
        line-height: 1.5;
        color: #c2c2bd;
    }
    small {
        color: #93938e;
        line-height: 1.5;
    }
    code,
    .origin {
        overflow-wrap: anywhere;
    }
    label {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
    }
    input {
        width: 18px;
        height: 18px;
    }
    .buttons {
        display: flex;
        gap: 12px;
    }
    button {
        flex: 1;
        background: #242424;
        color: #f3f3f1;
        border: 1px solid #ffffff24;
        border-radius: 12px;
        padding: 12px;
        font: inherit;
        cursor: pointer;
    }
    button:last-child {
        background: #f3f3f1;
        color: #20201e;
    }
    button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    :focus-visible {
        outline: 2px solid #d3ec42;
        outline-offset: 3px;
    }
`;
