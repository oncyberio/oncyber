import {
    decodeRecipe,
    encodeRecipe,
    isToonAvatarCode,
    TOON_AVATAR_CODE_MAX_LENGTH,
    TOON_AVATAR_PREFIX,
} from "./codec";
import { TOON_AVATAR_PRESETS } from "./presets";
import { randomRecipe } from "./random";
import {
    defaultRecipe,
    normalizeHex,
    normalizeRecipe,
    recipesEqual,
    setRecipeField,
    TOON_AVATAR_FIELDS,
} from "./recipe";
import {
    isToonAvatarUrl,
    toonAvatarCode,
    toonAvatarUrl,
    toonRecipeFromUrl,
} from "./url";

describe("toon avatar recipe", () => {
    it("fills, clamps and repairs whatever it is given", () => {
        const recipe = normalizeRecipe({
            body: { height: 7, head: "big", extra: 1 },
            hair: { style: "wig", color: "#ABC" },
            nonsense: true,
        });
        expect(recipe.body.height).toBe(1);
        expect(recipe.body.head).toBe(defaultRecipe().body.head);
        expect(recipe.hair.style).toBe(defaultRecipe().hair.style);
        expect(recipe.hair.color).toBe("#aabbcc");
        expect((recipe.body as Record<string, unknown>).extra).toBeUndefined();
        expect((recipe as Record<string, unknown>).nonsense).toBeUndefined();
        for (const input of [null, 5, "x", []])
            expect(recipesEqual(normalizeRecipe(input), defaultRecipe())).toBe(
                true
            );
    });

    it("reads hex colours in the forms people type", () => {
        expect(normalizeHex("FFF")).toBe("#ffffff");
        expect(normalizeHex(" #12aBcd ")).toBe("#12abcd");
        expect(normalizeHex("#12345")).toBeNull();
        expect(normalizeHex(12)).toBeNull();
    });

    it("changes one field without touching the original", () => {
        const before = defaultRecipe();
        const after = setRecipeField(before, "outfit", "top", "hoodie");
        expect(after.outfit.top).toBe("hoodie");
        expect(before.outfit.top).not.toBe("hoodie");
        expect(setRecipeField(before, "outfit", "top", "cape").outfit.top).toBe(
            before.outfit.top
        );
    });
});

describe("toon avatar code", () => {
    it("round-trips every preset and many random avatars exactly", () => {
        const recipes = [
            ...TOON_AVATAR_PRESETS.map((preset) => preset.recipe),
            ...Array.from({ length: 200 }, (_, seed) => randomRecipe(seed)),
        ];
        for (const recipe of recipes) {
            const code = encodeRecipe(recipe);
            expect(isToonAvatarCode(code)).toBe(true);
            expect(code).toMatch(/^toon1\.[A-Za-z0-9_-]+$/);
            expect(code.length).toBeLessThan(TOON_AVATAR_CODE_MAX_LENGTH / 2);
            expect(decodeRecipe(code)).toEqual(recipe);
        }
    });

    it("reads a code written before newer fields existed", () => {
        const code = encodeRecipe(randomRecipe(7));
        const older = decodeRecipe(code.slice(0, code.length - 12));
        expect(older).not.toBeNull();
        // The fields it does carry survive; the rest take their defaults.
        expect(older.body).toEqual(randomRecipe(7).body);
        const last = TOON_AVATAR_FIELDS[TOON_AVATAR_FIELDS.length - 1];
        expect(older[last.group][last.key]).toBe(
            defaultRecipe()[last.group][last.key]
        );
    });

    it("refuses what isn't a code", () => {
        for (const bad of [
            "",
            null,
            "toon2.AAAA",
            TOON_AVATAR_PREFIX + "not base64!",
            TOON_AVATAR_PREFIX + "A".repeat(TOON_AVATAR_CODE_MAX_LENGTH),
        ])
            expect(decodeRecipe(bad)).toBeNull();
        // Out-of-range choice bytes fall back instead of failing.
        expect(
            decodeRecipe(TOON_AVATAR_PREFIX + "_".repeat(40))
        ).not.toBeNull();
    });

    it("gives the same stranger for the same seed, and can reroll one part", () => {
        expect(randomRecipe(42)).toEqual(randomRecipe(42));
        expect(randomRecipe(42)).not.toEqual(randomRecipe(43));
        const base = defaultRecipe();
        const rerolled = randomRecipe(9, base, ["hair"]);
        expect(rerolled.body).toEqual(base.body);
        expect(rerolled.outfit).toEqual(base.outfit);
        expect(rerolled.hair).not.toEqual(base.hair);
    });
});

describe("toon avatar address", () => {
    const code = encodeRecipe(randomRecipe(3));

    it("is a site path that the lobby's avatar URL checks accept", () => {
        const url = toonAvatarUrl(code);
        expect(url).toBe(`/studio/avatar?a=${code}`);
        // multiplayer/src/rooms/crowd/protocol.ts and LobbyConnection.avatarUrl
        expect(url).toMatch(/^(https?:\/\/|\/)/);
        expect(url.length).toBeLessThan(2048);
        expect(toonAvatarUrl(randomRecipe(3))).toBe(url);
    });

    it("is recognised site-relative or absolute, and nowhere else", () => {
        expect(toonAvatarCode(toonAvatarUrl(code))).toBe(code);
        expect(
            toonAvatarCode(`https://oncyber.io/studio/avatar?a=${code}&x=1`)
        ).toBe(code);
        expect(toonRecipeFromUrl(toonAvatarUrl(code))).toEqual(randomRecipe(3));
        for (const other of [
            `/studio/other?a=${code}`,
            "/studio/avatar",
            "/studio/avatar?a=toon1.!!",
            "https://cyber.mypinata.cloud/ipfs/x?filename=a.vrm",
            "square",
            undefined,
            42,
        ])
            expect(isToonAvatarUrl(other)).toBe(false);
    });
});
