/** @jest-environment jsdom */
import * as THREE from "three";
import { rememberFlashPreview, takeFlashPreview } from "./flashPreview";
import { loadFlashTexture } from "./flashPresentation";

afterEach(() => jest.restoreAllMocks());

test("reuses a decoded preview with bounded dimensions and consumes it once", async () => {
    const context = { drawImage: jest.fn(), getImageData: jest.fn() };
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as any);
    const image = { complete: true, naturalWidth: 4000, naturalHeight: 2000 } as HTMLImageElement;
    rememberFlashPreview("/selected", image);
    const result = await loadFlashTexture(THREE, "/selected", new AbortController().signal);
    expect(result.texture.image.width).toBe(1024);
    expect(result.texture.image.height).toBe(512);
    expect(result.aspect).toBe(2);
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    expect(takeFlashPreview("/selected")).toBeUndefined();
    result.texture.dispose();
});

test("failed or incomplete previews do not keep stale selection data", () => {
    const context = { drawImage: jest.fn(), getImageData: jest.fn() };
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as any);
    const image = { complete: true, naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;
    rememberFlashPreview("/old", image);
    context.getImageData.mockImplementation(() => { throw new Error("tainted"); });
    rememberFlashPreview("/new", image);
    expect(takeFlashPreview("/old")).toBeUndefined();
    expect(takeFlashPreview("/new")).toBeUndefined();
});
