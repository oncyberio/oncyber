import { MeshStandardNodeMaterial } from 'three/webgpu'

import { float as tslFloat, normalLocal, output, vec4 } from 'three/tsl'

import { kitPosition, kitNormal, timerD2, fogFactor } from './transform.js'

/**
 * Lit kit material: a MeshStandardMaterial (metalness 0, roughness 1, no env
 * map) whose vertices and normals are placed by the kit instance attributes.
 * Shadows follow the same placement: the shadow pass reuses `positionNode`.
 * The occlusion variant dims the fogged colour by the fog factor.
 */
export default class StandardMaterial extends MeshStandardNodeMaterial {

    constructor(block, op, isVariant = false){

        super()

        const opts = {

            metalness: 0.0,

            roughness: 1.0,

            opacity: op.opacity != null ? op.opacity : 1,

            color: op.color != null ? op.color : "#ffffff",

            shadowSide: op.side != null ? op.side : 2,

            side: op.side != null ? op.side : 0,

            fog : op.fog != null ? true : op.fog,

            alphaTest: op.alphaTest != null ? op.alphaTest : 0,

            transparent: op.transparent
        }

        this.setValues(opts)

        this.defines = {

            INSTANCE: '',
        }

        this.uniforms = {}

        let needsRotate = block.name.includes('rotate')

        if(needsRotate){

            this.defines['ROTATING'] = ''

            this.uniforms.timer = timerD2
        }

        if ( this.transparent && this.opacity > 0 ) {

            this.forceSinglePass = false
        }

        this.map = op.uniforms.map.value

        this.name = block.name + '_instanced_lighting'

        this.kitTransform = { rotateTimer: needsRotate ? timerD2 : null }

        this.positionNode = kitPosition( this.kitTransform )

        this.needsEnvMap = false

        if( isVariant ) return

        this.occlusionMaterial    = new StandardMaterial( block, op, true )
    }

    setupPosition( builder ) {

        // getNormal(): the lighting normal follows the instance rotation.

        normalLocal.assign( kitNormal( this.kitTransform ) )

        return super.setupPosition( builder )
    }

    setup( builder ) {

        this.outputNode = null

        if( this.defines?.OCCLUSION !== undefined ) {

            const factor = fogFactor( this, builder )

            if( factor ) this.outputNode = vec4( output.rgb.mul( tslFloat( 1.0 ).sub( factor ) ), output.a )
        }

        super.setup( builder )
    }
}
