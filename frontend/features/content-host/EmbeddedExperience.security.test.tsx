/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"http://localhost:13000"}
 */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { UserContext } from "@components/context/UserContext";
import EmbeddedExperience from "./EmbeddedExperience";
import { CONTENT_BRIDGE_TAG } from "./protocol";
import type { EmbeddedRuntime } from "./runtime";
import * as contentSecurity from "./security";
import {
    registerLobbyDestinationEntry,
    lobbyDestinationPrepared,
} from "@utils/lobbyDestinationBridge";

jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("next/router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@utils/spaceEntrance", () => ({ finishSpaceEntrance: jest.fn() }));
jest.mock("@utils/lobbyDestinationBridge", () => ({
    failLobbyDestination: jest.fn(),
    isLobbyDestinationPreparing: () => false,
    lobbyDestinationPrepared: jest.fn(),
    registerLobbyDestinationEntry: jest.fn(() => () => {}),
}));
jest.mock("./ExperienceShell", () => ({
    __esModule: true,
    default: ({ actions, children, onExit, status }) => (
        <section>
            <span data-testid="status">{status}</span>
            <button onClick={onExit}>Exit experience</button>
            {actions.map((action) => (
                <button key={action.id} onClick={action.onClick}>
                    {action.label}
                </button>
            ))}
            {children}
        </section>
    ),
    ExperiencePanel: ({ children }) => <section>{children}</section>,
}));

const address = "0x1111111111111111111111111111111111111111";
const providerRequest = jest.fn();
const user = {
    user: { id: "account-1" },
    authenticated: true,
    isAnonymous: false,
    walletConnection: {
        walletId: address,
        type: "ethereum",
        provider: { request: providerRequest },
    },
};
const originalEnvironment = process.env.NODE_ENV;
const descriptor: EmbeddedRuntime = {
    kind: "web",
    url: "https://games.example.com/engine",
    capabilities: ["wallet.connect"],
};
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let frame: HTMLIFrameElement;
let post: jest.SpyInstance;
let session: string;
let sequence: number;
let nonce: number;
const makePort = () => ({ postMessage: jest.fn(), close: jest.fn() });
type Port = ReturnType<typeof makePort>;

const button = (text: string) =>
    Array.from(container.querySelectorAll("button")).find(
        (node) => node.textContent === text
    );
const click = (node: Element) =>
    act(() => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const render = async (runtime = descriptor, account = user) => {
    await act(async () =>
        root.render(
            <UserContext.Provider value={account as any}>
                <EmbeddedExperience runtime={runtime} title="Example game" />
            </UserContext.Provider>
        )
    );
};
const loadFrame = () => {
    frame = container.querySelector("iframe");
    post = jest
        .spyOn(frame.contentWindow, "postMessage")
        .mockImplementation(() => {});
    act(() => frame.dispatchEvent(new Event("load")));
    session = post.mock.calls.find(([message]) => message.kind === "init")[0]
        .session;
};
const request = (
    method = "wallet.connect",
    port: Port = makePort(),
    options: {
        source?: MessageEventSource;
        session?: string;
        ports?: Port[];
    } = {}
) => {
    const event = new MessageEvent("message", {
        source: options.source || frame.contentWindow,
        origin: "null",
        data: {
            tag: CONTENT_BRIDGE_TAG,
            v: 1,
            kind: "request",
            session: options.session || session,
            id: `request-${++sequence}`,
            method,
        },
    });
    Object.defineProperty(event, "ports", { value: options.ports || [port] });
    act(() => window.dispatchEvent(event));
    return port;
};

beforeEach(async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    window.sessionStorage.clear();
    sequence = 0;
    nonce = 0;
    Object.defineProperty(window, "crypto", {
        configurable: true,
        value: { getRandomValues: (bytes: Uint8Array) => bytes.fill(++nonce) },
    });
    document.exitPointerLock = jest.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await render();
    loadFrame();
});
afterEach(() => {
    (process.env as Record<string, string>).NODE_ENV = originalEnvironment;
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
});

