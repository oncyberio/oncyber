import {
    APP_STATES,
    EDITION_ACTIONS,
} from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import Emitter from "events";
import { sendRealtimeEvent, startRealtime } from "../realtime";
import {
    CommandInstanceMap,
    CommandMap,
    CommandOptsMap,
    CommandType,
} from "./CommandMap";
import { RealtimeEvents } from "./constants";

import { ExhibitCommandContext } from "./types";
import { Experience, Stylekit } from "@uitypes/experience";
import { Undo } from "./Undo";
import { historyAfterRedo, historyAfterUndo, UndoHistory } from "./history";
import { getDestination, getStylekitByRoom } from "@utils/saveToDb";
import { World3DPatch } from "./ExhibitDiff/World3DPatch";
import { SnapshotEvent } from "../ExhibitStore";
import { RoomParameters } from "@uitypes/roomParameters";
import { SpaceComponent } from "@components/_3DExhibit-v2/three/factory/abstract/spacecomponent";

export class ExhibitEditorService extends Emitter {
    //
    undoStack: Undo[] = [];

    undoIndex = -1;

    undoingCmd = null;

    isUndoPaused = false;

    lockedTargets = new WeakSet();

    private _stopRealtime: () => unknown = null;

    private world3dPatch: World3DPatch;

    private makeState = () => {
        //
        window["$$eds"] = this;
        return {
            undoStack: this.undoStack,
            undoIndex: this.undoIndex,
            undoingCmd: this.undoingCmd,
            isUndoPaused: this.isUndoPaused,
            lockedTargets: this.lockedTargets,
        };
    };

    _state = this.makeState();

    constructor(public context: ExhibitCommandContext) {
        //
        super();

        this.world3dPatch = new World3DPatch(this.context.world);
    }

    getState = () => {
        //
        return this._state;
    };

    subscribeState = (cb) => {
        //
        this.on("state-change", cb);

        return () => this.off("state-change", cb);
    };

    emitStateChange = () => {
        //
        this._state = this.makeState();
        this.emit("state-change");
    };

    pushCommand(cmd: Undo) {
        //
        this.undoStack[++this.undoIndex] = cmd;

        this.undoStack.length = this.undoIndex + 1;

        this.emitStateChange();
    }

    clearHistory() {
        //
        this.undoStack = [];

        this.undoIndex = -1;

        this.emitStateChange();
    }

    async undo() {
        //

        if (this.isUndoPaused || this.undoingCmd != null || this.undoIndex < 0)
            return;

        try {
            //
            const stack = this.undoStack;

            const cmd = stack[this.undoIndex];

            this.undoingCmd = cmd;

            this.emitStateChange();

            await cmd.undo();

            // The position moves only now. A failed undo leaves the history
            // as it was, so the next undo tries this step again.
            this.settleHistory(stack, (history) =>
                historyAfterUndo(history, cmd)
            );

            this.emit("command", { type: "undo" });

            //
        } finally {
            //
            this.undoingCmd = null;

            this.emitStateChange();
        }
    }

    async redo() {
        //
        if (
            this.isUndoPaused ||
            this.undoingCmd != null ||
            this.undoIndex === this.undoStack.length - 1
        )
            return;

        try {
            //
            const stack = this.undoStack;

            const at = this.undoIndex + 1;

            const cmd = stack[at];

            this.undoingCmd = cmd;

            this.emitStateChange();

            await cmd.redo();

            // As in undo(): a failed redo is still the next redo.
            this.settleHistory(stack, (history) =>
                historyAfterRedo(history, cmd, at)
            );

            this.emit("command", { type: "redo" });
            //
        } finally {
            //
            this.undoingCmd = null;

            this.emitStateChange();
        }
    }

    /**
     * Moves the history after an undo or redo that succeeded. `stack` is the
     * history the command started in: `clearHistory()` begins a new one, and
     * then there is nothing left to move.
     */
    private settleHistory(
        stack: Undo[],
        settle: (history: UndoHistory<Undo>) => UndoHistory<Undo>
    ) {
        //
        if (this.undoStack !== stack) return;

        const settled = settle({ stack, index: this.undoIndex });

        this.undoStack = settled.stack;

        this.undoIndex = settled.index;
    }

    lockUndo(mesh: SpaceComponent, isLocked: boolean) {
        //
        // TODO: Implement a more fine-grained locking
        this.isUndoPaused = isLocked;

        if (isLocked) {
            //
            this.lockedTargets.add(mesh);
        } else {
            //
            this.lockedTargets.delete(mesh);
        }

        this.emitStateChange();
    }

    private wasDisposed = false;

    sendRealimeCommand<C extends CommandType>(payload: {
        type: C;
        opts: CommandOptsMap[C];
    }) {
        //
        const event = {
            type: RealtimeEvents.RT_EDITOR_COMMAND,
            payload,
            timestamp: Date.now() + 1000 * 10,
        };

        sendRealtimeEvent(this.context.exhibitStore.exhibit.id, event);
    }

