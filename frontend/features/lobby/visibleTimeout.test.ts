/** @jest-environment jsdom */
import { startVisibleTimeout } from "./visibleTimeout";

let hidden = false;
beforeEach(() => {
    jest.useFakeTimers();
    hidden = false;
    Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => hidden,
    });
});
afterEach(() => jest.useRealTimers());
const setHidden = (value: boolean) => {
    hidden = value;
    document.dispatchEvent(new Event("visibilitychange"));
};

test("counts visible time only", () => {
    const run = jest.fn();
    startVisibleTimeout(run, 1000);
    jest.advanceTimersByTime(600);
    setHidden(true);
    jest.advanceTimersByTime(60_000);
    expect(run).not.toHaveBeenCalled();
    setHidden(false);
    jest.advanceTimersByTime(399);
    expect(run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    setHidden(true);
    setHidden(false);
    jest.advanceTimersByTime(5000);
    expect(run).toHaveBeenCalledTimes(1);
});

test("a timeout started in a hidden page waits for it to become visible", () => {
    hidden = true;
    const run = jest.fn();
    startVisibleTimeout(run, 100);
    jest.advanceTimersByTime(10_000);
    expect(run).not.toHaveBeenCalled();
    setHidden(false);
    jest.advanceTimersByTime(100);
    expect(run).toHaveBeenCalledTimes(1);
});

test("cancelling stops it, visible or hidden", () => {
    const run = jest.fn();
    const cancel = startVisibleTimeout(run, 100);
    setHidden(true);
    cancel();
    setHidden(false);
    jest.advanceTimersByTime(1000);
    expect(run).not.toHaveBeenCalled();
});