test("shares only the selected public address after a host click over the document-bound port", () => {
    const port = request();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(port.postMessage).not.toHaveBeenCalled();
    expect(
        post.mock.calls
            .flat()
            .some((value) => JSON.stringify(value)?.includes(address))
    ).toBe(false);
    click(button("Share address"));
    expect(port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
            kind: "result",
            method: "wallet.connect",
            payload: { address, chain: "ethereum" },
        })
    );
    expect(port.close).toHaveBeenCalledTimes(1);
    expect(providerRequest).not.toHaveBeenCalled();
    expect(
        post.mock.calls
            .flat()
            .some((value) => JSON.stringify(value)?.includes(address))
    ).toBe(false);
});

test("remembering the explanation never automatically authorizes a subsequent request", () => {
    request();
    click(container.querySelector('input[type="checkbox"]'));
    click(button("Share address"));
    const next = request();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(next.postMessage).not.toHaveBeenCalled();
    click(button("Cancel"));
    expect(next.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "error", error: "USER_REJECTED" })
    );
    expect(providerRequest).not.toHaveBeenCalled();
});

test("rejects signature and transaction RPC without opening consent or touching a wallet provider", () => {
    for (const method of [
        "eth_sendTransaction",
        "personal_sign",
        "wallet.personal-sign",
    ]) {
        const port = request(method);
        expect(port.close).toHaveBeenCalledTimes(1);
        expect(post).toHaveBeenLastCalledWith(
            expect.objectContaining({
                kind: "error",
                error: "UNSUPPORTED_METHOD",
            }),
            "*"
        );
    }
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(providerRequest).not.toHaveBeenCalled();
});

