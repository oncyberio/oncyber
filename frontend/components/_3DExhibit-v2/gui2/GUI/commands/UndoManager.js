import Emitter from "events";

export class UndoManager extends Emitter {
    //
    constructor() {
        //
        super();

        this.stack = [];

        this.index = -1;
    }

    log() {
        //
        console.log(
            this.stack
                .map((c, i) => {
                    //
                    const { info } = c;

                    const infoLabel = info?.prop
                        ? `${info.prop} ${JSON.stringify(
                              info.oldValue
                          )} -> ${JSON.stringify(info.newValue)}`
                        : info;

                    const mark = i === this.index ? "* " : "";

                    return `${mark}${infoLabel}`;
                })
                .join("\n")
        );
    }

    pushCommand(command) {
        //
        this.stack = this.stack.slice(0, this.index + 1);

        this.stack.push(command);

        this.index++;

        // this.log();
    }

    async undo() {
        //
        if (this.index < 0) {
            //
            console.log("no command to undo");

            return;
        }

        const command = this.stack[this.index];

        await command.undo();

        this.index--;

        // this.log();

        this.emit("command", { type: "undo" });
    }

    async redo() {
        //
        if (this.index === this.stack.length - 1) {
            //
            console.log("no command to redo");

            return;
        }

        const command = this.stack[this.index + 1];

        await command.redo();

        this.index++;

        // this.log();

        this.emit("command", { type: "redo" });
    }

    clearHistory() {
        //
        this.undoStack = [];

        this.redoStack = [];
    }
}
