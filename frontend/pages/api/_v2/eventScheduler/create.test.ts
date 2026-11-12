/** @jest-environment node */
import { create } from "./create";
import { canEditExhibit } from "@utils/firestore/exhibitEditors";

const mockAdd = jest.fn(async () => ({ id: "event-1" }));

jest.mock("@utils/rpc/server", () => ({
    NoApi: jest.fn(),
    proc: (options) => Object.assign(options.handler, { _RPC_OPTS: options }),
}));
jest.mock("@utils/firebaseAdmin", () => ({
    db: { collection: () => ({ add: mockAdd }) },
}));
jest.mock("@utils/firestore/exhibitEditors", () => ({
    canEditExhibit: jest.fn(),
}));

const editable = canEditExhibit as jest.Mock;
const event = {
    userId: "0xAlice",
    title: "Opening",
    date: 1,
    thumbnail: "t.png",
    eventType: "party",
    exhibitId: "space-1",
    endDate: 2,
};

beforeEach(() => {
    jest.clearAllMocks();
    editable.mockResolvedValue(true);
});

test("an event announced as another account is refused", async () => {
    const result = await create.call({ userId: "0xmallory" } as any, event);
    expect(result.success).toBe(false);
    expect(mockAdd).not.toHaveBeenCalled();
});

test("an event in a space the caller does not edit is refused", async () => {
    editable.mockResolvedValue(false);
    const result = await create.call({ userId: "0xalice" } as any, event);
    expect(result.success).toBe(false);
    expect(editable).toHaveBeenCalledWith("space-1", "0xalice");
    expect(mockAdd).not.toHaveBeenCalled();
});

test("an editor can announce an event in their space", async () => {
    const result = await create.call({ userId: "0xalice" } as any, event);
    expect(result.success).toBe(true);
    expect(mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "0xAlice", exhibitId: "space-1" })
    );
});
