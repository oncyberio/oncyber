/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import LobbyVoiceRequests from "./LobbyVoiceRequests";
import type { LobbyStage } from "./LobbyConnection";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const stage = (patch: Partial<LobbyStage> = {}): LobbyStage => ({
    speakers: [],
    limit: 5,
    role: "owner",
    muted: false,
    requested: false,
    requests: [
        { sessionId: "7", name: "Ada", avatar: "https://example.test/a.png" },
        { sessionId: "9", name: "Lin", avatar: "" },
    ],
    mutedPeople: [],
    spatial: true,
    ...patch,
});
const buttons = () =>
    Array.from(container.querySelectorAll("button")).map((b) => b.textContent);

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

it("shows admins the oldest request with approve and decline", async () => {
    const onAdmin = jest.fn().mockResolvedValue("");
    const onShowAll = jest.fn();
    act(() =>
        root.render(
            <LobbyVoiceRequests
                stage={stage()}
                onAdmin={onAdmin}
                onShowAll={onShowAll}
            />
        )
    );
    expect(container.textContent).toContain("Ada asks to speak.");
    expect(container.textContent).toContain("0/5 ON VOICE");
    expect(buttons()).toEqual(["Add to voice", "Decline", "+1 waiting"]);
    await act(async () => container.querySelector("button")!.click());
    expect(onAdmin).toHaveBeenCalledWith("stage-add", "7");
    await act(async () =>
        (container.querySelectorAll("button")[1] as HTMLElement).click()
    );
    expect(onAdmin).toHaveBeenLastCalledWith("decline-request", "7");
    act(() => (container.querySelectorAll("button")[2] as HTMLElement).click());
    expect(onShowAll).toHaveBeenCalled();
});

it("says when voice is full and shows the server's answer", async () => {
    const onAdmin = jest.fn().mockResolvedValue("Voice is full (5 speakers).");
    const five = Array.from({ length: 5 }, (_, i) => ({
        sessionId: String(i + 1),
        name: `S${i}`,
        avatar: "",
    }));
    act(() =>
        root.render(
            <LobbyVoiceRequests
                stage={stage({ speakers: five })}
                onAdmin={onAdmin}
            />
        )
    );
    const add = container.querySelector("button")!;
    expect(add.textContent).toBe("Voice is full");
    expect(add.disabled).toBe(true);
    act(() =>
        root.render(<LobbyVoiceRequests stage={stage()} onAdmin={onAdmin} />)
    );
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain("Voice is full (5 speakers).");
});

it("shows nothing to visitors who aren't admins", () => {
    act(() =>
        root.render(
            <LobbyVoiceRequests
                stage={stage({ role: null })}
                onAdmin={jest.fn()}
            />
        )
    );
    expect(container.innerHTML).toBe("");
});
