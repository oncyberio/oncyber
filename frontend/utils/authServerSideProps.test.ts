/** @jest-environment node */
import nookies from "nookies";
import { AuthServerSidePropsLite } from "./authServerSideProps";
import { measureSsrStage } from "./serverside/ssrTiming";

jest.mock("nookies", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("./middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock("./firebaseAdmin", () => ({ db: {} }));
jest.mock("./analytics", () => ({ amplitude_logAnalyticsEvent: jest.fn() }));
jest.mock("./autographAssets", () => ({ isAutographUser: jest.fn() }));
jest.mock("./metadata/formatExhibit", () => ({ formatExhibit: (e) => e }));
jest.mock("./anon", () => ({ initAnonUser: jest.fn() }));
jest.mock("pages/api/exhibit", () => ({}), { virtual: true });
jest.mock("pages/api/invite/access", () => ({}), { virtual: true });
jest.mock("pages/api/space/template", () => ({}), { virtual: true });
jest.mock("pages/api/space/createshortcut", () => ({}), { virtual: true });
jest.mock("@api/accounts/user/utils", () => ({}), { virtual: true });
jest.mock("@api/accounts/authenticate/utils/link", () => ({}), {
    virtual: true,
});

const originalEnvironment = process.env.NODE_ENV;
beforeEach(() => {
    Object.assign(process.env, { NODE_ENV: "production" });
    (nookies.get as jest.Mock).mockReturnValue({});
    jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalEnvironment });
    jest.restoreAllMocks();
});

test("world pages behind the auth wrapper report their server stages", async () => {
    const res = { setHeader: jest.fn() };
    const page = jest.fn(async () => ({
        experience: await measureSsrStage("ssr_exhibit", () => "world"),
    }));
    await expect(
        AuthServerSidePropsLite(page)({ res, query: {}, resolvedUrl: "/x" })
    ).resolves.toEqual({
        props: { user: null, authenticated: false, experience: "world" },
    });
    expect(res.setHeader).toHaveBeenCalledTimes(1);
    expect(res.setHeader.mock.calls[0][1]).toMatch(
        /^ssr_exhibit;dur=\d+\.\d, ssr_total;dur=\d+\.\d$/
    );
});

test("redirects keep their shape", async () => {
    const redirect = { destination: "/rift", permanent: true };
    await expect(
        AuthServerSidePropsLite(async () => ({ redirect }))({
            res: { setHeader: jest.fn() },
            query: {},
            resolvedUrl: "/spaces/x",
        })
    ).resolves.toEqual({ redirect });
});
