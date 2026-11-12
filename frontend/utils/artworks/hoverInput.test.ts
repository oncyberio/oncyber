/** @jest-environment jsdom */
import { bindArtworkHover } from "./hoverInput";

test("forwards backdrop hover coordinates and removes the listener on mode changes", () => {
    const overlay = document.createElement("div");
    const canvas = document.createElement("canvas");
    const receive = jest.fn();
    canvas.addEventListener("mousemove", receive);
    const cleanup = bindArtworkHover(overlay, canvas);
    overlay.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 450, clientY: 210 })
    );
    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive.mock.calls[0][0]).toMatchObject({
        clientX: 450,
        clientY: 210,
        buttons: 0,
    });
    cleanup();
    overlay.dispatchEvent(new MouseEvent("mousemove"));
    expect(receive).toHaveBeenCalledTimes(1);
});

test("leaves embedded artwork, dragging and clicks alone", () => {
    const overlay = document.createElement("div");
    const embedded = document.createElement("button");
    overlay.appendChild(embedded);
    const canvas = document.createElement("canvas");
    const receive = jest.fn();
    canvas.addEventListener("mousemove", receive);
    canvas.addEventListener("click", receive);
    const cleanup = bindArtworkHover(overlay, canvas);
    embedded.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    overlay.dispatchEvent(new MouseEvent("mousemove", { buttons: 1 }));
    overlay.dispatchEvent(new MouseEvent("click"));
    expect(receive).not.toHaveBeenCalled();
    cleanup();
});
