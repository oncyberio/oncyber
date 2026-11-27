import { createStallWatch } from "./frameStall";

function watch() {
    let clock = 0;
    const stall = createStallWatch({ now: () => clock, stalledAfter: 8000 });
    return { stall, pass: (ms: number) => void (clock += ms) };
}

test("a frame that has not drawn yet is not stalled, however long it takes", () => {
    const { stall, pass } = watch();
    pass(120_000);
    expect(stall.stalled()).toBe(false);
});

test("a frame that keeps beating is fine; one that goes silent has stopped", () => {
    const { stall, pass } = watch();
    for (let i = 0; i < 30; i++) {
        stall.beat();
        pass(1000);
        expect(stall.stalled()).toBe(false);
    }
    pass(8000);
    expect(stall.stalled()).toBe(true);
    // and it is fine again when it comes back
    stall.beat();
    expect(stall.stalled()).toBe(false);
});

test("silence while the tab is hidden is the browser's, not the frame's", () => {
    const { stall, pass } = watch();
    stall.beat();
    stall.setHidden(true);
    pass(600_000);
    expect(stall.stalled()).toBe(false);
    // back in view: the frame gets the full wait again
    stall.setHidden(false);
    pass(7000);
    expect(stall.stalled()).toBe(false);
    pass(2000);
    expect(stall.stalled()).toBe(true);
});
