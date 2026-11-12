/** @jest-environment node */
import handler from "./apply";
import { auth } from "@utils/middlewares/authMiddleware";
import {
    getDestinationById,
    updateDestination,
} from "@utils/firestore/destinations";

jest.mock("@utils/middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock("@utils/middlewares/corsMiddleware", () => ({
    corsMiddleware: jest.fn(async () => undefined),
}));
jest.mock("@utils/firestore/destinations", () => ({
    createDestination: jest.fn(async () => "new-id"),
    updateDestination: jest.fn(async () => undefined),
    getDestinationById: jest.fn(),
}));

const signedInAs = auth as jest.Mock;
const read = getDestinationById as jest.Mock;
const update = updateDestination as jest.Mock;

function response() {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    res.end = () => res;
    return res;
}

const edit = (id = "dest-1") => ({
    method: "PUT",
    headers: {},
    body: {
        id,
        payload: { name: "Renamed", author: { userId: "0xmallory" } },
    },
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    read.mockResolvedValue({ id: "dest-1", userId: "0xowner" });
});
afterEach(() => jest.restoreAllMocks());

test("an edit by someone other than the owner is refused", async () => {
    signedInAs.mockResolvedValue("0xmallory");
    const res = response();
    await handler(edit() as any, res);
    expect(res.statusCode).toBe(403);
    expect(update).not.toHaveBeenCalled();
});

test("an edit of a destination that does not exist is refused", async () => {
    signedInAs.mockResolvedValue("0xowner");
    read.mockResolvedValue(null);
    const res = response();
    await handler(edit("missing") as any, res);
    expect(res.statusCode).toBe(403);
    expect(update).not.toHaveBeenCalled();
});

test("an edit without a session is refused", async () => {
    signedInAs.mockRejectedValue("Failed to authenticate token.");
    const res = response();
    await handler(edit() as any, res);
    expect(res.statusCode).toBe(401);
    expect(update).not.toHaveBeenCalled();
});

test("the owner can still edit", async () => {
    signedInAs.mockResolvedValue("0xowner");
    const res = response();
    await handler(edit() as any, res);
    expect(res.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith(
        "dest-1",
        expect.objectContaining({ name: "Renamed" })
    );
});
