import {
    hasWorldPassword,
    publicGating,
    stripExhibitSecrets,
    stripExhibitSecretsDeep,
    stripSecretsFromJson,
    UNMIGRATED_REV,
    worldPasswordChanged,
    worldPasswordRevision,
} from "./publicGating";

const PLAIN = "plain-value-never-sent";

const legacy = { password: { password: PLAIN, message: "Ask Bob" } };
const hashed = { password: { message: "Ask Bob", rev: "rev-1" } };
const messageOnly = { password: { message: "Ask Bob" } };

test.each([
    ["no gating", undefined, false, null],
    ["gating without a password", { noAnonymous: true }, false, null],
    ["a message without a password", messageOnly, false, null],
    ["an empty plain password", { password: { password: "" } }, false, null],
    ["an old document's plain password", legacy, true, null],
    ["a stripped old document", publicGating(legacy), true, null],
    ["a hashed password", hashed, true, "rev-1"],
])("%s", (_, gating: any, required, rev) => {
    expect(hasWorldPassword(gating)).toBe(required);
    expect(worldPasswordRevision(gating)).toBe(rev);
});

test.each([
    ["the same revision", hashed, hashed, false],
    ["a new revision", hashed, { password: { rev: "rev-2" } }, true],
    // Hashing an old document's password is not a password change.
    ["an old document, then hashed", publicGating(legacy), hashed, false],
    ["a password added", { noAnonymous: true }, hashed, true],
    ["a password removed", hashed, messageOnly, false],
])("password change between %s", (_, before: any, after: any, changed) => {
    expect(worldPasswordChanged(before, after)).toBe(changed);
});

test("public gating keeps the prompt and drops the password", () => {
    expect(publicGating({ noAnonymous: true, ...legacy })).toEqual({
        noAnonymous: true,
        password: { message: "Ask Bob", rev: UNMIGRATED_REV },
    });
    const extra = { password: { ...hashed.password, hash: "scrypt$..." } };
    expect(publicGating(extra)).toEqual(hashed);
    // Already public: the same object, not a copy.
    expect(publicGating(hashed)).toBe(hashed);
    const exhibit = { id: "a", gating: hashed };
    expect(stripExhibitSecrets(exhibit)).toBe(exhibit);
    expect(stripExhibitSecrets(null)).toBe(null);
});

test("no API payload shape carries the password", () => {
    const exhibit = (id: string) => ({
        id,
        info: { headline: "World" },
        artworks: { a: { gating: "not a gate" } },
        gating: legacy,
    });
    const bodies = [
        { success: true, exhibit: exhibit("a") },
        { success: true, exhibits: [exhibit("a"), exhibit("b")] },
        { success: true, user: { id: "u" }, exhibit: exhibit("c") },
        { success: true, value: { ...exhibit("d"), kitbash: {} } },
        [exhibit("e")],
    ];
    for (const body of bodies) {
        const stripped = stripExhibitSecretsDeep(body);
        expect(JSON.stringify(stripped)).not.toContain(PLAIN);
        // The input is not changed in place.
        expect(JSON.stringify(body)).toContain(PLAIN);
    }
    const untouched = {
        success: true,
        exhibits: [{ id: "x", gating: hashed }],
    };
    expect(stripExhibitSecretsDeep(untouched)).toBe(untouched);
});

test("a route's res.json strips before sending", () => {
    const sent = [];
    const res = { json: (body) => (sent.push(body), res) };
    stripSecretsFromJson(res).json({ exhibit: { gating: legacy } });
    expect(JSON.stringify(sent)).not.toContain(PLAIN);
    expect(sent[0].exhibit.gating.password).toEqual({
        message: "Ask Bob",
        rev: UNMIGRATED_REV,
    });
});
