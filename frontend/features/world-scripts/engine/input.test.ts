/** @jest-environment jsdom */
import { BoxGeometry, Group, Mesh, Object3D, PerspectiveCamera } from "three";

jest.mock("./facade", () => ({
    currentCamera: jest.fn(),
    worldCanvas: jest.fn(),
    liveArtworks: jest.fn(() => []),
    artworkId: (artwork: any) => String(artwork?.data?.id ?? ""),
}));

import { currentCamera, liveArtworks, worldCanvas } from "./facade";
import { createInput } from "./input";

/** A canvas 200 by 100 at the page's corner, and a camera at +z looking in. */
function world() {
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 200, height: 100 } as DOMRect);
    (worldCanvas as jest.Mock).mockReturnValue(canvas);
    const camera = new PerspectiveCamera(60, 2, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.updateMatrixWorld(true);
    (currentCamera as jest.Mock).mockReturnValue(camera);
    const group = new Group();
    const things = new Map<Object3D, string>();
    const thing = (id: string, x: number) => {
        const mesh = new Mesh(new BoxGeometry(1, 1, 1));
        mesh.position.x = x;
        group.add(mesh);
        things.set(mesh, id);
        return mesh;
    };
    thing("coin", 0);
    group.updateMatrixWorld(true);
    const keys: string[] = [];
    const clicks: any[] = [];
    const input = createInput({ group, thingOf: (node) => things.get(node) });
    input.bind({
        key: (down, key, code) =>
            keys.push(`${down ? "down" : "up"} ${key} ${code}`),
        click: (hit) => clicks.push(hit),
    });
    const press = (type: string, x: number, y: number) =>
        canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y }));
    const click = (x: number, y: number) => {
        press("pointerdown", x, y);
        press("pointerup", x, y);
    };
    return { canvas, group, input, keys, clicks, press, click, thing };
}

const key = (
    type: string,
    init: KeyboardEventInit,
    target: EventTarget = window
) => target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, ...init }));

let open: ReturnType<typeof world> | null = null;
const make = () => (open = world());
afterEach(() => {
    open?.input.dispose();
    open = null;
    document.body.innerHTML = "";
});

describe("keys, for the script", () => {
    test("a key going down and up is told once each; held, it does not repeat", () => {
        const { keys } = make();
        key("keydown", { key: "e", code: "KeyE" });
        key("keydown", { key: "e", code: "KeyE", repeat: true });
        key("keyup", { key: "e", code: "KeyE" });
        expect(keys).toEqual(["down e KeyE", "up e KeyE"]);
    });

    test("what is typed into a field is not the script's", () => {
        const { keys } = make();
        const field = document.createElement("textarea");
        document.body.appendChild(field);
        key("keydown", { key: "e", code: "KeyE" }, field);
        key("keyup", { key: "e", code: "KeyE" }, field);
        expect(keys).toEqual([]);
    });

    test("after dispose nothing is heard", () => {
        const { keys, clicks, input, click } = make();
        input.dispose();
        key("keydown", { key: "e", code: "KeyE" });
        click(100, 50);
        expect(keys).toEqual([]);
        expect(clicks).toEqual([]);
    });
});

describe("clicks, for the script", () => {
    test("a click on a thing says which, and where it was hit", () => {
        const { clicks, click } = make();
        click(100, 50);
        expect(clicks).toHaveLength(1);
        expect(clicks[0].thing).toBe("coin");
        // The near face of a one-metre box at the origin.
        expect(clicks[0].point[2]).toBeCloseTo(0.5);
    });

    test("a click on nothing, or a press dragged away, is no click", () => {
        const { clicks, click, press } = make();
        click(5, 5);
        press("pointerdown", 100, 50);
        press("pointerup", 120, 50);
        // Released without having been pressed here.
        press("pointerup", 100, 50);
        expect(clicks).toEqual([]);
    });

    test("a part of a thing is the thing; an artwork is told by its id", () => {
        const { clicks, click, group } = make();
        group.clear();
        const artwork: any = new Group();
        artwork.data = { id: "art-1" };
        artwork.add(new Mesh(new BoxGeometry(1, 1, 1)));
        artwork.updateMatrixWorld(true);
        (liveArtworks as jest.Mock).mockReturnValue([artwork]);
        click(100, 50);
        expect(clicks[0]).toMatchObject({ artwork: "art-1" });
        expect(clicks[0].thing).toBeUndefined();
    });

    test("with the pointer locked, what is clicked is what is looked at", () => {
        const { clicks, press, canvas } = make();
        Object.defineProperty(document, "pointerLockElement", {
            value: canvas,
            configurable: true,
        });
        try {
            // Wherever the press is said to be.
            press("pointerdown", 3, 3);
            press("pointerup", 3, 3);
            expect(clicks[0]?.thing).toBe("coin");
        } finally {
            Object.defineProperty(document, "pointerLockElement", {
                value: null,
                configurable: true,
            });
        }
    });

    test("with no camera yet there is nothing to click through", () => {
        const { clicks, click } = make();
        (currentCamera as jest.Mock).mockReturnValue(null);
        click(100, 50);
        expect(clicks).toEqual([]);
    });
});
