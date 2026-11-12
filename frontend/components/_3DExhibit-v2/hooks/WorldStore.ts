import { is } from "immer/dist/internal";
import type Api from "../three/api";
import { WORLD_CREATED } from "../three/constants";
import { registerWorldEvent } from "./useWorldHandler";

type Callback = () => unknown;

export class WorldStore<T> {
    //
    public callbacks: Set<Callback>;

    private world: Api;

    private value: T;

    constructor(
        public startValue: T,
        public reducers: Array<{
            event: string;
            update: (eventData: any, seed: T) => T;
        }>,
        public isSync = false
    ) {
        //
        this.callbacks = new Set();

        this.value = this.startValue;

        WORLD_CREATED.then((world) => {
            //
            this.world = world;

            this.addEvents();
        });
    }

    notify = () => {
        this.callbacks.forEach((cb) => {
            cb();
        });
    };

    onEvent = (reducer) => (payload) => {
        //
        this.value = reducer(payload, this.value);

        if (this.isSync) {
            this.notify();
        } else {
            setTimeout(this.notify);
        }
    };

    addEvents() {
        //

        this.reducers.forEach(({ event, update }) => {
            //
            if (typeof update !== "function") {
                //
                throw new Error("No reducer for " + event);
            }

            registerWorldEvent(event, this.onEvent(update), this.world);
        });
    }

    subscribe = (callback: Callback) => {
        //
        this.callbacks.add(callback);

        return () => this.callbacks.delete(callback);
    };

    getState = () => {
        //
        return this.value;
    };

    getServerSnapshot = () => {
        //
        return this.value;
    };
}
