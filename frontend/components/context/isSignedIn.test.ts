import { selectIsSignedIn } from "./isSignedIn";

// The one answer to "is this visitor signed in to an account?". Each row is a
// session a screen can be handed; only a real account with its token counts.
describe("selectIsSignedIn", () => {
    test.each([
        ["signed out", { authenticated: false }, false],
        [
            "signed out, an id left behind",
            { authenticated: false, user: { id: "0xabc" }, token: "t" },
            false,
        ],
        [
            // The studio's draft session: `authenticated` is true, the id is
            // "anon" and there is no token (utils/anon initAnonUser).
            "anonymous draft",
            {
                authenticated: true,
                isAnonymous: true,
                user: { id: "anon" },
                token: "",
            },
            false,
        ],
        [
            "anonymous, even with a token",
            {
                authenticated: true,
                isAnonymous: true,
                user: { id: "anon" },
                token: "t",
            },
            false,
        ],
        [
            "signed in",
            {
                authenticated: true,
                isAnonymous: false,
                user: { id: "0xabc" },
                token: "t",
            },
            true,
        ],
        [
            "signed in, isAnonymous not set",
            { authenticated: true, user: { id: "0xabc" }, token: "t" },
            true,
        ],
        [
            "missing token",
            {
                authenticated: true,
                isAnonymous: false,
                user: { id: "0xabc" },
                token: "",
            },
            false,
        ],
        [
            "missing user id",
            {
                authenticated: true,
                isAnonymous: false,
                user: { id: "" },
                token: "t",
            },
            false,
        ],
        [
            "missing user",
            { authenticated: true, isAnonymous: false, user: null, token: "t" },
            false,
        ],
        ["no session at all", undefined, false],
    ])("%s", (_name, session, expected) => {
        expect(selectIsSignedIn(session as any)).toBe(expected);
    });
});
