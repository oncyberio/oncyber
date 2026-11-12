import assert from "assert";
import { clientAddress } from "../src/world/ingress";
import { createWorldServer } from "../src/world/server";
import WebSocket from "ws";

describe("Fly ingress", function () {
    this.timeout(20000);
    it("isolates Fly clients without trusting arbitrary forwarded headers", () => {
        const req = (peer: string, header: any) => ({ socket: { remoteAddress: peer }, headers: { "fly-client-ip": header, "x-forwarded-for": "8.8.8.8" } }) as any;
        assert.equal(clientAddress(req("::ffff:172.19.0.1", "1.2.3.4"), true), "1.2.3.4");
        assert.equal(clientAddress(req("fdaa:0:1::1", "2001:db8::2"), true), "2001:db8::2");
        assert.equal(clientAddress(req("172.19.0.1", "5.6.7.8"), true), "5.6.7.8");
        assert.equal(clientAddress(req("172.19.0.1", "5.6.7.8"), false), "172.19.0.1");
        assert.equal(clientAddress(req("1.2.3.4", "5.6.7.8"), true), "1.2.3.4");
        assert.equal(clientAddress(req("172.19.0.1", ["5.6.7.8", "9.9.9.9"]), true), "172.19.0.1");
        assert.equal(clientAddress(req("172.19.0.1", "bad"), true), "172.19.0.1");
    });
    it("rejects unknown workers and forbidden browser origins; closes ingress on shutdown", async () => {
        const world = await createWorldServer({ port: 2670, wsBase: 2671, workers: 1, capacity: 4, singlePort: true, webtransport: false });
        const sockets: WebSocket[] = [];
        try {
            for (const [path, origin] of [["/lobby-v2/1", "http://localhost:13000"], ["/lobby-v2/0", "https://untrusted.example"], ["/lobby-v2/00", "http://localhost:13000"]]) {
                const ws = new WebSocket(`ws://127.0.0.1:2670${path}`, { origin });
                sockets.push(ws);
                await new Promise<void>((resolve, reject) => { ws.once("open", () => reject(Error("Unexpected upgrade"))); ws.once("error", (error) => { assert.match(error.message, /403/); resolve(); }); });
            }
            const idle = new WebSocket("ws://127.0.0.1:2670/lobby-v2/0");
            sockets.push(idle);
            await new Promise<void>((resolve, reject) => { idle.once("open", resolve); idle.once("error", reject); });
            const closed = new Promise<void>((resolve) => idle.once("close", () => resolve()));
            await world.close();
            await closed;
        } finally { for (const ws of sockets) ws.terminate(); await world.close(); }
    });
});
