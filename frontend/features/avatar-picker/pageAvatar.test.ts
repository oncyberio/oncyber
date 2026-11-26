import {
    avatarMessage,
    readAvatarMessage,
    settingsWithAvatar,
} from "./pageAvatar";

const site = "https://www.oncyber.com";
const robot = { id: "robot", name: "Robot", url: "/avatars/robot.vrm" };

test("what the page sends is what the frame reads", () => {
    expect(readAvatarMessage(avatarMessage(robot), site)).toEqual({
        id: "robot",
        name: "Robot",
        url: "https://www.oncyber.com/avatars/robot.vrm",
    });
    expect(
        readAvatarMessage(
            avatarMessage({
                ...robot,
                url: "https://cdn.example/r.vrm",
                scale: 0.8,
            }),
            site
        )
    ).toEqual({
        id: "robot",
        name: "Robot",
        url: "https://cdn.example/r.vrm",
        scale: 0.8,
    });
});

test("an avatar with no id or name of its own goes by its address", () => {
    expect(readAvatarMessage({ avatarUrl: "/a.vrm" }, site)).toEqual({
        id: "https://www.oncyber.com/a.vrm",
        name: "Avatar",
        url: "https://www.oncyber.com/a.vrm",
    });
});

test("what is not a model on the web names no avatar", () => {
    for (const message of [
        { avatarUrl: "javascript:alert(1)" },
        { avatarUrl: "data:model/gltf-binary;base64,AAAA" },
        { avatarUrl: "https://user:pw@cdn.example/a.vrm" },
        { avatarUrl: "" },
        { avatarUrl: 7 },
        { avatarId: "robot" },
        null,
    ])
        expect(readAvatarMessage(message, site)).toBeNull();
    // a size no avatar has is left out, not believed
    expect(
        readAvatarMessage({ avatarUrl: "/a.vrm", avatarScale: 40 }, site)
    ).not.toHaveProperty("scale");
});

test("the saved setting is the avatar's id, kept with the other settings", () => {
    expect(
        settingsWithAvatar({ quality: "low", vrm: "square" }, robot)
    ).toEqual({ quality: "low", vrm: "robot" });
    expect(settingsWithAvatar(undefined, robot)).toEqual({ vrm: "robot" });
});

test("nothing is saved for the avatar already saved, or one held in a wallet", () => {
    expect(settingsWithAvatar({ vrm: "robot" }, robot)).toBeNull();
    expect(
        settingsWithAvatar(
            { vrm: "square" },
            {
                id: "https://nft.example/model.vrm",
                name: "Mine",
                url: "https://nft.example/model.vrm",
            }
        )
    ).toBeNull();
});
