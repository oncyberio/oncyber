/** @jest-environment jsdom */
import * as THREE from "three/webgpu";
import { LOBBY_GUEST_PORTRAIT } from "../lobbyIdentity";
import { createNameTags, type NameTags } from "./nameTags";

let tags: NameTags;
let context: CanvasRenderingContext2D;
let images: HTMLImageElement[];

beforeEach(() => {
    context = {
        clearRect: jest.fn(),
        fillRect: jest.fn(),
        fillText: jest.fn(),
        measureText: jest.fn((text: string) => ({
            width: 20 * text.length,
            actualBoundingBoxAscent: 30,
            actualBoundingBoxDescent: 8,
            actualBoundingBoxLeft: 1,
            actualBoundingBoxRight: 20,
        })),
        getImageData: jest.fn(
            (_x: number, _y: number, w: number, h: number) => ({
                data: new Uint8ClampedArray(w * h * 4),
            })
        ),
        drawImage: jest.fn(),
    } as unknown as CanvasRenderingContext2D;
    // Jest infers the last (WebGPU) overload; the tags request only 2D.
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
        () => context as any
    );
    images = [];
    jest.spyOn(window, "Image").mockImplementation(() => {
        const image = document.createElement("img");
        images.push(image);
        return image;
    });
    tags = createNameTags(new THREE.Scene());
});

afterEach(() => {
    tags.dispose();
    jest.restoreAllMocks();
});

function load(image: HTMLImageElement) {
    Object.defineProperty(image, "complete", { value: true });
    Object.defineProperty(image, "naturalWidth", { value: 64 });
    image.dispatchEvent(new Event("load"));
}

test("a visitor without a photo loads and draws the guest portrait", () => {
    tags.begin();
    tags.show("guest", "Guest", "", 0, 2, 0);
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe(LOBBY_GUEST_PORTRAIT);
    expect(images[0].crossOrigin).toBe("anonymous");
    load(images[0]);
    expect(context.drawImage).toHaveBeenCalledWith(
        images[0],
        ...Array(8).fill(expect.any(Number))
    );
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 2, 5);
    camera.updateMatrixWorld();
    tags.end(camera, 800);
    expect(tags.count).toBe(1);
});

test("a failed profile photo falls back once and keeps its cached tag", () => {
    tags.begin();
    tags.show("person", "Visitor", "https://example.com/missing.png", 0, 2, 0);
    const image = images[0];
    const src = jest.spyOn(image, "src", "set");
    image.dispatchEvent(new Event("error"));
    expect(image.src).toBe(LOBBY_GUEST_PORTRAIT);
    image.dispatchEvent(new Event("error"));
    expect(src).toHaveBeenCalledTimes(1);
    load(image);
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    tags.begin();
    tags.show("person", "Visitor", "https://example.com/missing.png", 1, 2, 0);
    expect(images).toHaveLength(1);
});

test("a late portrait load cannot repaint a disposed atlas", () => {
    tags.begin();
    tags.show("guest", "Guest", "", 0, 2, 0);
    tags.dispose();
    load(images[0]);
    expect(context.drawImage).not.toHaveBeenCalled();
});
