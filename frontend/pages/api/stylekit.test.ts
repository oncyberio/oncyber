/** @jest-environment node */
import handler from "./stylekit";
import { auth } from "@utils/middlewares/authMiddleware";

const mockSet = jest.fn(async () => undefined);
let mockExisting: Record<string, any> | undefined;

jest.mock("@utils/middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock("@utils/middlewares/corsMiddleware", () => ({
    corsMiddleware: jest.fn(async () => undefined),
}));
jest.mock("@utils/getContentByIds", () => ({ getContentByIds: jest.fn() }));
jest.mock("@utils/firebaseAdmin", () => ({
    db: {
        collection: () => ({
            doc: () => ({
                get: async () => ({
                    exists: !!mockExisting,
                    data: () => mockExisting,
                }),
                set: mockSet,
            }),
        }),
    },
}));

function response() {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    return res;
}
const save = {
    headers: {},
    query: { type: "CREATE_STYLEKIT" },
    body: { stylekitId: "room", room: "room", kitbash: {}, kitbashImgs: {} },
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    (auth as jest.Mock).mockResolvedValue("0xMallory");
});
afterEach(() => jest.restoreAllMocks());

test.each([
    ["someone else's", { owner: "0xowner" }],
    ["an ownerless", { info: { room: "room" } }],
])("saving over %s stylekit is refused", async (_name, existing) => {
    mockExisting = existing;
    const res = response();
    await handler(save, res);
    expect(res.statusCode).toBe(403);
    expect(mockSet).not.toHaveBeenCalled();
});

test("a new stylekit, or the caller's own, is saved", async () => {
    for (const existing of [undefined, { owner: "0xmallory" }]) {
        mockExisting = existing;
        const res = response();
        await handler(save, res);
        expect(res.statusCode).toBe(200);
    }
    expect(mockSet).toHaveBeenCalledTimes(2);
});
