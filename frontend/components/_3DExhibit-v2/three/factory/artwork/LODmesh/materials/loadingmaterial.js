// @ts-check

import Emitter from "@3emitter";
import Events from "@3events";
import SpriteMaterial from "../../loader/material";
import logo from "../../loader/logo.json";

/** Reuse the resident Oncyber sprite; no network or video decoder is needed. */
export class LoadingMaterial extends SpriteMaterial {
    constructor(data, materialParams) {
        const size = [data.videoDimensions, data.dimensions].find(
            (value) =>
                Array.isArray(value) &&
                value.length >= 2 &&
                value.every(
                    (dimension) => Number.isFinite(+dimension) && +dimension > 0
                )
        ) || [960, 540];
        super({
            width: +size[0],
            height: +size[1],
            ratio: logo.frames[0].sourceSize.w / logo.frames[0].sourceSize.h,
        });
        Object.assign(this, materialParams);
        this.dimensions = { width: +size[0], height: +size[1] };
        this.isLoadingMaterial = true;
        // The atlas belongs to the engine, not to an individual artwork.
        this.uniforms.tInput.value.userData.isShared = true;
        this.startedAt = performance.now();
        this.updateFrame();
    }

    updateFrame = () => {
        const frame =
            logo.frames[
                Math.floor(((performance.now() - this.startedAt) * 24) / 1000) %
                    logo.frames.length
            ].frame;
        this.uniforms.uvs.value.set(
            frame.x / logo.meta.size.w,
            frame.y / logo.meta.size.h,
            frame.w / logo.meta.size.w,
            frame.h / logo.meta.size.h
        );
    };

    get active() {
        return this._active;
    }

    set active(value) {
        if (this._active === value) return;
        this._active = value;
        if (value) Emitter.on(Events.PRE_UPDATE, this.updateFrame);
        else Emitter.off(Events.PRE_UPDATE, this.updateFrame);
    }

    dispose() {
        this.active = false;
        super.dispose();
    }
}