test("requires a response port and rejects stale sessions", () => {
    request("wallet.connect", makePort(), { ports: [] });
    expect(post).toHaveBeenLastCalledWith(
        expect.objectContaining({ error: "RESPONSE_PORT_REQUIRED" }),
        "*"
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    const stale = request("wallet.connect", makePort(), {
        session: "previous-document",
    });
    expect(stale.close).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
});

test("ignores unrelated window messages without closing their transferred ports", () => {
    const unrelated = request("wallet.connect", makePort(), { source: window });
    expect(unrelated.close).not.toHaveBeenCalled();
    expect(unrelated.postMessage).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
});

test("navigation cancels pending consent and invalidates the previous document session", () => {
    const firstSession = session;
    const pending = request();
    act(() => frame.dispatchEvent(new Event("load")));
    expect(pending.close).toHaveBeenCalledTimes(1);
    expect(pending.postMessage).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    request("wallet.connect", makePort(), { session: firstSession });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(providerRequest).not.toHaveBeenCalled();
});

test("capability-disabled content cannot open wallet consent", async () => {
    await render({ ...descriptor, capabilities: [] });
    loadFrame();
    const port = request();
    expect(port.close).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenLastCalledWith(
        expect.objectContaining({ error: "CAPABILITY_DISABLED" }),
        "*"
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
});

test("account changes close an outstanding response port without disclosing an address", async () => {
    const port = request();
    await render(descriptor, { ...user, user: { id: "account-2" } });
    expect(port.close).toHaveBeenCalledTimes(1);
    expect(port.postMessage).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
});

test("an untrusted host ancestor denies wallet capability before showing consent", () => {
    jest.spyOn(contentSecurity, "isTrustedContentHostWindow").mockReturnValue(
        false
    );
    const port = request();
    expect(port.close).toHaveBeenCalledTimes(1);
    expect(port.postMessage).not.toHaveBeenCalled();
    expect(post).toHaveBeenLastCalledWith(
        expect.objectContaining({ error: "UNTRUSTED_HOST_CONTEXT" }),
        "*"
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(providerRequest).not.toHaveBeenCalled();
});

test("a paused game receives a session-bound resume event from the host menu", () => {
    request("menu");
    expect(button("Resume")).toBeDefined();
    const focus = jest.spyOn(frame, "focus").mockImplementation(() => {});
    click(button("Resume"));
    expect(post).toHaveBeenLastCalledWith(
        {
            tag: CONTENT_BRIDGE_TAG,
            v: 1,
            kind: "event",
            session,
            method: "resume",
        },
        "*"
    );
    expect(focus).toHaveBeenCalledTimes(1);
    expect(button("Resume")).toBeUndefined();
});

test("frame failure revokes pending consent, removes the frame and ignores late ready", () => {
    const pending = request();
    act(() => Simulate.error(frame));
    expect(pending.close).toHaveBeenCalledTimes(1);
    expect(pending.postMessage).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    request("ready");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(providerRequest).not.toHaveBeenCalled();
});

test("leaving immediately revokes document permissions before navigation completes", () => {
    const pending = request();
    click(button("Exit experience"));
    expect(pending.close).toHaveBeenCalledTimes(1);
    expect(pending.postMessage).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).toBeNull();
    request();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
});

test("a ready message and self-navigation cannot hide the preview label", () => {
    request("ready");
    expect(container.querySelector('[data-testid="status"]').textContent).toBe(
        "Unregistered preview"
    );
    act(() => frame.dispatchEvent(new Event("load")));
    expect(container.querySelector('[data-testid="status"]').textContent).toBe(
        "Unregistered preview"
    );
});

test("load timeout removes the frame and retry creates a fresh document", async () => {
    await render({ ...descriptor, url: "https://games.example.com/slow" });
    const slow = container.querySelector("iframe");
    expect(slow).not.toBeNull();
    act(() => jest.advanceTimersByTime(30000));
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () =>
        button("Try again").dispatchEvent(
            new MouseEvent("click", { bubbles: true })
        )
    );
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(container.querySelector("iframe")).not.toBe(slow);
});

test("opaque embeds register immediate reveal after load and engine-neutral ready", async () => {
    const focus = jest.spyOn(frame, "focus").mockImplementation(() => {});
    const registration = () =>
        (registerLobbyDestinationEntry as jest.Mock).mock.calls.at(-1);
    expect(registration()[2]?.reveal).toBeUndefined();
    expect(lobbyDestinationPrepared).toHaveBeenCalled();
    request("ready");
    expect(registration()[2]?.reveal).toBeUndefined();
    await act(async () => {
        await registration()[0]();
    });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(frame.style.maskImage).toBe("");
    expect(frame.style.opacity).toBe("");
    expect(container.querySelector("canvas, svg mask")).toBeNull();
});

test("an opaque document cannot advertise a renderer reveal through its ready message", () => {
    act(() =>
        window.dispatchEvent(
            new MessageEvent("message", {
                source: frame.contentWindow,
                origin: "null",
                data: {
                    tag: CONTENT_BRIDGE_TAG,
                    v: 1,
                    kind: "request",
                    session,
                    id: "fake-renderer-ready",
                    method: "ready",
                    payload: { reveal: "native" },
                },
            })
        )
    );
    expect(post).toHaveBeenLastCalledWith(
        expect.objectContaining({ error: "INVALID_PARAMS" }),
        "*"
    );
    const registration = (
        registerLobbyDestinationEntry as jest.Mock
    ).mock.calls.at(-1);
    expect(registration[2]?.reveal).toBeUndefined();
});

test.each([
    ["production", "http://localhost:13000"],
    ["development", "https://preview.example.com"],
    ["development", "https://localhost.attacker.test"],
])(
    "supplied preview capabilities cannot enable wallet requests on %s at %s",
    async (environment, origin) => {
        (process.env as Record<string, string>).NODE_ENV = environment;
        jest.spyOn(window, "location", "get").mockReturnValue({
            origin,
        } as Location);
        await render({ ...descriptor, url: `${descriptor.url}?changed` });
        loadFrame();
        expect(post).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "init", capabilities: [] }),
            "*"
        );
        const port = request();
        expect(port.close).toHaveBeenCalledTimes(1);
        expect(post).toHaveBeenLastCalledWith(
            expect.objectContaining({ error: "CAPABILITY_DISABLED" }),
            "*"
        );
        expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(providerRequest).not.toHaveBeenCalled();
    }
);

test("an admitted registered space retains its explicit address capability and external label", async () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    const previousFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ runtime: descriptor }),
    })) as any;
    try {
        await act(async () =>
            root.render(
                <UserContext.Provider value={user as any}>
                    <EmbeddedExperience
                        experience={{ id: "registered-space" } as any}
                        runtime={{ ...descriptor, capabilities: [] }}
                    />
                </UserContext.Provider>
            )
        );
        loadFrame();
        request("ready");
        expect(
            container.querySelector('[data-testid="status"]').textContent
        ).toBe("External content");
        const port = request();
        expect(container.querySelector('[role="dialog"]')).not.toBeNull();
        expect(port.postMessage).not.toHaveBeenCalled();
        click(button("Cancel"));
    } finally {
        globalThis.fetch = previousFetch;
    }
});
