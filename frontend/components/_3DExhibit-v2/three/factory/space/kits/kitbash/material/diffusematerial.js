import { MeshBasicNodeMaterial } from 'three/webgpu'

import { float as tslFloat, output, vec4 } from 'three/tsl'

import { kitPosition, timer, fogFactor } from './transform.js'

/**
 * Unlit kit material: a MeshBasicMaterial whose vertices are placed by the
 * kit instance attributes (and spun around Y for "rotate" blocks).
 * The occlusion variant dims the fogged colour by the fog factor.
 */
export default class DiffuseMaterial extends MeshBasicNodeMaterial {

    constructor(block, op, isVariant = false){

        super()

        const opts = {

            opacity: op.opacity != null ? op.opacity : 1,

            shadowSide: 2,

            side: op.side != null ? op.side : 0,

            fog : op.fog != null ? true : op.fog,

            color: op.color != null ? op.color : "#ffffff",

            alphaTest: op.alphaTest != null ? op.alphaTest : 0,

            transparent: op.transparent
        }

        this.setValues(opts)

        this.defines = {

            INSTANCE: ''
        }

        this.defines[block.name + '_instanced'] = ''

        this.uniforms = {}

        let needsRotate = block.name.includes('rotate')

        if(needsRotate){

            this.defines['ROTATING'] = ''

            this.uniforms.timer = timer
        }

        if ( this.transparent && this.opacity > 0 ) {

            this.forceSinglePass = false
        }

        this.map = op.uniforms.map.value

        this.positionNode = kitPosition( { rotateTimer: needsRotate ? timer : null } )

        this.name = block.name + '_instanced'

        if( isVariant ) return

        this.occlusionMaterial    = new DiffuseMaterial( block, op, true )

        this.mirrorMaterial       = new DiffuseMaterial( block, op, true )
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
