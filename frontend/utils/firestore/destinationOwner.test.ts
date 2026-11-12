/** @jest-environment node */
import { isDestinationOwner } from "./destinationOwner";

test.each([
    ["the owner", { userId: "0xowner" }, "0xowner", true],
    [
        "an older document's author",
        { author: { userId: "0xowner" } },
        "0xowner",
        true,
    ],
    ["someone else", { userId: "0xowner" }, "0xmallory", false],
    [
        "an author who is not the owner",
        { userId: "0xowner", author: { userId: "0xmallory" } },
        "0xmallory",
        false,
    ],
    ["no session", { userId: "0xowner" }, undefined, false],
    ["a destination with no owner", {}, "0xmallory", false],
    ["no destination", null, "0xowner", false],
])("%s", (_name, destination, userId, expected) => {
    expect(isDestinationOwner(destination as any, userId)).toBe(expected);
});
