// @ts-check

import { SpaceArtwork } from "@3artwork/abstract";

import Camera from "@3camera";

import { USER_INTERACTED } from "@3constants";


export class GlobalSpaceArtwork extends SpaceArtwork {

    constructor(opts) {

        super(opts);

        this.preview = opts.preview;

        this.add(this.preview)

        /** @type { HTMLAudioElement } */
        this.audio = new Audio()

        this.streamInterval = null

        this.url = "";

        // this._audioController = new AudioController({
        //     volume: opts.item.volume || 1,
        //     audioType: opts.item.audioType || AUDIO_TYPES.CONSTANT,
        //     // @ts-ignore
        //     mesh: this.raycastMesh,
        // })

        // this._audioController.setSource(this.audio)
    }

    get muted() {

        return this.audio.muted
    }

    set muted(_muted) {

        this.audio.muted = _muted
    }

    async get(opts) {

        // https://cast4.my-control-panel.com/proxy/youssef1/stream

        this.url = opts.item.data.url;

        this.audio.src = this.url

        this.audio.onplaying = this.handlePlaying

        this.audio.onplay = this.handlePlay;

        this.audio.onpause = this.handlePause;

        USER_INTERACTED.then(() => {
            //
            this.startInterval()

            this.audio.play();
        })
    }

    startInterval = () => {

        clearInterval(this.streamInterval);

        if(this.wasDisposed) return;

        this.streamInterval = setInterval(() => {

            console.log("[ AUDIO STREAM RELOADING ]")

            this.audio.src = this.url + `?[${Date.now()}]`;

            this.audio.play();
        }, 5000);
    }

    handlePlay = (opts) => {

        if(this.wasDisposed) return;

        console.log("[AUDIO STREAM play]", opts);

        this.startInterval();
    }

    handlePause = (opts) => {

        if(this.wasDisposed) return;

        console.log("[AUDIO STREAM pause]", opts);

        this.startInterval();
    }

    handlePlaying = (opts) => {

        console.log("[AUDIO STREAM playing]");

        clearInterval(this.streamInterval);
    }

    update() {

        super.update()

        this.preview.visible = Camera.isEditing;
    }

    dispose() {

        super.dispose()

        this.audio.pause()

        this.audio = null;

        clearInterval(this.streamInterval);
    }
}
