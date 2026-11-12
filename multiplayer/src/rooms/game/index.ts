import { provesUser } from "../../identity/oncyberToken";
import { Client, Room } from "colyseus";

import { RACE_GAME } from "../../configurations/race";
import { GameRoomEventHandlers } from "./events/GameRoomEventsHandler";

import { PlayersCount } from "../../shared/events/PlayersCount";

import { GameObjectState } from "./schema/GameObjectState";

import { GamePlayerState } from "./schema/GamePlayerState";

import { GameState } from "./schema/GameState";

import { LOGS } from "../../utils/Logs";

const ROOM_CONFIG = {
    maxPlayers: 20,

    tickRate: 30,
};

export class GameRoom extends Room<GameState, Metadata> {
    public playersCount: PlayersCount;

    public game: GameState;

    onCreate(options: any): void | Promise<any> {
        this.setSimulationInterval((deltaTime) => this.update(deltaTime));

        this.maxClients = ROOM_CONFIG.maxPlayers;

        this.setMetadata({
            spaceId: options?.label,
            exhibitId: options?.currentSpace,
        });

        this.game = new GameState(RACE_GAME, this);

        this.setState(this.game);

        // 10fps
        this.setPatchRate(1000 / ROOM_CONFIG.tickRate);

        GameRoomEventHandlers(this);

        this.playersCount = new PlayersCount(this as any);
    }

    update(delta: number) {
        this.game.update(delta);
    }

    async onAuth(client: Client, options: JoinParams) {
        return true;
    }

    async onJoin(client: Client, options: JoinParams, fromAuth: any) {
        // Only a verified session may evict another connection with its id.
        if (provesUser(options.userId, options.token))
            this.state.disconnectDuplicatePlayer(options.userId, "onJoin");

        const player = new GamePlayerState(client);

        player.assign({
            userId: options.userId,

            username: options.username,

            avatar: options.avatar,

            pX: Number(options.position.x),

            pY: Number(options.position.y),

            pZ: Number(options.position.z),

            rY: Number(options.rotationY),

            VRM: options.VRM,

            sessionId: client.sessionId,

            space: options.currentSpace,
        });

        this.state.extendedPlayers.set(client.sessionId, player);

        // this.state.players.set(
        //     client.sessionId,
        //     player
        // );

        LOGS.roomOnJoin(player, "game");
    }

    async onLeave(client: Client, consented: boolean) {
        if (this.state.players.has(client.sessionId)) {
            const player = this.state.players.get(client.sessionId);

            LOGS.roomOnLeave(player);

            this.state.extendedPlayers.delete(client.sessionId);

            // this.state.players.delete(client.sessionId);
        }
    }

    onDispose() {
        this.playersCount.dispose();

        LOGS.roomOnDispose({
            metadata: this.metadata,

            clients: this.clients,

            roomId: this.roomId,
        });
    }
}
