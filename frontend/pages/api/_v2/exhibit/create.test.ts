/** @jest-environment node */
import { create } from "./create";
import { createEmpty } from "./createEmpty";
import { db } from "@utils/firebaseAdmin";

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));
jest.mock("@utils/firebaseAdmin", () => ({ db: { batch: jest.fn() } }));
jest.mock("pages/api/stylekit", () => ({ getStylekitByRoom: jest.fn() }), {
    virtual: true,
});
jest.mock("@utils/posthog-server", () => ({ getPostHogClient: jest.fn() }));
jest.mock("@utils/emptyRoom", () => ({ EMPTY_ROOM: { slug: "empty" } }));
jest.mock(
    "@3factory/space/roomdatacompat",
    () => ({ getDefaultEmptyRoomData: () => ({}) }),
    { virtual: true }
);

beforeEach(() => jest.clearAllMocks());

test.each([
    ["another account", "0xmallory"],
    ["nobody", undefined],
])(
    "a space created for someone else by %s is refused",
    async (_name, userId) => {
        const as = { userId } as any;
        const empty = await createEmpty.call(as, { userId: "0xVictim" });
        const fromKit = await create.call(as, {
            userId: "0xVictim",
            room: "temple",
        });
        expect(empty.success).toBe(false);
        expect(fromKit.success).toBe(false);
        expect(db.batch).not.toHaveBeenCalled();
    }
);
