/** @jest-environment jsdom */
import {
    bridgeGameSafeArea,
    computeSafeInsets,
    measureOverlays,
    type OverlayRect,
} from "./safeArea";

const controls: OverlayRect = {
    id: "controls",
    x: 20,
    y: 14,
    width: 250,
    height: 44,
};
const partyChat = (width: number, height: number): OverlayRect => ({
    id: "party-chat",
    x: 24,
    y: height - 64,
    width: Math.min(340, width - 32),
    height: 44,
});

describe("computeSafeInsets", () => {
    test("no overlays, no insets", () => {
        expect(computeSafeInsets(1280, 720, [])).toEqual({
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        });
    });

    test("a pill in a top corner reserves a band along the top", () => {
        expect(computeSafeInsets(1280, 720, [controls])).toEqual({
            top: 58,
            right: 0,
            bottom: 0,
            left: 0,
        });
        // Narrow and tall: still the top, not most of the width.
        expect(computeSafeInsets(390, 844, [controls]).top).toBe(58);
        expect(computeSafeInsets(390, 844, [controls]).left).toBe(0);
    });

    test("the lobby's party chat reserves the bottom", () => {
        expect(
            computeSafeInsets(1280, 720, [controls, partyChat(1280, 720)])
        ).toEqual({ top: 58, right: 0, bottom: 64, left: 0 });
    });

    test("a narrow rail down one side reserves that side", () => {
        const rail = { id: "rail", x: 1220, y: 100, width: 60, height: 520 };
        expect(computeSafeInsets(1280, 720, [rail])).toEqual({
            top: 0,
            right: 60,
            bottom: 0,
            left: 0,
        });
    });

    test("an overlay can name its edge", () => {
        const badge: OverlayRect = {
            id: "badge",
            x: 0,
            y: 0,
            width: 80,
            height: 60,
            edge: "left",
        };
        expect(computeSafeInsets(1280, 720, [badge]).left).toBe(80);
        expect(computeSafeInsets(1280, 720, [badge]).top).toBe(0);
    });

    test("an overlay inside a band another one reserved adds nothing", () => {
        const note = { id: "note", x: 300, y: 20, width: 600, height: 30 };
        expect(computeSafeInsets(1280, 720, [controls, note])).toEqual({
            top: 58,
            right: 0,
            bottom: 0,
            left: 0,
        });
    });

    test("an opened panel covering much of the frame is not laid out around", () => {
        const chat = { id: "chat", x: 16, y: 300, width: 358, height: 524 };
        expect(computeSafeInsets(390, 844, [chat])).toEqual({
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        });
    });

    test("device insets are the floor, and overlays off the frame are ignored", () => {
        const device = { top: 47, right: 0, bottom: 34, left: 0 };
        const off = { id: "off", x: -400, y: -90, width: 200, height: 40 };
        expect(computeSafeInsets(390, 844, [off], device)).toEqual(device);
        expect(computeSafeInsets(390, 844, [controls], device)).toEqual({
            top: 58,
            right: 0,
            bottom: 34,
            left: 0,
        });
    });
});

function place(element: Element, x: number, y: number, w: number, h: number) {
    element.getBoundingClientRect = () =>
        ({
            left: x,
            top: y,
            right: x + w,
            bottom: y + h,
            width: w,
            height: h,
            x,
            y,
            toJSON() {},
        } as DOMRect);
}

