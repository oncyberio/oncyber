/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Tooltip from "./Tooltip";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import mockEnglish from "../../../../../locales/en/index.json";

const en = mockEnglish;

jest.mock("@3events", () => ({ PLAYER_JOINED: "PLAYER_JOINED" }), {
    virtual: true,
});
jest.mock("@components/_3DExhibit-v2/hooks/useWorld", () => ({
    useWorld: () => ({ current: null }),
}));
jest.mock("@components/_3DExhibit-v2/context/MultiplayerProvider", () => ({
    useMultiplayer: jest.fn(),
}));
// The visitor's English, as the locales have it now.
jest.mock("@components/context/I18nContext", () => ({
    useCyberTranslation: () => ({ t: (key) => mockEnglish[String(key)] }),
}));
jest.mock("@ui/components/IconImg", () => ({
    __esModule: true,
    default: () => <span />,
}));
jest.mock("framer-motion", () => {
    const React = require("react");
    return {
        AnimatePresence: ({ children }) => children,
        motion: {
            div: ({
                initial,
                animate,
                exit,
                transition,
                onAnimationComplete,
                ...props
            }) => <div {...props} />,
        },
    };
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const render = (voiceState: any) => {
    (useMultiplayer as jest.Mock).mockReturnValue({
        voice: { voiceState },
        room: { isMod: false },
    });
    act(() => root.render(<Tooltip hasRequestMic />));
};
const shown = () => container.textContent;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    render({ type: "pending", reason: "mic" });
    expect(shown()).toBe("");
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

test("a request a moderator turned down says it was denied", () => {
    render({ type: "disabled" });
    expect(shown()).toBe(en.MIC_REQUEST_DENIED);
});

test("a request that ran out of time says so, and to ask again", () => {
    render({ type: "disabled", request: "expired" });
    expect(shown()).toBe("Your request expired. Ask again.");
    expect(shown()).not.toBe(en.MIC_REQUEST_DENIED);
});

test("a request the visitor withdrew, or left voice with, says nothing", () => {
    render({ type: "disabled", request: "withdrawn" });
    expect(shown()).toBe("");
});

test("a speaker moved back to the audience is told that, not denied", () => {
    render({ type: "disabled", leaveAsSpeaker: true });
    expect(shown()).toBe(en.MIC_LEAVE_AS_SPEAKER);
});

test("asking to speak with no moderator there says so, not denied", () => {
    (useMultiplayer as jest.Mock).mockReturnValue({
        voice: { voiceState: { type: "disabled" } },
        room: { isMod: false },
    });
    act(() => root.render(<Tooltip noModeratorAt={1} />));
    expect(shown()).toBe(en.NO_MODERATOR_TO_APPROVE);
    expect(shown()).toBe(
        "No moderator is here to let you speak. Try again later."
    );

    act(() => root.render(<Tooltip noModeratorAt={2} />));
    expect(shown()).toBe(en.NO_MODERATOR_TO_APPROVE);
});
