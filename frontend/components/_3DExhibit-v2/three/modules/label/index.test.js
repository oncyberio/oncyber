/** @jest-environment jsdom */

jest.mock("./oldspacelabel", () => ({ SpaceLabel: jest.fn() }));
jest.mock("./billboardlabel", () => ({ BillboardLabel: jest.fn() }));
jest.mock("@3abstract/pipelinemesh", () => jest.fn(), { virtual: true });
jest.mock("../../abstract/pipelinesprite", () => jest.fn());

import { blankLabelTexture } from "./index";
import { LABEL_CANVAS_SIZE } from "./constants";

beforeAll(() => {
    // jsdom has no ImageData
    global.ImageData ??= class {
        constructor(width, height) {
            this.width = width;
            this.height = height;
            this.data = new Uint8ClampedArray(width * height * 4);
        }
    };
});

test("a label's first texture has an image the renderer can upload", () => {
    const texture = blankLabelTexture();

    // CanvasTexture marks itself for upload at once; with no image the
    // renderer threw mid-frame and the space went black.
    expect(texture.version).toBeGreaterThan(0);
    expect(texture.image).not.toBeNull();
});

test("it is transparent and the size of every drawn label", () => {
    const { image } = blankLabelTexture();

    // the renderer keeps a texture's first size for later uploads
    expect(image.width).toBe(LABEL_CANVAS_SIZE);
    expect(image.height).toBe(LABEL_CANVAS_SIZE);
    expect(image.data.every((value) => value === 0)).toBe(true);
});
