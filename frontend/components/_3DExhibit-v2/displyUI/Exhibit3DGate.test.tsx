/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Exhibit3DGate from "./Exhibit3DGate";
import { yieldLobbyLoadingWork } from "@utils/lobbyLoadingBudget";
import { isWebGLAvailable } from "@utils/webgl";
import { failLobbyDestination } from "@utils/lobbyDestinationBridge";

jest.mock("@utils/lobbyLoadingBudget", () => ({
    yieldLobbyLoadingWork: jest.fn(),
}));
jest.mock("@utils/nativeStartupDiagnostics", () => ({
    markNativeStartup: jest.fn(),
}));
jest.mock("@utils/lobbyDestinationBridge", () => ({
    failLobbyDestination: jest.fn(),
}));
jest.mock("@utils/spaceEntrance", () => ({
    finishSpaceEntrance: jest.fn(),
}));
jest.mock("@utils/webgl", () => ({
    isWebGLAvailable: jest.fn(() => true),
    getWebGLDiagnostics: jest.fn(() => ({})),
}));
jest.mock("@utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
}));
jest.mock("next/dynamic", () => () => () => <div data-testid="native-scene" />);
jest.mock("./WebGLNotSupported", () => () => <div data-testid="unsupported" />);

let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
let release: () => void;
let signal: AbortSignal;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    (isWebGLAvailable as jest.Mock).mockReturnValue(true);
    (yieldLobbyLoadingWork as jest.Mock).mockImplementation((options) => {
        signal = options.signal;
        return new Promise<void>((resolve) => {
            release = resolve;
        });
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test("does not create a probe or mount the native renderer until the opening budget releases", async () => {
    act(() => root.render(<Exhibit3DGate />));
    expect(isWebGLAvailable).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid=native-scene]")).toBeNull();
    await act(async () => release());
    expect(isWebGLAvailable).toHaveBeenCalledTimes(1);
    expect(
        container.querySelector("[data-testid=native-scene]")
    ).not.toBeNull();
});

test("cancellation while waiting prevents late renderer startup", async () => {
    act(() => root.render(<Exhibit3DGate />));
    act(() => root.render(null));
    expect(signal.aborted).toBe(true);
    await act(async () => release());
    expect(isWebGLAvailable).not.toHaveBeenCalled();
    expect(failLobbyDestination).not.toHaveBeenCalled();
});

test("unsupported graphics still reports failure after the scheduling checkpoint", async () => {
    (isWebGLAvailable as jest.Mock).mockReturnValue(false);
    act(() => root.render(<Exhibit3DGate />));
    await act(async () => release());
    expect(container.querySelector("[data-testid=unsupported]")).not.toBeNull();
    expect(container.querySelector("[data-testid=native-scene]")).toBeNull();
    expect(failLobbyDestination).toHaveBeenCalledWith(
        "This device could not start the 3D world.",
        "webgl"
    );
});
