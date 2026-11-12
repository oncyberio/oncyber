import * as Colyseus from "colyseus.js";

import { nodeEnv } from "@env";

import voiceChat from "../voiceChat";

import SocialApi from "@api/social/_api";

import { ARENA_HTTP_URL, ARENA_WS_URL } from "./constants";

export const ARENA_SERVER = ARENA_HTTP_URL;

const SERVER = ARENA_WS_URL;

class Arena {
    public client: Colyseus.Client;

    public voiceChat = voiceChat.get();

    public room: Colyseus.Room<any>;

    // public rooms: Colyseus.RoomAvailable[] = [];

    constructor() {
        // @ts-ignore
        // window.randomUser = () => {
        //     const userId = shortid.generate();
        //     return {
        //         label: "hub",
        //         username: userId,
        //         avatar: DEFAULT_PLAYER_AVATAR_PICTURE,
        //         userId: userId,
        //         token: "",
        //         position: { x: 0, y: 0, z: 0 },
        //         rotationY: 0,
        //         currentSpace: "hub",
        //     };
        // };

        // window.joinMatch = this.joinMatch;

        this.client = new Colyseus.Client(SERVER);

        // this.client.joinOrCreate("lobby").then((lobby) => {
        //     lobby.onMessage("rooms", (rooms) => {
        //         this.rooms = rooms;
        //         window.rooms = this.rooms;
        //     });

        //     lobby.onMessage("+", ([roomId, room]) => {
        //         const roomIndex = this.rooms.findIndex(
        //             (room) => room.roomId === roomId
        //         );
        //         if (roomIndex !== -1) {
        //             this.rooms[roomIndex] = room;
        //         } else {
        //             this.rooms.push(room);
        //         }

        //         // here when someone leaves then leave that other room and join this one

        //         console.log("roooms update", this.rooms);

        //         window.rooms = this.rooms;
        //     });

        //     lobby.onMessage("-", (roomId) => {
        //         this.rooms = this.rooms.filter(
        //             (room) => room.roomId !== roomId
        //         );

        //         window.rooms = this.rooms;
        //     });
        // });
    }

    public async connect(userId, label) {}

    public joinMatch = async (
        matchId,
        userData: {
            label: string;
            username: string;
            avatar: string;
            userId: string;
            token: string;
            position: { x: string; y: string; z: string };
            rotationY: string;
            currentSpace: string;
            VRM: string;
            lobbyGroupCohort?: string;
        },
        abortController
    ) => {
        const checkCancelled = () => {
            if (abortController.signal.aborted)
                throw new DOMException("Room join cancelled", "AbortError");
        };
        checkCancelled();
        // Leaving the previous room first matters: overwriting this.room
        // orphans a still-connected session that keeps counting as online
        // server-side.
        if (this.room) {
            await this.leaveMatch();
        }

        checkCancelled();
        userData.username = encodeURIComponent(userData.username);

        const request = await fetch(`${ARENA_SERVER}/join`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(userData),
            signal: abortController.signal,
        });

        const response = await request.json();

        if (response.success) {
            if (userData.lobbyGroupCohort &&
                response.lobbyGroupCohort !== userData.lobbyGroupCohort)
                throw new Error("Group arrivals are not available in this world yet.");
            checkCancelled();
            const joined = await this.client.consumeSeatReservation(response.reservation);
            if (abortController.signal.aborted) {
                // Seat consumption cannot be cancelled in Colyseus. A late seat
                // belongs to the abandoned attempt, never to the current room.
                void Promise.resolve(joined.leave(true)).catch(() => {});
                checkCancelled();
            }
            this.room = joined;
        } else {
            throw new Error(
                response.message || "Failed to join multiplayer room"
            );
        }

        // const [room] = rooms
        //     .filter((room) => room.metadata.spaceId === userData.label)
        //     .sort((a, b) => {
        //         return b.clients - a.clients;
        //     });

        // // If the room already exists we join
        // if (room) {
        //     this.room = await this.client.joinById(room.roomId, userData);
        // } else {
        //     this.room = await this.client.create(matchId, userData);
        // }
        // console.log("responseresponseresponseresponseroooooooom", this.room);

        return this.room;
    };

    // room.send

    public async leaveMatch(matchId = null) {
        if (!this.room) return;

        const room = this.room;

        this.room = null;

        try {
            // leave() doesn't reliably resolve, so don't let callers hang on
            // it — the leave message is sent (and the socket closed) either
            // way.
            await Promise.race([
                room.leave(true),
                new Promise((resolve) => setTimeout(resolve, 2000)),
            ]);
        } catch (err) {
            console.error(err);
        }
    }

    public async storage(type: "feedback" | "report", data, space) {
        return SocialApi.storage({
            sessionId: this.room.sessionId,
            roomId: this.room.id,
            data,
            space,
            type,
        });
    }

    public async getMatches(label) {}

    public async kickPlayer(userId, sessionId) {}

    public async checkIfAlreadyConnected(userId) {}
}

const ArenaProvider = new Arena();

export default ArenaProvider;
