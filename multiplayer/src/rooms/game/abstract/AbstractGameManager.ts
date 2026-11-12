import { GamePlayerState } from "../schema/GamePlayerState";
import { ExtendedMapSchema } from "../../../utils/ExtendedMapSchema";
import { AbstractGameObject } from "./AbstractGameObject";
import { Schema, Context, type, MapSchema } from "@colyseus/schema";

import { AbstractGamePlayer } from "./AbstractGamePlayer";
import { GameObjectState } from "../schema/GameObjectState";

export type GAME_OBJECT = AbstractGameObject | AbstractGamePlayer;

// death event: respawn | destroy | reset | game over
// message sent on death
// respawn time
// quest type: counter | asset death | timer | wait for event

// the client game manager will need to run only for the main player while the server game manager will run for all players

export abstract class AbstractGameManager {
    players: MapSchema<GamePlayerState, string>;

    objects: MapSchema<GameObjectState, string>;

    gameProgress: "ready" | "idle" | "started" | "ended" = "started";

    joinAfterGameStarted = false;

    accumulatedTime = 0;

    winners: any[] = [];

    timers = {};

    callbacks: any = {};

    multiplayer?: any = {};

    constructor(public readonly game_params: any) {}

    update = (deltaTime: number) => {};

    addEvents = () => {};

    removeEvents = () => {};

    addObject?(object: GAME_OBJECT) {}

    addPlayer?(player: GAME_OBJECT) {}

    broadcast(event: string, data: any) {}

    countdown?(time: number, duration: number, broadcast: boolean) {}

    wait(time: number) {}

    public getPlayerById?(id: string): GAME_OBJECT {
        return this.players.get(id);
        // return this.players.find((player) => player.getId() === id);
    }

    public getObjectById?(id: string): GAME_OBJECT {
        return this.objects.get(id);
        // return this.objects.find((object) => object.getId() === id);
    }

    reset() {}

    dispose() {}
}
