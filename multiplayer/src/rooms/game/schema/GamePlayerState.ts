import { Schema, Context, type, MapSchema } from "@colyseus/schema";

import fetch from "node-fetch";

import { Client } from "colyseus";

import { LOGS } from "../../../utils/Logs";

import {
    AbstractGameManager,
    GAME_OBJECT,
} from "../../game/abstract/AbstractGameManager";

import { AbstractGamePlayer } from "../abstract/AbstractGamePlayer";
import { Box3, Vector3 } from "three";
import { checkIsMod } from "../../../utils/isMod";

// import { GameManager, GAME_OBJECT } from "../../utils/GameManager";

export class GamePlayerState extends Schema implements AbstractGamePlayer {
    @type("string") id: string = "";

    @type("string") sessionId: string = "";

    @type("string") space: string = "";

    @type("float32") pX: number = 0;

    @type("float32") pY: number = 0;

    @type("float32") pZ: number = 0;

    @type("float32") rX: number = 0;

    @type("float32") rY: number = 0;

    @type("float32") rZ: number = 0;

    @type("float32") sX: number = 0;

    @type("float32") sY: number = 0;

    @type("float32") sZ: number = 0;

    @type("string") userId: string = "";

    @type("string") avatar: string = "";

    @type("string") username: string = "";

    @type("boolean") paused: boolean = false;

    @type("int8") animation: number = -1;

    @type("boolean") isAdmin: boolean = false;

    @type("boolean") floor: boolean = true;

    @type("string") VRM: string = "";

    @type("int8") health: number = 5;

    @type("int16") score: number = 0;

    @type("boolean") visible: boolean = false;

    @type("boolean") active: boolean = false;

    @type("boolean") hasLost: boolean = false;

    @type("boolean") hasWon: boolean = false;

    @type("string") oolongMode: string = "";

    public hitboxParams = {
        min: new Vector3(-1, this.pY, -1),
        max: new Vector3(1, this.pY + 2.8, 1),
    };

    public hitbox = new Box3(
        this.hitboxParams.min.clone(),
        this.hitboxParams.max.clone()
    );

    private proxy: GamePlayerState;

    // @ts-ignore
    public readonly isPlayer = true;

    constructor(private client: Client) {
        super();

        this.proxy = new Proxy(this, {
            set(target, property, value) {
                // console.log("[ SETTING PROPERTY ]", property, value);

                // validate type to mitigate crashing
                if (typeof property === "string") {
                    const propertyVal =
                        target?.[property as keyof typeof target];

                    const propertyType = typeof propertyVal;

                    if (
                        typeof propertyVal !== "undefined" &&
                        propertyType !== typeof value
                    ) {
                        LOGS.stateValidation({
                            property,
                            propertyType,
                            value,
                            player: target,
                        });

                        return true;
                    }
                }

                Reflect.set(target, property, value);

                return true;
            },
        });

        return this.proxy;
    }

    _onInitMessage = (message: Array<any>) => {
        this.proxy.pX = message[0];

        this.proxy.pY = message[1];

        this.proxy.pZ = message[2];

        this.proxy.rY = message[3];

        this.proxy.sX = message[4];

        this.proxy.space = message[5];

        this.proxy.userId = message[6];

        // this.proxy.walletId = message[6];

        this.proxy.avatar = message[7];

        this.proxy.username = message[8];

        // this.proxy.user_height = message[9];

        this.proxy.paused = message[10];

        this.proxy.animation = message[11];

        this.proxy.VRM = message?.[13];
    };

    _onLoginMessage = async (message: Array<any>, metadata: Metadata) => {
        const [token, username, avatar, walletId] = message;

        this.proxy.username = username;

        this.proxy.avatar = avatar;

        this.proxy.userId = walletId;

        try {
            const isMod = await checkIsMod(
                this.proxy.userId,
                metadata.exhibitId,
                token
            );

            this.proxy.isAdmin = isMod;
        } catch (err) {
            console.log("err", err);
        }
    };

    _onAvatarMessage = (avatar: string) => {
        this.proxy.avatar = avatar;
    };

    _onUsernameMessage = (username: string) => {
        this.proxy.username = username;
    };

    _onVRMMessage = (vrm: string) => {
        this.proxy.VRM = vrm;
    };

    _onPauseMessage = (message: boolean) => {
        this.proxy.paused = message;
    };

    _onMoveMessage = (message: Array<any>) => {
        const [x, y, z, rotY, animation, floor, oolongMode] = message;

        this.proxy.pX = x;

        this.proxy.pY = y;

        this.proxy.pZ = z;

        this.proxy.rY = rotY;

        this.proxy.animation = animation;

        // this.proxy.oolongMode = oolongMode;

        if (typeof floor === "boolean") {
            this.proxy.floor = floor;
        }
    };

    leave = (source?: string) => {
        this.client.leave();
    };

    setHealth(health: number) {
        this.proxy.health = health;
    }

    setPosition(x: number, y: number, z: number) {
        this.proxy.pX = x;

        this.proxy.pY = y;

        this.proxy.pZ = z;
    }

    setHasLost(hasLost: boolean): void {
        this.proxy.hasLost = hasLost;
    }

    setRotation(x: number, y: number, z: number) {
        this.proxy.rX = x;

        this.proxy.rY = y;

        this.proxy.rZ = z;
    }

    setScale(x: number, y: number, z: number) {
        this.proxy.sX = x;

        this.proxy.sY = y;

        this.proxy.sZ = z;
    }

    setAnimation(animation: number) {
        this.proxy.animation = animation;
    }

    setScore(score: number) {
        // console.log("in set score", this.getId(), score);
        this.proxy.score = score;
    }

    setVisible(visible: boolean) {
        this.proxy.visible = visible;
    }

    setActive(active: boolean) {
        this.proxy.active = active;
    }

    setHasWon(hasWon: boolean): void {
        this.proxy.hasWon = hasWon;
    }

    getPosition(): { x: number; y: number; z: number } {
        return { x: this.rX, y: this.rY, z: this.rZ };
    }

    getRotation(): { x: number; y: number; z: number } {
        return { x: this.pX, y: this.pY, z: this.pZ };
    }

    getScale(): { x: number; y: number; z: number } {
        return { x: this.sX, y: this.sY, z: this.sZ };
    }

    getHasLost(): boolean {
        return this.hasLost;
    }

    getMetadata() {}

    setMetadata(metadata: any): void {}

    getAnimation(): number {
        return this.animation;
    }

    getHealth(): number {
        return this.health;
    }

    getActive(): boolean {
        return this.active;
    }

    getVisible(): boolean {
        return this.visible;
    }

    getScore(): number {
        return this.score;
    }

    getId(): string {
        return this.sessionId;
    }

    getHasWon(): boolean {
        return this.hasWon;
    }

    attachTo(target: GAME_OBJECT): void {}

    _isInteracting(
        game: AbstractGameManager,
        target: GAME_OBJECT,
        callbacks: any
    ): void {
        // collide
        // distance
        // raycast
        callbacks.onInteracting(this, target, game);
    }

    _moveTo(
        target: { x: number; y: number; z: number },
        duration: number,
        type: string
    ) {}

    _rotateTo(
        target: { x: number; y: number; z: number },
        duration: number,
        type: string
    ) {}

    _scaleTo(
        target: { x: number; y: number; z: number },
        duration: number,
        type: string
    ) {}

    deactivateControls() {}

    activateControls() {}
}
