import { Schema, Context, type, MapSchema } from "@colyseus/schema";
import { Room } from "colyseus";
import { Box3, Sphere, Vector3 } from "three";

import { AbstractGameManager, GAME_OBJECT } from "../../game/abstract/AbstractGameManager";

import { ExtendedMapSchema } from "../../../utils/ExtendedMapSchema";

import { LOGS } from "../../../utils/Logs";

import { GameObjectState } from "./GameObjectState";

import { GamePlayerState } from "./GamePlayerState";
import { AbstractGamePlayer } from "../abstract/AbstractGamePlayer";

export class GameState extends Schema implements AbstractGameManager {
    @type({ map: GamePlayerState }) players = new MapSchema<GamePlayerState>();

    @type({ map: GameObjectState }) objects = new MapSchema<GameObjectState>();

    @type("number") numOfUsers: number = 0;

    @type("int64") accumulatedTime: number = 0;

    @type("string") gameProgress: "idle" | "ready" | "started" | "ended" = "idle";

    @type("boolean") joinAfterGameStarted: boolean = false;

    @type("number") readyPlayers: number = 0;

    @type("number") resetPlayers: number = 0;

    readyPlayersIds: Array<string> = [];

    resetPlayersIds: Array<string> = [];

    winners: Array<string> = [];

    timers = {};

    callbacks: any = {};

    public extendedPlayers = new ExtendedMapSchema<GamePlayerState>(this.players);

