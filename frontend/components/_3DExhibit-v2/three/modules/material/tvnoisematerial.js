// @ts-check

import { MeshBasicNodeMaterial } from "three/webgpu";

import { Fn, vec2, vec3, dot, fract, sin, uv, uniform, sRGBTransferEOTF } from "three/tsl";

import Shared from '@3shared'

class TVNoiseMaterial extends MeshBasicNodeMaterial {
    constructor() {
        super();

        this.fog = false;

        this.uniforms = {
            uTime: uniform( 0 ).onRenderUpdate( () => Shared.timer.value ),
        };

        const uTime = this.uniforms.uTime;

        this.colorNode = Fn( () => {
            const random = fract( sin( dot( uv(), vec2( 12.9898, 78.233 ) ).add( uTime ) ).mul( 43758.543123 ) );

            // The WebGL shader wrote this grey straight to the screen.
            return sRGBTransferEOTF( vec3( random.mul( 0.3 ) ) );
        } )();

        this.userData.isShared = true;
    }
}

export default new TVNoiseMaterial()
