import {
    GAME_STORAGE_MAX,
    readGameStorage,
    writeGameStorage,
} from "./gameStorage";
import { findGame, gamesPreviewEnabled } from "./catalog";

function memory() {
    const values = new Map<string, string>();
    return {
        values,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, value),
    };
}

test("keeps declared keys per game and hands them back", () => {
    const storage = memory();
    expect(writeGameStorage("garden", "save", '{"a":1}', storage)).toBe(true);
    expect(writeGameStorage("garden", "muted", "1", storage)).toBe(true);
    expect(readGameStorage("garden", storage)).toEqual({
        save: '{"a":1}',
        muted: "1",
    });
    expect(readGameStorage("other", storage)).toEqual({});
});

test("refuses unknown keys, non-strings and oversized values", () => {
    const storage = memory();
    expect(writeGameStorage("garden", "token", "x", storage)).toBe(false);
    expect(writeGameStorage("garden", "save", { a: 1 }, storage)).toBe(false);
    expect(
        writeGameStorage(
            "garden",
            "save",
            "x".repeat(GAME_STORAGE_MAX + 1),
            storage
        )
    ).toBe(false);
    expect(storage.values.size).toBe(0);
});

test("survives blocked storage", () => {
    const blocked = {
        getItem: () => {
            throw new Error("blocked");
        },
        setItem: () => {
            throw new Error("blocked");
        },
    };
    expect(readGameStorage("garden", blocked)).toEqual({});
    expect(writeGameStorage("garden", "save", "{}", blocked)).toBe(false);
});

test("finds only catalogued games and hides them in production", () => {
    expect(findGame("garden")?.title).toBe("Bloom Garden");
    expect(findGame("constructor")).toBeNull();
    expect(findGame(undefined)).toBeNull();
    expect(gamesPreviewEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(
        gamesPreviewEnabled({ NODE_ENV: "production", GAMES_PREVIEW: "1" })
    ).toBe(true);
    expect(gamesPreviewEnabled({ NODE_ENV: "development" })).toBe(true);
});
