/** @jest-environment node */
import nookies from "nookies";
import { auth } from "../middlewares/authMiddleware";
import { fetchUserByWalletIdCached } from "@api/accounts/user/utils";
import { BasicServerSideProps } from "./BasicServerSideProps";

jest.mock("nookies", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("../middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock(
    "@api/accounts/user/utils",
    () => ({ fetchUserByWalletIdCached: jest.fn() }),
    { virtual: true }
);

const originalEnvironment = process.env.NODE_ENV;
const mockAuth = auth as jest.Mock;
const mockProfile = fetchUserByWalletIdCached as jest.Mock;
const context = () => ({ res: { setHeader: jest.fn() } });
beforeEach(() => {
    Object.assign(process.env, { NODE_ENV: "development" });
    jest.clearAllMocks();
    (nookies.get as jest.Mock).mockReturnValue({
        _CCA: "wallet",
        wallet: "token",
    });
    jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalEnvironment });
    jest.restoreAllMocks();
});

test("fresh authentication and page admission still run on every request", async () => {
    const user = { id: "wallet" };
    mockAuth.mockResolvedValue("WALLET");
    mockProfile.mockResolvedValue(user);
    const page = jest.fn(async (_context, receivedUser, token) => ({
        gatingError:
            receivedUser === user && token === "token" ? null : "denied",
    }));
    const resolve = BasicServerSideProps(page);
    const first = context();
    await expect(resolve(first)).resolves.toEqual({
        props: {
            userId: "WALLET",
            user,
            authenticated: true,
            token: "token",
            gatingError: null,
        },
    });
    await resolve(context());
    expect(mockAuth).toHaveBeenCalledTimes(2);
    expect(mockProfile).toHaveBeenCalledTimes(2);
    expect(page).toHaveBeenCalledTimes(2);
    expect(first.res.setHeader.mock.calls[0][1]).toMatch(
        /ssr_auth;dur=.*ssr_user;dur=.*ssr_page;dur=.*ssr_total;dur=/
    );
    expect(first.res.setHeader.mock.calls[0][1]).not.toContain("token");
});

test("guests skip profile hydration but execute the page callback", async () => {
    mockAuth.mockRejectedValue(new Error("guest"));
    const page = jest.fn(async () => ({
        experience: "public",
        gatingError: "no-anonymous-error",
    }));
    const ctx = context();
    await expect(BasicServerSideProps(page)(ctx)).resolves.toEqual({
        props: {
            authenticated: false,
            experience: "public",
            gatingError: "no-anonymous-error",
        },
    });
    expect(page).toHaveBeenCalledTimes(1);
    expect(page).toHaveBeenCalledWith(ctx);
    expect(mockProfile).not.toHaveBeenCalled();
    expect(ctx.res.setHeader.mock.calls[0][1]).toContain("ssr_auth;dur=");
});

test("retains Next redirect return shape", async () => {
    mockAuth.mockRejectedValue(new Error("guest"));
    const redirect = { destination: "/public", permanent: false };
    await expect(
        BasicServerSideProps(async () => ({ redirect }))(context())
    ).resolves.toEqual({ redirect });
});

function deferred<T>() {
    let resolve: (value: T) => void, reject: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("prefetch", () => {
    test("the page's read starts with the profile read, not after it", async () => {
        const user = { id: "wallet" };
        mockAuth.mockResolvedValue("WALLET");
        const profile = deferred<typeof user>();
        mockProfile.mockReturnValue(profile.promise);
        const exhibit = deferred<{ experience: string }>();
        const prefetch = jest.fn(() => exhibit.promise);
        const page = jest.fn(async (_context, receivedUser, token, data) => ({
            ...(await data),
            gating: receivedUser === user && token === "token",
        }));
        const ctx = context();
        const result = BasicServerSideProps(page, { prefetch })(ctx);
        await flush();
        // Both reads are in flight; the page itself waits for the profile.
        expect(mockProfile).toHaveBeenCalledTimes(1);
        expect(prefetch).toHaveBeenCalledTimes(1);
        expect(prefetch).toHaveBeenCalledWith(ctx);
        expect(page).not.toHaveBeenCalled();
        exhibit.resolve({ experience: "rift" });
        profile.resolve(user);
        await expect(result).resolves.toEqual({
            props: {
                userId: "WALLET",
                user,
                authenticated: true,
                token: "token",
                experience: "rift",
                gating: true,
            },
        });
        expect(page).toHaveBeenCalledTimes(1);
        expect(prefetch).toHaveBeenCalledTimes(1);
        expect(ctx.res.setHeader.mock.calls[0][1]).toMatch(
            /ssr_auth;dur=.*ssr_user;dur=.*ssr_page;dur=.*ssr_total;dur=/
        );
    });

    test("guests get the same props, with the read handed to the page", async () => {
        mockAuth.mockRejectedValue(new Error("guest"));
        const prefetch = jest.fn(async () => ({ experience: "public" }));
        const page = jest.fn(async (_context, user, token, data) => ({
            ...(await data),
            user: user ?? "none",
            token: token ?? "none",
        }));
        const ctx = context();
        await expect(
            BasicServerSideProps(page, { prefetch })(ctx)
        ).resolves.toEqual({
            props: {
                authenticated: false,
                experience: "public",
                user: "none",
                token: "none",
            },
        });
        expect(prefetch).toHaveBeenCalledTimes(1);
        expect(mockProfile).not.toHaveBeenCalled();
    });

    test("a page that throws is retried signed out with the same read", async () => {
        mockAuth.mockResolvedValue("WALLET");
        mockProfile.mockResolvedValue({ id: "wallet" });
        const prefetch = jest.fn(async () => ({ experience: "rift" }));
        const page = jest
            .fn()
            .mockRejectedValueOnce(new Error("gating failed"))
            .mockImplementationOnce(async (_context, user, _token, data) => ({
                ...(await data),
                signedIn: !!user,
            }));
        await expect(
            BasicServerSideProps(page, { prefetch })(context())
        ).resolves.toEqual({
            props: {
                authenticated: false,
                experience: "rift",
                signedIn: false,
            },
        });
        expect(page).toHaveBeenCalledTimes(2);
        expect(prefetch).toHaveBeenCalledTimes(1);
    });

    test("a failed read fails the page as before, and the retry reads again", async () => {
        mockAuth.mockResolvedValue("WALLET");
        mockProfile.mockResolvedValue({ id: "wallet" });
        const prefetch = jest
            .fn()
            .mockRejectedValueOnce(new Error("firestore unavailable"))
            .mockResolvedValueOnce({ experience: "rift" });
        const page = jest.fn(async (_context, _user, _token, data) => ({
            ...(await data),
        }));
        await expect(
            BasicServerSideProps(page, { prefetch })(context())
        ).resolves.toEqual({
            props: { authenticated: false, experience: "rift" },
        });
        expect(page).toHaveBeenCalledTimes(2);
        expect(prefetch).toHaveBeenCalledTimes(2);
    });

    test("a read the page never awaits cannot fail the request", async () => {
        mockAuth.mockRejectedValue(new Error("guest"));
        const unhandled = jest.fn();
        process.on("unhandledRejection", unhandled);
        try {
            const prefetch = () => Promise.reject(new Error("not needed"));
            await expect(
                BasicServerSideProps(async () => ({ isProfile: true }), {
                    prefetch,
                })(context())
            ).resolves.toEqual({
                props: { authenticated: false, isProfile: true },
            });
            await flush();
            expect(unhandled).not.toHaveBeenCalled();
        } finally {
            process.off("unhandledRejection", unhandled);
        }
    });
});
