/** @jest-environment node */
import { exportSpace } from "./exportSpace";
import { getExhibitByCustomLink, getExhibitById } from "pages/api/exhibit";
import { getDestinationBySlug } from "@utils/firestore/destinations";

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));
jest.mock("pages/api/exhibit", () => ({
    getExhibitById: jest.fn(),
    getExhibitByCustomLink: jest.fn(),
}));
jest.mock("@utils/firestore/destinations", () => ({
    getDestinationBySlug: jest.fn(),
}));
jest.mock("@utils/siteAdmins", () => ({
    isSiteAdmin: (userId: string) => userId === "0xadmin",
}));

const space = {
    id: "space-1",
    owner: "0xOwner",
    editors: ["0xEditor"],
    ownerName: "Ada",
    info: { room: "sky-house", customLink: "mine" },
    artworks: {},
    gating: { password: { message: "Ask", rev: "r1" } },
};
const world = {
    _id: "dest-1",
    slug: "sky-house",
    author: { id: "a", userId: "a", email: "a@example.com" },
};

const call = (userId: string, input: Record<string, string>) =>
    (exportSpace as any).call({ userId }, input);
const schema = (exportSpace as any)._RPC_OPTS.schema;

beforeEach(() => {
    jest.clearAllMocks();
    (getExhibitById as jest.Mock).mockResolvedValue(space);
    (getExhibitByCustomLink as jest.Mock).mockResolvedValue(space);
    (getDestinationBySlug as jest.Mock).mockResolvedValue(world);
});

test("needs a session, and an id or a link but not both", () => {
    expect((exportSpace as any)._RPC_OPTS.auth).toBe(true);
    expect(schema.safeParse({ id: "space-1" }).success).toBe(true);
    expect(schema.safeParse({ link: "mine" }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ id: "space-1", link: "mine" }).success).toBe(
        false
    );
});

test.each(["0xowner", "0xeditor", "0xadmin"])(
    "%s gets the space and its world",
    async (userId) => {
        const copy = await call(userId, { id: "space-1" });
        expect(copy.id).toBe("space-1");
        expect(copy.space.info).toEqual(space.info);
        expect(copy.space.editors).toEqual([]);
        expect(copy.space).not.toHaveProperty("ownerName");
        expect(copy.destination.id).toBe("dest-1");
        expect(JSON.stringify(copy)).not.toContain("a@example.com");
        expect(getDestinationBySlug).toHaveBeenCalledWith("sky-house");
    }
);

test("by link", async () => {
    const copy = await call("0xowner", { link: "mine" });
    expect(getExhibitByCustomLink).toHaveBeenCalledWith("mine");
    expect(copy.id).toBe("space-1");
});

test("anyone else is told the same as for a space that does not exist", async () => {
    const refused = await call("0xstranger", { id: "space-1" }).catch(
        (error) => error.message
    );
    (getExhibitById as jest.Mock).mockResolvedValue(null);
    const missing = await call("0xowner", { id: "nope" }).catch(
        (error) => error.message
    );
    expect(refused).toMatch(/No space of yours/);
    expect(missing).toBe(refused);
    expect(getDestinationBySlug).not.toHaveBeenCalled();
});

test("a room the app defines has no world to copy", async () => {
    (getExhibitById as jest.Mock).mockResolvedValue({
        ...space,
        info: { room: "@@empty" },
    });
    const copy = await call("0xowner", { id: "space-1" });
    expect(copy.destination).toBeNull();
    expect(getDestinationBySlug).not.toHaveBeenCalled();
});
