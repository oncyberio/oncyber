import {
    createPageAuthority,
    type PageAuthorityDeps,
    type PageSession,
} from "./pageAuthority";

const ada: PageSession = {
    signedIn: true,
    userId: "0xada",
    token: "page-session",
    username: "ada",
};
const guest: PageSession = { signedIn: false, userId: "", token: "" };

function page(session: PageSession, more: Partial<PageAuthorityDeps> = {}) {
    const does: PageAuthorityDeps = {
        // "home" is the link of the space the page opened; "away" another.
        spaceIdOf: jest.fn(async (label) =>
            label === "home" ? "abc" : label === "away" ? "xyz" : null
        ),
        isMod: jest.fn(async () => true),
        rpc: jest.fn(async () => ({ type: "success", proof: "pass" })),
        request: jest.fn() as any,
        origin: () => "https://www.oncyber.com",
        ...more,
    };
    return { does, authority: createPageAuthority("abc", () => session, does) };
}

test("the space the page opened, by its id or by its name", async () => {
    const { authority, does } = page(ada);
    expect(await authority.opened("abc")).toBe(true);
    expect(await authority.opened("home")).toBe(true);
    expect(await authority.opened("away")).toBe(false);
    expect(await authority.opened("nowhere")).toBe(false);
    for (const odd of [null, 7, "", "x".repeat(201)])
        expect(await authority.opened(odd)).toBe(false);
    // a name it is, is not asked about twice
    await authority.opened("home");
    expect(
        (does.spaceIdOf as jest.Mock).mock.calls.filter(
            ([label]) => label === "home"
        )
    ).toHaveLength(1);
});

test("the session joins the opened space's room and no other", async () => {
    const { authority } = page(ada);
    expect(await authority.identify("home")).toEqual({
        userId: "0xada",
        token: "page-session",
        username: "ada",
    });
    expect(await authority.identify("away")).toEqual({
        userId: "0xada",
        token: "",
        username: "ada",
    });
});

test("a guest joins as the page's one guest, with no session", async () => {
    const { authority } = page(guest);
    const who = await authority.identify("home");
    expect(who.userId).toMatch(/^Anon-/);
    expect(who.token).toBe("");
    expect((await authority.identify("away")).userId).toBe(who.userId);
});

test("moderating is asked for the opened space only, and never for a guest", async () => {
    const signedIn = page(ada);
    expect(await signedIn.authority.moderates("home")).toBe(true);
    expect(await signedIn.authority.moderates("away")).toBe(false);
    expect(signedIn.does.isMod).toHaveBeenCalledTimes(1);
    const out = page(guest);
    expect(await out.authority.moderates("home")).toBe(false);
    expect(out.does.isMod).not.toHaveBeenCalled();
    // the site cannot say: no
    const down = page(ada, {
        isMod: jest.fn(async () => {
            throw new Error("offline");
        }),
    });
    expect(await down.authority.moderates("home")).toBe(false);
});

test("an account call about another space carries no pass", async () => {
    const { authority } = page(ada);
    const ask = (spaceId: string) =>
        authority.account("rpc", {
            route: "/api/_v2/social",
            method: "checkGating",
            params: [{ spaceId }],
        });
    expect(await ask("home")).toEqual({
        ok: true,
        value: { type: "success", proof: "pass" },
    });
    expect(await ask("away")).toEqual({
        ok: true,
        value: { type: "success", proof: undefined },
    });
});
