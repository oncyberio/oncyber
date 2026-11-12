import { createColumnScroller } from "./columnScroller";
function fixture(start = 0, reduced = false, frameMs = 16) {
    let position = start,
        time = 0,
        id = 0;
    const frames = new Map<number, (time: number) => void>();
    const positions: number[] = [];
    const target = jest.fn();
    const scroller = createColumnScroller({
        read: () => position,
        write: (next) => {
            position = next;
            positions.push(next);
        },
        stride: () => 400,
        maxColumn: () => 5,
        reducedMotion: () => reduced,
        requestFrame: (callback) => {
            frames.set(++id, callback);
            return id;
        },
        cancelFrame: (key) => {
            frames.delete(key);
        },
        onTarget: target,
        now: () => time,
    });
    function advance(count = 1) {
        for (let i = 0; i < count; i++) {
            time += frameMs;
            const pending = [...frames.values()];
            frames.clear();
            pending.forEach((callback) => callback(time));
        }
    }
    function finish() {
        for (let i = 0; frames.size && i < 300; i++) advance();
        expect(frames.size).toBe(0);
    }
    return {
        scroller,
        positions,
        advance,
        finish,
        target,
        position: () => position,
        pending: () => frames.size,
    };
}

it("stops at the exact wheel offset without rounding to a card", () => {
    const f = fixture();
    f.scroller.wheel(137);
    f.scroller.endWheel();
    f.finish();
    expect(f.position()).toBe(137);
    expect(f.pending()).toBe(0);
});
it("preserves the complete trackpad tail, including subpixel input", () => {
    const f = fixture();
    [80, 40, 20, 5, 0.5].forEach((delta) => {
        f.scroller.wheel(delta);
        f.scroller.endWheel();
    });
    f.finish();
    expect(f.position()).toBe(145.5);
});
it("reverses directly without a projected landing", () => {
    const f = fixture(700);
    f.scroller.wheel(-123);
    f.scroller.wheel(11);
    expect(f.position()).toBe(588);
});
it("does not snap on pointer release", () => {
    const f = fixture();
    f.scroller.beginDrag();
    f.scroller.dragTo(237);
    f.scroller.settle();
    f.finish();
    expect(f.position()).toBe(237);
});
it("clamps input to the content bounds", () => {
    const f = fixture();
    f.scroller.wheel(-100);
    expect(f.position()).toBe(0);
    f.scroller.wheel(5000);
    expect(f.position()).toBe(2000);
});
it("keeps explicit next/previous navigation working", () => {
    const f = fixture(137);
    f.scroller.goTo(2);
    f.finish();
    expect(f.position()).toBe(800);
});
it("wheel input immediately interrupts button animation", () => {
    const f = fixture();
    f.scroller.goTo(3);
    f.advance(3);
    const previous = f.position();
    f.scroller.wheel(19);
    f.finish();
    expect(f.position()).toBe(previous + 19);
});
it("honors reduced motion and disposes pending animation", () => {
    const reduced = fixture(0, true);
    reduced.scroller.goTo(2);
    expect(reduced.position()).toBe(800);
    expect(reduced.pending()).toBe(0);
    const f = fixture();
    f.scroller.goTo(2);
    f.scroller.dispose();
    f.scroller.wheel(100);
    f.finish();
    expect(f.position()).toBe(0);
});
