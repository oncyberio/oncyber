import {
    askAccess,
    asksInAddress,
    forgetAccess,
    ownsOrEdits,
    shouldAskAccess,
} from "./access";

const space = { id: "space-1", owner: "0xOwner", editors: ["acc-editor"] };

beforeEach(forgetAccess);

describe("whether to ask the server what a visitor may do with a space's scripts", () => {
    test("the owner and the editors, however their ids are cased", () => {
        expect(ownsOrEdits(space, "0xowner")).toBe(true);
        expect(ownsOrEdits(space, "ACC-EDITOR")).toBe(true);
        expect(ownsOrEdits(space, "acc-visitor")).toBe(false);
        // A space as an old record has it.
        expect(ownsOrEdits({ id: "s", owner: "a" }, "a")).toBe(true);
        expect(ownsOrEdits({ id: "s", editors: "a" as any }, "a")).toBe(false);
        expect(ownsOrEdits({ id: "s", editors: [null, 7] }, "a")).toBe(false);
    });

    test("a visitor who is neither is not asked about", () => {
        expect(shouldAskAccess(space, "acc-visitor")).toBe(false);
        expect(shouldAskAccess(space, "0xowner")).toBe(true);
    });

    test("nobody signed in, or no space, is nothing to ask", () => {
        expect(shouldAskAccess(space, "")).toBe(false);
        expect(shouldAskAccess(space, null)).toBe(false);
        expect(shouldAskAccess(null, "0xowner")).toBe(false);
        expect(shouldAskAccess({ id: "" }, "0xowner", "?scripts=1")).toBe(
            false
        );
    });

    test("the address can ask anyway: a site admin is no editor of the space", () => {
        expect(asksInAddress("?scripts=1")).toBe(true);
        expect(asksInAddress("?other=2&scripts")).toBe(true);
        expect(asksInAddress("?scripts=0")).toBe(false);
        expect(asksInAddress("?scripts=false")).toBe(false);
        expect(asksInAddress("?script=1")).toBe(false);
        expect(asksInAddress("")).toBe(false);
        expect(shouldAskAccess(space, "site-admin", "?scripts=1")).toBe(true);
        // Signed out, the address asks nothing.
        expect(shouldAskAccess(space, "", "?scripts=1")).toBe(false);
    });
});

describe("asking", () => {
    const yes = { canEdit: true, allowed: true, earlyAccess: true };

    test("the server's answer, as the page keeps it", async () => {
        const ask = jest.fn(async () => ({ ...yes, reason: undefined }));
        expect(await askAccess("space-1", "0xowner", ask)).toEqual({
            canEdit: true,
            canAsk: true,
            earlyAccess: true,
            askReason: "",
        });
        expect(ask).toHaveBeenCalledWith({ experienceId: "space-1" });
        const no = jest.fn(async () => ({
            canEdit: true,
            allowed: false,
            earlyAccess: true,
            reason: "That's today's limit. Try again tomorrow.",
        }));
        expect(await askAccess("space-2", "0xowner", no)).toMatchObject({
            canAsk: false,
            askReason: "That's today's limit. Try again tomorrow.",
        });
    });

    test("once per space per page: coming back to a space does not ask again", async () => {
        const ask = jest.fn(async () => yes);
        // Twice at once (two layers mounting), then again later.
        await Promise.all([
            askAccess("space-1", "0xowner", ask),
            askAccess("space-1", "0xOwner", ask),
        ]);
        await askAccess("space-1", "0xowner", ask);
        expect(ask).toHaveBeenCalledTimes(1);
        // Another space, or another account, is another question.
        await askAccess("space-2", "0xowner", ask);
        await askAccess("space-1", "acc-editor", ask);
        expect(ask).toHaveBeenCalledTimes(3);
    });

    test("a question that could not be asked may be asked again", async () => {
        const ask = jest
            .fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValue(yes);
        expect(await askAccess("space-1", "0xowner", ask)).toBeNull();
        expect(await askAccess("space-1", "0xowner", ask)).toMatchObject({
            canEdit: true,
        });
        expect(ask).toHaveBeenCalledTimes(2);
    });
});
