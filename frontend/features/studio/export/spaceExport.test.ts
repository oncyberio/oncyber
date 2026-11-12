import {
    buildSpaceExport,
    canExportSpace,
    ipfsCidOf,
    spaceExportFileName,
    SPACE_EXPORT_FORMAT,
} from "./spaceExport";

const CID0 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const CID1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

function exhibit(extra: any = {}): any {
    return {
        id: "space1",
        owner: "0xowner",
        editors: ["0xowner"],
        createdAt: "2024-01-01",
        number_of_visits: 3,
        info: {
            curator: "0xowner",
            room: "gallery",
            headline: "My Space!",
            heroImg: `https://cyber.mypinata.cloud/ipfs/${CID0}`,
        },
        artworks: {
            a: {
                data: {
                    image: `ipfs://${CID1}`,
                    animation_url: "https://example.com/art.glb",
                },
                position: { x: 1, y: 2, z: 3 },
                rotation: { _x: 0, _y: 0, _z: 0 },
                addedBy: "0xowner",
            },
            b: {
                data: { image: `ipfs://${CID1}` },
                position: { x: 0, y: 0, z: 0 },
                rotation: { _x: 0, _y: 0, _z: 0 },
                addedBy: "0xowner",
            },
        },
        ...extra,
    };
}

describe("buildSpaceExport", () => {
    it("keeps the space, the room and every file it points to", () => {
        const out = buildSpaceExport({
            exhibit: exhibit(),
            room: {
                _id: "gallery",
                path: "https://rooms.example/g.glb",
            } as any,
            exportedAt: new Date("2026-11-12T00:00:00Z"),
        });

        expect(out.format).toBe(SPACE_EXPORT_FORMAT);
        expect(out.version).toBe(1);
        expect(out.exportedAt).toBe("2026-11-12T00:00:00.000Z");
        expect(out.kind).toBe("native");
        expect(out.source).toEqual({
            id: "space1",
            url: "https://oncyber.io/spaces/space1",
        });
        expect(out.space.artworks.a.position).toEqual({ x: 1, y: 2, z: 3 });
        expect(out.room._id).toBe("gallery");

        expect(out.files.pinned.map((f) => f.cid).sort()).toEqual(
            [CID0, CID1].sort()
        );
        const shared = out.files.pinned.find((f) => f.cid === CID1);
        expect(shared.at).toEqual([
            "space.artworks.a.data.image",
            "space.artworks.b.data.image",
        ]);
        expect(out.files.hosted.map((f) => f.url)).toEqual([
            "https://example.com/art.glb",
            "https://rooms.example/g.glb",
        ]);
    });

    it("leaves out caches and the world password", () => {
        const out = buildSpaceExport({
            exhibit: exhibit({
                ownerData: { email: "x@example.com" },
                portalsOwners: { p: {} },
                portalExhibits: { p: {} },
                mock: true,
                gating: {
                    noAnonymous: true,
                    password: { password: "hunter2", message: "Ask", rev: "r" },
                },
            }),
        });

        const text = JSON.stringify(out);
        expect(text).not.toContain("hunter2");
        expect(text).not.toContain("x@example.com");
        expect(out.space).not.toHaveProperty("ownerData");
        expect(out.space).not.toHaveProperty("portalExhibits");
        expect(out.space).not.toHaveProperty("mock");
        expect(out.space.gating).toEqual({
            noAnonymous: true,
            password: { message: "Ask" },
        });
    });

    it("does not change the space it was given", () => {
        const input = exhibit({ gating: { password: { password: "p" } } });
        buildSpaceExport({ exhibit: input });
        expect(input.gating.password.password).toBe("p");
    });

    it("marks a world hosted outside Oncyber as external", () => {
        const out = buildSpaceExport({
            exhibit: exhibit({
                runtime: { kind: "web", url: "https://world.example/" },
            }),
        });
        expect(out.kind).toBe("external");
        expect(out.files.hosted.map((f) => f.url)).toContain(
            "https://world.example/"
        );
    });

    it("links a custom slug when the space has one", () => {
        const space = exhibit();
        space.info.customLink = "moon";
        const out = buildSpaceExport({
            exhibit: space,
            origin: "http://localhost:13000/",
        });
        expect(out.source.url).toBe("http://localhost:13000/moon");
    });
});

describe("ipfsCidOf", () => {
    it.each([
        [`ipfs://${CID0}`, CID0],
        [`ipfs://ipfs/${CID0}/x.png`, CID0],
        [`https://ipfs.io/ipfs/${CID1}?a=1`, CID1],
        [`https://${CID1}.ipfs.dweb.link/x`, CID1],
        ["https://example.com/ipfs/notacid", undefined],
        ["https://example.com/a.png", undefined],
    ])("%s", (url, cid) => {
        expect(ipfsCidOf(url)).toBe(cid);
    });
});

describe("spaceExportFileName", () => {
    it("uses the slug or title and the date", () => {
        const date = new Date("2026-11-12T10:00:00Z");
        expect(spaceExportFileName(exhibit(), date)).toBe(
            "my-space-2026-11-12.oncyber.json"
        );
    });
});

describe("canExportSpace", () => {
    type Who = Parameters<typeof canExportSpace>[0];

    const owner: Who = {
        isAnonymous: false,
        userRole: "owner",
        userId: "0xABC",
        owner: "0xabc",
    };

    it("lets the signed-in owner export", () => {
        expect(canExportSpace(owner)).toBe(true);
    });

    const refused: Array<[string, Partial<Who>]> = [
        ["a visitor without an account", { isAnonymous: true }],
        ["a co-curator", { userRole: "co-curator" }],
        ["another account in memory mode", { userId: "0xother" }],
        ["no account id", { userId: null }],
    ];

    it.each(refused)("refuses %s", (_, change) => {
        expect(canExportSpace({ ...owner, ...change })).toBe(false);
    });
});
