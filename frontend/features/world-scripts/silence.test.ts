import { watchSilence } from "./silence";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("a limit on silence", () => {
    test("something that keeps answering is never called silent, however long it takes", () => {
        const silent = jest.fn();
        const watch = watchSilence(4000, silent);
        // A world drawing less than a frame a second: 30 answers in 45 s.
        for (let frame = 0; frame < 30; frame++) {
            jest.advanceTimersByTime(1500);
            watch.heard();
        }
        expect(silent).not.toHaveBeenCalled();
    });

    test("something that goes quiet while it owes an answer is called silent, once", () => {
        const silent = jest.fn();
        const watch = watchSilence(4000, silent);
        watch.heard();
        jest.advanceTimersByTime(3999);
        expect(silent).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        expect(silent).toHaveBeenCalledTimes(1);
        watch.heard();
        jest.advanceTimersByTime(20_000);
        expect(silent).toHaveBeenCalledTimes(1);
    });

    test("silence while nothing is owed is waited out: a tab in the background draws no frames", () => {
        const silent = jest.fn();
        let owed = false;
        watchSilence(4000, silent, () => owed);
        jest.advanceTimersByTime(60_000);
        expect(silent).not.toHaveBeenCalled();
        // The tab comes back, a frame is drawn and the script is asked.
        owed = true;
        jest.advanceTimersByTime(4000);
        expect(silent).toHaveBeenCalledTimes(1);
    });

    test("stopped, it says nothing", () => {
        const silent = jest.fn();
        watchSilence(4000, silent).stop();
        jest.advanceTimersByTime(10_000);
        expect(silent).not.toHaveBeenCalled();
    });
});
