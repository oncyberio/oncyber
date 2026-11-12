import { selectModelVariant } from "./selectModelVariant";

const files = {
    high: "high.glb",
    low: "low.glb",
    low_compressed: "low-ktx.glb",
};

test("lobby entry prefers a prepared low model without changing desktop gallery quality", () => {
    expect(selectModelVariant(files)).toBe("high.glb");
    expect(selectModelVariant(files, { preferLowResolution: true })).toBe(
        "low.glb"
    );
    expect(
        selectModelVariant(files, {
            preferLowResolution: true,
            compressedSupport: true,
        })
    ).toBe("low-ktx.glb");
});
test("editor and existing mobile behavior remain explicit", () => {
    expect(
        selectModelVariant(files, { preferLowResolution: true, fromEdit: true })
    ).toBe("high.glb");
    expect(selectModelVariant(files, { isMobile: true })).toBe("low.glb");
    expect(
        selectModelVariant(files, { isMobile: true, compressedSupport: true })
    ).toBe("low-ktx.glb");
});
test("missing variants fall back to a usable authored source without requiring transcoding", () => {
    expect(
        selectModelVariant({ high: "high.glb" }, { preferLowResolution: true })
    ).toBe("high.glb");
    expect(selectModelVariant({ low: "low.glb" })).toBe("low.glb");
    expect(selectModelVariant({ low_compressed: "ktx.glb" })).toBeUndefined();
    expect(
        selectModelVariant(
            { low: " ", high: "high.glb" },
            { preferLowResolution: true }
        )
    ).toBe("high.glb");
    expect(selectModelVariant(null)).toBeUndefined();
});
