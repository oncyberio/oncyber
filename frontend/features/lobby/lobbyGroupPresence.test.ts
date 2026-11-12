import { lobbyGroupPresence, groupLocationLabel } from "./lobbyGroupPresence";
import { readGroupLocation } from "../../../multiplayer/protocol/group-location";
const destination = {
    id: "wanimal",
    title: "Wanimal blue",
    href: "/wanimal?__lobbyAttempt=private&cohort=secret#focus",
};
const clean = { id: "wanimal", title: "Wanimal blue", href: "/wanimal" };
test("visible destination presence does not wait for multiplayer, and return waits for the lobby reveal", () => {
    expect(lobbyGroupPresence("loading", destination, false)).toEqual({
        present: true,
        location: { state: "lobby" },
    });
    expect(lobbyGroupPresence("loading", destination, true)).toEqual({
        present: true,
        location: { state: "travelling", destination: clean },
    });
    for (const phase of ["revealing", "entered"] as const)
        expect(
            lobbyGroupPresence(phase, destination, phase === "revealing")
        ).toEqual({
            present: false,
            location: { state: "space", destination: clean },
        });
    expect(lobbyGroupPresence("returning", destination, true)).toEqual({
        present: false,
        location: { state: "travelling" },
    });
    expect(lobbyGroupPresence("idle", null, false)).toEqual({
        present: true,
        location: { state: "lobby" },
    });
});
test("private frame parameters and external paths never enter group location metadata", () => {
    expect(
        lobbyGroupPresence(
            "entered",
            { ...destination, href: "https://elsewhere.test/private" },
            false
        ).location
    ).toEqual({ state: "space" });
    for (const href of [
        "//elsewhere.test",
        "/x?token=private",
        "/x#private",
        "/../admin",
        "/x%2Fy",
        "/x\\y",
    ])
        expect(
            readGroupLocation({
                state: "space",
                destination: { ...clean, href },
            })
        ).toBeNull();
    expect(
        readGroupLocation({
            state: "space",
            destination: { ...clean, title: "x".repeat(81) },
        })
    ).toBeNull();
    expect(
        readGroupLocation({ state: "lobby", destination: clean })
    ).toBeNull();
    expect(
        readGroupLocation({
            state: "space",
            destination: { ...clean, privateToken: "secret" },
            rawUrl: "secret",
        })
    ).toEqual({ state: "space", destination: clean });
    expect(
        groupLocationLabel({ state: "travelling", destination: clean })
    ).toBe("Travelling to Wanimal blue");
    expect(groupLocationLabel({ state: "space", destination: clean })).toBe(
        "In Wanimal blue"
    );
    expect(groupLocationLabel({ state: "lobby" })).toBe("In lobby");
});
