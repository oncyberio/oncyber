/** @jest-environment node */
import { api, proc } from "./server";
import { z } from "zod";

jest.mock("@utils/middlewares/authMiddleware", () => ({
    auth: async () => "test-user",
    getToken: () => "test-session-token",
}));
jest.mock("@utils/middlewares/corsMiddleware", () => ({ corsMiddleware: async () => {} }));
jest.mock("./shared", () => ({
    EID: "encoded",
    CHECKSUM_ID: "checksum",
    decodePayload: (value) => value,
    decodeChecksum: async (value) => value,
    encodePayload: (value) => value,
    encodeChecksum: async (value) => value,
}), { virtual: true });

test("RPC logging excludes request IPs, credentials and personal payload fields", async () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => {});
    const timing = jest.spyOn(console, "time").mockImplementation(() => {});
    const timingEnd = jest.spyOn(console, "timeEnd").mockImplementation(() => {});
    try {
        const handler = api({
            authenticate: proc({
                schema: z.object({ token: z.string(), email: z.string() }),
                async handler() { return { success: true }; },
            }),
        }) as any;
        const req = {
            method: "POST",
            headers: { "x-forwarded-for": "203.0.113.7" },
            body: { method: "authenticate", params: [{ token: "test-login-token", email: "person@example.invalid" }] },
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        await handler(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        const recorded = JSON.stringify(info.mock.calls);
        expect(recorded).not.toContain("203.0.113.7");
        expect(recorded).not.toContain("test-login-token");
        expect(recorded).not.toContain("person@example.invalid");
    } finally {
        info.mockRestore();
        timing.mockRestore();
        timingEnd.mockRestore();
    }
});
