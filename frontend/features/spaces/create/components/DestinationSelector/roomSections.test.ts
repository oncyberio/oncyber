import {
    roomSections,
    canUseTemplate,
    withDefaultTemplateTags,
} from "./roomSections";
const room = (slug, tag, extras = {}) => ({ slug, tag, ...extras } as any);
it("shares free, owned and uploaded eligibility without unlocking paid templates", () => {
    const free = room("free-room", ["free"]);
    const owned = room("owned-room", ["factory"], { contractName: "factory" });
    const paid = room("paid-room", ["factory"], { contractName: "factory" });
    const uploaded = room("my-room", ["uploaded"]);
    const kit = room("galaxy-kit", ["free"]);
    const groups = roomSections(
        [free, owned, paid, uploaded, kit],
        { "owned-room": true },
        "template"
    );
    expect(groups.owned).toEqual([owned, free]);
    expect(groups.uploaded).toEqual([uploaded]);
    expect(groups.purchase).toEqual([paid]);
    expect(roomSections([owned, paid], {}, "template").owned).toEqual([]);
});
it("updates the available list when ownership is revoked", () => {
    const paid = room("paid-room", ["factory"], { contractName: "factory" });
    expect(
        roomSections([paid], { "paid-room": true }, "template").owned
    ).toEqual([paid]);
    expect(roomSections([paid], {}, "template").purchase).toEqual([paid]);
});

it("unlocks collected rooms only after a completed ownership check", () => {
    const paid = room("new-collection", [], {
        contractName: "future-collection",
    });
    expect(roomSections([paid], {}, "template").purchase).toEqual([paid]);
    expect(canUseTemplate(paid, {})).toBe(false);
    expect(canUseTemplate(paid, { "new-collection": true }, true)).toBe(false);
    expect(canUseTemplate(paid, { "new-collection": true })).toBe(true);
    expect(canUseTemplate(paid, {})).toBe(false);
    expect(canUseTemplate(room("free", ["free"]), {}, true)).toBe(true);
    expect(canUseTemplate(room("uploaded", ["uploaded"]), {}, true)).toBe(true);
});

it("offers the Brand destination as a default free template without changing other rooms", () => {
    const source = room("cyberwarehouse", []);
    const warehouse = withDefaultTemplateTags(source);
    expect(source.tag).toEqual([]);
    expect(warehouse.tag).toEqual(["free"]);
    expect(canUseTemplate(warehouse, {}, true)).toBe(true);
    expect(roomSections([warehouse], {}, "template").owned).toEqual([
        warehouse,
    ]);
    expect(withDefaultTemplateTags(warehouse)).toBe(warehouse);
    const paid = room("other", ["factory"]);
    expect(withDefaultTemplateTags(paid)).toBe(paid);
    expect(canUseTemplate(paid, {})).toBe(false);
});
