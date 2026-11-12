// Gallery scripts are retired, including direct or stale editor callers.
// Independently published games are hosted through the isolated content host.
export class ScriptContainer {
    static create(_opts) {
        throw new Error("Gallery custom scripts have been retired");
    }

    constructor(_opts) {
        throw new Error("Gallery custom scripts have been retired");
    }
}
