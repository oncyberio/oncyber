/** @jest-environment jsdom */
import { updateAvatar } from "@utils/saveToDb";
import { formatAvatar } from "./avatar";

jest.mock("@utils/saveToDb", () => ({ updateAvatar: jest.fn() }));
jest.mock("@utils/urlUtils", () => ({
    cloudinary: {
        isBrokenCloudinaryUrl: () => false,
        isCloudinaryUrl: (url: string) =>
            url.startsWith("https://res.cloudinary.com/"),
    },
}));
jest.mock("../three/factory/player/constants", () => ({
    DEFAULT_PLAYER_AVATAR_PICTURE: "https://fallback.example/avatar.png",
    UPDATE_AVATAR: "UPDATE_AVATAR",
}));

const NativeImage = globalThis.Image;
const managed = "https://cyber.mypinata.cloud/ipfs/avatar-cid";
const user = { walletId: "0xABCD", avatarTokenId: "123" };
let images: string[];
let dispatch: jest.Mock;

beforeEach(() => {
    images = [];
    dispatch = jest.fn();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    (updateAvatar as jest.Mock).mockResolvedValue({
        success: true,
        url: managed,
    });
    Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: class {
            onload?: () => void;
            onerror?: () => void;
            set src(url: string) {
                images.push(url);
                // Browser image events arrive after listeners have been assigned.
                void Promise.resolve().then(() => {
                    if (url.includes("unavailable")) this.onerror?.();
                    else this.onload?.();
                });
            }
        },
    });
});

afterEach(() => {
    Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: NativeImage,
    });
    jest.clearAllMocks();
    jest.restoreAllMocks();
});

test("repeat visits reuse a managed profile image, resize it, and still validate it", async () => {
    const avatar = `${managed}?filename=profile.png`;
    const expected = `${managed}?img-width=256&filename=profile.png`;
    await expect(formatAvatar({ ...user, avatar }, dispatch)).resolves.toBe(
        expected
    );
    await expect(formatAvatar({ ...user, avatar }, dispatch)).resolves.toBe(
        expected
    );
    expect(updateAvatar).not.toHaveBeenCalled();
    expect(images).toEqual([expected, expected]);
    expect(dispatch).toHaveBeenLastCalledWith({
        type: "UPDATE_AVATAR",
        payload: expected,
    });
});

test("managed images retain an existing resize parameter", async () => {
    const avatar = `${managed}?img-width=128&filename=profile.png`;
    await expect(formatAvatar({ ...user, avatar }, dispatch)).resolves.toBe(
        avatar
    );
    expect(updateAvatar).not.toHaveBeenCalled();
    expect(images).toEqual([avatar]);
});

test("managed host recognition follows URL hostname casing", async () => {
    await expect(
        formatAvatar(
            { ...user, avatar: "https://CYBER.MYPINATA.CLOUD/ipfs/avatar-cid" },
            dispatch
        )
    ).resolves.toBe(`${managed}?img-width=256&`);
    expect(updateAvatar).not.toHaveBeenCalled();
});

test.each([
    "https://external.example/avatar.png",
    "https://cyber.mypinata.cloud.evil.example/ipfs/avatar-cid",
    "https://cyber.mypinata.cloud@external.example/ipfs/avatar-cid",
    "http://cyber.mypinata.cloud/ipfs/avatar-cid",
    "https://cyber.mypinata.cloud/not-ipfs/avatar-cid",
])(
    "profile images outside the managed gateway still migrate: %s",
    async (avatar) => {
        await expect(formatAvatar({ ...user, avatar }, dispatch)).resolves.toBe(
            `${managed}?img-width=256&`
        );
        expect(updateAvatar).toHaveBeenCalledTimes(1);
        expect(updateAvatar).toHaveBeenCalledWith(avatar, "0xabcd", "123");
        expect(images).toEqual([managed, `${managed}?img-width=256&`]);
        expect(dispatch).toHaveBeenLastCalledWith({
            type: "UPDATE_AVATAR",
            payload: `${managed}?img-width=256&`,
        });
    }
);

test("an unavailable managed image still falls back without uploading it", async () => {
    await expect(
        formatAvatar({ ...user, avatar: `${managed}-unavailable` }, dispatch)
    ).resolves.toBe("https://fallback.example/avatar.png");
    expect(updateAvatar).not.toHaveBeenCalled();
    expect(images).toHaveLength(1);
    expect(dispatch).toHaveBeenCalledWith({
        type: "UPDATE_AVATAR",
        payload: "https://fallback.example/avatar.png",
    });
});

test("existing Cloudinary images retain their transform and validation", async () => {
    const avatar =
        "https://res.cloudinary.com/example/image/upload/v1/avatar.png";
    const expected =
        "https://res.cloudinary.com/example/image/upload/c_limit,fl_keep_dar,h_256,w_256,c_fit,c_fill/avatar.jpg";
    await expect(formatAvatar({ ...user, avatar }, dispatch)).resolves.toBe(
        expected
    );
    expect(updateAvatar).not.toHaveBeenCalled();
    expect(images).toEqual([expected]);
});
