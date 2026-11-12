/** @jest-environment jsdom */
import {
    holdArtworkPresentation,
    waitForArtworkPresentation,
} from "./artworkPresentation";
test("overlapping exit and arrival hold only artwork presentation and resume it once", async () => {
    const exit = holdArtworkPresentation(),
        arrival = holdArtworkPresentation();
    const attach = jest.fn();
    const pending = waitForArtworkPresentation().then(attach);
    exit();
    exit();
    await Promise.resolve();
    expect(attach).not.toHaveBeenCalled();
    arrival();
    await pending;
    expect(attach).toHaveBeenCalledTimes(1);
    await expect(waitForArtworkPresentation()).resolves.toBeUndefined();
});
test("leaving a room cancels queued artwork rather than attaching it in the new room", async () => {
    const release = holdArtworkPresentation();
    const abort = new AbortController();
    const pending = waitForArtworkPresentation(abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    release();
});
