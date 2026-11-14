import { spacePeople } from "./spacePeople";

test("you first, then moderators, then visitors by name, each once", () => {
    const people = spacePeople(
        [{ sessionId: "m", userData: { username: "mod", isAdmin: true } }],
        [
            { sessionId: "z", userData: { username: "zed", avatar: "z.png" } },
            { sessionId: "me", userData: { walletId: "0xabc" } },
            { sessionId: "a", userData: { username: "amy" } },
            { sessionId: "a", userData: { username: "amy" } },
            { userData: { username: "no session yet" } },
        ],
        "me"
    );
    expect(people).toEqual([
        {
            id: "me",
            name: "0xabc",
            avatar: undefined,
            isLocal: true,
            role: undefined,
        },
        {
            id: "m",
            name: "mod",
            avatar: undefined,
            isLocal: undefined,
            role: "admin",
        },
        {
            id: "a",
            name: "amy",
            avatar: undefined,
            isLocal: undefined,
            role: undefined,
        },
        {
            id: "z",
            name: "zed",
            avatar: "z.png",
            isLocal: undefined,
            role: undefined,
        },
    ]);
});
