/** @jest-environment node */
import { updateAssetMedia } from "./uploadAssetMedia";
import { updateExhibit } from "../../exhibit";
import { push } from "firebase/database";

jest.mock("../../exhibit", () => ({ updateExhibit: jest.fn() }));
jest.mock("@utils/saveToDb", () => ({
    updateAsset: (assetId, update) => ({ assetId, update }),
}));
jest.mock("@utils/firebase", () => ({ database: {} }));
jest.mock("@utils/firebaseAdmin", () => ({ db: {} }));
jest.mock("firebase/database", () => ({ push: jest.fn(), ref: jest.fn() }));

const update = updateExhibit as jest.Mock;
const space = (extra = {}) => ({
    owner: "0xowner",
    editors: ["0xowner", "0xeditor"],
    artworks: { "art-1": { data: {} } },
    ...extra,
});
const media = {
    type: "Uploadable",
    mime_type: "image/png",
    urlField: "image_url",
    url: "https://ipfs.example/compressed.png",
} as any;

// Runs the procedure's precondition against `exhibit`, as updateExhibit
// would inside its transaction, and reports what it decided.
async function decide(userId: string, exhibit: any) {
    let decision;
    update.mockImplementation(async (_id, _payload, _user, precondition) => {
        decision = precondition(exhibit);
        return decision;
    });
    await updateAssetMedia(
        userId,
        "space-1",
        "art-1",
        "0xcontract",
        "1",
        media,
        null
    ).catch(() => undefined);
    return decision;
}

beforeEach(() => jest.clearAllMocks());

test("a visitor cannot write an artwork's optimised media", async () => {
    await expect(decide("0xvisitor", space())).resolves.toEqual({
        success: false,
        error: "Get out of here",
    });
    expect(push).not.toHaveBeenCalled();
});

test.each([
    ["the owner", "0xowner", space()],
    ["an editor", "0xEditor", space()],
    [
        "a visitor where visitors may add content",
        "0xvisitor",
        space({ params: { editionAllowed: true } }),
    ],
])("%s can", async (_name, userId, exhibit) => {
    await expect(decide(userId, exhibit)).resolves.toEqual({
        success: true,
    });
});
