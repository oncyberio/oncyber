import assert from "assert";
import express from "express";
import { createServer } from "http";
import { LocalPresence, Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { initializeExpress } from "../src/express";
import { CyberRoom } from "../src/rooms/cyber";

/** Real HTTP admission and actual CyberRoom metadata; no external moderator calls. */
describe("native cohort HTTP admission", function () {
    this.timeout(20000);
    let server: Server;
    const base = "http://127.0.0.1:2794";
    const cohort = "native-group-abcdefghijklmn";
    class SmallCyberRoom extends CyberRoom {
        onCreate(options: any) { super.onCreate(options); this.maxClients = 2; }
    }
    before(async () => {
        const app = express(); app.use(express.json()); initializeExpress(app);
        server = new Server({ presence: new LocalPresence(), transport: new WebSocketTransport({ server: createServer(app) }) });
        server.define("cyber", SmallCyberRoom);
        await server.listen(2794, "127.0.0.1");
    });
    after(async () => server.gracefullyShutdown(false));
    let next = 0;
    const join = async (extra: any = {}) => {
        const response = await fetch(base + "/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "cohort-test-gallery", currentSpace: "fixture-native-gallery", avatar: "/avatar.png", userId: `test-${++next}`, username: "Test guest", position: { x: 0, y: 0, z: 0 }, ...extra }) });
        return response.json() as Promise<any>;
    };
    it("acknowledges cohort support and reserves exactly one shared native room", async () => {
        const a = await join({ lobbyGroupCohort: cohort }), b = await join({ lobbyGroupCohort: cohort });
        assert.equal(a.success, true); assert.equal(b.success, true);
        assert.equal(a.lobbyGroupCohort, cohort); assert.equal(b.lobbyGroupCohort, cohort);
        assert.equal(a.reservation.room.roomId, b.reservation.room.roomId);
        assert.equal(a.reservation.room.metadata.lobbyGroupCohort, cohort);
        const full = await join({ lobbyGroupCohort: cohort });
        assert.equal(full.success, false); assert.match(full.message, /not been split/);
        const ordinary = await join();
        assert.equal(ordinary.success, true); assert.equal(ordinary.lobbyGroupCohort, undefined);
        assert.notEqual(ordinary.reservation.room.roomId, a.reservation.room.roomId);
        const publicRooms: any = await (await fetch(base + "/getRooms")).json();
        assert(publicRooms.rooms.every((room: any) => !room.metadata?.lobbyGroupCohort));
        const invalid = await join({ lobbyGroupCohort: "../invalid" });
        assert.equal(invalid.success, false); assert.match(invalid.message, /Invalid lobby group cohort/);
    });
});
