/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useChat from "./useChat";
import { UserContext } from "@components/context/UserContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { getProfanity } from "@utils/saveToDb";
import ChatProvider from "@utils/chat/ColyseusChatProvider";

jest.mock("@components/context/UserContext", () => ({ UserContext: require("react").createContext({}) }));
jest.mock("@components/_3DExhibit-v2/hooks/useWorld", () => ({ useWorld: jest.fn() }));
jest.mock("@utils/saveToDb", () => ({ getProfanity: jest.fn() }));
jest.mock("@utils/chat/ColyseusChatProvider", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@3gl/factory/player/constants", () => ({ CHAT_NEARBY_RADIUS: 10 }), { virtual: true });
jest.mock("@3events", () => ({ UPDATE_PLAYERS: "UPDATE_PLAYERS" }), { virtual: true });
jest.mock("@components/_3DExhibit-v2/three/factory/multiplayer/constants", () => ({ UPDATE_CHAT_BUBBLE: "UPDATE_CHAT_BUBBLE" }));
jest.mock("@components/_3DExhibit-v2/three/constants", () => ({ IS_MOBILE: false }));
jest.mock("@components/_3DExhibit-v2/ui/ControlPanel/Raffle/raffles/rtfktRaffleConstants", () => ({ MINT_SPACE_CUSTOM_LINK: "mint" }));
jest.mock("@env", () => ({ nodeEnv: {} }));

let root: ReturnType<typeof createRoot>, hook: ReturnType<typeof useChat>;
let services: any, client: any;
const room = { roomId: "gallery", label: "gallery", sessionId: "session", exhibit: { id: "gallery" } as any, isMod: false, isAnon: true };
const chatModule = { default: ChatProvider } as any;
function deferred<T>() {
    let resolve: (value: T) => void;
    let reject: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function Harness() {
    hook = useChat({ userId: "visitor", MultiplayerService: services });
    return null;
}
beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.spyOn(console, "log").mockImplementation(() => {});
    (useWorld as jest.Mock).mockReturnValue({ current: { setEventListener: jest.fn() } });
    (getProfanity as jest.Mock).mockResolvedValue(["cold-word"]);
    client = {
        init: jest.fn(), on: jest.fn(), login: jest.fn(async () => {}),
        joinChannel: jest.fn(async () => ({ on: jest.fn() })),
        leaveChannel: jest.fn(async () => {}), logout: jest.fn(async () => {}), dispose: jest.fn(async () => {}),
    };
    (ChatProvider as unknown as jest.Mock).mockImplementation(() => client);
    services = { current: { roomService: { room: {} }, chatService: null } };
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(<UserContext.Provider value={{ userData: {} } as any}><Harness /></UserContext.Provider>));
});
afterEach(async () => {
    await act(async () => root.unmount());
    jest.clearAllMocks(); jest.restoreAllMocks();
});

test("warm chat waits for moderation before enabling the existing room channel", async () => {
    const words = deferred<string[]>();
    let pending: ReturnType<typeof hook.init>;
    await act(async () => { pending = hook.init(room, { profanity: words.promise, chatProvider: Promise.resolve(chatModule) }); });
    expect(ChatProvider).not.toHaveBeenCalled();
    expect(hook.active).toBe(false);
    await act(async () => { words.resolve(["warm-word"]); await pending; });
    expect(getProfanity).not.toHaveBeenCalled();
    expect(ChatProvider).toHaveBeenCalledTimes(1);
    expect(client.init).toHaveBeenCalledWith(services.current.roomService.room);
    expect(client.login).toHaveBeenCalledWith("galleryv1", "session");
    expect(client.joinChannel).toHaveBeenCalledWith("gallery");
    expect(hook.swearwordsRegexRef.test("WARM-WORD")).toBe(true);
    expect(hook.active).toBe(true);
});

test("cold chat still fetches moderation and imports its own provider", async () => {
    await act(async () => { await hook.init(room); });
    expect(getProfanity).toHaveBeenCalledWith({ abortController: expect.any(AbortController) });
    expect(getProfanity).toHaveBeenCalledTimes(1);
    expect(ChatProvider).toHaveBeenCalledTimes(1);
    expect(hook.swearwordsRegexRef.test("cold-word")).toBe(true);
    expect(hook.active).toBe(true);
});

test.each(["moderation", "module"])("cancel during %s warmup cannot create or enable chat", async (stage) => {
    const words = deferred<string[]>(), module = deferred<any>();
    let pending: ReturnType<typeof hook.init>;
    await act(async () => {
        pending = hook.init(room, { profanity: words.promise, chatProvider: module.promise });
        if (stage === "module") {
            words.resolve(["word"]);
            for (let i = 0; i < 5; i++) await Promise.resolve();
        }
        await hook.dispose("gallery");
        words.resolve(["word"]); module.resolve(chatModule);
        await pending;
    });
    expect(ChatProvider).not.toHaveBeenCalled();
    expect(client.joinChannel).not.toHaveBeenCalled();
    expect(hook.active).toBe(false);
});

test("existing moderation fallback still permits chat, while a failed module cannot enable it", async () => {
    const module = deferred<any>();
    let pending: ReturnType<typeof hook.init>;
    await act(async () => {
        pending = hook.init(room, { profanity: Promise.resolve(null), chatProvider: module.promise });
        await Promise.resolve();
        module.reject(Error("chunk unavailable"));
        await pending;
    });
    expect(hook.swearwordsRegexRef).toBeNull();
    expect(hook.active).toBe(false);
    expect(ChatProvider).not.toHaveBeenCalled();
    await act(async () => { await hook.init(room, { profanity: Promise.resolve(null), chatProvider: Promise.resolve(chatModule) }); });
    expect(hook.swearwordsRegexRef).toBeNull();
    expect(hook.active).toBe(true);
});


test.each([false, true])("chat starts visible on narrow screens and resizing preserves the visitor's choice (mobile=%s)", async (mobile) => {
    const width = Object.getOwnPropertyDescriptor(window, "innerWidth");
    const platform = jest.requireMock("@components/_3DExhibit-v2/three/constants");
    platform.IS_MOBILE = mobile;
    try {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
        await act(async () => { await hook.init(room); });
        expect(hook.isChatDisplayed).toBe(true);
        act(() => window.dispatchEvent(new Event("resize")));
        expect(hook.isChatDisplayed).toBe(true);
        act(() => hook.setIsChatDisplayed(false));
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
        act(() => window.dispatchEvent(new Event("resize")));
        expect(hook.isChatDisplayed).toBe(false);
    } finally {
        platform.IS_MOBILE = false;
        Object.defineProperty(window, "innerWidth", width);
    }
});
