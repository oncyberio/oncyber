/** @jest-environment node */
import handler from "./index";
import { auth } from "@utils/middlewares/authMiddleware";
import { canEditExhibit } from "@utils/firestore/exhibitEditors";

const mockGet = jest.fn(async () => ({
    empty: false,
    docs: [{ id: "invite-1" }],
}));

jest.mock("@utils/middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock("@utils/middlewares/corsMiddleware", () => ({
    corsMiddleware: jest.fn(async () => undefined),
}));
jest.mock("@utils/firestore/exhibitEditors", () => ({
    canEditExhibit: jest.fn(),
}));
jest.mock("@utils/firebaseAdmin", () => ({
    db: { collection: () => ({ where: () => ({ get: mockGet }) }) },
}));

function response() {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    return res;
}
const request = { headers: {}, query: { exhibitId: "space-1" } };

beforeEach(() => jest.clearAllMocks());

test.each([
    ["a signed-in visitor", async () => "0xvisitor", false],
    ["nobody", () => Promise.reject("no token"), false],
])("%s cannot read a space's invite id", async (_name, session, editor) => {
    (auth as jest.Mock).mockImplementation(session);
    (canEditExhibit as jest.Mock).mockResolvedValue(editor);
    const res = response();
    await handler(request, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain("invite-1");
    expect(mockGet).not.toHaveBeenCalled();
});

test("an editor can read it", async () => {
    (auth as jest.Mock).mockResolvedValue("0xeditor");
    (canEditExhibit as jest.Mock).mockResolvedValue(true);
    const res = response();
    await handler(request, res);
    expect(canEditExhibit).toHaveBeenCalledWith("space-1", "0xeditor");
    expect(res.body).toEqual({ success: true, inviteId: "invite-1" });
});
