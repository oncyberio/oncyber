import { artistQueryKey, matchesArtistNames } from "./artistSearch";
test.each([
    ["@OSF_REKT", "osfrekt"],
    ["Killer Acid", "killeracid"],
    ["Loïs Voirol", "loisvoirol"],
    ["alphacentaurikid", "alphacentaurikid"],
])("normalizes artist query %s", (name, key) =>
    expect(artistQueryKey(name)).toBe(key)
);
test("matches names and word prefixes, preserves non-EVM address casing, and tolerates missing metadata", () => {
    expect(matchesArtistNames(["Jack Butcher"], [], "butch")).toBe(true);
    expect(matchesArtistNames(["Jack Butcher"], [], "ack")).toBe(false);
    expect(matchesArtistNames(["killer_acid"], [], "Killer Acid")).toBe(true);
    expect(matchesArtistNames(undefined, undefined, "missing")).toBe(false);
    expect(matchesArtistNames([], ["AbCd"], "abcd")).toBe(false);
    expect(matchesArtistNames([], ["0xAbCd"], "0xabcd")).toBe(true);
});

test("keeps Unicode letters whole at the artist-name limit", () => {
    const name = "a".repeat(159) + "𐍄";
    expect(artistQueryKey(name + "extra")).toBe(name);
    expect(matchesArtistNames(["𝘓ʯ℞Ḵ𝕄𝟶𐍄ꖾ.art"], [], "lʯkm0𐍄")).toBe(true);
});
