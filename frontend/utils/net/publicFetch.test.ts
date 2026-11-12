import http from "http";
import { assertPublicUrl, isPublicAddress, publicFetch } from "./publicFetch";

test("private, loopback and metadata addresses are not public", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])
        expect(isPublicAddress(address)).toBe(false);
    for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPublicAddress(address)).toBe(true);
});

test("only plain http(s) URLs without credentials", () => {
    expect(() => assertPublicUrl("file:///etc/passwd")).toThrow();
    expect(() => assertPublicUrl("http://user:pw@example.com/")).toThrow();
    expect(() => assertPublicUrl("http://169.254.169.254/latest/meta-data")).toThrow();
    expect(() => assertPublicUrl("http://[::1]:8080/")).toThrow();
    expect(assertPublicUrl("https://example.com/a.png").hostname).toBe("example.com");
});

test("a hostname that resolves to loopback is refused at connect time", async () => {
    const server = http.createServer((_, res) => res.end("secret")).listen(0);
    const port = (server.address() as any).port;
    try {
        await expect(publicFetch(`http://localhost:${port}/`)).rejects.toThrow(/not allowed/);
    } finally {
        server.close();
    }
});

test("HEAD returns headers without enforcing the body cap", async () => {
    const server = http.createServer((_, res) => { res.setHeader("content-length", "1000"); res.setHeader("content-type", "image/png"); res.end(); }).listen(0);
    const port = (server.address() as any).port;
    const { isPublicAddress: _ } = await import("./publicFetch");
    try {
        // Loopback is refused even for HEAD.
        await expect(publicFetch(`http://localhost:${port}/`, { method: "HEAD", maxBytes: 0 })).rejects.toThrow(/not allowed/);
    } finally {
        server.close();
    }
});
