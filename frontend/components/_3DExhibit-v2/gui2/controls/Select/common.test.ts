import { isSelectedOption } from "./common";

it("selects only the active Background mode", () => {
    expect(
        ["Color", "Texture"].map((item) => isSelectedOption(item, "Color"))
    ).toEqual([true, false]);
    expect(
        ["Color", "Texture"].map((item) => isSelectedOption(item, "Texture"))
    ).toEqual([false, true]);
});
it("does not equate absent IDs or a cleared selection", () => {
    expect(isSelectedOption("Color", null)).toBe(false);
    expect(isSelectedOption({ label: "A" }, { label: "B" })).toBe(false);
    expect(isSelectedOption({ id: null }, { id: null })).toBe(false);
});
it("supports object choices with stable IDs including zero", () => {
    expect(isSelectedOption({ id: 0 }, { id: 0 })).toBe(true);
    expect(isSelectedOption({ id: "a" }, { id: "b" })).toBe(false);
    const option = { label: "A" };
    expect(isSelectedOption(option, option)).toBe(true);
});
