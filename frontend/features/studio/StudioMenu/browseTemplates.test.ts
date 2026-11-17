import { shouldBrowseTemplates } from "./browseTemplates";

const placeholder = { mock: true, info: { room: "@@empty" } };

it("sends someone with no world to browse templates", () => {
    expect(shouldBrowseTemplates(placeholder, undefined)).toBe(true);
});

it("keeps someone who chose the blank canvas in the studio", () => {
    expect(shouldBrowseTemplates(placeholder, "@@empty")).toBe(false);
});

it("keeps someone with a saved world in the studio", () => {
    expect(
        shouldBrowseTemplates({ info: { room: "@@empty" } }, undefined)
    ).toBe(false);
    expect(
        shouldBrowseTemplates({ mock: true, info: { room: "loft" } }, undefined)
    ).toBe(false);
    expect(shouldBrowseTemplates(null, undefined)).toBe(false);
});
