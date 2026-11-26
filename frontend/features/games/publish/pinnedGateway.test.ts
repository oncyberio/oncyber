/** @jest-environment node */
import { gatewayGet } from "./pinnedGateway";

// The addresses are refused before any connection is made.
test("only https, without credentials", async () => {
    await expect(
        gatewayGet(new URL("http://gateway.example/ipfs/x/"))
    ).rejects.toThrow("Unsupported URL");
    await expect(
        gatewayGet(new URL("https://a:b@gateway.example/ipfs/x/"))
    ).rejects.toThrow("Unsupported URL");
});

test("a gateway name that resolves to this machine or a private network is refused", async () => {
    await expect(
        gatewayGet(new URL("https://localhost/ipfs/x/"), { timeoutMs: 2000 })
    ).rejects.toMatchObject({ code: "EADDRBLOCKED" });
    for (const host of ["127.0.0.1", "169.254.169.254", "10.0.0.8", "[::1]"])
        await expect(
            gatewayGet(new URL(`https://${host}/ipfs/x/`), { timeoutMs: 2000 })
        ).rejects.toThrow("Address not allowed");
});