    onRealtimeEvent = async (event, isCurrentSender: boolean) => {
        //

        if (event.type === RealtimeEvents.RT_EDITOR_COMMAND) {
            //
            // TODO
        }

        // Server side
        if (event.type === "COMPRESSION_FINISHED") {
            //
            this.context.world.edit({
                type: EDITION_ACTIONS.EDITOR_UPDATE_ARTWORK_MEDIA,
                artworkId: event.meshId,
                urlField: event.payload.urlField,
                mediaInfo: event.payload.mediaInfo,
                coverMediaInfo: event.payload.coverMediaInfo,
                isCurrentUser: isCurrentSender,
            });
        }

        if (event.type === "COMPRESSION_FINISHED_3D") {
            //
            console.log("COMPRESSION_FINISHED_3D", 1);
            console.log("COMPRESSION_FINISHED_3D", 2);
            console.log("COMPRESSION_FINISHED_3D", 3);
            console.log("COMPRESSION_FINISHED_3D", 4);

            this.context.world.edit({
                type: EDITION_ACTIONS.EDITOR_UPDATE_MODEL_MEDIA,
                artworkId: event.meshId,
                dcompressed_animation_url:
                    event.payload.dcompressed_animation_url,
                d_optimized_files: event.payload.d_optimized_files,
            });
        }

        // Server side
        if (event.type === "REPLACE_ASSET") {
            // world.edit({
            //     type: EDITION_ACTIONS.REPLACE_HTML_PREVIEW_TEXTURE,
            //     artworkId: event.meshId,
            //     asset: event.payload.asset,
            // });
        }
    };

    private _offSnaphot: Function;

    startRealtime() {
        //
        this._stopRealtime = startRealtime({
            exhibitId: this.context.exhibitStore.exhibit.id,
            onEvent: this.onRealtimeEvent,
        });

        this._offSnaphot = this.context.exhibitStore.onRemoteSnaphot((opts) => {
            //
            console.log("opts", opts);
            this.patch3DScene(opts);
        });
    }

    stopRealtime() {
        //
        this._stopRealtime?.();

        this._offSnaphot?.();
    }

    getCommand<C extends CommandType>(
        type: C,
        opts: CommandOptsMap[C]
    ): CommandInstanceMap[C] {
        //
        if (this.wasDisposed) {
            //
            throw new Error("Exhibit store was disposed");
        }

        const Factory = CommandMap[type];

        if (Factory == null) throw new Error("Unknown command type " + type);

        // @ts-ignore
        const cmd = new Factory(this.context, opts);

        // @ts-ignore
        return cmd;
    }

    kitUpdatePromise = null;

    async patch3DScene(opts: SnapshotEvent) {
        //
        if (this.kitUpdatePromise) {
            //
            await this.kitUpdatePromise;

            this.kitUpdatePromise = null;
        }

        if (opts.current.info.room !== opts.incoming.info.room) {
            //
            console.log("Room changed, updating kit ", opts.incoming.info.room);
            this.kitUpdatePromise = this.updateExhibitKit(
                {
                    id: opts.incoming.info.room,
                },
                opts
            );

            return;
        }

        this.world3dPatch.patch3DScene(opts);
    }

    async updateExhibitKit(
        opts: { id: string; applyStylekit?: boolean },
        remoteSnapshot?: SnapshotEvent
    ) {
        //
        if (this.context.exhibitStore.hasPendingRemoteChanges) {
            //
            throw new Error("Another user is updating the exhibit kit");
        }

        try {
            this.emit("apply-kit", { kit: opts, status: "start" });

            this.clearHistory();

            let newExhibit: Experience;

            let destination: RoomParameters;

            let stylekit: Stylekit;

            if (remoteSnapshot) {
                //
                destination = await getDestination(opts.id);

                newExhibit = remoteSnapshot.incoming;
                //
            } else {
                //
                [stylekit, destination] = await Promise.all([
                    opts.applyStylekit ? getStylekitByRoom(opts.id) : null,
                    getDestination(opts.id),
                ]);

                newExhibit = structuredClone(
                    this.context.exhibitStore.exhibit
                ) as Experience;

                newExhibit.info.room = opts.id;

                newExhibit.hasKitbash = true;

                newExhibit.artworks = {};

                newExhibit.portals = {};

                if (opts.applyStylekit) {
                    newExhibit.kitbash = stylekit?.kitbash ?? {};

                    Object.values(newExhibit.kitbash).forEach((c) => {
                        //
                        c.kit = c.kit ?? opts.id;
                    });
                } else {
                    newExhibit.kitbash = {};

                    Object.values(
                        this.context.exhibitStore.exhibit.kitbash ?? {}
                    ).forEach((c) => {
                        //
                        if (c.kit === "cyber") {
                            //
                            newExhibit.kitbash[c.id] = c;
                        }
                    });
                }

                //
            }

            await this.context.world.edit({
                type: EDITION_ACTIONS.SET_SELECTED_ITEMS,
                items: [],
            });

            let space = await this.context.world.loadSpace({
                roomParameters: structuredClone(destination),
                exhibit: structuredClone(newExhibit),
            });

            await this.context.world.setState(APP_STATES.SPACE, {
                roomParameters: destination,
                exhibit: newExhibit,
                space,
            });

            if (remoteSnapshot == null) {
                //
                this.context.exhibitStore.updateKit(newExhibit);
            }

            console.log("newExhibit", newExhibit);

            return { exhibit: newExhibit, destination, stylekit };
            //
        } finally {
            //
            this.emit("apply-kit", { kit: opts, status: "end" });
        }
    }

    dispose() {
        //
        this.wasDisposed = true;
    }
}
