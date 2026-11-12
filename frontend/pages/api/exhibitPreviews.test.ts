/** @jest-environment node */
import handler, {
    EXHIBIT_PREVIEW_FIELDS,
    EXHIBIT_PREVIEWS_CACHE_CONTROL,
    parseExhibitPreviewIds,
} from "./exhibit";
import { db } from "@utils/firebaseAdmin";

// Staff picks read Firestore; these tests are about the feed itself.
jest.mock("@utils/staffPicks", () => ({
    readStaffPickIds: jest.fn(async () => []),
}));
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        getAll: jest.fn(),
        collection: jest.fn(() => ({ doc: jest.fn((id) => ({ id })) })),
    },
    fire: {},
}));
jest.mock("../../utils/middlewares/corsMiddleware", () => ({
    corsMiddleware: jest.fn(async () => undefined),
}));
jest.mock("../../utils/middlewares/authMiddleware", () => ({
    auth: jest.fn(),
}));
jest.mock("@utils/firestore/spaceSearch", () => ({ searchSpaces: jest.fn() }));
jest.mock("@features/landing-carousel/data", () => ({ DEFAULT_FILTERS: {} }));
jest.mock("@utils/saveToDb", () => ({
    getSlug: jest.fn(),
    oldToNew: {},
    pathToSlug: {},
}));
jest.mock("@utils/metadata/formatExhibit", () => ({
    formatExhibit: jest.fn(),
    formatUpdate: jest.fn(),
}));
jest.mock("@utils/firestore/userProfiles", () => ({
    getUserProfileByWalletId: jest.fn(),
}));
jest.mock("./stylekit", () => ({ getStylekitByRoom: jest.fn() }));

function response() {
    const res: any = { headers: {} };
    res.setHeader = jest.fn((name, value) => (res.headers[name] = value));
    res.status = jest.fn(() => res);
    res.json = jest.fn((body) => ((res.body = body), res));
    return res;
}

const doc = (id: string, data: any) => ({
    id,
    exists: data != null,
    data: () => data,
});

beforeEach(() => jest.clearAllMocks());

test("ids come from the query, without paths or duplicates", () => {
    expect(parseExhibitPreviewIds("a, b,,a,x/likes/y")).toEqual(["a", "b"]);
    expect(parseExhibitPreviewIds(["a", "c"])).toEqual(["a", "c"]);
    expect(parseExhibitPreviewIds(undefined)).toEqual([]);
});

test("a GET reads only the preview fields of every id, in one call, cacheably", async () => {
    (db.getAll as jest.Mock).mockResolvedValue([
        doc("a", { owner: "0xa", info: { room: "r" } }),
        doc("gone", null),
    ]);
    const res = response();
    await handler(
        {
            method: "GET",
            query: { type: "GET_EXHIBITS_BY_IDS", ids: "a,gone" },
        },
        res
    );

    expect(db.getAll).toHaveBeenCalledTimes(1);
    const args = (db.getAll as jest.Mock).mock.calls[0];
    expect(args.slice(0, 2)).toEqual([{ id: "a" }, { id: "gone" }]);
    expect(args[2]).toEqual({ fieldMask: EXHIBIT_PREVIEW_FIELDS });
    expect(EXHIBIT_PREVIEW_FIELDS).not.toContain("artworks");
    expect(res.headers["Cache-Control"]).toBe(EXHIBIT_PREVIEWS_CACHE_CONTROL);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exhibits).toHaveLength(1);
    expect(res.body.exhibits[0]).toMatchObject({
        id: "a",
        owner: "0xa",
        portals: {},
        artworks: {},
    });
});

test("the POST form keeps reading whole docs, uncached", async () => {
    (db.getAll as jest.Mock).mockResolvedValue([doc("a", { info: {} })]);
    const res = response();
    await handler(
        {
            method: "POST",
            query: { type: "GET_EXHIBITS_BY_IDS" },
            body: { exhibitIds: ["a"] },
        },
        res
    );
    expect((db.getAll as jest.Mock).mock.calls[0]).toEqual([{ id: "a" }]);
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(res.body.exhibits).toHaveLength(1);
});

// A world's password must never reach a browser: the batched previews are
// public and CDN-cached, and older documents still hold the plain value.
test.each(["GET", "POST"])(
    "%s previews carry the password prompt but never the password",
    async (method) => {
        (db.getAll as jest.Mock).mockResolvedValue([
            doc("old", {
                info: {},
                gating: {
                    password: { password: "plain-value", message: "Hi" },
                },
            }),
            doc("new", {
                info: {},
                gating: { password: { message: "Hey", rev: "rev-1" } },
            }),
        ]);
        const res = response();
        await handler(
            {
                method,
                query: { type: "GET_EXHIBITS_BY_IDS", ids: "old,new" },
                body: { exhibitIds: ["old", "new"] },
            },
            res
        );
        expect(JSON.stringify(res.body)).not.toContain("plain-value");
        expect(res.body.exhibits.map((it) => it.gating.password)).toEqual([
            { message: "Hi", rev: "unmigrated" },
            { message: "Hey", rev: "rev-1" },
        ]);
    }
);
