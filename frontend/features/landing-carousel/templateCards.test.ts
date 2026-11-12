import {
    createTemplateCards,
    templateCover,
    CYBER_WAREHOUSE_COVER,
} from "./templateCards";
import type { Destination } from "@uitypes/destinations";
const room = (slug: string, tag: string[] = []): Destination =>
    ({
        slug,
        name: slug,
        tag,
        image: `/${slug}.jpg`,
        thumbnail: `/${slug}-small.jpg`,
    } as Destination);
const warehouse = room("cyberwarehouse", ["free"]);
const owned = room("mine");
const uploaded = room("upload", ["uploaded"]);
const paid = room("space-pod");
const groups = {
    owned: [warehouse, owned],
    uploaded: [uploaded],
    purchase: [paid],
};
it("puts usable gallery rooms and a blank canvas before the uncollected continuation", () => {
    const cards = createTemplateCards(groups, { mine: true }, "", "all");
    expect(cards.map((card) => card.id)).toEqual([
        "template-cyberwarehouse",
        "template-mine",
        "template-upload",
        "template-blank",
        "template-space-pod",
    ]);
    expect(cards.map((card) => card.templateStatus)).toEqual([
        "free",
        "owned",
        "owned",
        "free",
        "uncollected",
    ]);
    expect(cards[cards.length - 1].actionLabel).toBe("View space-pod details");
});
it("uses the captured Warehouse image in both its card and details, without the stale placeholder fallback", () => {
    const card = createTemplateCards(
        groups,
        { mine: true },
        "cyberwarehouse",
        "all"
    )[0];
    expect(card.imageUrls).toEqual([CYBER_WAREHOUSE_COVER]);
    expect(templateCover(warehouse)).toBe(CYBER_WAREHOUSE_COVER);
    expect(templateCover(paid)).toBe(paid.image);
});
it("updates ownership labels and actions after wallet verification without losing templates", () => {
    const before = createTemplateCards(
        groups,
        { mine: true },
        "mine",
        "all",
        true
    )[0];
    expect(before.templateStatus).toBe("checking");
    expect(before.actionLabel).toBe("View mine details");
    const after = createTemplateCards(
        groups,
        { mine: true },
        "mine",
        "all",
        false
    )[0];
    expect(after.id).toBe(before.id);
    expect(after.templateStatus).toBe("owned");
    expect(after.actionLabel).toBe("Use mine template");
});
it("keeps only gallery destinations and the blank gallery in the free category", () => {
    const cards = createTemplateCards(groups, {}, "", "free");
    expect(cards.map((card) => card.id)).toEqual([
        "template-cyberwarehouse",
        "template-blank",
    ]);
    expect(cards.map((card) => card.href)).toEqual([
        "/studio?templateId=cyberwarehouse",
        "/studio?templateId=%40%40empty",
    ]);
});
it.each(["gaussian", "scan", "game", "video"])(
    "does not expose a %s creation starter through catalog search",
    (query) => {
        expect(createTemplateCards(groups, {}, query, "all")).toEqual([]);
    }
);
it("keeps every displayed gallery action in the normal Studio template flow", () => {
    const cards = createTemplateCards(groups, { mine: true }, "", "all");
    expect(
        cards.every((card) => card.href.startsWith("/studio?templateId="))
    ).toBe(true);
    expect(cards.find((card) => card.id === "template-blank").room).toBe(
        "@@empty"
    );
});

it("uses restored room artwork consistently in template cards and details", () => {
    const rooms = [
        "white-cube",
        "wolfgang-n2",
        "wolfgang-n2-dark",
        "loft",
        "classic",
    ].map((slug) => room(slug, ["free"]));
    const cards = createTemplateCards(
        { owned: rooms, uploaded: [], purchase: [] },
        {},
        "",
        "all"
    );
    for (const destination of rooms) {
        const card = cards.find((item) => item.room === destination.slug);
        expect(card.imageUrls).toEqual([templateCover(destination)]);
        expect(card.imageUrls[0]).toContain("/gallery-previews/");
    }
    const original = createTemplateCards(
        groups,
        { mine: true },
        "mine",
        "all"
    )[0];
    expect(original.imageUrls).toEqual([owned.image, owned.thumbnail]);
});
