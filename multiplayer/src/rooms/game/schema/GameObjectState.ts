import { Schema, Context, type, MapSchema } from "@colyseus/schema";

import fetch from "node-fetch";

import { Client } from "colyseus";

import { LOGS } from "../../../utils/Logs";

import { AbstractGameObject, HitType } from "../abstract/AbstractGameObject";
import {
    AbstractGameManager,
    GAME_OBJECT,
} from "../abstract/AbstractGameManager";

export class GameObjectState extends Schema implements AbstractGameObject {
    @type("string") id: string = "";

    @type("float32") pX: number = 0;

    @type("float32") pY: number = 0;

    @type("float32") pZ: number = 0;

    @type("float32") rX: number = 0;

    @type("float32") rY: number = 0;

    @type("float32") rZ: number = 0;

    @type("float32") sX: number = 0;

    @type("float32") sY: number = 0;

    @type("float32") sZ: number = 0;

    @type("int8") animation: number = -1;

    @type("boolean") visible: boolean = false;

    @type("boolean") active: boolean = false;

    private proxy: GameObjectState;

    public readonly isPlayer = false;

    constructor() {
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

    setPosition(x: number, y: number, z: number) {
        this.proxy.pX = x;

        this.proxy.pY = y;

        this.proxy.pZ = z;
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

    setVisible(visible: boolean) {
        this.proxy.visible = visible;
    }

    setActive(active: boolean) {
        this.proxy.active = active;
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

    getMetadata() {}

    setMetadata(metadata: any): void {}

    getAnimation(): number {
        return this.animation;
    }

    getActive(): boolean {
        return this.active;
    }

    getVisible(): boolean {
        return this.visible;
    }

    getId(): string {
        return this.id;
    }

    trigger(type: any) {}

    attachTo(target: GAME_OBJECT): void {}

    _isInteracting(
        game: AbstractGameManager,
        target: any,
        radius: number,
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

    _wait(behavior: Function, duration: number) {}
}
