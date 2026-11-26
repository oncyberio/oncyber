/**
 * One side's hold on the other across the frame: say a kind of message,
 * and hear the kinds that arrive (./worldProtocol.ts lists them). The
 * world's document is one (./worldDocument.ts); each relay is written
 * against this and nothing more, so it can be tested with two of them
 * joined directly.
 */
export interface FrameLink {
    send(kind: string, data?: object): void;
    /** Hears every kind that arrives; returns the function that stops. */
    listen(handler: (kind: string, data: any) => void): () => void;
}
