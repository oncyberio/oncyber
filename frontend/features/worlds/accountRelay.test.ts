/** @jest-environment node */
import {
    askedSpace,
    relayedRoute,
    relayedRpc,
    relayedSettings,
    relayedSpaceEdit,
    savedSettings,
} from "./accountRelay";
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

describe("the page's copy of the settings after a world saved to them", () => {
    const before = { vrm: "square", quality: "high", camera: { mode: "tp" } };
    test("settings named whole take the place of them all, as on the server", () => {
        // The in-world panels send every setting with the one that changed.
        expect(
            savedSettings(before, {
                payload: { settings: { ...before, vrm: "robot" } },
            })
        ).toEqual({ ...before, vrm: "robot" });
        expect(
            savedSettings(before, { payload: { settings: { vrm: "robot" } } })
        ).toEqual({ vrm: "robot" });
    });
    test("a setting named by its path is set, and its neighbours kept", () => {
        const after = savedSettings(before, {
            payload: { "settings.camera.fov": 70, "settings.vrm": "robot" },
        });
        expect(after).toEqual({
            vrm: "robot",
            quality: "high",
            camera: { mode: "tp", fov: 70 },
        });
        // a copy: what the page held is not changed under it
        expect(before.camera).toEqual({ mode: "tp" });
    });
    test("a first setting, on an account that had none", () => {
        expect(
            savedSettings(undefined, { payload: { "settings.vrm": "robot" } })
        ).toEqual({ vrm: "robot" });
    });
    test("anything that is not a save of settings changes nothing", () => {
        for (const body of [
            { payload: { username: "mallory" } },
            { payload: {} },
            null,
            "x",
        ])
            expect(savedSettings(before, body)).toBeNull();
    });
});

describe("the edits a world may save to the space the page opened", () => {
    test("one piece at a time: an artwork, a portal, a kit part", () => {
        for (const payload of [
            { FIRESTORE_ADD_ASSET: true, assetId: "a", asset: {} },
            { FIRESTORE_REPLACE_ASSET: true, assetId: "a", asset: {} },
            { FIRESTORE_UPDATE_ASSET: true, assetId: "a", update: {} },
            { FIRESTORE_DELETE_ASSET: true, assetId: "a" },
            { FIRESTORE_UPDATE_PORTAL: true, portalId: "p", update: {} },
            { FIRESTORE_DELETE_PORTAL: true, portalId: "p" },
            { FIRESTORE_RESET_KITBASH: true, data: {} },
            { FIRESTORE_UPDATE_KITBASH: true, id: "k", update: {} },
            { FIRESTORE_DELETE_KITBASH: true, id: "k" },
        ])
            expect(relayedSpaceEdit({ payload })).toBe(true);
    });

    test("never who edits it, its gate, its address or its script", () => {
        for (const payload of [
            // the path update writes any field
            { FIRESTORE_UPDATE_Field: true, update: { editors: ["0xbad"] } },
            { FIRESTORE_UPDATE_Field: true, update: { gating: null } },
            { FIRESTORE_UPDATE_Field: true, update: { worldScripts: {} } },
            // one riding along with an edit that is allowed
            {
                FIRESTORE_UPDATE_ASSET: true,
                FIRESTORE_UPDATE_Field: true,
                assetId: "a",
                update: { editors: ["0xbad"] },
            },
            // a field that edit does not carry
            { FIRESTORE_DELETE_ASSET: true, assetId: "a", editors: [] },
            { FIRESTORE_DELETE_ASSET: "yes", assetId: "a" },
            { editors: ["0xbad"] },
            {},
            [],
        ])
            expect(relayedSpaceEdit({ payload })).toBe(false);
        expect(relayedSpaceEdit(null)).toBe(false);
        expect(relayedSpaceEdit({})).toBe(false);
    });

    test("which space a call asks about", () => {
        const social = "/api/_v2/social";
        expect(askedSpace(social, "checkGating", [{ spaceId: "abc" }])).toBe(
            "abc"
        );
        expect(askedSpace(social, "isMod", [{ slug: "ada" }])).toBe("ada");
        // one that names none is about no space the page knows
        expect(askedSpace(social, "isMod", [{}])).toBe("");
        expect(askedSpace(social, "checkGating", [])).toBe("");
        // calls that are not about a space
        expect(askedSpace(social, "storage", [{}])).toBeNull();
        expect(askedSpace("/api/_v2/vrm", "getVrms", [{}])).toBeNull();
    });
});

describe("the page's answers", () => {
    const host = (more: Partial<WorldAccountHost> = {}): WorldAccountHost => ({
        signedIn: true,
        spaceId: "abc",
        origin,
        opened: jest.fn(async (label: string) => label === "abc"),
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

    test("what the session alone earns is for the space the page opened", async () => {
        const pass = { type: "success", proof: "signed-pass" };
        const page = host({ rpc: jest.fn(async () => pass) });
        const ask = (method: string, params: unknown[]) =>
            answerWorldAccount(
                "rpc",
                { route: "/api/_v2/social", method, params },
                page
            );
        // The opened space: the answer as it came.
        expect(await ask("checkGating", [{ spaceId: "abc" }])).toEqual({
            ok: true,
            value: pass,
        });
        // Another space: let in, without the pass the account earns there.
        expect(await ask("checkGating", [{ spaceId: "other" }])).toEqual({
            ok: true,
            value: { type: "success", proof: undefined },
        });
        // With the password the visitor typed, the pass is theirs anyway.
        expect(
            await ask("checkGating", [{ spaceId: "other", password: "pw" }])
        ).toEqual({ ok: true, value: pass });
        // Moderating another space is not a world's to learn, or to ask.
        (page.rpc as jest.Mock).mockClear();
        expect(await ask("isMod", [{ slug: "other" }])).toEqual({
            ok: true,
            value: false,
        });
        expect(page.rpc).not.toHaveBeenCalled();
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
        // The opened space, but an edit to who may edit it.
        expect(
            await answerWorldAccount(
                "api",
                {
                    url: "/api/exhibit?id=abc&type=UPDATE_EXHIBIT",
                    method: "POST",
                    body: JSON.stringify({
                        payload: {
                            FIRESTORE_UPDATE_Field: true,
                            update: { editors: ["0xmallory"] },
                        },
                    }),
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
                body: JSON.stringify({
                    payload: { FIRESTORE_DELETE_ASSET: true, assetId: "a" },
                }),
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
                body: JSON.stringify({
                    token: "page",
                    payload: { FIRESTORE_DELETE_ASSET: true, assetId: "a" },
                }),
            },
            page
        );
        expect(page.request).toHaveBeenCalledWith(
            "/api/exhibit?id=abc&type=UPDATE_EXHIBIT",
            {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=UTF-8" },
                credentials: "include",
                body: JSON.stringify({
                    payload: { FIRESTORE_DELETE_ASSET: true, assetId: "a" },
                }),
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
