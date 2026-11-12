import Emitter from "events";

//

export type Role = "audience" | "host";

export type MediaType = "audio" | "video";

export interface UserStreams {
    audio?: MediaStream;
    video?: MediaStream;
}

export interface VolumeStats {
    level: number;
    isActive: boolean;
    inactiveTime: number;
}

export type ChannelType = "mic" | "stream";

export const Events = {
    //
    USER_JOINED: "USER_JOINED",

    USER_LEFT: "USER_LEFT",

    USER_PUBLISHED: "USER_PUBLISHED",

    USER_UNPUBLISHED: "USER_UNPUBLISHED",

    VOLUME_INDICATOR: "VOLUME_INDICATOR",

    SHARING_STOPPED: "SHARING_STOPPED",
    //
} as const;

type EventType = keyof typeof Events;

export type EventCallbacks = {
    USER_JOINED: (
        uid: string,
        info: { hasAudio: boolean; hasVideo: boolean }
    ) => unknown;
    USER_LEFT: (uid: string, info: { reason: string }) => unknown;
    USER_PUBLISHED: (
        uid: string,
        info: {
            channel: ChannelType;
            mediaType: MediaType;
            stream: MediaStream;
        }
    ) => unknown;
    USER_UNPUBLISHED: (
        uid: string,
        info: {
            channel: ChannelType;
            mediaType: MediaType;
            stream: MediaStream;
        }
    ) => unknown;

    VOLUME_INDICATOR: (info: {
        channel: ChannelType;
        volumes: Record<string, VolumeStats>;
        /** The level above which `isActive` is set, on the 0..1 scale. */
        threshold?: number;
    }) => unknown;

    SHARING_STOPPED: () => unknown;
};

export class TypedEmitter {
    private _emitter = new Emitter();

    on<T extends EventType>(event: T, callback: EventCallbacks[T]) {
        this._emitter.on(event, callback);
    }

    once<T extends EventType>(event: T, callback: EventCallbacks[T]) {
        this._emitter.once(event, callback);
    }

    off<T extends EventType>(event: T, callback: EventCallbacks[T]) {
        this._emitter.off(event, callback);
    }

    emit<T extends EventType>(
        event: T,
        ...args: Parameters<EventCallbacks[T]>
    ) {
        this._emitter.emit(event, ...args);
    }

    removeAllListeners() {
        this._emitter.removeAllListeners();
    }
}
