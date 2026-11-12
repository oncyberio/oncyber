/** @jest-environment jsdom */
import React, { act } from "react";
import { Simulate } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
let mockSceneProps: any;
jest.mock("./AvatarFeedbackPanel", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("next/dynamic", () => ({
    __esModule: true,
    default: () => (props: any) => {
        mockSceneProps = props;
        return null;
    },
}));
jest.mock("../avatarSelection", () => ({
    DEFAULT_LOBBY_AVATAR_URL: "/test.vrm",
}));
import { completeFeelReport } from "../../../public/lobby/feel-metrics-worker";
import FeelPage from "../../../pages/dev/lobby-feel";
test("fixed-duration capture pauses at 24 seconds and preserves its measurements", () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    const previousWorker = globalThis.Worker;
    globalThis.Worker = class {
        onmessage: (event: any) => void;
        postMessage(snapshot: any) {
            this.onmessage({ data: completeFeelReport(snapshot) });
        }
        terminate() {}
    } as any;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const button = (name: string) =>
        Array.from(container.querySelectorAll("button")).find(
            (node) => node.textContent === name
        );
    const report = () =>
        JSON.parse(
            container.querySelector('[data-testid="feel-report"]').textContent
        );
    act(() => root.render(<FeelPage />));
    act(() => Simulate.click(button("Record 24s")));
    const command = {
        strafe: 0,
        forward: 0,
        yaw: 0,
        running: false,
        jump: false,
        animation: -1,
    };
    act(() => {
        for (let i = 0; i < 1600; i++)
            mockSceneProps.advanceMovement(1 / 60, command);
        jest.advanceTimersByTime(500);
    });
    expect(button("Resume")).toBeTruthy();
    expect(report().movement.seconds).toBe(24);
    act(() => jest.advanceTimersByTime(1500));
    expect(report().movement.seconds).toBe(24);
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
    globalThis.Worker = previousWorker;
});
