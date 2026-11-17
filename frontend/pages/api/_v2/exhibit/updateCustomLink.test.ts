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
