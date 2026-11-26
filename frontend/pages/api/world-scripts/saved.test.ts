/** @jest-environment node */
const mockDocs = new Map<string, Record<string, any>>();
const mockMasks: string[][] = [];
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: (name: string) => ({
            doc: (id: string) => ({ path: `${name}/${id}` }),
        }),
        getAll: async (ref: { path: string }, options: any) => {
            mockMasks.push(options.fieldMask);
            return [
                {
                    exists: mockDocs.has(ref.path),
                    data: () => mockDocs.get(ref.path),
                },
            ];
        },
    },
    fire: {},
}));
jest.mock("@api/accounts/authenticate/utils/link", () => ({
    getAccountDoc: jest.fn(),
}));

import handler from "./saved";

// Named in two pieces: a build writes a NEXT_PUBLIC_ variable's value in
// place of its name wherever it is read, and every file under pages/ is
// built, tests too.
const FLAG = ["NEXT_PUBLIC", "WORLD_SCRIPTS"].join("_");
const env = process.env as Record<string, string | undefined>;

async function ask(query: Record<string, string>, method = "GET") {
    const said: any = { headers: {} as Record<string, string> };
    const res: any = {
        setHeader: (name: string, value: string) =>
            (said.headers[name] = value),
        status: (code: number) => ((said.status = code), res),
        json: (body: unknown) => ((said.body = body), res),
    };
    await handler({ method, query } as any, res);
    return said;
}

beforeEach(() => {
    mockDocs.clear();
    mockMasks.length = 0;
    env[FLAG] = "1";
});
afterAll(() => {
    delete env[FLAG];
});

describe("when a space's script was last saved", () => {
    test("says the time and the landing, from two fields of the document", async () => {
        mockDocs.set("exhibits/space-1", {
            worldScriptsSavedAt: 500,
            worldScriptsLanding: "rewind",
        });
        const said = await ask({ space: "space-1" });
        expect(said.status).toBe(200);
        expect(said.body).toEqual({ savedAt: 500, landing: "rewind" });
        // Not the script, not the document.
        expect(mockMasks[0]).toEqual([
            "worldScriptsSavedAt",
            "worldScriptsLanding",
            "deleted",
        ]);
    });

    test("is the same for everyone, and held by the CDN for a few seconds", async () => {
        mockDocs.set("exhibits/space-1", { worldScriptsSavedAt: 500 });
        const said = await ask({ space: "space-1" });
        expect(said.headers["Cache-Control"]).toMatch(
            /public, s-maxage=\d+, stale-while-revalidate=\d+/
        );
        expect(said.body.landing).toBe("add");
    });

    test("a space never saved, missing or deleted has nothing newer", async () => {
        expect((await ask({ space: "nowhere" })).body.savedAt).toBe(0);
        mockDocs.set("exhibits/space-1", {});
        expect((await ask({ space: "space-1" })).body.savedAt).toBe(0);
        mockDocs.set("exhibits/space-1", {
            worldScriptsSavedAt: 500,
            deleted: true,
        });
        expect((await ask({ space: "space-1" })).body.savedAt).toBe(0);
    });

    test("is not there with world scripts off, for a bad id, or for a write", async () => {
        expect((await ask({ space: "a/b" })).status).toBe(404);
        expect((await ask({ space: "space-1" }, "POST")).status).toBe(405);
        env[FLAG] = "";
        expect((await ask({ space: "space-1" })).status).toBe(404);
        expect(mockMasks).toEqual([]);
    });
});
