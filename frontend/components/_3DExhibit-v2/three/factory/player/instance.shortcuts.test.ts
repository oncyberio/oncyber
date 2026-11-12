/** @jest-environment jsdom */
import InstancePlayer from "./instance";
import root from "../../root";
import { EMOTE_SHORTCUTS_STORAGE_KEY } from "@features/lobby/emoteShortcuts";

jest.mock("@3constants", () => ({}), { virtual: true });
jest.mock("@3utils/previewbaker.js", () => ({}), { virtual: true });
jest.mock("@3emitter", () => ({}), { virtual: true });
jest.mock("@3events", () => ({}), { virtual: true });
jest.mock("@3factory/player", () => ({}), { virtual: true });
jest.mock("@3gltf", () => ({}), { virtual: true });
jest.mock("./constants", () => ({}));
jest.mock("../../utils/three", () => ({}));
jest.mock("./chatbubble/index", () => ({}));
jest.mock("gsap", () => ({}));
jest.mock("../../events/socket", () => ({}));
jest.mock("./capsulegeo.js", () => ({}));
jest.mock("./instanceavatarvrm", () => ({}));
jest.mock("../../root", () => ({
    __esModule: true,
    default: { currentPortals: null },
}));
jest.mock("../../utils/spaceutils", () => ({}));
jest.mock("../artwork/controllers/pseudoaudiocontroller", () => ({}));
jest.mock("../artwork/controllers/players", () => ({}));
jest.mock("../../modules/label", () => ({}));
jest.mock("../../camera", () => ({}));

const defaults = [
    "WAVING",
    "HIPHOP",
    "MOONWALK",
    "TECHNO",
    "SHUFFLING",
    "CHAABI",
    "CHAABI2",
    "SEXY",
    "DEATH",
];
const save = (names: string[]) => {
    const newValue = JSON.stringify(names);
    localStorage.setItem(EMOTE_SHORTCUTS_STORAGE_KEY, newValue);
    window.dispatchEvent(
        new StorageEvent("storage", {
            key: EMOTE_SHORTCUTS_STORAGE_KEY,
            newValue,
            storageArea: localStorage,
        })
    );
};
function player() {
    const value = Object.create(InstancePlayer.prototype);
    value.playEmote = jest.fn();
    value.getUp = jest.fn();
    value.deactivated = false;
    return value;
}
beforeEach(() => {
    localStorage.removeItem(EMOTE_SHORTCUTS_STORAGE_KEY);
    root.currentPortals = null;
});
afterEach(() => localStorage.removeItem(EMOTE_SHORTCUTS_STORAGE_KEY));

test("native number keys use current shortcut assignments while preserving native clip indexes", () => {
    const visitor = player();
    visitor.keyBoard({ code: "Digit1" });
    expect(visitor.playEmote).toHaveBeenLastCalledWith(0);
    const names = [...defaults];
    names[0] = "FLOORSITTING";
    names[8] = "PRAYING";
    save(names);
    visitor.keyBoard({ code: "Digit1" });
    expect(visitor.playEmote).toHaveBeenLastCalledWith(13);
    visitor.keyBoard({ code: "Digit9" });
    expect(visitor.playEmote).toHaveBeenLastCalledWith(9);
    names[0] = "WANNAROCK";
    save(names);
    visitor.keyBoard({ code: "Digit1" });
    expect(visitor.playEmote).toHaveBeenLastCalledWith(10);
});

test("native legacy modifier shortcuts, floor sitting and zero-to-stop remain intact", () => {
    const visitor = player();
    save(["FLOORSITTING", ...defaults.slice(1)]);
    visitor.keyBoard({ code: "Digit1", ctrlKey: true });
    expect(visitor.playEmote).toHaveBeenLastCalledWith(9);
    visitor.keyBoard({ code: "Digit3", metaKey: true });
    expect(visitor.playEmote).toHaveBeenLastCalledWith(11);
    visitor.keyBoard({ code: "KeyL" });
    expect(visitor.playEmote).toHaveBeenLastCalledWith(13);
    visitor.keyBoard({ code: "Digit0" });
    expect(visitor.playEmote).toHaveBeenLastCalledWith(-1);
    visitor.playEmote.mockClear();
    visitor.keyBoard({ code: "Digit4", ctrlKey: true });
    expect(visitor.playEmote).not.toHaveBeenCalled();
});

test("native shortcut lookup cannot play while movement is locked or in an elevator", () => {
    const visitor = player();
    visitor.deactivated = true;
    visitor.keyBoard({ code: "Digit1" });
    expect(visitor.playEmote).not.toHaveBeenCalled();
    visitor.deactivated = false;
    root.currentPortals = { currentPortal: { isElevator: true } };
    visitor.keyBoard({ code: "Digit1" });
    expect(visitor.playEmote).not.toHaveBeenCalled();
});

test.each(["defaultPrevented", "isComposing", "repeat", "altKey"])(
    "native shortcuts ignore %s events",
    (flag) => {
        const visitor = player();
        visitor.keyBoard({ code: "Digit1", [flag]: true });
        expect(visitor.playEmote).not.toHaveBeenCalled();
    }
);

test.each(["input", "textarea", "button", "dialog", "contenteditable"])(
    "native shortcuts leave %s interaction alone",
    (kind) => {
        const visitor = player();
        const target = document.createElement(
            kind === "dialog" || kind === "contenteditable" ? "div" : kind
        );
        if (kind === "dialog") target.setAttribute("role", "dialog");
        if (kind === "contenteditable")
            target.setAttribute("contenteditable", "plaintext-only");
        visitor.keyBoard({ code: "Digit1", target });
        expect(visitor.playEmote).not.toHaveBeenCalled();
    }
);


test("late emote packets are harmless without an avatar and still play once ready", () => {
    const visitor = Object.create(InstancePlayer.prototype);
    visitor.avatar3D = null;
    expect(() => visitor.playEmote(3)).not.toThrow();
    const playEmote = jest.fn().mockReturnValue("playing");
    visitor.avatar3D = { playEmote };
    expect(visitor.playEmote(3)).toBe("playing");
    expect(playEmote).toHaveBeenCalledWith(3);
    visitor.wasDisposed = true;
    visitor.playEmote(4);
    expect(playEmote).toHaveBeenCalledTimes(1);
    visitor.avatar3D = null;
    expect(() => visitor.playEmote(-1)).not.toThrow();
});
