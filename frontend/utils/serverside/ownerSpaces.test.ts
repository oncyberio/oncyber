/** @jest-environment node */
jest.mock("@utils/firebaseAdmin", () => ({ db: {} }));

import {
    hasGallery,
    ownerSpaceLinks,
    profileSpaceLinks,
    spaceLinks,
} from "./ownerSpaces";

const doc = (id: string, data: any) => ({ id, data });

describe("spaceLinks", () => {
    it("lists public, named spaces, most visited first", () => {
        expect(
            spaceLinks([
                doc("a", {
                    info: { headline: "6529 Photo A", customLink: "6529photo" },
                    number_of_visits: 30752,
                }),
                doc("b", {
                    info: { headline: " 6529 Museum\nDistrict " },
                    number_of_visits: 140774,
                }),
                doc("c", { info: { customLink: "untitled" } }),
                doc("d", { deleted: true, info: { headline: "Gone" } }),
                doc("e", { info: { headline: "Hidden", private: true } }),
                doc("f", {
                    info: { headline: "Studio", customLink: "studio" },
                }),
            ])
        ).toEqual([
            { id: "b", name: "6529 Museum District", path: "/spaces/b" },
            { id: "a", name: "6529 Photo A", path: "/6529photo" },
            // A link the site's own pages answer never opens the space.
            { id: "f", name: "Studio", path: "/spaces/f" },
        ]);
    });

    it("never builds a link that leaves the site", () => {
        expect(
            spaceLinks([
                doc("a", {
                    info: { headline: "Slashes", customLink: "//evil.example" },
                }),
                doc("b", {
                    info: {
                        headline: "Backslash",
                        customLink: "\\evil.example",
                    },
                }),
                doc("c", {
                    info: { headline: "Spaces", customLink: "my space" },
                }),
            ]).map((link) => link.path)
        ).toEqual(["/evil.example", "/evil.example", "/my%20space"]);
    });

    it("keeps to the limit", () => {
        const many = Array.from({ length: 40 }, (_, i) =>
            doc(`s${i}`, { info: { headline: `Space ${i}` } })
        );
        expect(spaceLinks(many, 5)).toHaveLength(5);
        expect(spaceLinks(many)).toHaveLength(12);
    });
});

describe("ownerSpaceLinks", () => {
    const store = (docs: any[]) => {
        const query: any = {
            where: jest.fn(() => query),
            select: jest.fn(() => query),
            limit: jest.fn(() => query),
            get: jest.fn(async () => ({
                docs: docs.map(({ id, data }) => ({ id, data: () => data })),
            })),
        };
        return { collection: jest.fn(() => query), query } as any;
    };

    it("lists the owner's other public spaces, never the space itself", async () => {
        const db = store([
            doc("self", {
                info: { headline: "This one" },
                number_of_visits: 9,
            }),
            doc("a", { info: { headline: "Other", customLink: "other" } }),
            doc("b", { deleted: true, info: { headline: "Gone" } }),
        ]);
        expect(await ownerSpaceLinks("0xowner", "self", db)).toEqual([
            { id: "a", name: "Other", path: "/other" },
        ]);
        expect(db.query.where).toHaveBeenCalledWith("owner", "==", "0xowner");
        expect(db.query.limit).toHaveBeenCalledWith(13);
    });

    it("leaves out a space whose gallery is gone: its page answers 404", async () => {
        const db = store([
            doc("a", {
                info: { headline: "Museum", customLink: "museum", room: "ok" },
            }),
            doc("b", {
                info: {
                    headline: "tropix",
                    customLink: "tropix",
                    room: "gone",
                },
            }),
            // A private space is never looked up.
            doc("c", {
                info: { headline: "Hidden", room: "gone", private: true },
            }),
        ]);
        const exists = jest.fn(async (data) => data.info.room !== "gone");
        expect(
            await ownerSpaceLinks("0xowner", "self", db, { exists })
        ).toEqual([{ id: "a", name: "Museum", path: "/museum" }]);
        expect(exists).toHaveBeenCalledTimes(2);
        expect(db.query.select).toHaveBeenCalledWith(
            expect.stringContaining("info.headline"),
            "info.customLink",
            "info.room",
            "runtime",
            "number_of_visits",
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
    });

    it("lists nothing without an owner or when the read fails", async () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => {});
        expect(await ownerSpaceLinks("", "self", store([]))).toEqual([]);
        expect(
            await ownerSpaceLinks("0xowner", "self", {
                collection: () => {
                    throw new Error("down");
                },
            } as any)
        ).toEqual([]);
        error.mockRestore();
    });
});

describe("profileSpaceLinks", () => {
    it("reads a person's spaces once, then answers from memory for a while", async () => {
        const calls = { count: 0 };
        const query: any = {
            where: jest.fn(() => query),
            select: jest.fn(() => query),
            limit: jest.fn(() => query),
            get: jest.fn(async () => {
                calls.count++;
                return {
                    docs: [doc("a", { info: { headline: "One" } })].map(
                        ({ id, data }) => ({ id, data: () => data })
                    ),
                };
            }),
        };
        const db = { collection: jest.fn(() => query) } as any;
        expect(await profileSpaceLinks("0xprofile", db, 1000)).toEqual([
            { id: "a", name: "One", path: "/spaces/a" },
        ]);
        expect(query.limit).toHaveBeenCalledWith(30);
        await profileSpaceLinks("0xprofile", db, 1000 + 9 * 60 * 1000);
        expect(calls.count).toBe(1);
        await profileSpaceLinks("0xprofile", db, 1000 + 11 * 60 * 1000);
        expect(calls.count).toBe(2);
        expect(await profileSpaceLinks("", db)).toEqual([]);
    });

    it("does not remember a failed read", async () => {
        let fail = true;
        const query: any = {
            where: jest.fn(() => query),
            select: jest.fn(() => query),
            limit: jest.fn(() => query),
            get: jest.fn(async () => {
                if (fail) throw new Error("firestore unavailable");
                return {
                    docs: [
                        {
                            id: "a",
                            data: () => ({ info: { headline: "One" } }),
                        },
                    ],
                };
            }),
        };
        const db = { collection: jest.fn(() => query) } as any;
        const error = jest.spyOn(console, "error").mockImplementation(() => {});
        expect(await profileSpaceLinks("0xflaky", db, 1000)).toEqual([]);
        fail = false;
        // A moment later, inside the ten minutes, the spaces are read again.
        expect(await profileSpaceLinks("0xflaky", db, 2000)).toEqual([
            { id: "a", name: "One", path: "/spaces/a" },
        ]);
        error.mockRestore();
    });
});

describe("hasGallery", () => {
    it("asks only for native spaces that name a gallery, and keeps a space when the lookup cannot be made", async () => {
        // The mocked database cannot answer: nothing is hidden on a failure.
        expect(await hasGallery({ info: { room: "white-cube_v2" } })).toBe(
            true
        );
        // Another runtime has no gallery to look for.
        expect(
            await hasGallery({ runtime: { kind: "web" }, info: { room: "x" } })
        ).toBe(true);
        expect(await hasGallery({ info: {} })).toBe(true);
    });
});
