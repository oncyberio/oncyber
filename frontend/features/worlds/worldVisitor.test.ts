import {
    readWorldVisitor,
    visitorUserData,
    worldVisitorMessage,
} from "./worldVisitor";

const identity = {
    name: "ada",
    pfp: "https://cdn.example/ada.png",
    avatarUrl: "https://cdn.example/ada.vrm",
};
const avatar = { id: "robot", name: "Robot" };

describe("the visitor a page hands a framed world", () => {
    test("what the page sends is what the world reads", () => {
        const visitor = readWorldVisitor(
            worldVisitorMessage(true, { identity, avatar }, 0.4)
        );
        expect(visitor).toEqual({
            ...identity,
            guest: false,
            avatar: { id: "robot", name: "Robot", url: identity.avatarUrl },
            avatarSize: 0.4,
        });
    });

    test("a guest carries an avatar but no saved size", () => {
        const visitor = readWorldVisitor(
            worldVisitorMessage(false, { identity, avatar: null }, 0.4)
        );
        expect(visitor.guest).toBe(true);
        expect(visitor.avatarSize).toBeNull();
        // with no choice behind it, the avatar goes by its address
        expect(visitor.avatar).toEqual({
            id: identity.avatarUrl,
            name: "Avatar",
            url: identity.avatarUrl,
        });
    });

    test("a message with no usable identity names no one", () => {
        expect(readWorldVisitor({})).toBeNull();
        expect(readWorldVisitor(null)).toBeNull();
        expect(
            readWorldVisitor({ ...identity, avatarUrl: "javascript:1" })
        ).toBeNull();
    });

    test("anyone not said to be signed in is a guest", () => {
        expect(readWorldVisitor({ ...identity }).guest).toBe(true);
        expect(readWorldVisitor({ ...identity, guest: "no" }).guest).toBe(true);
    });

    test("fields the world did not ask for are dropped, and odd ones ignored", () => {
        const visitor = readWorldVisitor({
            ...identity,
            guest: false,
            token: "secret",
            walletId: "0xabc",
            avatarId: "x".repeat(500),
            avatarSize: 7,
        });
        expect(visitor).toEqual({
            ...identity,
            guest: false,
            avatar: {
                id: identity.avatarUrl,
                name: "Avatar",
                url: identity.avatarUrl,
            },
            avatarSize: null,
        });
    });
});

describe("what the world's account state holds for a visitor", () => {
    const signedIn = readWorldVisitor(
        worldVisitorMessage(true, { identity, avatar }, 0.4)
    );

    test("a signed-in visitor's name, portrait and avatar size", () => {
        expect(visitorUserData(signedIn)).toEqual({
            username: "ada",
            avatar: identity.pfp,
            settings: { default_vrm_scale: 0.4 },
        });
        expect(visitorUserData({ ...signedIn, avatarSize: null })).toEqual({
            username: "ada",
            avatar: identity.pfp,
        });
    });

    test("nothing for a guest: the world's own guest stands", () => {
        expect(visitorUserData({ ...signedIn, guest: true })).toBeNull();
        expect(visitorUserData(null)).toBeNull();
    });
});
