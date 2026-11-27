import { readCliAuthRequest } from "./request";

const challenge = "a".repeat(43);

describe("what a terminal sign-in link asks for", () => {
    test("a terminal on this machine is redirected to, on localhost only", () => {
        expect(
            readCliAuthRequest({
                callback: "http://localhost:4123/callback",
                state: "s1",
            })
        ).toEqual({
            kind: "callback",
            callback: "http://localhost:4123/callback",
            state: "s1",
        });
        for (const callback of [
            "https://example.com/callback",
            "http://localhost.example.com/callback",
            "javascript:alert(1)",
            "not a url",
        ])
            expect(readCliAuthRequest({ callback, state: "s1" })).toEqual({
                kind: "invalid",
            });
    });

    test("a terminal somewhere else gives a challenge and is shown a code", () => {
        expect(readCliAuthRequest({ challenge })).toEqual({
            kind: "code",
            challenge,
        });
        for (const bad of ["", "short", challenge + "a", "!".repeat(43)])
            expect(readCliAuthRequest({ challenge: bad })).toEqual({
                kind: "invalid",
            });
    });

    test("a link that asks for both, or for neither, is refused", () => {
        expect(
            readCliAuthRequest({
                challenge,
                callback: "http://localhost:4123/callback",
            })
        ).toEqual({ kind: "invalid" });
        expect(readCliAuthRequest({})).toEqual({ kind: "invalid" });
        expect(readCliAuthRequest({ challenge: [challenge] })).toEqual({
            kind: "invalid",
        });
    });
});
