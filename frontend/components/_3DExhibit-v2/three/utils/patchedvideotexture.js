import { VideoTexture } from "three";


export class PatchedVideoTexture extends VideoTexture {
    update() {
        const video = this.image;
        if (video.paused || video.ended) {
            this.needsUpdate = false;
            return;
        }

        return super.update();
    }
}

