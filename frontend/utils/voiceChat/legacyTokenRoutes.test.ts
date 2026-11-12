jest.mock("@utils/rpc/server", () => ({
    api: (procedures) => procedures,
    NoApi: jest.fn(),
}));
jest.mock("../../pages/api/_v2/voiceChat/range", () => ({
    setRange: jest.fn(),
}));

import legacyHandler from "../../pages/api/voiceChat/auth";
import voiceService from "../../pages/api/_v2/voiceChat";

describe("retired Agora token endpoints", () => {
    it("refuses token issuance without returning credentials", async () => {
        const response = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        await legacyHandler(
            { query: { host: true, channel: "another-space", uid: "visitor" } },
            response
        );

        expect(response.status).toHaveBeenCalledWith(410);
        expect(response.json).toHaveBeenCalledWith({
            success: false,
            error: "Legacy voice token endpoint is no longer available",
        });
    });

    it("does not expose a token-minting RPC while keeping range controls", () => {
        expect(Object.prototype.hasOwnProperty.call(voiceService, "authenticate")).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(voiceService, "setRange")).toBe(true);
    });
});
