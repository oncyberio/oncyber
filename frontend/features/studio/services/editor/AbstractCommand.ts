import type { SpaceArtwork } from "@components/_3DExhibit-v2/three/factory/artwork/abstract";
import { EDITOR_ACTION } from "@components/_3DExhibit-v2/three/factory/editor/actions";
import { isArtwork, isPortal } from "@features/studio/EditWorldMenu/utils";
import { deferred } from "@utils/js";

import Emitter from "events";
import { ExhibitStore } from "../ExhibitStore";
import { CommandState, ExhibitCommandContext } from "./types";

export class AbstractCommand extends Emitter {
    //
    editorAction: EDITOR_ACTION = null;

    state: CommandState = { type: "Idle" };

    private isFirstRun = false;

    public isTransient = false;

    private dbDeferred = deferred();

    get dbUpdate() {
        //
        return this.dbDeferred.promise;
    }

    constructor(public context: ExhibitCommandContext) {
        super();
    }

    get exhibit() {
        return this.context.exhibitStore.exhibit;
    }

    protected getTargetMesh(id: string) {
        //
        if (id == null) return null;

        const target = this.context.world.getItem(id);

        if (target == null) {
            //
            throw new Error("Unable to find target mesh " + id);
        }

        return target;
    }

    protected getTargetArtwork(id: string) {
        //
        const target = this.context.world.getItem(id);

        if (!isArtwork(target)) {
            //
            throw new Error("Unable to find target artowrk " + id);
        }

        return target;
    }

    protected getTargetPortal(id: string) {
        //
        const target = this.context.world.getItem(id);

        if (!isPortal(target)) {
            //
            throw new Error("Unable to find target portal " + id);
        }

        return target;
    }

    getLabel() {
        //
        return this.constructor.name;
    }

    async run() {
        //
        try {
            this.state = { type: "Submitting" };

            this.isFirstRun = true;

            await this.runImpl();

            this.state = { type: "Success" };

            // if (this.editorAction != null) {
            //     //
            //     try {
            //         sendEditorAction(
            //             this.context.exhibitStore.exhibit.id,
            //             this.context.userId,
            //             this.editorAction
            //         );
            //     } catch (err) {
            //         //
            //         console.error("Failed to send realtime action", err);
            //     }
            // }
        } catch (error) {
            //
            console.error(error);

            this.state = { type: "Error", error: error?.message };

            throw error;
            //
        } finally {
            //
            this.isFirstRun = false;
        }
    }

    updateExhibit: ExhibitStore["updateExhibit"] = (recipe) => {
        //
        if (this.isTransient) return;

        return this.context.exhibitStore.updateExhibit(recipe).then(
            (val) => this.dbDeferred.resolve(val),
            (err) => this.dbDeferred.reject(err)
        );
    };

    async runImpl() {
        //
        throw new Error("Abstract");
    }

    async undo() {}

    async redo() {}
}
