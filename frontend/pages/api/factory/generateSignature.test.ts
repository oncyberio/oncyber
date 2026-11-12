/** @jest-environment node */
import handler from "./generateSignature";
import { auth } from "@utils/middlewares/authMiddleware";
import { getDestinationById } from "@utils/saveToDb";
import { signCreateDropRequest } from "@utils/factory/sign";

jest.mock("@utils/middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock("@utils/middlewares/corsMiddleware", () => ({
    corsMiddleware: jest.fn(async () => undefined),
}));
jest.mock("../../../config", () => ({ __esModule: true, default: {} }));
jest.mock("@utils/saveToDb", () => ({ getDestinationById: jest.fn() }));
jest.mock("@utils/factory/pinata", () => ({
    __esModule: true,
    default: { uploadMetadata: jest.fn() },
}));
jest.mock("@utils/factory/address", () => ({
    getAddressCatch: (id) => id,
}));
jest.mock("@utils/factory/sign", () => ({ signCreateDropRequest: jest.fn() }));
jest.mock("@ethersproject/wallet", () => ({ Wallet: jest.fn() }));

function response() {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    res.end = () => res;
    return res;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    (getDestinationById as jest.Mock).mockResolvedValue({
        success: true,
        data: { userId: "0xowner", status: "verified", name: "Drop" },
    });
});
afterEach(() => jest.restoreAllMocks());

test("a drop signature for someone else's destination is refused", async () => {
    (auth as jest.Mock).mockResolvedValue("0xmallory");
    const res = response();
    await handler(
        {
            method: "POST",
            headers: {},
            body: { payload: { destinationId: "dest-1" } },
        } as any,
        res
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.signature).toBe(null);
    expect(signCreateDropRequest).not.toHaveBeenCalled();
});
