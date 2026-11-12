import { Scene } from "three/webgpu"

import {

    Fn,
    vec4,
    mix,
    normalize,
    output,
    reference,
    renderGroup,
    positionWorld,
    cameraPosition,
    rangeFogFactor,
    pmremTexture,
    sRGBTransferEOTF,
    sRGBTransferOETF,

} from "three/tsl"

/**
 * Oncyber's fog, as the WebGL engine drew it:
 * - mixed in display (sRGB) space, after colour conversion, not in linear;
 * - the fog colour is either the fog's colour taken as-is, or, when the fog
 *   carries a `fogTexture` (the room's PMREM'd background), the background
 *   seen along the view ray, so distant geometry dissolves into the sky.
 *
 * WebGPU materials apply fog in linear space before output conversion, so we
 * convert out, mix, and convert back. The result is identical once the
 * renderer's sRGB output conversion runs.
 */
const fogNodes = new WeakMap()

function createFogNode( fog ) {

    const near = reference( "near", "float", fog ).setGroup( renderGroup )

    const far = reference( "far", "float", fog ).setGroup( renderGroup )

    const factor = rangeFogFactor( near, far )

    return Fn( () => {

        const color = sRGBTransferOETF( output.rgb )

        let fogColor

        if( fog.fogTexture ) {

            const direction = normalize( positionWorld.sub( cameraPosition ) )

            fogColor = sRGBTransferOETF( pmremTexture( fog.fogTexture, direction, 0 ).rgb )
        }
        else {

            // The WebGL engine fed the (linear) Color straight into an sRGB-space mix.
            fogColor = reference( "color", "color", fog ).setGroup( renderGroup )
        }

        return vec4( sRGBTransferEOTF( mix( color, fogColor, factor ) ), output.a )

    } )()
}

export function getFogNode( fog ) {

    if( !fog || fog.isFogExp2 ) return null

    let node = fogNodes.get( fog )

    if( !node ) {

        node = createFogNode( fog )

        fogNodes.set( fog, node )
    }

    return node
}

let installed = false

/**
 * Scenes get their fog node from `scene.fog`, wherever the engine assigns it
 * (rooms, portals, kits, camera modes). An explicit `fogNode` still wins.
 */
export function installFog() {

    if( installed ) return

    installed = true

    Object.defineProperty( Scene.prototype, "fogNode", {

        configurable: true,

        get() {

            return this._fogNode ?? getFogNode( this.fog )
        },

        set( value ) {

            this._fogNode = value
        },
    } )
}
