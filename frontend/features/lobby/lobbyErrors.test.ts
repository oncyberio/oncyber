import { lobbyErrorMessage } from "./lobbyErrors";

const FALLBACK = "Couldn’t invite the party.";

class TimeoutError extends Error {
    name = "TimeoutError";
}

test.each([
    // Written for visitors, by the lobby or its server: kept.
    [new Error("This party is full."), "This party is full."],
    [
        new Error("The party request timed out. Try again."),
        "The party request timed out. Try again.",
    ],
    [
        "You can belong to four lobby parties at a time.",
        "You can belong to four lobby parties at a time.",
    ],
    [
        { message: "This invitation has expired." },
        "This invitation has expired.",
    ],
    // Not written for anyone: replaced.
    [new TypeError("Failed to fetch"), FALLBACK],
    [new TypeError("crypto.randomUUID is not a function"), FALLBACK],
    [new SyntaxError("Unexpected token < in JSON at position 0"), FALLBACK],
    [new TimeoutError("Timed out"), FALLBACK],
    [new Error("Cannot read properties of undefined (reading 'id')"), FALLBACK],
    [new Error("GET https://api.example/groups 500"), FALLBACK],
    [new Error("x".repeat(201)), FALLBACK],
    [new Error(""), FALLBACK],
    [new Error("   "), FALLBACK],
    ["", FALLBACK],
    [null, FALLBACK],
    [undefined, FALLBACK],
    [42, FALLBACK],
    [{ name: "AbortError", message: "The user aborted a request." }, FALLBACK],
])("%p reads as %p", (error, expected) => {
    expect(lobbyErrorMessage(error, FALLBACK)).toBe(expected);
});