describe("the page bridge", () => {
    let frame: HTMLIFrameElement;
    let posted: any[];
    let stop: () => void;
    const flush = () => new Promise((resolve) => setTimeout(resolve, 40));
    const fromGame = (type: string) =>
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { type },
                source: frame.contentWindow,
            })
        );

    beforeEach(() => {
        document.body.innerHTML = "";
        frame = document.createElement("iframe");
        document.body.appendChild(frame);
        place(frame, 0, 0, 1280, 720);
        posted = [];
        jest.spyOn(frame.contentWindow!, "postMessage").mockImplementation(
            (message: any) => void posted.push(message)
        );
    });
    afterEach(() => stop?.());

    function addOverlay(
        name: string,
        x: number,
        y: number,
        w: number,
        h: number
    ) {
        const element = document.createElement("div");
        element.setAttribute("data-game-overlay", name);
        place(element, x, y, w, h);
        document.body.appendChild(element);
        return element;
    }

    test("measures marked overlays relative to the frame", () => {
        place(frame, 10, 20, 1280, 720);
        addOverlay("controls", 30, 34, 250, 44);
        addOverlay("hidden", 0, 0, 0, 0);
        addOverlay("elsewhere", 5000, 34, 250, 44);
        expect(measureOverlays(frame)).toEqual([
            { id: "controls", x: 20, y: 14, width: 250, height: 44 },
        ]);
    });

    test("inside the lobby, the lobby's overlays count too", () => {
        // This document stands in for the lobby; the game page is a frame in it.
        const chat = addOverlay("party-chat", 24, 656, 340, 44);
        const pageFrame = document.createElement("iframe");
        document.body.appendChild(pageFrame);
        place(pageFrame, 0, 0, 1280, 720);
        const pageDocument = pageFrame.contentDocument!;
        const gameFrame = pageDocument.createElement("iframe");
        pageDocument.body.appendChild(gameFrame);
        place(gameFrame, 0, 0, 1280, 720);
        expect(measureOverlays(gameFrame)).toEqual([
            { id: "party-chat", x: 24, y: 656, width: 340, height: 44 },
        ]);
        // The lobby shows the page somewhere else: the boxes follow.
        place(pageFrame, 100, 50, 1280, 720);
        expect(measureOverlays(gameFrame)[0]).toMatchObject({ x: -76, y: 606 });
        chat.remove();
    });

    test("sends the safe area at once, on hello and ready, and when overlays change", async () => {
        stop = bridgeGameSafeArea(frame, "ace");
        await flush();
        expect(posted).toEqual([
            {
                type: "ace:safe-area",
                insets: { top: 0, right: 0, bottom: 0, left: 0 },
                width: 1280,
                height: 720,
            },
        ]);
        // Nothing changed: nothing more to say, until the game asks.
        window.dispatchEvent(new Event("resize"));
        await flush();
        expect(posted).toHaveLength(1);
        fromGame("ace:hello");
        fromGame("garden:hello");
        expect(posted).toHaveLength(2);
        // The controls appear once the game is ready.
        const controlsElement = addOverlay("controls", 20, 14, 250, 44);
        await flush();
        expect(posted).toHaveLength(3);
        expect(posted[2].insets).toEqual({
            top: 58,
            right: 0,
            bottom: 0,
            left: 0,
        });
        fromGame("ace:ready");
        expect(posted[3]).toEqual(posted[2]);
        // The window shrinks to a phone.
        place(frame, 0, 0, 390, 844);
        window.dispatchEvent(new Event("resize"));
        await flush();
        expect(posted[4]).toMatchObject({ width: 390, height: 844 });
        controlsElement.remove();
        await flush();
        expect(posted[5].insets.top).toBe(0);
    });

    test("with the page's link, it posts and reads through the page's own way to the game", async () => {
        const sent: Array<[string, any]> = [];
        stop = bridgeGameSafeArea(frame, "ace", {
            post: (kind, data) => void sent.push([kind, data]),
            // As GamePage reads a message: either form, by kind.
            kindOf: (data: any) =>
                /^(oncyber:game|ace):/.test(data?.type ?? "")
                    ? data.type.split(":").pop()
                    : null,
        });
        await flush();
        expect(sent).toEqual([
            [
                "safe-area",
                {
                    insets: { top: 0, right: 0, bottom: 0, left: 0 },
                    width: 1280,
                    height: 720,
                },
            ],
        ]);
        fromGame("oncyber:game:hello");
        fromGame("oncyber:game:ready");
        fromGame("garden:hello");
        expect(sent).toHaveLength(3);
        // Nothing went to the frame behind the page's back.
        expect(posted).toEqual([]);
    });

    test("stops when disposed", async () => {
        stop = bridgeGameSafeArea(frame, "ace");
        await flush();
        stop();
        addOverlay("controls", 20, 14, 250, 44);
        fromGame("ace:hello");
        await flush();
        expect(posted).toHaveLength(1);
    });

    test("a missing frame is a no-op", () => {
        expect(() => bridgeGameSafeArea(null, "ace")()).not.toThrow();
    });
});
