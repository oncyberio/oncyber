/** @jest-environment jsdom */
import {
    createGameInputHost,
    isTypingTarget,
    GAME_RESERVED_KEYS,
    type GameKeyIntent,
} from "./gameInput";
import { readGameMessage } from "./gameContract";

function setup(muted = false) {
    const sent: any[] = [];
    const intents: GameKeyIntent[] = [];
    let focused = 0;
    const host = createGameInputHost({
        game: "ace",
        send: (message) => sent.push(message),
        focusGame: () => focused++,
        intent: (intent) => intents.push(intent),
        muted,
    });
    return { host, sent, intents, focused: () => focused };
}
const press = (target: EventTarget, code: string, more = {}) => {
    const event = new KeyboardEvent("keydown", {
        code,
        bubbles: true,
        cancelable: true,
        ...more,
    });
    target.dispatchEvent(event);
    return event;
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => (document.body.innerHTML = ""));

test("the page reserves Escape and nothing else", () => {
    expect(GAME_RESERVED_KEYS).toEqual({ Escape: "menu" });
});

test("overlapping holds reach the game as one pause and one resume", () => {
    const { host, sent, focused } = setup();
    host.hold("menu");
    host.hold("typing");
    host.hold("menu");
    host.release("menu");
    expect(sent).toEqual([
        { type: "ace:input", paused: true, reason: "menu" },
        { type: "ace:input", paused: true, reason: "typing" },
    ]);
    expect(focused()).toBe(0);
    host.release("typing");
    host.release("typing");
    expect(sent[2]).toEqual({ type: "ace:input", paused: false, reason: "" });
    expect(sent).toHaveLength(3);
    expect(focused()).toBe(1);
    host.hold("Bad Reason");
    expect(host.paused).toBe(false);
});

test("only reserved keys from the game become intents", () => {
    const { host, intents } = setup();
    // The kind is read by the page (readGameMessage), whichever form the
    // game speaks: oncyber:game:key, or ace:key in an older build.
    const receive = (type: unknown, data: any = { type }) =>
        host.receive(readGameMessage(type, "ace")?.kind, data);
    expect(receive("oncyber:game:key", { code: "Escape" })).toBe(true);
    // A build from when the page also took Enter and M still hands them
    // over; they are the game's keys now and the page does nothing.
    expect(receive("ace:key", { code: "NumpadEnter" })).toBe(true);
    expect(receive("oncyber:game:key", { code: "KeyM" })).toBe(true);
    expect(receive("ace:key", { code: "KeyW" })).toBe(true);
    expect(receive("oncyber:game:key", { code: "constructor" })).toBe(true);
    expect(receive("garden:key", { code: "Escape" })).toBe(false);
    expect(receive("oncyber:game:ready")).toBe(false);
    expect(host.receive(null, null)).toBe(false);
    expect(intents).toEqual(["menu"]);
});

test("typing in any page text field pauses the game; leaving it resumes", async () => {
    const { host, sent, intents, focused } = setup();
    document.body.innerHTML = `<input id="chat" data-game-chat><button id="b">x</button>`;
    const stop = host.watch(document);
    expect(host.paused).toBe(false);
    // The visitor clicks into the page's chat.
    document.getElementById("chat")!.focus();
    expect(sent).toEqual([
        { type: "ace:input", paused: true, reason: "typing" },
    ]);
    const chat = document.getElementById("chat")!;
    // Letters and Enter are text while typing.
    expect(press(chat, "KeyM").defaultPrevented).toBe(false);
    expect(press(chat, "Enter").defaultPrevented).toBe(false);
    expect(intents).toEqual([]);
    // Escape leaves the field and the game takes focus again.
    expect(press(chat, "Escape").defaultPrevented).toBe(true);
    await tick();
    expect(document.activeElement).toBe(document.body);
    expect(host.paused).toBe(false);
    expect(sent[1]).toEqual({ type: "ace:input", paused: false, reason: "" });
    expect(focused()).toBeGreaterThan(0);
    stop();
    chat.focus();
    expect(host.paused).toBe(false);
});

test("page keys work when the page, not the game, has focus", () => {
    const { host, intents } = setup();
    document.body.innerHTML = `<button id="b">x</button>`;
    host.watch(document);
    expect(press(document.body, "Escape").defaultPrevented).toBe(true);
    // Every other key is left alone: Enter still presses a focused button,
    // M and Cmd+M are the browser's and the system's.
    for (const code of ["KeyM", "Enter", "NumpadEnter", "KeyW"])
        expect(press(document.body, code).defaultPrevented).toBe(false);
    expect(
        press(document.body, "KeyM", { metaKey: true }).defaultPrevented
    ).toBe(false);
    expect(press(document.getElementById("b")!, "Enter").defaultPrevented).toBe(
        false
    );
    expect(intents).toEqual(["menu"]);
});

test("sound state is sent on change and again on sync", () => {
    const { host, sent } = setup(true);
    expect(host.muted).toBe(true);
    host.setMuted(false);
    host.hold("menu");
    host.sync();
    expect(sent).toEqual([
        { type: "ace:muted", muted: false },
        { type: "ace:input", paused: true, reason: "menu" },
        { type: "ace:input", paused: true, reason: "menu" },
        { type: "ace:muted", muted: false },
    ]);
});

test("what counts as typing", () => {
    const el = (html: string) => {
        document.body.innerHTML = html;
        return document.body.firstElementChild;
    };
    expect(isTypingTarget(el("<input>"))).toBe(true);
    expect(isTypingTarget(el("<textarea></textarea>"))).toBe(true);
    expect(isTypingTarget(el('<input type="checkbox">'))).toBe(false);
    expect(isTypingTarget(el("<input readonly>"))).toBe(false);
    expect(isTypingTarget(el("<button></button>"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
});
