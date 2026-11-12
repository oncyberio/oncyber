import EventEmitter from "events";
import type { Room } from "colyseus.js";
import { ChatChannel } from "./ChatChannel";

const REQUEST_TIMEOUT_MS = 3000;

// Drop-in replacement for the PartyKit-backed RTMClient, carried over the
// Colyseus room. One Colyseus room == one logical chat channel.
export default class ColyseusChatProvider extends EventEmitter {
    public channels: Record<string, { channel: ChatChannel; joined: boolean }> =
        {};

    public accountName: string;

    private room: Room | null = null;

    private _unbinds: Array<() => void> = [];

    private _pending = new Map<
        string,
        { resolve: (v: any) => void; reject: (e: any) => void; timer: any }
    >();

    constructor() {
        super();
        globalThis.$rtmClient = this;
    }

    init(room: Room) {
        if (!room) throw new Error("ColyseusChatProvider: no room");

        this.room = room;

        this._unbinds.push(
            room.onMessage("chat-channel", (msg: any) => {
                // Fan out to every joined channel (there is only one).
                Object.values(this.channels).forEach(({ channel, joined }) => {
                    if (joined) {
                        channel._emit(
                            "ChannelMessage",
                            msg.data,
                            msg.from,
                            msg.server_ts
                        );
                    }
                });
            }),
            room.onMessage("chat-peer", (msg: any) => {
                this.emit(
                    "MessageFromPeer",
                    this._normalize(msg.data),
                    msg.from,
                    msg.server_ts,
                    msg.profile
                );
            }),
            room.onMessage("attr-reply", (msg: any) => {
                const pending = this._pending.get(msg.requestId);
                if (!pending) return;
                this._pending.delete(msg.requestId);
                clearTimeout(pending.timer);
                pending.resolve(msg.values || {});
            })
        );
    }

    // roomId arg is ignored: the room connection replaces login + joinChannel.
    async login(_roomId: string, accountName: string) {
        if (!this.room) throw new Error("ColyseusChatProvider: not initialised");
        this.accountName = accountName;
    }

    async logout() {
        // Never closes the room — it's owned by the multiplayer layer.
        this._rejectPending("logged out");
    }

    async joinChannel(name: string) {
        const channel = new ChatChannel();
        this.channels[name] = { channel, joined: true };
        return channel;
    }

    async leaveChannel(name: string) {
        const entry = this.channels[name];
        if (!entry) return;
        entry.channel.removeAllListeners();
        delete this.channels[name];
    }

    async sendChannelMessage(data: any, channelName: string) {
        if (!this.channels[channelName]?.joined || !this.room) return;
        this.room.send("chat-channel", data);
    }

    async sendPeerMessage(data: any, peerId: string) {
        this.room?.send("chat-peer", { to: peerId.toString(), data });
        return true;
    }

    async getUserAttribute(userId: string, key: string) {
        const values = await this._request("attr-get-user", {
            sessionId: userId,
            keys: [key],
        });
        const val = values?.[key];
        return val != null ? JSON.parse(val) : null;
    }

    async setLocalUserAttribute(key: string, value: any) {
        try {
            this.room?.send("attr-set-user", {
                key,
                value: value == null ? null : JSON.stringify(value),
            });
        } catch (err) {
            console.error(err);
        }
    }

    async getChannelAttribute(channelName: string, key: string) {
        if (this.channels[channelName] == null) {
            throw new Error("Can't find channel " + channelName);
        }
        const values = await this._request("attr-get-channel", { keys: [key] });
        const val = values?.[key];
        return val != null ? JSON.parse(val) : null;
    }

    async setChannelAttribute(channelName: string, key: string, value: any) {
        if (this.channels[channelName] == null) {
            throw new Error("Can't find channel " + channelName);
        }
        this.room?.send("attr-set-channel", {
            key,
            value: value == null ? null : JSON.stringify(value),
        });
    }

    dispose() {
        this._unbinds.forEach((unbind) => {
            try {
                unbind();
            } catch (err) {
                // room may already be cleaned up
            }
        });
        this._unbinds = [];

        this._rejectPending("disposed");

        Object.values(this.channels).forEach(({ channel }) =>
            channel.removeAllListeners()
        );
        this.channels = {};

        this.room = null;
    }

    private _request(type: string, payload: any): Promise<Record<string, string>> {
        return new Promise((resolve, reject) => {
            if (!this.room) return reject("not connected");

            const requestId = Math.random().toString(36).slice(2);

            const timer = setTimeout(() => {
                this._pending.delete(requestId);
                reject("Request timeout");
            }, REQUEST_TIMEOUT_MS);

            this._pending.set(requestId, { resolve, reject, timer });

            this.room.send(type, { ...payload, requestId });
        });
    }

    private _rejectPending(reason: string) {
        this._pending.forEach((p) => {
            clearTimeout(p.timer);
            p.reject(reason);
        });
        this._pending.clear();
    }

    // sendCommand JSON.stringifies peer payloads, so a peer message arrives as
    // a string; parse it back so RTM_COMMAND dispatch sees an object.
    private _normalize(data: any) {
        if (typeof data === "string") {
            try {
                return JSON.parse(data);
            } catch (err) {
                return data;
            }
        }
        return data;
    }
}
