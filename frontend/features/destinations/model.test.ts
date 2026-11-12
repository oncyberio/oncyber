import type { Destination } from "@uitypes/destinations";
import {
    destinationCard,
    destinationStatus,
    filterDestinations,
} from "./model";
import { CYBER_WAREHOUSE_COVER } from "@utils/destinationCover";
import { getStatus } from "@utils/destinations";
const room = (values: Partial<Destination>): Destination =>
    ({
        _id: "destination-1",
        slug: "gallery-one",
        name: "Gallery One",
        status: "tested",
        params: {},
        ...values,
    } as Destination);

it("uses the original destination image and preserves management metadata", () => {
    const card = destinationCard(
        room({
            image: "/original.jpg",
            thumbnail: "/small.jpg",
            status: "active",
            contractName: "factory-polygon",
            distributionType: "create_claim_page",
        })
    );
    expect(card.imageUrls).toEqual(["/original.jpg", "/small.jpg"]);
    expect(card.destinationStatus).toBe("Published");
    expect(card.href).toBe("/destinations/gallery-one");
    expect(card.collections).toEqual(["Community Polygon"]);
    expect(card.buildStatus).toBe("Create claim page");
});
it("keeps missing covers eligible for the grid fallback and uses the shared warehouse cover", () => {
    expect(destinationCard(room({})).imageUrls).toEqual([]);
    expect(
        destinationCard(room({ slug: "cyberwarehouse", image: "/old.jpg" }))
            .imageUrls[0]
    ).toBe(CYBER_WAREHOUSE_COVER);
});
it.each([
    ["tested", "Testing"],
    ["submitted", "Under review"],
    ["verified", "Ready for minting"],
    ["active", "Published"],
    ["failed", "Failed"],
    ["rejected", "Rejected"],
    ["uploaded", "Uploaded"],
])("labels %s destinations as %s", (status, label) => {
    expect(destinationStatus(room({ status }))).toBe(label);
});
it("labels unpublished Kitbash uploads without implying a review is required", () => {
    expect(destinationStatus(room({ params: { isFuture: true } }))).toBe(
        "Uploaded"
    );
});
it.each([
    ["tested"],
    ["submitted"],
    ["verified"],
    ["active"],
    ["failed"],
    ["rejected"],
    ["uploaded"],
    [undefined],
])("names %p destinations the same in the create flow", (status) => {
    expect(getStatus(status)).toBe(destinationStatus(room({ status })));
});
it("combines legacy filters across groups and permits multiple statuses", () => {
    const rooms = [
        room({
            slug: "one",
            status: "tested",
            contractName: "factory-polygon",
            distributionType: "self_claim_tokens",
        }),
        room({
            slug: "two",
            status: "submitted",
            contractName: "factory-polygon",
            distributionType: "self_claim_tokens",
        }),
        room({
            slug: "three",
            status: "active",
            contractName: "factory-polygon",
            distributionType: "self_claim_tokens",
        }),
        room({
            slug: "four",
            status: "tested",
            contractName: "oncyber-ethereum-community",
            distributionType: "self_claim_tokens",
        }),
    ];
    expect(
        filterDestinations(
            rooms,
            {
                status: ["tested", "submitted"],
                contractName: ["factory-polygon"],
                distributionType: ["self_claim_tokens"],
            },
            ""
        ).map((item) => item.slug)
    ).toEqual(["one", "two"]);
});
it("groups pending uploads separately from published destinations", () => {
    const rooms = [
        room({ status: "tested" }),
        room({ status: "verified" }),
        room({ status: "active" }),
    ];
    expect(filterDestinations(rooms, { status: ["uploaded"] }, "")).toEqual(
        rooms.slice(0, 2)
    );
    expect(
        filterDestinations(rooms, { status: ["uploaded", "active"] }, "")
    ).toEqual(rooms);
});
it("searches names, descriptions, and displayed metadata while respecting status filters", () => {
    const rooms = [
        room({
            name: "Rayan's Gallery",
            status: "active",
            contractName: "factory-polygon",
        }),
        room({
            name: "Rayan's Gallery",
            status: "tested",
            contractName: "factory-polygon",
        }),
    ];
    expect(
        filterDestinations(rooms, { status: ["active"] }, "  RAYAN polygon  ")
    ).toEqual([rooms[0]]);
    expect(filterDestinations(rooms, {}, "missing")).toEqual([]);
});
