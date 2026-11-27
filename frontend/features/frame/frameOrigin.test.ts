/** @jest-environment node */
import { OPAQUE_FRAME_ORIGIN, frameTarget, fromFrame } from "./frameOrigin";

const world = {};
const frame = { contentWindow: world } as unknown as HTMLIFrameElement;
const event = (origin: string, source: unknown = world) =>
    ({ origin, source } as MessageEvent);

describe("fromFrame", () => {
    test("a game: its own window, and no origin of its own", () => {
        expect(fromFrame(event("null"), frame)).toBe(true);
        expect(OPAQUE_FRAME_ORIGIN).toBe("null");
    });

    test("a world: its own window and exactly the origin it is served from", () => {
        const origin = "https://worlds.example";
        expect(fromFrame(event(origin), frame, origin)).toBe(true);
        expect(
            fromFrame(event("https://elsewhere.example"), frame, origin)
        ).toBe(false);
        // a world is never taken for a sandboxed game, nor a game for a world
        expect(fromFrame(event("null"), frame, origin)).toBe(false);
        expect(fromFrame(event(origin), frame)).toBe(false);
    });

    test("another window with the right origin is not the frame", () => {
        expect(fromFrame(event("null", {}), frame)).toBe(false);
        expect(fromFrame(event("null", null), frame)).toBe(false);
    });

    test("no frame, or one with no document yet, is nobody", () => {
        expect(fromFrame(event("null"), null)).toBe(false);
        expect(
            fromFrame(event("null", undefined), {
                contentWindow: undefined,
            } as unknown as HTMLIFrameElement)
        ).toBe(false);
    });
});

test("an opaque frame cannot be named; a real origin always is", () => {
    expect(frameTarget()).toBe("*");
    expect(frameTarget("https://worlds.example")).toBe(
        "https://worlds.example"
    );
});
