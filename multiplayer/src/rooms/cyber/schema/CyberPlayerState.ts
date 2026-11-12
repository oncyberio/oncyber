import { Schema, Context, type, MapSchema } from "@colyseus/schema";

import fetch from "node-fetch";

import { Client } from "colyseus";

import { LOGS } from "../../../utils/Logs";
import { checkIsMod } from "../../../utils/isMod";

export class Player extends Schema {
    @type("float32") positionX: number = 0;

    @type("float32") positionY: number = 0;

    @type("float32") positionZ: number = 0;

    @type("float32") rotation: number = 0;

    @type("float32") scale: number = 0;

    @type("string") userId: string = "";

    @type("string") walletId: string = "";

    @type("string") avatar: string = "";

    @type("string") username: string = "";

    @type("string") space: string = "";

    @type("float32") user_height: number = 0;

    @type("boolean") paused: boolean = false;

    @type("string") sessionId: string = "";

    @type("int8") animation: number = -1;

    @type("boolean") isAdmin: boolean = false;

    @type("boolean") floor: boolean = true;

    @type("string") VRM: string = "";

    private proxy: Player;

    constructor(private client: Client) {
        super();

        this.proxy = new Proxy(this, {
            set(target, property, value) {
                // console.log("[ SETTING PROPERTY ]", property, value)

                // validate type to mitigate crashing
                if (typeof property === "string") {
                    const propertyVal = target?.[property as keyof typeof target];

                    const propertyType = typeof propertyVal;

                    if (typeof propertyVal !== "undefined" && propertyType !== typeof value) {
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
        this.proxy.positionX = message[0];

        this.proxy.positionY = message[1];

        this.proxy.positionZ = message[2];

        this.proxy.rotation = message[3];

        this.proxy.scale = message[4];

        this.proxy.space = message[5];

        this.proxy.userId = message[6];

        this.proxy.walletId = message[6];

        this.proxy.avatar = message[7];

        this.proxy.username = message[8];

        this.proxy.user_height = message[9];

        this.proxy.paused = message[10];

        this.proxy.animation = message[11];

        this.proxy.VRM = message?.[13];
    };

    _onLoginMessage = async (message: Array<any>, metadata: Metadata) => {
        const [token, username, avatar, walletId] = message;

        this.proxy.username = username;

        this.proxy.avatar = avatar;

        this.proxy.walletId = walletId;

        this.proxy.userId = walletId;

        try {
            const isMod = await checkIsMod(this.proxy.userId, metadata.exhibitId, token);

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

    _onSpaceMessage = (message: Array<any>) => {
        const [space, user_height, scale] = message;

        this.proxy.space = space;

        this.proxy.user_height = user_height;

        this.proxy.scale = scale;
    };

    _onPauseMessage = (message: boolean) => {
        this.proxy.paused = message;
    };

    _onScaleMessage = (message: number) => {
        this.proxy.scale = message;
    };

    _onMoveMessage = (message: Array<any>) => {
        const [x, y, z, rotY, animation, floor] = message;

        this.proxy.positionX = x;

        this.proxy.positionY = y;

        this.proxy.positionZ = z;

        this.proxy.rotation = rotY;

        this.proxy.animation = animation;

        if (typeof floor === "boolean") {
            this.proxy.floor = floor;
        }
    };

    leave = (source?: string) => {
        this.client.leave();
    };
}
