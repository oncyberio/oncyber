import { Presence, Room } from "colyseus";
import { CyberState } from "../../rooms/cyber/schema/CyberState";
import { Player } from "../../rooms/cyber/schema/CyberPlayerState";
import { LOGS } from "../../utils/Logs";

const HASH_KEY = "playerscount";

// Entries not refreshed within this window belong to rooms that died without
// disposing (crash, deploy kill) — they are pruned instead of summed forever.
const STALE_ENTRY_MS = 90_000;

// How often a live room refreshes its own entry and reconciles its count.
const HEARTBEAT_MS = 30_000;

interface CountEntry {
    c: number;
    ts: number;
}

export class PlayersCount {
    private presence: Presence;

    private metadata: Metadata;

    private roomState: CyberState;

    private id: string;

    private channel: string;

    private heartbeat: ReturnType<typeof setInterval>;

    private disposed = false;

    constructor(private room: Room<CyberState, Metadata>) {
        this.room.state.extendedPlayers.setCallbacks({
            onAdd: this.onAddPlayer,

            onRemove: this.onRemovePlayer,
        });

        this.presence = this.room.presence;

        this.metadata = this.room.metadata;

        this.roomState = this.room.state;

        this.id = this.metadata.spaceId + ":" + this.room.roomId;

        // One pub/sub channel per space (not per room): every room of the
        // space gets notified when any sibling room's count changes or when a
        // sibling disposes, so numOfUsers can't go permanently stale.
        this.channel = HASH_KEY + ":" + this.metadata.spaceId;

        this.presence.subscribe(this.channel, this._recompute);

        this._setNumOfUsers();

        this.heartbeat = setInterval(this._setNumOfUsers, HEARTBEAT_MS);
    }

    private onAddPlayer = (player: Player) => {
        this._setNumOfUsers();

        LOGS.stateOnAddPlayer({
            player,
            currentOnlineUsers: this.roomState.numOfUsers,
        });
    };

    private onRemovePlayer = (player: Player) => {
        this._setNumOfUsers();

        LOGS.stateOnRemovePlayer({
            player,
            currentOnlineUsers: this.roomState.numOfUsers,
        });
    };

    private _setNumOfUsers = async () => {
        if (this.disposed) return;

        try {
            const entry: CountEntry = {
                c: this.room.state.players.size,
                ts: Date.now(),
            };

            await this.presence.hset(HASH_KEY, this.id, JSON.stringify(entry));

            this.presence.publish(this.channel, null);
        } catch (err) {
            console.log(err);
        }
    };

    private _recompute = async () => {
        if (this.disposed) return;

        try {
            const data: Record<string, string> =
                (await this.presence.hgetall(HASH_KEY)) || {};

            const now = Date.now();

            let count = 0;

            for (const key of Object.keys(data)) {
                const [spaceId] = key.split(":");

                if (spaceId !== this.metadata.spaceId) continue;

                const entry = parseEntry(data[key]);

                if (entry == null || now - entry.ts > STALE_ENTRY_MS) {
                    // Orphaned by a room that never disposed — clean it up.
                    this.presence.hdel(HASH_KEY, key);

                    continue;
                }

                count += entry.c;
            }

            this.roomState.numOfUsers = count;
        } catch (err) {
            console.log(err);
        }
    };

    async dispose() {
        this.disposed = true;

        clearInterval(this.heartbeat);

        await this.presence.hdel(HASH_KEY, this.id);

        this.presence.unsubscribe(this.channel, this._recompute);

        // Let the remaining rooms of this space drop our players from their
        // counts right away.
        this.presence.publish(this.channel, null);
    }
}

function parseEntry(raw: string): CountEntry | null {
    try {
        const parsed = JSON.parse(raw);

        if (typeof parsed?.c === "number" && typeof parsed?.ts === "number") {
            return parsed;
        }

        return null;
    } catch (err) {
        return null;
    }
}
