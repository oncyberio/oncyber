/** @jest-environment node */
import { writesProtectedExhibitField } from "./exhibitWrites";

test.each([
    [
        "a path update to the owner",
        { FIRESTORE_UPDATE_Field: true, update: { owner: "0xm" } },
        true,
    ],
    [
        "a path update to the visit count",
        { FIRESTORE_UPDATE_Field: true, update: { number_of_visits: 9 } },
        true,
    ],
    ["a whole-document owner", { owner: "0xm", info: {} }, true],
    ["a dotted path into the owner", { "owner.id": "0xm" }, true],
    [
        "a path update to the space's info",
        { FIRESTORE_UPDATE_Field: true, update: { info: { headline: "Hi" } } },
        false,
    ],
    [
        "an artwork's own owner field",
        {
            FIRESTORE_UPDATE_ASSET: true,
            assetId: "a",
            update: { owner: "0xm" },
        },
        false,
    ],
    ["nothing", undefined, false],
])("%s", (_name, payload, expected) => {
    expect(writesProtectedExhibitField(payload)).toBe(expected);
});
