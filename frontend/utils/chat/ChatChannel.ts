import Emitter from "events";

export class ChatChannel {
    //
    private _emitter = new Emitter();

    on(event: string, listener: (...args: any[]) => void) {
        this._emitter.on(event, listener);
    }

    off(event: string, listener: (...args: any[]) => void) {
        this._emitter.off(event, listener);
    }

    _emit(event: string, ...args: any[]) {
        this._emitter.emit(event, ...args);
    }

    removeAllListeners() {
        this._emitter.removeAllListeners();
    }
}
