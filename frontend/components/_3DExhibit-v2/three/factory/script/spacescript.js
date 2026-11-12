// Retained as a fail-closed compatibility boundary for stale imports.
// Gallery custom scripts no longer execute in the first-party application.
export class SpaceScript {
    static create(_opts) {
        throw new Error("Gallery custom scripts have been retired");
    }

    constructor(_opts) {
        throw new Error("Gallery custom scripts have been retired");
    }
}
