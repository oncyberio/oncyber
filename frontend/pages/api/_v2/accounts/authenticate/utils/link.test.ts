/** @jest-environment node */
import { db } from "@utils/firebaseAdmin";
import { invalidateUserProfile } from "@utils/firestore/userProfiles";
import { forceMergeAccount } from "./link";

jest.mock("@utils/accountIdentity", () => ({
    prepareSocialIdentityMerge: jest.fn(),
}));
jest.mock(
    "@api/accounts/user/utils",
    () => ({ getUserByDoc: jest.fn(), getUserMergeMetadataByDoc: jest.fn() }),
    { virtual: true }
);
jest.mock("@utils/firebaseAdmin", () => ({
    db: { runTransaction: jest.fn(), collection: jest.fn() },
    fire: {},
}));
jest.mock("@utils/firestore/destinations", () => ({
    transferDestinations: jest.fn(),
}));
jest.mock("@utils/firestore/userProfiles", () => ({
    getUserProfileByWalletId: jest.fn(),
    invalidateUserProfile: jest.fn(),
}));

const merge = (signedInAccountId?: string) =>
    forceMergeAccount({
        sourceMetadata: {},
        sourceAccountId: "0xSecond",
        destinationAccountId: "0xfirst",
        signedInAccountId,
        source: "current",
        token: "session-token",
    });

beforeEach(() => jest.clearAllMocks());

test.each([
    ["another account", "0xmallory"],
    ["the account being merged in", "0xSecond"],
    ["nobody", undefined],
])(
    "nothing is read or written when the caller is signed in as %s",
    async (_name, signedInAccountId) => {
        await expect(merge(signedInAccountId)).rejects.toThrow(
            "Sign in to the account you are merging into."
        );
        expect(db.runTransaction).not.toHaveBeenCalled();
        expect(db.collection).not.toHaveBeenCalled();
        expect(invalidateUserProfile).not.toHaveBeenCalled();
    }
);

test("the owner of the destination account reaches the merge", async () => {
    (db.runTransaction as jest.Mock).mockResolvedValue({ success: true });
    await expect(merge("0xFirst")).resolves.toEqual({ success: true });
    expect(db.runTransaction).toHaveBeenCalledTimes(1);
});
