/** @jest-environment node */
import { Object3D } from "three";

jest.mock("./facade", () => ({
    avatarCatalogue: () => ({
        sunshine: { url: "sunshine.vrm" },
        robot: { url: "robot.vrm" },
        broken: {},
    }),
    loadAvatarFile: jest.fn(async () => {}),
    requestPooledAvatar: jest.fn(async () => undefined),
    standAvatar: jest.fn(),
}));

import { avatarUrl, createAvatar } from "./avatars";
import { loadAvatarFile, requestPooledAvatar, standAvatar } from "./facade";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function standing() {
    const calls: string[] = [];
    let labelled = false;
    (standAvatar as jest.Mock).mockImplementation((options: any) => {
        calls.push(`stand ${options.url} as "${options.name}"`);
        return {
            setName: (name: string) => void calls.push(`name ${name}`),
            setMotion: (sit: boolean, emote: number) =>
                void calls.push(`motion ${sit ? "sit" : "stand"} ${emote}`),
            say(text: string) {
                if (labelled) calls.push(`say ${text}`);
                return labelled;
            },
            setShown: (shown: boolean) =>
                void calls.push(shown ? "show" : "hide"),
            place: (position: any, yaw: number) =>
                void calls.push(`place ${position.toArray()} ${yaw}`),
            remove: () => void calls.push("remove"),
        };
    });
    return { calls, label: () => (labelled = true) };
}

beforeEach(() => jest.clearAllMocks());

describe("which avatar a script gets", () => {
    test("one from the built-in catalogue, by id; anything else is the default", () => {
        expect(avatarUrl("robot")).toBe("robot.vrm");
        expect(avatarUrl(undefined)).toBe("sunshine.vrm");
        expect(avatarUrl("https://elsewhere/x.vrm")).toBe("sunshine.vrm");
        expect(avatarUrl("constructor")).toBe("sunshine.vrm");
        expect(avatarUrl("broken")).toBe("sunshine.vrm");
    });
});

describe("an avatar a script places", () => {
    test("it is loaded, stood where its holder is, and told what it is", async () => {
        const { calls } = standing();
        const holder = new Object3D();
        holder.position.set(1, 0, 2);
        const avatar = createAvatar("guide", holder);
        avatar.update({ avatar: "robot", name: "Ada", motion: "wave" });
        await settle();
        expect(loadAvatarFile).toHaveBeenCalledWith("robot.vrm");
        expect(standAvatar).toHaveBeenCalledWith(
            expect.objectContaining({ url: "robot.vrm", name: "Ada", yaw: 0 })
        );
        expect(calls).toEqual([
            'stand robot.vrm as "Ada"',
            "name Ada",
            "motion stand 0",
        ]);
    });

    test("only what changed is told again", async () => {
        const { calls } = standing();
        const avatar = createAvatar("guide", new Object3D());
        avatar.update({ name: "Ada" });
        await settle();
        calls.length = 0;
        avatar.update({ name: "Ada" });
        avatar.update({ name: "Ada", motion: "sit" });
        avatar.update({ name: "Ada", motion: "sit", visible: false });
        expect(calls).toEqual(["motion sit 12", "hide"]);
    });

    test("it follows its holder every frame, and speaks once its label is there", async () => {
        const { calls, label } = standing();
        const holder = new Object3D();
        const avatar = createAvatar("guide", holder);
        avatar.update({ say: "Hello" });
        await settle();
        calls.length = 0;
        holder.position.set(3, 0, 0);
        holder.rotation.y = 1;
        avatar.frame();
        expect(calls).toEqual(["place 3,0,0 1"]);
        label();
        avatar.frame();
        avatar.frame();
        expect(calls.filter((call) => call === "say Hello")).toHaveLength(1);
    });

    test("another avatar takes the first one's place", async () => {
        const { calls } = standing();
        const avatar = createAvatar("guide", new Object3D());
        avatar.update({ avatar: "robot" });
        await settle();
        avatar.update({ avatar: "sunshine" });
        await settle();
        expect(calls.filter((call) => !call.startsWith("motion"))).toEqual([
            'stand robot.vrm as ""',
            "remove",
            'stand sunshine.vrm as ""',
        ]);
    });

    test("one removed while it loads never stands, and takes nothing from the pool", async () => {
        standing();
        let loaded = () => {};
        (loadAvatarFile as jest.Mock).mockImplementationOnce(
            () => new Promise<void>((resolve) => (loaded = resolve))
        );
        const avatar = createAvatar("guide", new Object3D());
        avatar.update({ avatar: "robot" });
        avatar.dispose();
        loaded();
        await settle();
        expect(requestPooledAvatar).not.toHaveBeenCalled();
        expect(standAvatar).not.toHaveBeenCalled();
        expect(() => avatar.frame()).not.toThrow();
    });
});
