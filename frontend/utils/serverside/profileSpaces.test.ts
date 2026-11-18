/** @jest-environment node */
jest.mock("@utils/firebaseAdmin", () => ({ db: {} }));

import {
    ownerSpaceLinks,
    profileSpaceLinks,
    profileSpaces,
} from "./profileSpaces";

const doc = (id: string, data: any) => ({ id, data });

describe("profileSpaceLinks", () => {
    it("lists public, named spaces, most visited first", () => {
        expect(
            profileSpaceLinks([
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

    it("keeps to the limit", () => {
        const many = Array.from({ length: 40 }, (_, i) =>
            doc(`s${i}`, { info: { headline: `Space ${i}` } })
        );
        expect(profileSpaceLinks(many, 5)).toHaveLength(5);
    });
});

describe("profileSpaces", () => {
    const store = (docs: any[], calls = { count: 0 }) => {
        const query: any = {
            where: jest.fn(() => query),
            select: jest.fn(() => query),
            limit: jest.fn(() => query),
            get: jest.fn(async () => {
                calls.count++;
                return {
                    docs: docs.map(({ id, data }) => ({
                        id,
                        data: () => data,
                    })),
                };
            }),
        };
        return { collection: jest.fn(() => query), query, calls } as any;
    };

    it("reads the owner's spaces once, then answers from memory for a while", async () => {
        const db = store([doc("a", { info: { headline: "One" } })]);
        const first = await profileSpaces("0xowner1", db, 1000);
        expect(first).toEqual([{ id: "a", name: "One", path: "/spaces/a" }]);
        expect(db.query.where).toHaveBeenCalledWith("owner", "==", "0xowner1");
        expect(db.query.limit).toHaveBeenCalledWith(30);
        await profileSpaces("0xowner1", db, 1000 + 9 * 60 * 1000);
        expect(db.calls.count).toBe(1);
        await profileSpaces("0xowner1", db, 1000 + 11 * 60 * 1000);
        expect(db.calls.count).toBe(2);
    });

    it("lists nothing when the read fails or there is no owner", async () => {
        const failing = {
            collection: () => {
                throw new Error("down");
            },
        } as any;
        const error = jest.spyOn(console, "error").mockImplementation(() => {});
        expect(await profileSpaces("0xowner2", failing)).toEqual([]);
        expect(await profileSpaces("", failing)).toEqual([]);
        error.mockRestore();
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
        expect(db.query.limit).toHaveBeenCalledWith(13);
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
