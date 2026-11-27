/** @jest-environment jsdom */
import { startStarfield } from "./startStarfield";

// Under Jest there is no worker (starfieldWorkerFactory.jest.ts) and jsdom
// has no canvas to hand over: this is the page's own thread drawing.
let frames: FrameRequestCallback[] = [];
let calls: string[] = [];
beforeEach(() => {
    frames = [];
    calls = [];
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((run) => {
        frames.push(run);
        return frames.length;
    });
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
        () =>
            new Proxy(
                {},
                {
                    get: (_, name: string) => () => void calls.push(name),
                    set: () => true,
                }
            ) as any
    );
});
afterEach(() => jest.restoreAllMocks());

const canvasOf = (width: number, height: number) => {
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { get: () => width });
    Object.defineProperty(canvas, "clientHeight", { get: () => height });
    document.body.append(canvas);
    return canvas;
};

test("draws on the page when no worker can take the canvas, sized to it", async () => {
    Object.defineProperty(window, "devicePixelRatio", {
        value: 3,
        configurable: true,
    });
    const canvas = canvasOf(800, 600);
    const stars = startStarfield(canvas);
    // Two pixels to the pixel at most, however dense the screen.
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(calls).toContain("clearRect");
    expect(frames).toHaveLength(1);
    frames.shift()(16);
    expect(frames).toHaveLength(1);
    const paced = await stars.stop();
    expect(paced).toMatchObject({ thread: "page", frames: 2 });
    // Stopped: the frame that was waiting draws nothing and asks for no more.
    const drawn = calls.length;
    frames.shift()(32);
    expect(calls).toHaveLength(drawn);
    expect(frames).toHaveLength(0);
});

test("follows the window's size until it is stopped", async () => {
    let width = 800;
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { get: () => width });
    Object.defineProperty(canvas, "clientHeight", { get: () => 600 });
    Object.defineProperty(window, "devicePixelRatio", {
        value: 1,
        configurable: true,
    });
    const stars = startStarfield(canvas);
    expect(canvas.width).toBe(800);
    width = 1000;
    window.dispatchEvent(new Event("resize"));
    expect(canvas.width).toBe(1000);
    await stars.stop();
    width = 500;
    window.dispatchEvent(new Event("resize"));
    expect(canvas.width).toBe(1000);
});
