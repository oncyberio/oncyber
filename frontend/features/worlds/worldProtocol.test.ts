import fs from "fs";
import path from "path";
import {
    PAGE_TO_WORLD,
    RELAYED_FAMILIES,
    WORLD_TO_PAGE,
    knownWorldKind,
} from "./worldProtocol";

const read = (file: string) =>
    fs.readFileSync(path.join(__dirname, file), "utf8");
const found = (source: string, pattern: RegExp) =>
    [...source.matchAll(pattern)].map((match) => match[1]);

test("the page's bridge reads no kind that is not on the list", () => {
    const bridge = read("WorldFrameView.tsx");
    const read_ = [
        ...found(bridge, /kind === "([a-z-]+)"/g),
        ...found(bridge, /kind !== "([a-z-]+)"/g),
    ];
    expect(read_.length).toBeGreaterThan(8);
    for (const kind of read_)
        expect([kind, knownWorldKind(kind)]).toEqual([kind, true]);
    // and each family it routes is one of the four
    for (const family of found(bridge, /startsWith\("([a-z]+-)"\)/g))
        expect(Object.keys(RELAYED_FAMILIES)).toContain(family);
});

test("neither side sends a kind that is not on the list", () => {
    const sent = [
        ...found(read("worldDocument.ts"), /post\(\s*"([a-z-]+)"/g),
        ...found(read("worldLinks.ts"), /post\(\s*"([a-z-]+)"/g),
        ...found(read("WorldFrameView.tsx"), /post\(\s*"([a-z-]+)"/g),
        ...found(
            read("WorldFrameView.tsx"),
            /GAME_MESSAGE_PREFIX\}([a-z-]+)`/g
        ),
    ];
    expect(sent.length).toBeGreaterThan(8);
    for (const kind of sent)
        expect([kind, knownWorldKind(kind)]).toEqual([kind, true]);
});

test("a kind belongs to one direction", () => {
    for (const kind of Object.keys(WORLD_TO_PAGE))
        expect(PAGE_TO_WORLD).not.toHaveProperty(kind);
    expect(knownWorldKind("room-join")).toBe(true);
    expect(knownWorldKind("teleport")).toBe(false);
});
