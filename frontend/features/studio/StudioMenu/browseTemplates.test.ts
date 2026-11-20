import { needsTemplateFirst } from "./browseTemplates";

const base = {
    isAnonymous: false,
    hasLocalWorld: false,
    exhibit: null,
    templateId: undefined,
};

it("sends a signed-in visitor with no world to the templates", () => {
    expect(needsTemplateFirst(base)).toBe(true);
});

it("sends a guest with no local draft to the templates", () => {
    expect(needsTemplateFirst({ ...base, isAnonymous: true })).toBe(true);
});

it("opens the studio when there is a world to edit", () => {
    expect(needsTemplateFirst({ ...base, exhibit: { id: "x" } })).toBe(false);
    expect(
        needsTemplateFirst({ ...base, isAnonymous: true, hasLocalWorld: true })
    ).toBe(false);
});

it("opens the studio when a template was chosen, blank canvas included", () => {
    expect(needsTemplateFirst({ ...base, templateId: "@@empty" })).toBe(false);
    expect(
        needsTemplateFirst({ ...base, isAnonymous: true, templateId: "loft" })
    ).toBe(false);
});
