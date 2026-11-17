import { avatarGatewayUrl } from "./avatar";

jest.mock("@utils/middlewares/authMiddleware", () => ({ auth: jest.fn() }));
jest.mock("@utils/firebaseAdmin", () => ({ db: {} }));
jest.mock("@utils/pinataUpload", () => ({
    MAX_IMAGE_SIZE: 1,
    uploadUrlToPinata: jest.fn(),
}));
jest.mock("@utils/firestore/userProfiles", () => ({
    invalidateUserProfile: jest.fn(),
}));

test("only pictures the gateway can resize get a resized address", () => {
    expect(avatarGatewayUrl("cid", "0xabc/1/2", "png")).toBe(
        "https://cyber.mypinata.cloud/ipfs/cid?img-width=256&filename=0xabc/1/2.jpg"
    );
    // The resizer answers 415 for AVIF, which broke the picture everywhere.
    expect(avatarGatewayUrl("cid", "0xabc/1/2", "avif")).toBe(
        "https://cyber.mypinata.cloud/ipfs/cid?filename=0xabc/1/2.avif"
    );
    expect(avatarGatewayUrl("cid", "0xabc/1/2", null)).not.toContain(
        "img-width"
    );
});