    constructor(public readonly game_params: any, public room: Room<GameState, Metadata>) {
        super();

        Object.keys(this.game_params.objects).forEach((key) => {
            const objectParams = this.game_params.objects[key];

            const object = new GameObjectState();

            object.setVisible(objectParams.visible ?? true);

            object.setActive(objectParams.active ?? true);

            // add event listeners
            // if (objectParams?.callbacks?.onKeyPress) {
            //     this.callbacks[id + "/" + Events.KEY_DOWN] = (e) =>
            //         this.game_params.objects[id].callbacks.onKeyPress(
            //             e,
            //             object,
            //             this
            //         );

            //     Emitter.on(
            //         Events.KEY_DOWN,
            //         this.callbacks[id + "/" + Events.KEY_DOWN]
            //     );
            // }

            this.objects.set(key, object);
        });

        this.room.onMessage("interact", (client, objectId) => {
            const obj = this.objects.get(objectId);

            if (!obj) return;

            if (this.game_params.objects[objectId].callbacks) {
                obj._isInteracting(this, this.players.get(client.sessionId), 5, this.game_params.objects[objectId].callbacks);
            }
        });

        this.room.onMessage("reset", (client) => {
            if (this.resetPlayersIds.includes(client.sessionId)) return;

            this.resetPlayersIds.push(client.sessionId);

            this.resetPlayers++;

            if (this.resetPlayers >= this.game_params.start_params?.resetPlayers) {
                this.reset();

                this.gameProgress = "idle";

                this.resetPlayersIds = [];

                this.resetPlayers = 0;
            }
        });

        this.room.onMessage("ready", async (client) => {
            if (this.readyPlayersIds.includes(client.sessionId)) return;

            this.readyPlayersIds.push(client.sessionId);

            this.readyPlayers++;

            if (this.readyPlayers >= this.game_params.start_params?.readyPlayers) {
                this.reset();

                this.gameProgress = "ready";

                await this.game_params.start_params?.onPlayersReady?.(this);

                await this.game_params.start_params?.onGameStart?.(this);

                // countdown before game starts

                this.gameProgress = "started";

                this.readyPlayersIds = [];

                this.readyPlayers = 0;
            }
        });

        this.room.onMessage("shoot", (client, data) => {
            this.broadcast("shoot", {
                sessionId: client.sessionId,
                ...data,
            });

            const player = this.players.get(client.sessionId);

            if (!player) return;

            const direction = data.direction;

            const origin = data.origin;

            this.players.forEach((otherPlayer) => {
                if (otherPlayer.getId() !== client.sessionId) {
                    const tx1 = (otherPlayer.hitbox.min.x - origin.x) / direction.x;
                    const tx2 = (otherPlayer.hitbox.max.x - origin.x) / direction.x;
                    const ty1 = (otherPlayer.hitbox.min.y - origin.y) / direction.y;
                    const ty2 = (otherPlayer.hitbox.max.y - origin.y) / direction.y;
                    const tz1 = (otherPlayer.hitbox.min.z - origin.z) / direction.z;
                    const tz2 = (otherPlayer.hitbox.max.z - origin.z) / direction.z;

                    const tmin = Math.max(0, Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2)));

                    const tmax = Math.min(data.duration || 1000, Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2)));

                    // Step 4: Check if the calculated t value is within the time range of the bullet
                    if (tmin > tmax) {
                        return console.log("missed player"); // Bullet missed the player's bounding box
                    }

                    // Step 5: Check if the point of intersection p is inside the player's bounding box
                    const p = new Vector3(origin.x + direction.x * tmin, origin.y + direction.y * tmin, origin.z + direction.z * tmin);

                    if (otherPlayer.hitbox.containsPoint(p)) {
                        otherPlayer.health -= data.damage || 1;
                        return console.log("hit player");
                    } else {
                        return console.log("missed player");
                    }
                }
            });

            // if user health is 0 then kill the user
        });
    }

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

    update = (deltaTime: number) => {
        // if (this.gameProgress !== "started") return;

        this.accumulatedTime += deltaTime;

        this.players.forEach((player) => {
            // console.log(player.hitbox);
            player.hitbox.min.setX(player.hitboxParams.min.x + player.pX);

            player.hitbox.max.setX(player.hitboxParams.max.x + player.pX);

            player.hitbox.min.setZ(player.hitboxParams.min.z + player.pZ);

            player.hitbox.max.setZ(player.hitboxParams.max.z + player.pZ);

            player.hitbox.min.setY(player.hitboxParams.min.y + player.pY);

            player.hitbox.max.setY(player.hitboxParams.max.y + player.pY);

            if (player && this.game_params.hit.enable) {
                // we need to check if current player is interacting any of the other players
                this.players.forEach((otherPlayer) => {
                    if (otherPlayer.getId() !== player.getId()) {
                        if (this.game_params.hit.callbacks?.onInteracting) {
                            player._isInteracting(this, otherPlayer, this.game_params.hit.callbacks);
                        }
                    }
                });
            }

            this.objects.forEach((object) => {
                // check if player is touching the target

                if (this.game_params.objects[object.getId()]?.callbacks?.onInteracting) {
                    if (object.getActive()) {
                        object._isInteracting(this, player, this.game_params.objects[object.getId()]?.radius || 5, this.game_params.objects[object.getId()].callbacks);
                    }
                }
            });

            this.checkWinConditions(player);
        });
    };

    wait(time: number) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(null);
            }, time);
        });
    }

    addEvents = () => {};

    removeEvents = () => {};

    broadcast = (event: string, data: any) => {
        this.room.broadcast(event, data);
    };

    checkWinConditions = (player: AbstractGamePlayer) => {
        if (!player.getHasLost() && !player.getHasWon() && player.getScore() >= this.game_params.win_params?.score) {
            player.setHasWon(true);

            this.winners.push(player.getId());

            this.game_params.hit?.callbacks.onWin(player, this);
        }
    };

    countdown = (time: number, duration: number, broadcast: boolean = true) => {
        return new Promise((resolve) => {
            // @ts-ignore
            this.timers["countdown"] = setInterval(() => {
                if (broadcast) {
                    this.broadcast("countdown", time);
                }

                if (time === 0) {
                    // @ts-ignore
                    clearInterval(this.timers["countdown"]);
                    resolve(time);
                } else {
                    time--;
                }
            }, duration);
        });
    };

    reset() {
        this.players.forEach((player) => {
            player.setHasLost(false);

            player.setHasWon(false);

            player.setScore(0);
        });

        this.objects.forEach((object) => {
            const objectParams = this.game_params.objects[object.getId()];

            object.setVisible(objectParams?.visible ?? true);

            object.setActive(objectParams?.active ?? true);
        });

        this.accumulatedTime = 0;

        this.gameProgress = "idle";

        this.readyPlayers = 0;

        this.readyPlayersIds = [];

        this.winners = [];
    }

    dispose(): void {
        this.removeEvents();
    }

    public getPlayerById?(id: string): GAME_OBJECT {
        return this.players.get(id);
        // return this.players.find((player) => player.getId() === id);
    }

    public getObjectById?(id: string): GAME_OBJECT {
        return this.objects.get(id);
        // return this.objects.find((object) => object.getId() === id);
    }
}
