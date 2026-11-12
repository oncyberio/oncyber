import { AbstractCommand } from "./AbstractCommand";
import { ExhibitCommandContext } from "./types";

export interface MultiCommandOpts {
    commands: AbstractCommand[];
    label?: string;
}

export class MultiCommand extends AbstractCommand {
    //
    constructor(context: ExhibitCommandContext, public opts: MultiCommandOpts) {
        //
        super(opts.commands[0].context);
    }

    getLabel() {
        //
        return this.opts.label || "Multi-command";
    }

    async runImpl() {
        //
        await Promise.all(
            this.opts.commands.map((command) => command.runImpl())
        );
    }

    async undo(): Promise<void> {
        //
        await Promise.all(this.opts.commands.map((command) => command.undo()));
    }

    async redo(): Promise<void> {
        //
        await Promise.all(this.opts.commands.map((command) => command.redo()));
    }
}
