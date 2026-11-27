import { isBuiltInRoom, portableDestination, portableSpace } from "./portable";

describe("a space as data for a copy", () => {
    const exhibit = {
        id: "space-1",
        owner: "0xowner",
        editors: ["0xfriend"],
        otherOwners: ["0xother"],
        ownerName: "Ada",
        ownerSpaces: [{ id: "space-2", name: "Other", path: "/other" }],
        ownerData: { email: "ada@example.com" },
        portalExhibits: { p: {} },
        info: { room: "sky-house", headline: "Mine", customLink: "mine" },
        artworks: { a: { id: "a" } },
        kitbash: { k: { id: "k" } },
        hasKitbash: true,
        runtime: { kind: "awe-app", url: "https://awe.box/play/abc" },
        worldScripts: [{ id: "s", source: "world.say('hi')" }],
        gating: { password: { message: "Ask me", password: "plain" } },
    };

    test("keeps the space, drops who edits it and what the page cached", () => {
        const space = portableSpace(exhibit);
        expect(space.info).toEqual(exhibit.info);
        expect(space.artworks).toEqual(exhibit.artworks);
        expect(space.kitbash).toEqual(exhibit.kitbash);
        expect(space.runtime).toEqual(exhibit.runtime);
        expect(space.worldScripts).toEqual(exhibit.worldScripts);
        expect(space.editors).toEqual([]);
        for (const gone of [
            "id",
            "ownerName",
            "ownerSpaces",
            "ownerData",
            "portalExhibits",
            "otherOwners",
        ])
            expect(space).not.toHaveProperty(gone);
    });

    test("never carries a password, even from a document not migrated yet", () => {
        const space = portableSpace(exhibit);
        expect(JSON.stringify(space)).not.toContain("plain");
        expect(space.gating.password.message).toBe("Ask me");
    });

    test("does not change the view it was given", () => {
        const before = JSON.stringify(exhibit);
        portableSpace(exhibit);
        expect(JSON.stringify(exhibit)).toBe(before);
    });
});

describe("a world as data for a copy", () => {
    test("keeps the world and the author's name, not how to reach them", () => {
        const copy = portableDestination({
            _id: "dest-1",
            slug: "sky-house",
            path: "https://cdn.example/sky.glb",
            params: { avatarSize: 0.5 },
            userId: "0xauthor",
            author: {
                id: "0xauthor",
                userId: "0xauthor",
                name: "Grace",
                email: "grace@example.com",
                twitter: "grace",
            },
        });
        expect(copy).toEqual({
            id: "dest-1",
            doc: {
                slug: "sky-house",
                path: "https://cdn.example/sky.glb",
                params: { avatarSize: 0.5 },
                userId: "0xauthor",
                author: { id: "0xauthor", userId: "0xauthor", name: "Grace" },
            },
        });
    });

    test("no world is no copy", () => {
        expect(portableDestination(null)).toBeNull();
    });

    test("a room the app defines has no document", () => {
        expect(isBuiltInRoom("@@empty")).toBe(true);
        expect(isBuiltInRoom("")).toBe(true);
        expect(isBuiltInRoom(undefined)).toBe(true);
        expect(isBuiltInRoom("sky-house")).toBe(false);
    });
});
