jest.mock(
    "@3emitter",
    () => ({ __esModule: true, default: { on: jest.fn(), off: jest.fn() } }),
    { virtual: true }
);
jest.mock(
    "@3events",
    () => ({ __esModule: true, default: { PRE_UPDATE: "pre" } }),
    { virtual: true }
);
jest.mock("../../loader/material", () => {
    // The loader material is a node material that keeps the WebGL
    // `uniforms` API; only that API matters here.
    const { Material, Texture, Vector4 } = require("three");
    const atlas = new Texture();
    return {
        __esModule: true,
        default: class extends Material {
            constructor() {
                super();
                this.uniforms = {
                    tInput: { value: atlas },
                    uvs: { value: new Vector4() },
                };
            }
        },
    };
});
import Emitter from "@3emitter";
import { LoadingMaterial } from "./loadingmaterial";
import { ImageMaterial } from "./imagematerial";

beforeEach(() => jest.clearAllMocks());

test("the resident Oncyber atlas starts with a visible frame and survives individual artwork disposal", () => {
    const material = new LoadingMaterial({ dimensions: [600, 900] }, {});
    expect(material.dimensions).toEqual({ width: 600, height: 900 });
    expect(material.uniforms.uvs.value.z).toBeGreaterThan(0);
    expect(material.uniforms.uvs.value.w).toBeGreaterThan(0);
    expect(material.uniforms.tInput.value.userData.isShared).toBe(true);
    material.active = true;
    material.active = true;
    expect(Emitter.on).toHaveBeenCalledTimes(1);
    material.dispose();
    expect(Emitter.off).toHaveBeenCalledWith("pre", material.updateFrame);
});

test("invalid video dimensions fall back to valid image dimensions or a safe video ratio", () => {
    const material = new LoadingMaterial(
        { videoDimensions: [0, NaN], dimensions: [300, 400] },
        {}
    );
    expect(material.dimensions).toEqual({ width: 300, height: 400 });
    material.dispose();
    const fallback = new LoadingMaterial({ dimensions: [-1, 0] }, {});
    expect(fallback.dimensions).toEqual({ width: 960, height: 540 });
    fallback.dispose();
});

test("ImageBitmap previews use width/height instead of HTMLImageElement-only dimensions", () => {
    const material = new ImageMaterial({
        image: { width: 256, height: 384 },
        materialParams: {},
    });
    expect(material.dimensions).toEqual({ width: 256, height: 384 });
    material.map.dispose();
    material.dispose();
});
