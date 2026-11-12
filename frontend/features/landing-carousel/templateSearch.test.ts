import {
    matchesTemplate,
    selectTemplateRooms,
    templateSearchPatch,
} from "./templateSearch";
const free = {
    slug: "free",
    name: "White Cube",
    description: "A quiet gallery",
    author: { name: "André" },
    tag: ["free"],
};
const owned = {
    slug: "mine",
    name: "My room",
    description: "A white sculpture gallery",
    tag: [],
};
const paid = {
    slug: "spacepod",
    name: "Space Pod",
    description: "A white gallery in space",
    author: { name: "RTFKT" },
    tag: [],
    blockchain: "ethereum",
};
const groups = { owned: [owned, free], uploaded: [], purchase: [paid] };
it("keeps owned, free, and uncollected rooms in one catalog before and after searching", () => {
    expect(selectTemplateRooms(groups, "")).toEqual([owned, free, paid]);
    expect(selectTemplateRooms(groups, "white")).toEqual([owned, free, paid]);
    expect(templateSearchPatch(" white ")).toEqual({ templateSearch: "white" });
    expect(templateSearchPatch("   ")).toEqual({ templateSearch: "" });
});
it("matches names, descriptions and artists with case and accent normalization", () => {
    expect(selectTemplateRooms(groups, "ANDRE")).toEqual([free]);
    expect(selectTemplateRooms(groups, "space RTFKT")).toEqual([paid]);
    expect(selectTemplateRooms(groups, "missing")).toEqual([]);
    expect(matchesTemplate("gaussian", "Your Gaussian room")).toBe(true);
});
it("category and text search still combine without an availability gate", () => {
    expect(selectTemplateRooms(groups, "white", "free")).toEqual([free]);
    expect(selectTemplateRooms(groups, "white", "ethereum")).toEqual([paid]);
    expect(selectTemplateRooms(groups, "André", "ethereum")).toEqual([]);
});
