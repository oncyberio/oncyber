/** @jest-environment node */
import { keepFramesComing } from "./worldFrames";

/** A window whose frames come only when the test says, and whose clock it moves. */
function fakeWindow() {
    let now = 0;
    let ids = 0;
    const frames = new Map<number, (time: number) => void>();
    const timers = new Map<number, { at: number; run: () => void }>();
    const win: any = {
        document: { visibilityState: "visible" },
        performance: { now: () => now },
        requestAnimationFrame: (run: any) => (frames.set(++ids, run), ids),
        cancelAnimationFrame: (id: number) => void frames.delete(id),
        setTimeout: (run: () => void, ms: number) => (
            timers.set(++ids, { at: now + ms, run }), ids
        ),
        clearTimeout: (id: number) => void timers.delete(id),
    };
    return {
        win: win as Window,
        /** The browser draws a frame. */
        frame() {
            const due = [...frames.values()];
            frames.clear();
            due.forEach((run) => run(now));
        },
        pass(ms: number) {
            now += ms;
            for (const [id, timer] of [...timers])
                if (timer.at <= now) {
                    timers.delete(id);
                    timer.run();
                }
        },
        pending: () => frames.size + timers.size,
    };
}

test("frames the browser gives freely run as they always did, once each", () => {
    const w = fakeWindow();
    keepFramesComing(w.win);
    const ran: number[] = [];
    w.win.requestAnimationFrame((time) => void ran.push(time));
    w.pass(16);
    w.frame();
    expect(ran).toEqual([16]);
    // the promise it no longer needs is gone
    w.pass(1000);
    expect(ran).toEqual([16]);
    expect(w.pending()).toBe(0);
});

test("a frame the browser holds back still comes, about twenty times a second", () => {
    const w = fakeWindow();
    keepFramesComing(w.win);
    let count = 0;
    const loop = () => {
        count++;
        w.win.requestAnimationFrame(loop);
    };
    w.win.requestAnimationFrame(loop);
    // a second in which the browser draws nothing for this frame
    for (let i = 0; i < 100; i++) w.pass(10);
    expect(count).toBeGreaterThanOrEqual(19);
    expect(count).toBeLessThanOrEqual(21);
    // and a late frame from the browser does not run it twice
    const before = count;
    w.frame();
    expect(count).toBe(before + 1);
});

test("in a tab that is not showing, nothing is forced", () => {
    const w = fakeWindow();
    keepFramesComing(w.win);
    (w.win.document as any).visibilityState = "hidden";
    const ran: number[] = [];
    w.win.requestAnimationFrame((time) => void ran.push(time));
    w.pass(5000);
    expect(ran).toEqual([]);
    // it still runs when the browser draws again
    w.frame();
    expect(ran).toEqual([5000]);
});

test("a cancelled frame never runs, by either way", () => {
    const w = fakeWindow();
    keepFramesComing(w.win);
    const run = jest.fn();
    const id = w.win.requestAnimationFrame(run);
    w.win.cancelAnimationFrame(id);
    w.pass(1000);
    w.frame();
    expect(run).not.toHaveBeenCalled();
    expect(w.pending()).toBe(0);
});

test("undone, the window's own frames are back", () => {
    const w = fakeWindow();
    const own = w.win.requestAnimationFrame;
    const undo = keepFramesComing(w.win);
    expect(w.win.requestAnimationFrame).not.toBe(own);
    undo();
    expect(w.win.requestAnimationFrame).toBe(own);
});
