/** @jest-environment jsdom */
import { observeSceneSize } from "./observeSceneSize";
let container: HTMLDivElement;
let notify: () => void;
let frame: () => void;
let width: number;
let height: number;
let disconnect: jest.Mock;
beforeEach(() => {
    width = 1122;
    height = 934;
    disconnect = jest.fn();
    (global as any).ResizeObserver = class {
        constructor(callback) {
            notify = callback;
        }
        observe() {}
        disconnect = disconnect;
    };
    global.requestAnimationFrame = jest.fn((callback) => {
        frame = () => callback(0);
        return 1;
    });
    global.cancelAnimationFrame = jest.fn();
    container = document.createElement("div");
    Object.defineProperties(container, {
        clientWidth: { get: () => width },
        clientHeight: { get: () => height },
    });
    document.body.appendChild(container);
});
afterEach(() => container.remove());
test("resizes to the container after an embedded pane changes without a window resize", () => {
    const resize = jest.fn();
    const cleanup = observeSceneSize(container, resize);
    frame();
    expect(resize).toHaveBeenLastCalledWith({ w: 1122, h: 934 });
    height = 600;
    notify();
    frame();
    expect(resize).toHaveBeenLastCalledWith({ w: 1122, h: 600 });
    cleanup();
});
test("waits for final layout, skips unchanged and hidden sizes, and cleans up", () => {
    const resize = jest.fn();
    const cleanup = observeSceneSize(container, resize);
    frame();
    window.dispatchEvent(new Event("resize"));
    height = 500; // layout changes after the browser resize event
    notify();
    frame();
    expect(resize).toHaveBeenLastCalledWith({ w: 1122, h: 500 });
    notify();
    frame();
    height = 0;
    notify();
    frame();
    expect(resize).toHaveBeenCalledTimes(2);
    height = 700;
    notify();
    cleanup();
    frame();
    expect(resize).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalled();
});
