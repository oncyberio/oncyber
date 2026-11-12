export class ActionCommand {
    //
    constructor(payload) {
        //
        this.payload = payload;
    }

    run() {
        //
        return this.payload.run();
    }

    undo() {
        //
        return this.payload.undo();
    }

    redo() {
        //
        return this.payload.redo();
    }

    get info() {
        //
        return this.payload.info;
    }
}
