/**
 * Which document a framed game or world is, as the page checks it. Every
 * listener for messages from a frame asks this one question, so the answer
 * is the same in all of them.
 *
 * A game runs in a sandboxed frame with no origin of its own, which the
 * browser reports as "null". A native world is served from its own origin
 * (features/worlds/worldFrame.ts), and the page expects exactly that one.
 */
export const OPAQUE_FRAME_ORIGIN = "null";

/** Whether a message came from this frame's window and the origin expected there. */
export function fromFrame(
    event: Pick<MessageEvent, "source" | "origin">,
    frame: HTMLIFrameElement | null | undefined,
    origin: string = OPAQUE_FRAME_ORIGIN
): boolean {
    return (
        !!frame?.contentWindow &&
        event.source === frame.contentWindow &&
        event.origin === origin
    );
}

/**
 * Where a message to that frame is addressed. An opaque origin cannot be
 * named, so the message goes to the frame's window alone and carries only
 * public fields; a real origin is named, and nothing else can read it.
 */
export function frameTarget(origin: string = OPAQUE_FRAME_ORIGIN): string {
    return origin === OPAQUE_FRAME_ORIGIN ? "*" : origin;
}
