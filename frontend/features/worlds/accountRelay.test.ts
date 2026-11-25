/** @jest-environment node */
import { relayedRoute, relayedRpc, relayedSettings } from "./accountRelay";
import { answerWorldAccount, type WorldAccountHost } from "./worldAccountHost";

const origin = "https://www.oncyber.com";

describe("what a framed world may do with its visitor's account", () => {
    test("my avatars, my way in, my feedback: yes", () => {
        for (const [route, method] of [
            ["/api/_v2/vrm", "getVrms"],
            ["/api/_v2/vrm", "getVrm"],
            ["/api/_v2/vrm", "updateVrm"],
            ["/api/_v2/social", "checkGating"],
            ["/api/_v2/social", "isMod"],
            ["/api/_v2/social", "storage"],
        ])
            expect(relayedRpc(route, method)).toBe(true);
    });

    test("deleting, another area, or anything not named: no", () => {
        for (const [route, method] of [
            ["/api/_v2/vrm", "destroyVrm"],
            ["/api/_v2/accounts", "getUsers"],
            ["/api/_v2/accounts", "authenticate"],
            ["/api/_v2/vrm", "constructor"],
            ["/api/_v2/vrm", "toString"],
            ["__proto__", "getVrm"],
            [null, "getVrm"],
        ])
            expect(relayedRpc(route, method)).toBe(false);
    });

    test("two plain requests: saving my settings, saving an edit to a space", () => {
        expect(relayedRoute("POST", "/api/user/update", origin)).toEqual({
            kind: "settings",
        });
        expect(
            relayedRoute(
                "POST",
                "/api/exhibit?id=abc&type=UPDATE_EXHIBIT",
                origin
            )
        ).toEqual({ kind: "space", id: "abc" });
        for (const [method, url] of [
            ["GET", "/api/user/update"],
            ["POST", "/api/user/update?admin=1"],
            ["POST", "/api/exhibit?id=abc&type=DELETE_EXHIBIT"],
            ["POST", "/api/exhibit?id=abc&type=UPDATE_EXHIBIT&as=someone"],
            ["POST", "/api/user/avatar"],
            ["POST", "https://elsewhere.example/api/user/update"],
            ["POST", "/api/guestbook/add"],
        ])
            expect(relayedRoute(method, url, origin)).toBeNull();
    });

    test("of the profile, a world saves settings and nothing else", () => {
        expect(
            relayedSettings({ payload: { settings: { quality: "low" } } })
        ).toBe(true);
        for (const body of [
            { payload: { username: "mallory" } },
            { payload: { settings: {}, avatar: "x" } },
            { payload: { currentExhibitId: "abc" } },
            { payload: {} },
            { payload: [] },
            {},
            null,
        ])
            expect(relayedSettings(body)).toBe(false);
    });
});

describe("the page's answers", () => {
    const host = (more: Partial<WorldAccountHost> = {}): WorldAccountHost => ({
        signedIn: true,
        spaceId: "abc",
        origin,
        rpc: jest.fn(async () => ({ list: [1] })),
        request: jest.fn(async () => ({
            status: 200,
            text: async () => '{"success":true}',
        })) as any,
        ...more,
    });

    test("an allowed call is made by the page, as it was asked", async () => {
        const page = host();
        expect(
            await answerWorldAccount(
                "rpc",
                {
                    route: "/api/_v2/social",
                    method: "checkGating",
                    params: [{ spaceId: "abc" }],
                    encode: true,
                },
                page
            )
        ).toEqual({ ok: true, value: { list: [1] } });
        expect(page.rpc).toHaveBeenCalledWith(
            "/api/_v2/social",
            "checkGating",
            [{ spaceId: "abc" }],
            { encode: true }
        );
    });

    test("a call that is not allowed is never made", async () => {
        const page = host();
        expect(
            await answerWorldAccount(
                "rpc",
                { route: "/api/_v2/vrm", method: "destroyVrm", params: [{}] },
                page
            )
        ).toEqual({ ok: false, error: "Not available to a world" });
        expect(page.rpc).not.toHaveBeenCalled();
    });

    test("a failure is told, not thrown", async () => {
        const page = host({
            rpc: jest.fn(async () => {
                throw new Error("Unauthorized");
            }),
        });
        expect(
            await answerWorldAccount(
                "rpc",
                { route: "/api/_v2/vrm", method: "getVrms", params: [{}] },
                page
            )
        ).toEqual({ ok: false, error: "Unauthorized" });
    });

    test("settings are saved with the page's own session", async () => {
        const page = host();
        const body = JSON.stringify({
            payload: { settings: { quality: "low" } },
        });
        expect(
            await answerWorldAccount(
                "api",
                { url: "/api/user/update", method: "POST", body },
                page
            )
        ).toEqual({ status: 200, body: '{"success":true}' });
        expect(page.request).toHaveBeenCalledWith("/api/user/update", {
            method: "POST",
            credentials: "include",
            body,
        });
    });

    test("a world cannot rename its visitor, or save to a space the page did not open", async () => {
        const page = host();
        const refused = { status: 403, body: "" };
        expect(
            await answerWorldAccount(
                "api",
                {
                    url: "/api/user/update",
                    method: "POST",
                    body: JSON.stringify({ payload: { username: "mallory" } }),
                },
                page
            )
        ).toEqual(refused);
        expect(
            await answerWorldAccount(
                "api",
                {
                    url: "/api/exhibit?id=someone-elses&type=UPDATE_EXHIBIT",
                    method: "POST",
                    body: "{}",
                },
                page
            )
        ).toEqual(refused);
        expect(page.request).not.toHaveBeenCalled();
        await answerWorldAccount(
            "api",
            {
                url: "/api/exhibit?id=abc&type=UPDATE_EXHIBIT",
                method: "POST",
                body: "{}",
            },
            page
        );
        expect(page.request).toHaveBeenCalledTimes(1);
    });

    test("the page's own session answers for an edit: the world's stand-in for a token is taken out", async () => {
        const page = host();
        await answerWorldAccount(
            "api",
            {
                url: "/api/exhibit?id=abc&type=UPDATE_EXHIBIT",
                method: "POST",
                contentType: "text/plain;charset=UTF-8",
                body: JSON.stringify({ token: "page", payload: { a: 1 } }),
            },
            page
        );
        expect(page.request).toHaveBeenCalledWith(
            "/api/exhibit?id=abc&type=UPDATE_EXHIBIT",
            {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=UTF-8" },
                credentials: "include",
                body: JSON.stringify({ payload: { a: 1 } }),
            }
        );
    });

    test("a guest's page makes no account call for a world", async () => {
        const page = host({ signedIn: false });
        expect(
            await answerWorldAccount(
                "rpc",
                { route: "/api/_v2/vrm", method: "getVrms", params: [{}] },
                page
            )
        ).toBeUndefined();
        expect(page.rpc).not.toHaveBeenCalled();
    });
});
