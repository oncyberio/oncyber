import { readLobbyGroupCohort } from "../../express/groupCohort";
import { Room, Client, ServerError, updateLobby } from "colyseus";

import { CyberState } from "./schema/CyberState";

import fetch from "node-fetch";

import { Player } from "./schema/CyberPlayerState";

import { PlayersEventHandlers } from "./events/CyberRoomEventsHandler";

import { ChatEventHandlers } from "./events/ChatEventsHandler";

import { PlayersCount } from "../../shared/events/PlayersCount";

import { LOGS } from "../../utils/Logs";
import { provesUser } from "../../identity/oncyberToken";
import { checkIsMod } from "../../utils/isMod";
import { admitToWorld } from "../../identity/worldAccess";

const MAX_PLAYERS = Number(process.env.MAX_PLAYERS);

const ROOM_CONFIG = {
    spaceId: "",
    exhibitId: "",
    maxPlayers: MAX_PLAYERS,
    tickRate: 5,
};

export class CyberRoom extends Room<CyberState, Metadata> {
    public playersCount: PlayersCount;

    // Per-session/room realtime data kept OUT of the synced schema (no patch
    // traffic, no old-client decoder concerns). Used by the chat/voice layer.
    public userAttributes = new Map<string, Map<string, string>>();

    public channelAttributes = new Map<string, string>();

    public chatRate = new Map<string, { count: number; windowStart: number }>();

    public rtcRate = new Map<string, { tokens: number; last: number }>();

    onCreate(options: any) {
        let lastServerTime = 0;

        this.setSimulationInterval(() => {
            // serverTime is not read by the client; refresh it ~1Hz instead of
            // every tick so it stops dirtying every state patch in idle rooms.
            const now = Date.now();
            if (now - lastServerTime >= 1000) {
                this.state.serverTime = now;
                lastServerTime = now;
            }
        });

        this.maxClients = MAX_PLAYERS;

        this.setMetadata({
            spaceId: options?.label,
            exhibitId: options?.currentSpace,
            ...(options?.lobbyGroupCohort !== undefined ? { lobbyGroupCohort: readLobbyGroupCohort(options.lobbyGroupCohort) } : {}),
        });

        // 10fps
        this.setPatchRate(1000 / ROOM_CONFIG.tickRate);

        const cyberState = new CyberState();

        // message listeners and handlers
        PlayersEventHandlers(this);

        ChatEventHandlers(this);

        this.setState(cyberState);

        this.playersCount = new PlayersCount(this);
    }

    update() {
        // Later for physics...
    }

    async onAuth(client: Client, options: JoinParams) {
        // The hint selects the room; all existing destination admission still applies.
        // Direct joinById must not bypass the same cohort partition used by /join.
        if (readLobbyGroupCohort(options.lobbyGroupCohort) !== this.metadata.lobbyGroupCohort)
            throw new ServerError(400, "This room belongs to a different lobby travel cohort.");
        // A password-gated world's room admits only joins carrying the signed
        // proof the web API gave for its password; the room is the world's by
        // its label (metadata.spaceId), whatever this join claims.
        const admission = await admitToWorld(this.metadata.spaceId, options.accessProof);
        if (!admission.ok) {
            if (admission.reason === "no-secret") console.error("world access: WORLD_ACCESS_SECRET/SECRET_JWT_KEY not set; refusing a password-gated join");
            throw new ServerError(403, "This world needs its password. Enter it to join.");
        }
        // const request = await fetch(
        //   `${process.env.}/api/social/checkGating?walletId=${ options.userId }&spaceId=${ options.label }&nbPlayers=${ this.clients.length }&token=${ options.token }&cap=true&ts=${ Date.now()}`
        // );

        // const response = await request.json();

        // if (!response?._v?.success) {
        //   throw new ServerError(403, JSON.stringify(response))
        // };

        // if (options.label === "anarrowthroughhistory") {
        //   if (this.state.players.size >= 280) {
        //     const request = await fetch(
        //       `${process.env.}/api/gagosian?userId=${options.userId}`
        //     );

        //     const response = await request.json();

        //     if (!response.success) {
        //       throw new ServerError(400, "The party is at max capacity, please refresh until an extra spot opens up.");
        //     }

        //     return true;
        //   }
        // }

        return true;
    }

    async onJoin(client: Client, options: JoinParams, fromAuth: any) {
        // A mod-check failure (API hiccup) must not block the join itself.
        let isMod = false;

        try {
            isMod = await checkIsMod(
                options.userId,
                this.metadata.exhibitId,
                options.token
            );
        } catch (err) {
            console.log("checkIsMod failed onJoin", err);
        }

        // Only a verified session may evict another connection with its id.
        if (provesUser(options.userId, options.token))
            this.state.disconnectDuplicatePlayer(options.userId, "onJoin");

        const player = new Player(client);

        player.assign({
            userId: options.userId,

            username: options.username,

            avatar: options.avatar,

            sessionId: client.sessionId,

            isAdmin: isMod,

            space: options.currentSpace || "",

            positionX: Number(options.position.x),

            positionY: Number(options.position.y),

            positionZ: Number(options.position.z),

            rotation: Number(options.rotationY),

            walletId: options.userId,

            VRM: options.VRM,
        });

        this.state.extendedPlayers.set(client.sessionId, player);

        // this.state.players.set(
        //     client.sessionId,
        //     player
        // );

        // Tell existing clients to bring up a voice peer connection to the
        // newcomer. The joiner derives its own initial roster from
        // state.players (already synced before any message is delivered).
        this.broadcast(
            "rtc-join",
            { sessionId: client.sessionId },
            { except: client }
        );

        LOGS.roomOnJoin(player, "cyber");
    }

    async onLeave(client: Client, consented: boolean) {
        // Voice peers must tear down regardless of schema-player presence
        // (covers duplicate-session force-disconnects too).
        this.broadcast(
            "rtc-leave",
            { sessionId: client.sessionId },
            { except: client }
        );

        // Session-keyed realtime data is not part of the schema player.
        this.userAttributes.delete(client.sessionId);
        this.chatRate.delete(client.sessionId);
        this.rtcRate.delete(client.sessionId);

        if (this.state.players.has(client.sessionId)) {
            const player = this.state.players.get(client.sessionId);

            LOGS.roomOnLeave(player);

            this.state.extendedPlayers.delete(client.sessionId);

            // this.state.players.delete(client.sessionId);
        }
    }

    onError(err: any) {
        console.log("err", err);
    }

    async onDispose() {
        await this.playersCount.dispose();

        this.userAttributes.clear();
        this.channelAttributes.clear();
        this.chatRate.clear();
        this.rtcRate.clear();

        LOGS.roomOnDispose({
            metadata: this.metadata,

            clients: this.clients,

            roomId: this.roomId,
        });
    }
}
