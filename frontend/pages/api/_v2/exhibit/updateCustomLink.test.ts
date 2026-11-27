/** @jest-environment node */
import { updateCustomLink } from "./updateCustomLink";
import { db } from "@utils/firebaseAdmin";

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        runTransaction: jest.fn((run) =>
            run({ set: jest.fn(), delete: jest.fn(), update: jest.fn() })
        ),
        collection: jest.fn(),
    },
}));

const call = (link: string) =>
    (updateCustomLink as any).call(
        { userId: "0xowner" },
        { link, exhibitId: "space-1" }
    );

beforeEach(() => jest.clearAllMocks());

test.each(["studio", "about", "contact-us", "Explore", "ja"])(
    "a space can't take the site's own address %s",
    async (link) => {
        const result = await call(link);
        expect(result.success).toBe(false);
        expect(
            result.message ?? result.error ?? JSON.stringify(result)
        ).toMatch(/reserved/i);
        expect(db.collection).not.toHaveBeenCalled();
    }
);

// One space of names (features/games/gameSlug.ts): a game published on the
// site may hold a name as its short address, and the site's own games hold
// theirs as reserved links.
describe("a name a game holds", () => {
    const held = new Set<string>();
    const update = jest.fn();
    beforeEach(() => {
        held.clear();
        (db.runTransaction as jest.Mock).mockImplementation((run) =>
            run({
                // The game's claim is read in the space's own transaction.
                get: async (ref: { path: string }) => ({
                    exists: held.has(ref.path),
                }),
                set: jest.fn(),
                delete: jest.fn(),
                update,
            })
        );
        (db.collection as jest.Mock).mockImplementation((name: string) => ({
            doc: (id: string) => ({
                path: `${name}/${id}`,
                get: async () => ({
                    data: () => ({
                        owner: "0xOWNER",
                        info: { customLink: "" },
                    }),
                }),
            }),
            where: () => ({
                limit: () => ({ get: async () => ({ docs: [] }) }),
            }),
        }));
    });

    test("a space can't take a published game's slug, however it is spelt", async () => {
        held.add("gameLinks/sky-run");
        for (const link of ["sky-run", "Sky-Run"]) {
            const result = await call(link);
            expect(result.success).toBe(false);
            expect(result.message ?? JSON.stringify(result)).toMatch(
                /already exists/i
            );
        }
        expect(update).not.toHaveBeenCalled();
    });

    test("a name no game holds is the space's to take, as before", async () => {
        held.add("gameLinks/sky-run");
        const result = await call("frahm-gallery");
        expect(result.success).toBe(true);
        expect(update).toHaveBeenCalledTimes(1);
    });
});

test("a slug of one of the site's own games is a reserved link", () => {
    jest.isolateModules(() => {
        jest.doMock("@features/games/catalog.slugs.json", () => ({
            "sky-run": "sky",
        }));
        const { isReservedLink } = require("@utils/reservedLinks");
        expect(isReservedLink("sky-run")).toBe(true);
        expect(isReservedLink(" Sky-Run ")).toBe(true);
        expect(isReservedLink("sky-walk")).toBe(false);
        // The site's own pages are still reserved.
        expect(isReservedLink("studio")).toBe(true);
    });
    jest.dontMock("@features/games/catalog.slugs.json");
});
