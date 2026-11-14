/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PadelHostOverlay from "./PadelHostOverlay";
import {
    createPadelHostEnvelope,
    type PadelHostMessageType,
} from "./padelHostProtocol";

let mockSocial: any;
const mockVisit = {
    receivePose: jest.fn(),
    receiveShortcut: jest.fn(),
    focusChat: jest.fn(),
};
jest.mock("./PadelSocial", () => ({
    __esModule: true,
    default: (props) => {
        mockSocial = props;
        require("react").useEffect(() => {
            props.bridge.current = mockVisit;
            return () => {
                props.bridge.current = null;
            };
        }, [props.bridge]);
        return (
            <div data-testid="social" hidden={props.hidden}>
                <button onClick={props.onBack}>Social back</button>
            </div>
        );
    },
}));
let container: HTMLDivElement,
    root: ReturnType<typeof createRoot>,
    frame: HTMLIFrameElement;
let frameRef: React.RefObject<HTMLIFrameElement>,
    post: jest.SpyInstance,
    exit: jest.Mock;
const attempt = "00000000-0000-4000-8000-000000000123";
const identity = {
    avatarUrl: "/selected.vrm",
    name: "Visitor",
    pfp: "/portrait.png",
};
const state = { identity, active: true, mode: "visit", setupOpen: false };
function render(entered = true, blocked = false) {
    act(() =>
        root.render(
            <PadelHostOverlay
                attempt={attempt}
                frameRef={frameRef}
                entered={entered}
                blocked={blocked}
                onExit={exit}
            />
        )
    );
}
function message(
    type: PadelHostMessageType,
    payload = {},
    options: MessageEventInit = {}
) {
    act(() =>
        window.dispatchEvent(
            new MessageEvent("message", {
                source: frame.contentWindow,
                origin: window.location.origin,
                data: createPadelHostEnvelope(attempt, type, payload),
                ...options,
            })
        )
    );
}
beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSocial = null;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    frame = document.createElement("iframe");
    document.body.append(frame, container);
    frameRef = { current: frame };
    post = jest
        .spyOn(frame.contentWindow, "postMessage")
        .mockImplementation(() => {});
    exit = jest.fn();
    root = createRoot(container);
    render();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    frame.remove();
    jest.useRealTimers();
});
test("controls are owned by the outer document and reject foreign/stale frame messages", () => {
    message("state", { state }, { source: window });
    message("state", { state }, { origin: "https://untrusted.example" });
    message(
        "state",
        {},
        { data: createPadelHostEnvelope("stale", "state", { state }) }
    );
    expect(mockSocial).toBeNull();
    message("hello");
    expect(post).toHaveBeenLastCalledWith(
        createPadelHostEnvelope(attempt, "connect"),
        window.location.origin
    );
    message("state", { state });
    const controls = container.querySelector('[data-testid="social"]');
    expect(controls.ownerDocument).toBe(document);
    expect(
        frame.contentDocument.querySelector('[data-testid="social"]')
    ).toBeNull();
    expect(mockSocial.hidden).toBe(false);
    act(() => mockSocial.send({ type: "unknown:command", token: "secret" }));
    expect(post).not.toHaveBeenLastCalledWith(
        expect.objectContaining({
            message: expect.objectContaining({ token: "secret" }),
        }),
        expect.anything()
    );
});
test("setup retains the social surface and rejects input release or shortcuts until visit resumes", () => {
    message("state", { state });
    const controls = container.querySelector('[data-testid="social"]');
    message("state", { state: { ...state, setupOpen: true } });
    expect(container.querySelector('[data-testid="social"]')).toBe(controls);
    expect(mockSocial.hidden).toBe(true);
    post.mockClear();
    act(() => {
        mockSocial.focusGame();
        mockSocial.send({ type: "padel:input", enabled: true });
    });
    message("chat");
    message("shortcut", { slot: 1 });
    expect(post).not.toHaveBeenCalled();
    expect(mockVisit.focusChat).not.toHaveBeenCalled();
    expect(mockVisit.receiveShortcut).not.toHaveBeenCalled();
    message("state", { state });
    message("chat");
    expect(mockVisit.focusChat).toHaveBeenCalledTimes(1);
    render(true, true);
    expect(mockSocial.hidden).toBe(true);
    post.mockClear();
    act(() => mockSocial.send({ type: "padel:input", enabled: true }));
    expect(post).not.toHaveBeenCalled();
});
test("Back invokes native departure without asking the renderer and retains a working escape on reload", () => {
    message("state", { state });
    act(() => mockSocial.onBack());
    expect(post).toHaveBeenLastCalledWith(
        createPadelHostEnvelope(attempt, "back"),
        window.location.origin
    );
    expect(exit).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(22000));
    expect(exit).toHaveBeenCalledTimes(1);
});
test("a destination reload leaves host navigation available and requests fresh ownership", () => {
    message("state", { state });
    act(() => frame.dispatchEvent(new Event("load")));
    expect(mockSocial.hidden).toBe(true);
    expect(post).toHaveBeenLastCalledWith(
        createPadelHostEnvelope(attempt, "connect"),
        window.location.origin
    );
    const back = container.querySelector<HTMLButtonElement>(
        '[aria-label="Back to lobby"]'
    );
    expect(back).not.toBeNull();
    act(() => back.click());
    expect(exit).toHaveBeenCalledTimes(1);
});
test("only the current visit can forward pose, focus and keyboard events", () => {
    message("state", { state });
    const pose = { x: 1, y: 0, z: 2, rotation: 0 };
    message("pose", { pose });
    expect(mockVisit.receivePose).toHaveBeenCalledWith(pose);
    render(false);
    message("chat");
    message("shortcut", { slot: 2 });
    expect(mockVisit.focusChat).not.toHaveBeenCalled();
    expect(mockVisit.receiveShortcut).not.toHaveBeenCalled();
    message("state", { state: { ...state, mode: "match" } });
    expect(container.querySelector('[data-testid="social"]')).toBeNull();
});

test.each([
    { ...state, setupOpen: true },
    { ...state, mode: "match" },
])(
    "failed/reloading game always leaves host Back usable regardless of stale mode",
    (lastState) => {
        message("state", { state: lastState });
        message("state", { state: { ...lastState, active: false } });
        const back = container.querySelector<HTMLButtonElement>(
            '[aria-label="Back to lobby"]'
        );
        expect(back).not.toBeNull();
        act(() => back.click());
        expect(exit).toHaveBeenCalledTimes(1);
    }
);
