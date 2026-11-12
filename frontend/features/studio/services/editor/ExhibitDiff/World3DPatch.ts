import type { EDITOR_ACTION } from "@3factory/editor/actions";
import type Api from "@3gl/api";
import { Experience } from "@uitypes/experience";
import { ExhibitDiff } from "./ExhibitDiff";
import { TaskQueueManager, TaskRunner } from "./TaskQueue";

export class World3DPatch {
    //
    private exhibitDiff: ExhibitDiff;

    private runAction = async (action: EDITOR_ACTION) => {
        //
        await this.world.edit(action);
    };

    private queueManagers = {
        artworks: new TaskQueueManager(this.runAction),
        portals: new TaskQueueManager(this.runAction),
        kitbash: new TaskQueueManager(this.runAction),
    };

    constructor(public world: Api) {
        //
        this.exhibitDiff = new ExhibitDiff(this.world);
    }

    async patch3DScene(opts: {
        current: Experience;
        incoming: Experience;
        scope: any;
    }) {
        //
        const { artCmds, portalCmds, kitCmds } = this.exhibitDiff.diffExhibit(
            opts.current,
            opts.incoming,
            opts.scope
        );

        for (let id in artCmds) {
            //
            this.queueManagers.artworks.pushPatches(id, ...artCmds[id]);
        }

        for (let id in portalCmds) {
            //
            this.queueManagers.portals.pushPatches(id, ...portalCmds[id]);
        }

        for (let id in kitCmds) {
            //
            this.queueManagers.kitbash.pushPatches(id, ...kitCmds[id]);
        }
    }
}
