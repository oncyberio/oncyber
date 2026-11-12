// The repository targets older Node declarations; these are Node 22 test APIs.
const { ReadableStream, WritableStream } = require("node:stream/web");
import { LobbyConnection } from "./LobbyConnection";
import * as endpoints from "./lobbyEndpoints";
import {
    encodeControl,
    decodeMovement,
} from "../../../multiplayer/protocol/lobby-v2.js";

jest.mock("colyseus.js", () => ({ Client: jest.fn() }));

/** Exercises the real LobbyConnection -> WorldLobbyTransport -> stream path.
 * Unit tests that replace WorldLobbyTransport.connect cannot detect a broken
 * lobby-ready handshake, chat adapter binding, or reliable write sequencing. */
test.each([false, true])(
    "real WebTransport carries ready, movement, ack and chat (input=%s)",
    async (inputMode) => {
        const {
            decodeInputs,
            state,
            step,
        } = require("../../../multiplayer/protocol/movement");
        let authority = state({ x: 2 }),
            sequence = 0;
        let receive: any;
        const controls: Array<{ type: string; data: any }> = [];
        const datagrams: any[] = [];
        const close = jest.fn();
        class Session {
            ready = Promise.resolve();
            closed = new Promise(() => {});
            reliability = "supports-unreliable";
            close = close;
            control = new ReadableStream({
                start(controller) {
                    receive = controller;
                    controller.enqueue(
                        encodeControl("session-accepted", { sessionId: "42" })
                    );
                },
            });
            datagrams = {
                maxDatagramSize: 1200,
                readable: new ReadableStream(),
                writable: new WritableStream({
                    write(bytes) {
                        if (inputMode) {
                            const inputs = decodeInputs(bytes);
                            expect(inputs).not.toBeNull();
                            for (const i of inputs)
                                if (i.sequence > sequence) {
                                    step(authority, i);
                                    sequence = i.sequence;
                                }
                            datagrams.push({
                                sequence,
                                x: authority.x,
                                z: authority.z,
                            });
                            receive.enqueue(
                                encodeControl("lobby-ack", {
                                    seq: sequence,
                                    state: { ...authority },
                                })
                            );
                        } else {
                            const move = decodeMovement(bytes);
                            datagrams.push(move);
                            receive.enqueue(
                                encodeControl("lobby-ack", {
                                    seq: move.sequence,
                                    position: [
                                        move.x,
                                        move.y,
                                        move.z,
                                        move.yaw,
                                    ],
                                })
                            );
                        }
                    },
                }),
            };
            async createBidirectionalStream() {
                return {
                    readable: this.control,
                    writable: new WritableStream({
                        write(bytes) {
                            const message = JSON.parse(
                                new TextDecoder().decode(bytes)
                            );
                            controls.push(message);
                            if (message.type === "lobby-ready")
                                receive.enqueue(
                                    encodeControl("lobby-welcome", {
                                        lobbyProtocol: 2,
                                        flash: true,
                                        movement: inputMode
                                            ? "input-v1"
                                            : "pose-v1",
                                        epoch: 1,
                                        roomId: "world",
                                        region: "local",
                                        position: [2, 0, 0, 0],
                                    })
                                );
                            if (message.type === "lobby-ping")
                                receive.enqueue(
                                    encodeControl("lobby-pong", {
                                        ...message.data,
                                        serverTime: Date.now(),
                                    })
                                );
                            if (message.type === "chat-channel")
                                receive.enqueue(
                                    encodeControl("chat-channel", {
                                        from: "42",
                                        server_ts: Date.now(),
                                        data: message.data,
                                    })
                                );
                        },
                    }),
                };
            }
        }
        (globalThis as any).WebTransport = Session;
        jest.spyOn(endpoints, "selectLobbyEndpoint").mockResolvedValue({
            id: "local",
            httpUrl: "http://127.0.0.1:2575",
            wsUrl: "ws://127.0.0.1:2576",
            protocol: 2,
        });
        globalThis.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                lobbyProtocol: 2,
                token: "test-ticket",
                sessionId: "42",
                roomId: "world",
                region: "local",
                wsUrl: "ws://127.0.0.1:2576",
                webTransportUrl: "https://localhost:4480/lobby-v2",
            }),
        });
        const connection = new LobbyConnection(
            { username: "Stream client" },
            jest.fn()
        );
        try {
            await connection.connect();
            expect(connection.snapshot.status).toBe("connected");
            expect(controls[0]).toEqual({
                type: "lobby-ready",
                data: { movement: "input-v1", motion: "velocity-v1" },
            });
            expect(connection.getNetworkDiagnostics()).toMatchObject({
                transport: "webtransport",
                connectionPhase: "connected",
            });
            const flash = {
                id: "one",
                title: "Art",
                imageUrl: "/art.png",
                nonce: "stream",
                startedAt: 10,
            };
            expect(connection.setFlash(flash)).toBe(true);
            for (let i = 0; i < 30; i++) await Promise.resolve();
            expect(controls).toContainEqual({
                type: "lobby-flash",
                data: { flash },
            });
            connection.setFlash(null);
            for (let i = 0; i < 30; i++) await Promise.resolve();
            expect(controls).toContainEqual({
                type: "lobby-flash",
                data: { flash: null },
            });
            if (inputMode) {
                connection.advanceMovement(1 / 60, {
                    strafe: 0,
                    forward: -1,
                    yaw: 0,
                    running: false,
                    jump: false,
                    animation: -1,
                });
                await new Promise((resolve) => setTimeout(resolve, 60));
            }
            expect(connection.sendMessage("Hello over QUIC")).toBe(true);
            for (let i = 0; i < 30; i++) await Promise.resolve();
            expect(datagrams[0]).toMatchObject({ sequence: 1, x: 2 });
            if (inputMode) {
                expect(datagrams[0].z).toBeLessThan(0);
                expect(connection.getNetworkDiagnostics().movementModel).toBe(
                    "input-replay-60hz"
                );
            } else expect(datagrams[0].z).toBe(0);
            expect(connection.getNetworkDiagnostics().pendingAcks).toBe(0);
            expect(connection.snapshot.messages[0].text).toBe(
                "Hello over QUIC"
            );
        } finally {
            await connection.close();
            jest.restoreAllMocks();
            delete (globalThis as any).WebTransport;
        }
        expect(close).toHaveBeenCalledTimes(1);
    }
);
