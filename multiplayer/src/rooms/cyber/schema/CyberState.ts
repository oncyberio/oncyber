import { Schema, Context, type, MapSchema } from "@colyseus/schema";

import { ExtendedMapSchema } from "../../../utils/ExtendedMapSchema";

import { LOGS } from "../../../utils/Logs";

import { Player } from "./CyberPlayerState";

// export const PlayersMapSchema = new ExtendedMapSchema<Player>();

export class CyberState extends Schema {
    // @type({ map: Player }) players = PlayersMapSchema.map;

    @type({ map: Player }) players = new MapSchema<Player>();

    @type("number") numOfUsers: number = 0;

    @type("int64") serverTime: number = 0;

    public extendedPlayers = new ExtendedMapSchema<Player>(this.players);

    disconnectDuplicatePlayer(userId: string, source: "onJoin" | "onLogin") {
        this.players.forEach((player) => {
            if (player.userId === userId) {
                LOGS.duplicateRemovePlayer({
                    player,
                    source,
                });

                player.leave(source);

                return;
            }
        });
    }
}
