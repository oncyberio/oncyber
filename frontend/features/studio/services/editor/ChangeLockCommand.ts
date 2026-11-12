import { EDITION_ACTIONS } from "@components/_3DExhibit-v2/three/constants";
import type { SpaceItem } from "@components/_3DExhibit-v2/three/factory/abstract/spaceitem";
import { ArtworkData } from "@uitypes/experience";
import { AbstractCommand } from "./AbstractCommand";
import { CommandState, ExhibitCommandContext } from "./types";

export interface ChangeLockOpts {
    targetMeshId: string;
    lock: ArtworkData["lock"];
}

export class ChangeLockCommand extends AbstractCommand {
    //
    prevOpts: ChangeLockOpts;

    isPortal: boolean;

    constructor(context: ExhibitCommandContext, public opts: ChangeLockOpts) {
        super(context);
    }

    async runImpl() {
        //
        const targetMesh = this.getTargetMesh(this.opts.targetMeshId);

        this.prevOpts = {
            ...this.opts,
            lock: targetMesh.userData.lock,
        };

        this.isPortal = targetMesh.isPortal;

        return this.runWithOpts(this.opts);
    }

    async runWithOpts(opts: ChangeLockOpts) {
        //
        let { world } = this.context;

        let { lock, targetMeshId: id } = opts;

        this.editorAction = {
            type: EDITION_ACTIONS.EDITOR_CHANGE_LOCK,
            artworkId: id,
            lock,
        };

        await world.edit(this.editorAction);

        this.updateExhibit((draft) => {
            //
            if (this.isPortal) {
                draft.portals[id].spawn.lock = lock;
            } else {
                draft.artworks[id].lock = lock;
            }
        });
    }

    undo() {
        //
        return this.runWithOpts(this.prevOpts);
    }

    redo() {
        //
        return this.runWithOpts(this.opts);
    }
}
