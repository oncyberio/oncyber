/** @jest-environment node */
import { db } from "../firebaseAdmin";
import { getExhibitAccessByCustomLink } from "./exhibitAccess";

jest.mock("../firebaseAdmin", () => ({
    db: { collection: jest.fn(), getAll: jest.fn() },
}));

let record: any;
let query: any;
beforeEach(() => {
    jest.clearAllMocks();
    record = {
        owner: "owner",
        editors: ["editor"],
        gating: { noAnonymous: true },
        artworks: { large: "unused" },
    };
    query = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        doc: jest.fn((id) => ({ id })),
        get: jest.fn(async () => ({
            empty: record === null,
            docs:
                record === null
                    ? []
                    : [{ id: "document-id", data: () => record }],
        })),
    };
    (db.collection as jest.Mock).mockReturnValue(query);
    (db.getAll as jest.Mock).mockImplementation(async () => [
        { exists: record !== null, data: () => record },
    ]);
});

test("custom links read access fields once without loading content or owner data", async () => {
    await expect(getExhibitAccessByCustomLink("6529AB")).resolves.toEqual({
        id: "document-id",
        editors: ["editor"],
        gating: { noAnonymous: true },
    });
    expect(db.collection).toHaveBeenCalledTimes(1);
    expect(db.collection).toHaveBeenCalledWith("exhibits");
    expect(query.where).toHaveBeenCalledWith("info.customLink", "==", "6529AB");
    expect(query.select).toHaveBeenCalledWith("editors", "gating");
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(query.get).toHaveBeenCalledTimes(1);
    expect(db.getAll).not.toHaveBeenCalled();
});

test("s@ IDs use one masked document read", async () => {
    await expect(
        getExhibitAccessByCustomLink("s@document-id")
    ).resolves.toEqual({
        id: "document-id",
        editors: ["editor"],
        gating: { noAnonymous: true },
    });
    expect(query.doc).toHaveBeenCalledWith("document-id");
    expect(db.getAll).toHaveBeenCalledTimes(1);
    expect(db.getAll).toHaveBeenCalledWith(
        { id: "document-id" },
        { fieldMask: ["editors", "gating"] }
    );
    expect(query.where).not.toHaveBeenCalled();
    expect(query.get).not.toHaveBeenCalled();
});

test.each(["6529AB", "s@document-id"])(
    "every request sees fresh gating, editor removal and deletion: %s",
    async (slug) => {
        expect(await getExhibitAccessByCustomLink(slug)).toMatchObject({
            editors: ["editor"],
            gating: { noAnonymous: true },
        });
        record = { editors: [], gating: { whitelist: ["new-editor"] } };
        expect(await getExhibitAccessByCustomLink(slug)).toEqual({
            id: "document-id",
            ...record,
        });
        record = null;
        await expect(getExhibitAccessByCustomLink(slug)).resolves.toBeNull();
        expect(
            query.get.mock.calls.length +
                (db.getAll as jest.Mock).mock.calls.length
        ).toBe(3);
    }
);

test("database failure propagates so admission can fail closed", async () => {
    query.get.mockRejectedValue(new Error("unavailable"));
    await expect(getExhibitAccessByCustomLink("6529AB")).rejects.toThrow(
        "unavailable"
    );
});
