import {
    adoptGuestId,
    guestId,
    guestName,
    isGuestId,
    resetGuestIdentity,
    shownName,
    visitorName,
} from "./guestIdentity";

beforeEach(resetGuestIdentity);

test("a page has one guest id, however often it is asked", () => {
    const first = guestId();
    expect(isGuestId(first)).toBe(true);
    expect(guestId()).toBe(first);
});

test("a guest goes by Guest and the end of their id", () => {
    expect(guestName("Anon-0b1c2d3e-aaaa-bbbb-cccc-0123456789ab")).toBe(
        "Guest 89AB"
    );
    // An older id may end in a dash or an underscore: letters and digits.
    expect(guestName("Anon-Xy_9-")).toBe("Guest NXY9");
    expect(guestName("")).toBe("Guest");
});

test("an account's name wins; a guest id is never shown as a name", () => {
    expect(visitorName("rae", "0xabc")).toBe("rae");
    expect(visitorName("", "Anon-12345678")).toBe("Guest 5678");
    expect(visitorName(undefined, "0xabc")).toBe("0xabc");
    expect(visitorName(null, "")).toBe("");
    expect(shownName("Anon-12345678")).toBe("Guest 5678");
    expect(shownName("rae")).toBe("rae");
});

test("a framed world takes the page's guest id, and only a real one", () => {
    expect(adoptGuestId("Anon-pagepage1234")).toBe(true);
    expect(guestId()).toBe("Anon-pagepage1234");
    for (const bad of [
        "rae",
        "Anon-",
        "Anon-<b>",
        7,
        null,
        "Anon-" + "a".repeat(80),
    ])
        expect(adoptGuestId(bad)).toBe(false);
    expect(guestId()).toBe("Anon-pagepage1234");
});
