/** @jest-environment jsdom */
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { useLobbySocialHandoff } from "./lobbySocialHandoff";
import { SOCIAL_HANDOFF, SOCIAL_REQUEST } from "./gameSocial";

function Lobby({ frame, social }) {
    useLobbySocialHandoff(frame, social);
    return null;
}

const ask = (source: object, origin = window.location.origin) => {
    const event = new MessageEvent("message", {
        origin,
        data: { type: SOCIAL_REQUEST },
    });
    Object.defineProperty(event, "source", { value: source });
    window.dispatchEvent(event);
};

it("answers the destination frame with the lobby's chat and departing voice", () => {
    const destination = { postMessage: jest.fn() };
    const frame = createRef<HTMLIFrameElement>();
    (frame as any).current = { contentWindow: destination };
    const social = {
        sessionId: "me",
        lobbyPresent: true,
        voiceState: "live",
        messages: [{ sessionId: "a", name: "Ada", text: "hello", sentAt: 5 }],
    };
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Lobby frame={frame} social={social} />));
    // The visitor is in the game now: the lobby's own voice is off.
    act(() =>
        root.render(
            <Lobby
                frame={frame}
                social={{ ...social, lobbyPresent: false, voiceState: "off" }}
            />
        )
    );
    ask({ postMessage: jest.fn() });
    ask(destination, "https://elsewhere.example");
    expect(destination.postMessage).not.toHaveBeenCalled();
    ask(destination);
    expect(destination.postMessage).toHaveBeenCalledWith(
        {
            type: SOCIAL_HANDOFF,
            voice: "live",
            messages: [{ name: "Ada", text: "hello", sentAt: 5, self: false }],
        },
        window.location.origin
    );
    act(() => root.unmount());
});
