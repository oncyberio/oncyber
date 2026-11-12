import register from "../../pages/api/content/register";
import session from "../../pages/api/content/session";
import { db } from "@utils/firebaseAdmin";
import { auth } from "@utils/middlewares/authMiddleware";
import { checkGating, checkGatingRules } from "@utils/checkGatingRules";
import { getExhibitById } from "../../pages/api/exhibit";

jest.mock("@utils/firebaseAdmin", () => ({
    db: { collection: jest.fn(), runTransaction: jest.fn(), getAll: jest.fn() },
}));
jest.mock("@utils/middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock("@utils/checkGatingRules", () => ({
    checkGating: jest.fn(),
    checkGatingRules: jest.fn(),
}));
jest.mock("../../pages/api/exhibit", () => ({ getExhibitById: jest.fn() }));
jest.mock(
    "@api/accounts/user/utils",
    () => ({ fetchUserByWalletId: jest.fn(async () => ({ id: "owner" })) }),
    { virtual: true }
);

const runtime = {
    kind: "web",
    url: "https://games.example/demo",
    capabilities: [],
};
let transaction: any;
const request = (
    body: any = { experienceId: "space", runtime },
    origin = "https://oncyber.io"
) => ({ method: "POST", headers: { host: "oncyber.io", origin }, body } as any);
const response = () => {
    const res: any = {
        setHeader: jest.fn(),
        status: jest.fn(),
        json: jest.fn(),
    };
    res.status.mockReturnValue(res);
    res.json.mockReturnValue(res);
    return res;
};
beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue("owner");
    (db.collection as jest.Mock).mockReturnValue({ doc: jest.fn(() => "ref") });
    (db.getAll as jest.Mock).mockResolvedValue([
        { exists: true, data: () => ({ deleted: false }) },
    ]);
    transaction = {
        get: jest.fn(async () => ({
            exists: true,
            data: () => ({ owner: "owner", editors: [] }),
        })),
        update: jest.fn(),
    };
    (db.runTransaction as jest.Mock).mockImplementation((run) =>
        run(transaction)
    );
    (getExhibitById as jest.Mock).mockResolvedValue({
        id: "space",
        runtime,
        gating: { password: { password: "test" } },
    });
    (checkGating as jest.Mock).mockResolvedValue({ type: "success" });
});

test.each([
    "null",
    "https://evil.test",
    "http://oncyber.io",
    "https://oncyber.io/path",
    undefined,
])(
    "opaque/cross-origin/malformed writes and reads are denied: %s",
    async (origin) => {
        for (const handler of [register, session]) {
            const req = request();
            req.headers.origin = origin;
            const res = response();
            await handler(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        }
        expect(auth).not.toHaveBeenCalled();
        expect(db.runTransaction).not.toHaveBeenCalled();
    }
);
test("only an authenticated editor can attach or restore runtime", async () => {
    (auth as jest.Mock).mockResolvedValue("stranger");
    const denied = response();
    await register(request(), denied);
    expect(denied.status).toHaveBeenCalledWith(403);
    expect(transaction.update).not.toHaveBeenCalled();
    (auth as jest.Mock).mockResolvedValue("owner");
    const allowed = response();
    await register(request(), allowed);
    expect(allowed.status).toHaveBeenCalledWith(200);
    expect(transaction.update).toHaveBeenCalledWith(
        "ref",
        expect.objectContaining({ runtime })
    );
    await register(
        request({ experienceId: "space", runtime: { kind: "cyber" } }),
        response()
    );
    expect(transaction.update).toHaveBeenLastCalledWith(
        "ref",
        expect.objectContaining({ runtime: { kind: "cyber" } })
    );
});
test("forbidden URLs and wallet signing declarations never persist", async () => {
    for (const descriptor of [
        { kind: "web", url: "https://oncyber.io/studio" },
        { kind: "web", url: "javascript:alert(1)" },
        { ...runtime, capabilities: ["wallet.sign"] },
    ]) {
        const res = response();
        await register(
            request({ experienceId: "space", runtime: descriptor }),
            res
        );
        expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(transaction.update).not.toHaveBeenCalled();
});
test("session never discloses a descriptor until admission succeeds", async () => {
    (checkGating as jest.Mock).mockResolvedValue({ type: "password-error" });
    const blocked = response();
    await session(request(), blocked);
    expect(blocked.status).toHaveBeenCalledWith(403);
    expect(blocked.json).toHaveBeenCalledWith({
        error: "GATED",
        gating: "password-error",
    });
    (checkGatingRules as jest.Mock).mockResolvedValue({ type: "success" });
    const allowed = response();
    await session(
        request({ experienceId: "space", password: "test" }),
        allowed
    );
    expect(allowed.json).toHaveBeenCalledWith({ runtime });
    expect(allowed.setHeader).toHaveBeenCalledWith(
        "cache-control",
        "private, no-store"
    );
});

test.each(["deleted", "missing"])(
    "fresh %s admission denies a stale cached descriptor",
    async (state) => {
        (db.getAll as jest.Mock).mockResolvedValue([
            {
                exists: state !== "missing",
                data: () => ({ deleted: true }),
            },
        ]);
        const res = response();
        await session(request(), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: "EXPERIENCE_NOT_FOUND",
        });
        expect(db.getAll).toHaveBeenCalledWith("ref", {
            fieldMask: ["deleted"],
        });
        expect(getExhibitById).not.toHaveBeenCalled();
        expect(auth).not.toHaveBeenCalled();
    }
);

test("unavailable authoritative admission fails closed", async () => {
    (db.getAll as jest.Mock).mockRejectedValue(
        new Error("database unavailable")
    );
    const res = response();
    await session(request(), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(getExhibitById).not.toHaveBeenCalled();
});

test("even an authenticated owner cannot replace or restore deleted content", async () => {
    transaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ owner: "owner", deleted: true }),
    });
    for (const descriptor of [runtime, { kind: "cyber" }]) {
        const res = response();
        await register(
            request({ experienceId: "space", runtime: descriptor }),
            res
        );
        expect(res.status).toHaveBeenCalledWith(404);
    }
    expect(transaction.update).not.toHaveBeenCalled();
});
