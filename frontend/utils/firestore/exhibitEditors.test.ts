/** @jest-environment node */
import { canEditExhibit, isExhibitOwnerOrEditor } from "./exhibitEditors";

let mockSpace: Record<string, any> | undefined;

jest.mock("../firebaseAdmin", () => ({
    db: {
        collection: () => ({
            doc: () => ({
                get: async () => ({
                    exists: !!mockSpace,
                    data: () => mockSpace,
                }),
            }),
        }),
    },
}));

const space = { owner: "0xOwner", editors: ["0xowner", "0xEditor"] };

test.each([
    ["the owner", "0xowner", true],
    ["an editor, in any casing", "0xeditor", true],
    ["a visitor", "0xvisitor", false],
    ["nobody", undefined, false],
    ["an empty id", "", false],
])("%s", (_name, userId, expected) => {
    expect(isExhibitOwnerOrEditor(space, userId)).toBe(expected);
});

test("an owner who is not listed as an editor is still the owner", () => {
    expect(isExhibitOwnerOrEditor({ owner: "0xa" }, "0xA")).toBe(true);
});

test("a space that does not exist has no editors", async () => {
    mockSpace = undefined;
    await expect(canEditExhibit("missing", "0xowner")).resolves.toBe(false);
    mockSpace = space;
    await expect(canEditExhibit("space-1", "0xowner")).resolves.toBe(true);
    await expect(canEditExhibit("", "0xowner")).resolves.toBe(false);
});
